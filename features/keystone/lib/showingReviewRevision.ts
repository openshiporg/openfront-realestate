import type { Context } from '.keystone/types'
import { domainPayloadHash } from './domainEvents'

/**
 * Timestamp alone is not a unique version (two writes may share a millisecond).
 * Bind review to material Showing state AND append-only aggregate history count.
 * Call only after authorizing the Showing under the brokerage transaction lock.
 * Existing audit immutability is required; raw out-of-band DB writes are not an
 * admitted command path and do not acquire a guaranteed revision here.
 */
export async function showingReviewRevision(context: Context, item: any) {
  const auditCount = await context.sudo().query.DomainAuditEvent.count({ where: {
    brokerage: { id: { equals: item.brokerage.id } }, aggregateType: { equals: 'showing' }, aggregateId: { equals: item.id },
  } })
  if (!Number.isSafeInteger(auditCount) || auditCount < 0) throw new Error('Showing revision evidence is unavailable.')
  return domainPayloadHash({
    version: 1, id: item.id, brokerageId: item.brokerage.id, auditCount,
    status: item.status, updatedAt: item.updatedAt || null,
    showingType: item.showingType || null, scheduledStart: item.scheduledStart || null, scheduledEnd: item.scheduledEnd || null,
    assignedAgentId: item.assignedAgent?.id || null, leadId: item.lead?.id || null, propertyId: item.property?.id || null,
    notes: item.notes || '', feedback: item.feedback || '',
  })
}
