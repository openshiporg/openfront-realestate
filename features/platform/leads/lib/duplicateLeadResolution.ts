export type DuplicateLeadResolutionState = {
  ok: boolean
  message: string
  uncertain?: boolean
}

export type DuplicateLeadResolutionRequest = {
  primaryLeadId: string
  duplicateLeadId: string
  note: string
  idempotencyKey: string
}

type Dependencies = {
  request: (query: string, variables: Record<string, unknown>) => Promise<unknown>
  revalidate: (path: string) => void | Promise<void>
}

const MUTATION = `
  mutation ResolveDuplicateLead($data: ResolveDuplicateLeadInput!) {
    resolveDuplicateLeadCommand(data: $data) { ok message itemId replayed }
  }
`

const LEADS_PATH = '/dashboard/platform/leads'
const UNRESOLVED_MESSAGE = 'We couldn\u2019t confirm the merge. Refresh the page to check before trying again.'

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function unresolved(): DuplicateLeadResolutionState {
  return { ok: false, uncertain: true, message: UNRESOLVED_MESSAGE }
}

export async function submitDuplicateLeadResolution(
  request: DuplicateLeadResolutionRequest,
  dependencies: Dependencies,
): Promise<DuplicateLeadResolutionState> {
  let response: unknown
  try {
    response = await dependencies.request(MUTATION, {
      data: {
        primaryLeadId: request.primaryLeadId,
        duplicateLeadId: request.duplicateLeadId,
        note: request.note,
        idempotencyKey: request.idempotencyKey,
      },
    })
  } catch {
    return unresolved()
  }

  if (!record(response) || response.success !== true || !record(response.data)) return unresolved()
  const result = response.data.resolveDuplicateLeadCommand
  if (!record(result)
    || typeof result.ok !== 'boolean'
    || typeof result.message !== 'string'
    || !result.message.trim()
    || !(result.itemId === null || typeof result.itemId === 'string')
    || typeof result.replayed !== 'boolean') return unresolved()

  if (!result.ok) {
    if (result.itemId !== null || result.replayed) return unresolved()
    return { ok: false, message: result.message }
  }

  if (result.itemId !== request.primaryLeadId) return unresolved()

  try {
    await dependencies.revalidate(LEADS_PATH)
  } catch {
    return { ok: true, message: 'Duplicate resolved. Refresh to see the update.' }
  }
  return { ok: true, message: 'Duplicate resolved.' }
}
