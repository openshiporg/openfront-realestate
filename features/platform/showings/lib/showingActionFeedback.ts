export type ShowingActionState = {
  ok: boolean
  message: string
  uncertain?: boolean
}

export const SHOWING_STATUS_UNCONFIRMED =
  'We couldn\u2019t confirm the update. Refresh the page to check before trying again.'
export const SHOWING_FEEDBACK_UNCONFIRMED =
  'We couldn\u2019t confirm the feedback was saved. Refresh the page to check before trying again.'

function commandResult(response: unknown, field: string, hasStatus: boolean): Record<string, unknown> | null {
  if (!response || typeof response !== 'object') return null
  const envelope = response as Record<string, unknown>
  if (envelope.success !== true || !envelope.data || typeof envelope.data !== 'object') return null

  const result = (envelope.data as Record<string, unknown>)[field]
  if (!result || typeof result !== 'object') return null
  const row = result as Record<string, unknown>
  if (typeof row.ok !== 'boolean' || typeof row.message !== 'string' || !row.message.trim() || !('itemId' in row) || typeof row.replayed !== 'boolean') return null
  if (hasStatus && (!('status' in row) || (typeof row.status !== 'string' && row.status !== null))) return null
  return row
}

function uncertain(message: string): ShowingActionState {
  return { ok: false, uncertain: true, message }
}

export function classifyShowingStatusResponse(response: unknown, showingId: string, requestedStatus: string): ShowingActionState {
  const result = commandResult(response, 'transitionShowingStatus', true)
  if (!result) return uncertain(SHOWING_STATUS_UNCONFIRMED)
  if (result.itemId !== null && result.itemId !== showingId) return uncertain(SHOWING_STATUS_UNCONFIRMED)

  if (result.ok) {
    if (result.itemId !== showingId || result.status !== requestedStatus) return uncertain(SHOWING_STATUS_UNCONFIRMED)
    return { ok: true, message: result.message as string }
  }

  // A guard may run before the same-status no-op and reject even though a prior
  // request already moved this Showing to the requested target.
  if (result.itemId === showingId && result.status === requestedStatus) return uncertain(SHOWING_STATUS_UNCONFIRMED)
  return { ok: false, message: result.message as string }
}

export function classifyShowingFeedbackResponse(response: unknown, showingId: string): ShowingActionState {
  const result = commandResult(response, 'completeShowingWithFeedback', false)
  if (!result) return uncertain(SHOWING_FEEDBACK_UNCONFIRMED)
  if (result.itemId !== null && result.itemId !== showingId) return uncertain(SHOWING_FEEDBACK_UNCONFIRMED)

  if (result.ok) {
    if (result.itemId !== showingId) return uncertain(SHOWING_FEEDBACK_UNCONFIRMED)
    return { ok: true, message: result.message as string }
  }

  // A new-key retry after a lost completion response is rejected because the
  // row is already completed; that does not establish whether this feedback was saved.
  if (result.itemId === showingId && result.message === 'Cannot complete showing from completed.') {
    return uncertain(SHOWING_FEEDBACK_UNCONFIRMED)
  }
  return { ok: false, message: result.message as string }
}
