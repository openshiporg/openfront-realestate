export type LeadStatusTransitionState = {
  ok: boolean
  message: string
  uncertain?: boolean
}

export type LeadStatusTransitionRequest = {
  id: string
  status: string
  idempotencyKey: string
}

type Dependencies = {
  request: (query: string, variables: Record<string, unknown>) => Promise<unknown>
  revalidate: (path: string) => void | Promise<void>
}

const MUTATION = `
  mutation UpdateLeadStatus($id: ID!, $status: String!, $idempotencyKey: String!) {
    transitionLeadStatus(data: { id: $id, status: $status, idempotencyKey: $idempotencyKey }) {
      ok message itemId status replayed
    }
  }
`

const LEADS_PATH = '/dashboard/platform/leads'
const UNRESOLVED_MESSAGE = 'We couldn\u2019t confirm the status change. Refresh the page to check before trying again.'

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function unresolved(): LeadStatusTransitionState {
  return { ok: false, uncertain: true, message: UNRESOLVED_MESSAGE }
}

export async function submitLeadStatusTransition(
  request: LeadStatusTransitionRequest,
  dependencies: Dependencies,
): Promise<LeadStatusTransitionState> {
  let response: unknown
  try {
    response = await dependencies.request(MUTATION, {
      id: request.id,
      status: request.status,
      idempotencyKey: request.idempotencyKey,
    })
  } catch {
    return unresolved()
  }

  if (!record(response) || response.success !== true || !record(response.data)) return unresolved()
  const result = response.data.transitionLeadStatus
  if (!record(result)
    || typeof result.ok !== 'boolean'
    || typeof result.message !== 'string'
    || !result.message.trim()
    || !(result.itemId === null || (typeof result.itemId === 'string' && result.itemId.trim().length > 0))
    || !(result.status === null || (typeof result.status === 'string' && result.status.trim().length > 0))
    || typeof result.replayed !== 'boolean') return unresolved()

  if (!result.ok) {
    const deniedForRequestedLead = result.itemId === request.id && typeof result.status === 'string'
    const deniedBeforeFindingLead = result.itemId === null && result.status === null
    if (result.replayed || (!deniedForRequestedLead && !deniedBeforeFindingLead)) return unresolved()
    return { ok: false, message: result.message }
  }

  if (result.itemId !== request.id || result.status !== request.status) return unresolved()

  try {
    await dependencies.revalidate(LEADS_PATH)
  } catch {
    return { ok: true, message: 'Lead status updated. Refresh to see the update.' }
  }
  return { ok: true, message: 'Lead status updated.' }
}
