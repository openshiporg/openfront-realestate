export type CommissionTransitionFeedback =
  | { kind: 'confirmed'; message: string }
  | { kind: 'rejected'; message: string }
  | { kind: 'unconfirmed'; message: string }

export const COMMISSION_TRANSITION_UNCONFIRMED_MESSAGE =
  'We couldn\u2019t confirm the commission update. Refresh the page to check before trying again.'

export function classifyCommissionTransitionFeedback(
  response: unknown,
  commissionId: string,
  requestedStatus: string,
): CommissionTransitionFeedback {
  if (!response || typeof response !== 'object' || !('success' in response) || response.success !== true || !('data' in response)) {
    return { kind: 'unconfirmed', message: COMMISSION_TRANSITION_UNCONFIRMED_MESSAGE }
  }

  const result = (response.data as Record<string, unknown> | null)?.transitionCommissionStatus
  if (!result || typeof result !== 'object' || !('ok' in result) || typeof result.ok !== 'boolean' || !('message' in result) || typeof result.message !== 'string' || !result.message.trim()) {
    return { kind: 'unconfirmed', message: COMMISSION_TRANSITION_UNCONFIRMED_MESSAGE }
  }

  if (result.ok === false) return { kind: 'rejected', message: result.message }

  if (!('itemId' in result) || result.itemId !== commissionId || !('status' in result) || result.status !== requestedStatus) {
    return { kind: 'unconfirmed', message: COMMISSION_TRANSITION_UNCONFIRMED_MESSAGE }
  }

  return { kind: 'confirmed', message: result.message }
}
