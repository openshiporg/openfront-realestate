export type ShowingRequestState = { ok: boolean; message: string; uncertain?: boolean; requestReference?: string }

export function classifyShowingRequestResult(response: unknown): ShowingRequestState {
  const unknownResult: ShowingRequestState = {
    ok: false, uncertain: true,
    message: 'We could not confirm your request was sent. Please contact us before trying again.',
  }
  if (!response || typeof response !== 'object') return unknownResult
  const envelope = response as any
  const result = envelope.data?.requestPropertyShowing
  if (envelope.success !== true || !result || typeof result !== 'object' || Array.isArray(result)
    || typeof result.ok !== 'boolean' || typeof result.message !== 'string' || !result.message.trim()) return unknownResult
  if (!result.ok) {
    if (result.requestReference != null) return unknownResult
    return { ok: false, message: /authori|eligib|verif/i.test(result.message) ? 'This home is not accepting showing requests right now.' : result.message }
  }
  if (typeof result.requestReference !== 'string' || !/^[a-f0-9]{64}$/.test(result.requestReference)) return unknownResult
  return {
    ok: true, requestReference: result.requestReference,
    message: 'Request sent. An advisor will contact you to confirm a time.',
  }
}
