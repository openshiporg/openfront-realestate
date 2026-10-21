import type { Context } from '.keystone/types'

export const showingTransitions: Record<string, readonly string[]> = {
  requested: ['scheduled', 'cancelled'],
  scheduled: ['completed', 'no_show', 'cancelled'],
  completed: [],
  no_show: ['scheduled'],
  cancelled: ['requested', 'scheduled'],
}

export function leadStatusAfterShowing(current: string, next: string) {
  if (next === 'scheduled' && current === 'qualified') return 'tour_scheduled'
  return current // Terminal and post-tour stages require scoped reconciliation; never infer attendance.
}

export async function reconcileLeadStatusAfterShowing(context: Context, input: {
  currentLeadStatus: string
  nextShowingStatus: string
  brokerageId?: string | null
  leadId?: string | null
  showingId?: string | null
}) {
  const { currentLeadStatus, nextShowingStatus, brokerageId, leadId, showingId } = input
  const scheduledStatus = leadStatusAfterShowing(currentLeadStatus, nextShowingStatus)
  if (scheduledStatus !== currentLeadStatus) return scheduledStatus
  if (currentLeadStatus !== 'tour_scheduled' || !['completed', 'cancelled', 'no_show'].includes(nextShowingStatus)) return currentLeadStatus
  if (!brokerageId || !leadId || !showingId) throw new Error('Showing-to-lead reconciliation requires scoped showing relationships.')

  const otherScheduledShowings = await context.sudo().query.Showing.findMany({
    where: { AND: [
      { brokerage: { id: { equals: brokerageId } } },
      { lead: { id: { equals: leadId } } },
      { status: { equals: 'scheduled' } },
      { id: { not: { equals: showingId } } },
    ] },
    take: 1,
    query: 'id',
  })
  return otherScheduledShowings.length ? 'tour_scheduled' : 'qualified'
}

export function showingInterval(startValue: unknown, durationMinutes: number, now = Date.now()) {
  const start = new Date(String(startValue || ''))
  if (!Number.isFinite(start.getTime()) || start.getTime() <= now || start.getTime() > now + 365 * 86400_000) {
    throw new Error('Choose a showing time in the future, within one year.')
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 240) {
    throw new Error('Showing duration must be between 15 and 240 minutes.')
  }
  return { scheduledStart: start.toISOString(), scheduledEnd: new Date(start.getTime() + durationMinutes * 60_000).toISOString() }
}

/** Serialized by the brokerage command lock; requests do not reserve a slot. */
export async function requireAvailableShowingSlot(context: Context, input: {
  brokerageId: string; propertyId: string; agentId: string; scheduledStart: string; scheduledEnd: string; excludeId?: string
}) {
  const start = new Date(input.scheduledStart), end = new Date(input.scheduledEnd)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end.getTime() - start.getTime() > 240 * 60_000) {
    throw new Error('A valid showing start and end are required.')
  }
  const conflicts = await context.sudo().query.Showing.findMany({
    where: { AND: [
      { brokerage: { id: { equals: input.brokerageId } }, status: { equals: 'scheduled' } },
      { OR: [{ property: { id: { equals: input.propertyId } } }, { assignedAgent: { id: { equals: input.agentId } } }] },
      { scheduledStart: { lt: input.scheduledEnd } },
      { OR: [
        { scheduledEnd: { gt: input.scheduledStart } },
        // Legacy records with no end conservatively reserve the maximum duration.
        { scheduledEnd: { equals: null }, scheduledStart: { gt: new Date(start.getTime() - 240 * 60_000).toISOString() } },
      ] },
      ...(input.excludeId ? [{ id: { not: { equals: input.excludeId } } }] : []),
    ] },
    take: 1,
    query: 'id',
  })
  if (conflicts.length) throw new Error('The property or advisor already has a confirmed showing during this time. Choose another time.')
}
