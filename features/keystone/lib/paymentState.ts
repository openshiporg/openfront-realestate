import { randomBytes } from 'node:crypto'

export type PaymentStatus = 'pending' | 'authorized' | 'captured' | 'refunded' | 'failed' | 'unknown'
export type PaymentPurpose = 'application_fee' | 'holding_deposit' | 'rent' | 'agent_fee'

export const PAYMENT_PURPOSES: PaymentPurpose[] = ['application_fee', 'holding_deposit', 'rent', 'agent_fee']
/** Purposes staff may request from a payer. Application fees come only from the listing. */
export const REQUESTABLE_PURPOSES: PaymentPurpose[] = ['holding_deposit', 'rent']
export const MAX_REQUEST_MINOR = 5_000_000

export class PaymentMismatchError extends Error {
  constructor(message: string) { super(message); this.name = 'PaymentMismatchError' }
}

/**
 * The application fee is the brokerage's own number on the Property. Nothing the
 * browser sends can change it. Null/absent means the listing takes no fee.
 */
export function applicationFeeFor(property: { listingType?: string | null; applicationFeeMinor?: number | null } | null | undefined): number | null {
  if (!property || property.listingType !== 'rent') return null
  const fee = property.applicationFeeMinor
  return typeof fee === 'number' && Number.isSafeInteger(fee) && fee > 0 ? fee : null
}

export function newAccessToken() {
  return randomBytes(24).toString('base64url')
}

/** Provider vocabulary (Stripe PaymentIntent / PayPal) to the local Payment status. */
export function mapProviderStatus(status: string | undefined | null): PaymentStatus {
  switch (String(status || '').toLowerCase()) {
    case 'succeeded': case 'paid': case 'captured': return 'captured'
    case 'requires_capture': case 'processing': case 'authorized': return 'authorized'
    case 'canceled': case 'cancelled': case 'failed': case 'expired': return 'failed'
    case 'requires_payment_method': case 'requires_action': case 'requires_confirmation': case 'pending': case 'open': case 'unpaid': return 'pending'
    default: return 'unknown'
  }
}

export function assertAmountAndCurrency(payment: { amountMinor: number; currency: string }, amount: unknown, currency: unknown) {
  if (!Number.isSafeInteger(amount)) throw new PaymentMismatchError('Provider amount is not an integer in minor units.')
  if (amount !== payment.amountMinor) throw new PaymentMismatchError('Provider amount does not match the local payment.')
  if (String(currency || '').toUpperCase() !== String(payment.currency).toUpperCase()) throw new PaymentMismatchError('Provider currency does not match the local payment.')
}

export type ProviderResult = { status: string; amount?: number | null; currency?: string | null; refundedAmount?: number | null; paymentIntentId?: string | null }

/**
 * Next local state for a provider result, or null when nothing changes.
 * Money states only move forward (captured never goes back to pending) and a
 * result whose amount or currency differs from the local record is never accepted:
 * the payment goes to `unknown` for review.
 */
export function nextPaymentState(payment: { status: PaymentStatus; amountMinor: number; currency: string; refundedMinor?: number | null }, result: ProviderResult): { status: PaymentStatus; refundedMinor?: number; paymentIntentId?: string; mismatch?: boolean } | null {
  const mapped = mapProviderStatus(result.status)
  if (mapped === 'captured' || mapped === 'authorized' || (result.refundedAmount ?? 0) > 0) {
    try {
      assertAmountAndCurrency(payment, result.amount, result.currency)
    } catch (error) {
      if (!(error instanceof PaymentMismatchError)) throw error
      return payment.status === 'unknown' ? null : { status: 'unknown', mismatch: true }
    }
  }
  const refunded = result.refundedAmount ?? 0
  let status: PaymentStatus = mapped
  if (refunded > 0 && refunded >= payment.amountMinor) status = 'refunded'
  else if (refunded > 0 && mapped === 'captured') status = 'captured'
  if (payment.status === 'refunded' && status !== 'refunded') return null
  if (payment.status === 'captured' && (status === 'pending' || status === 'authorized' || status === 'unknown')) return null
  if (payment.status === 'failed' && status === 'pending') return null
  if (payment.status === status && (refunded === (payment.refundedMinor ?? 0))) return null
  return { status, refundedMinor: refunded, ...(result.paymentIntentId ? { paymentIntentId: result.paymentIntentId } : {}) }
}

export function publicStatusMessage(status: PaymentStatus) {
  switch (status) {
    case 'captured': return 'Payment received. Thank you.'
    case 'authorized': return 'Your payment is processing. This page updates when it clears.'
    case 'refunded': return 'This payment was refunded.'
    case 'failed': return 'This payment did not go through. You have not been charged.'
    case 'unknown': return 'We could not confirm this payment yet. If you were charged, contact the brokerage with your receipt.'
    default: return 'Waiting for payment.'
  }
}

export type WebhookRefs = { sessionId?: string; intentId?: string; paymentId?: string }
export type WebhookOutcome = { refs: WebhookRefs; result: ProviderResult } | null

const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined)

/**
 * Reads a verified Stripe event into the references used to find our Payment and the
 * money facts the provider reported. Events we do not act on return null (acknowledged, ignored).
 */
export function stripeEventOutcome(event: any): WebhookOutcome {
  const object = event?.data?.object
  if (!object || typeof object !== 'object') return null
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      return {
        refs: { sessionId: text(object.id), intentId: text(object.payment_intent), paymentId: text(object.metadata?.paymentId) || text(object.client_reference_id) },
        // ACH settles later: an unpaid completed session is "processing", not money received.
        result: { status: object.payment_status === 'paid' ? 'succeeded' : 'processing', amount: object.amount_total, currency: object.currency, paymentIntentId: text(object.payment_intent) },
      }
    case 'checkout.session.async_payment_failed':
      return { refs: { sessionId: text(object.id), intentId: text(object.payment_intent), paymentId: text(object.metadata?.paymentId) || text(object.client_reference_id) }, result: { status: 'failed', paymentIntentId: text(object.payment_intent) } }
    case 'checkout.session.expired':
      return { refs: { sessionId: text(object.id), paymentId: text(object.metadata?.paymentId) || text(object.client_reference_id) }, result: { status: 'expired' } }
    case 'payment_intent.succeeded':
      return { refs: { intentId: text(object.id), paymentId: text(object.metadata?.paymentId) }, result: { status: 'succeeded', amount: object.amount_received, currency: object.currency, paymentIntentId: text(object.id) } }
    case 'payment_intent.processing':
      return { refs: { intentId: text(object.id), paymentId: text(object.metadata?.paymentId) }, result: { status: 'processing', amount: object.amount, currency: object.currency, paymentIntentId: text(object.id) } }
    case 'charge.refunded':
      return { refs: { intentId: text(object.payment_intent) }, result: { status: 'succeeded', amount: object.amount, currency: object.currency, refundedAmount: object.amount_refunded, paymentIntentId: text(object.payment_intent) } }
    default:
      return null
  }
}

export function formatMinorUsd(minor: number) {
  return `$${(minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
