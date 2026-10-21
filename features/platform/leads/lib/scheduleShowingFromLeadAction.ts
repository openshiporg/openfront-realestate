export type ScheduleShowingActionState = {
  ok: boolean
  message: string
  uncertain?: boolean
  attempt?: ScheduleShowingRequest
}

export type ScheduleShowingRequest = {
  originalActorId?: string
  originalBrokerageId?: string
  leadId: string
  propertyId: string
  assignedAgentId: string | null
  scheduledStart: string
  notes: string
  idempotencyKey: string
}

type Dependencies = {
  request: (query: string, variables: Record<string, unknown>) => Promise<unknown>
  revalidate: (path: string) => void | Promise<void>
}

const SCHEDULE_MUTATION = `
  mutation ScheduleShowing($data: ScheduleShowingForLeadInput!) {
    scheduleShowingForLeadCommand(data: $data) { ok message itemId replayed }
  }
`

// Retained historical exact-ID reader for compatibility tests/older consumers.
const VERIFY_SHOWING_QUERY = `
  query VerifyScheduledShowing($where: ShowingWhereUniqueInput!) {
    showing(where: $where) { id lead { id } property { id } }
  }
`
// Current action uses this minimal owned contract, not an elevated raw read.
const OWNED_RECEIPT_QUERY = `
  query VerifyScheduledShowing($data: ScheduleShowingForLeadInput!) {
    scheduledShowingReceipt(data: $data) { version showingId leadId propertyId }
  }
`

const LEADS_PATH = '/dashboard/platform/leads'
const SHOWINGS_PATH = '/dashboard/platform/showings'
const UNRESOLVED_MESSAGE = 'We couldn\u2019t confirm the showing. Refresh the page to check before trying again.'

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function unresolvedOutcome(attempt?: ScheduleShowingRequest): ScheduleShowingActionState {
  return { ok: false, uncertain: true, message: UNRESOLVED_MESSAGE, ...(attempt ? { attempt } : {}) }
}

export async function submitScheduleShowingFromLead(
  request: ScheduleShowingRequest,
  dependencies: Dependencies,
  ownedReceipt = false,
): Promise<ScheduleShowingActionState> {
  const unresolved = () => unresolvedOutcome(ownedReceipt ? request : undefined)
  let mutationResponse: unknown
  try {
    mutationResponse = await dependencies.request(SCHEDULE_MUTATION, {
      data: {
        leadId: request.leadId,
        propertyId: request.propertyId,
        assignedAgentId: request.assignedAgentId,
        scheduledStart: request.scheduledStart,
        notes: request.notes,
        idempotencyKey: request.idempotencyKey,
        ...(request.originalActorId === undefined && request.originalBrokerageId === undefined ? {} : {
          originalActorId: request.originalActorId, originalBrokerageId: request.originalBrokerageId,
        }),
      },
    })
  } catch {
    return unresolved()
  }

  if (!record(mutationResponse) || mutationResponse.success !== true || !record(mutationResponse.data)) return unresolved()
  const result = mutationResponse.data.scheduleShowingForLeadCommand
  if (!record(result)
    || typeof result.ok !== 'boolean'
    || typeof result.message !== 'string'
    || !result.message.trim()
    || !(result.itemId === null || (typeof result.itemId === 'string' && result.itemId.trim().length > 0))
    || typeof result.replayed !== 'boolean') return unresolved()

  if (!result.ok) {
    if (result.itemId !== null || result.replayed) return unresolved()
    return { ok: false, message: result.message }
  }

  if (typeof result.itemId !== 'string' || !result.itemId.trim()) return unresolved()

  let verificationResponse: unknown
  try {
    verificationResponse = ownedReceipt
      ? await dependencies.request(OWNED_RECEIPT_QUERY, { data: request })
      : await dependencies.request(VERIFY_SHOWING_QUERY, { where: { id: result.itemId } })
  } catch {
    return unresolved()
  }

  if (!record(verificationResponse) || verificationResponse.success !== true || !record(verificationResponse.data)) return unresolved()
  if (ownedReceipt) {
    const receipt = verificationResponse.data.scheduledShowingReceipt
    if (!record(receipt) || receipt.version !== 1 || receipt.showingId !== result.itemId
      || receipt.leadId !== request.leadId || receipt.propertyId !== request.propertyId) return unresolved()
  } else {
    const showing = verificationResponse.data.showing
    if (!record(showing) || showing.id !== result.itemId || !record(showing.lead)
      || showing.lead.id !== request.leadId || !record(showing.property)
      || showing.property.id !== request.propertyId) return unresolved()
  }

  try {
    await dependencies.revalidate(LEADS_PATH)
    await dependencies.revalidate(SHOWINGS_PATH)
  } catch {
    return { ok: true, message: 'Showing scheduled. Refresh to see the update.' }
  }
  return { ok: true, message: 'Showing scheduled.' }
}

/** Recovery is READ ONLY: no mutation, UUID rotation or changed payload. */
export async function verifyOwnedShowingSchedule(request: ScheduleShowingRequest, dependencies: Dependencies): Promise<ScheduleShowingActionState> {
  if (!record(request) || !(['leadId', 'propertyId', 'scheduledStart', 'notes', 'idempotencyKey'] as const).every(key => typeof request[key] === 'string')
    || !(request.assignedAgentId === null || typeof request.assignedAgentId === 'string')) return unresolvedOutcome()
  try {
    const response = await dependencies.request(OWNED_RECEIPT_QUERY, { data: request })
    if (!record(response) || response.success !== true || !record(response.data)) return unresolvedOutcome(request)
    const receipt = response.data.scheduledShowingReceipt
    if (!record(receipt) || receipt.version !== 1 || typeof receipt.showingId !== 'string' || !receipt.showingId.trim()
      || receipt.leadId !== request.leadId || receipt.propertyId !== request.propertyId) return unresolvedOutcome(request)
  } catch {
    return unresolvedOutcome(request)
  }
  try {
    await dependencies.revalidate(LEADS_PATH)
    await dependencies.revalidate(SHOWINGS_PATH)
  } catch {
    return { ok: true, message: 'Showing confirmed. Refresh to see the update.' }
  }
  return { ok: true, message: 'Showing confirmed.' }
}
