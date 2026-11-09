import type { Context } from '.keystone/types'

import { activeBrokerageIds } from '../access'
import { enqueueDomainEvent } from '../lib/domainEvents'
import { newAccessToken, formatMinorUsd, nextPaymentState, applicationFeeFor, publicStatusMessage, REQUESTABLE_PURPOSES, MAX_REQUEST_MINOR, stripeEventOutcome, assertAmountAndCurrency, PaymentMismatchError, type PaymentPurpose, type PaymentStatus } from '../lib/paymentState'
import { leadIdentityKey } from './leadCapture'
import { runControlledEvidenceCommand } from './controlledEvidenceCommand'
import { submitListingInquiry } from './submitListingInquiry'
import { createPayment, getPaymentStatus, handleWebhook, refundPayment } from '../utils/paymentProviderAdapter'
import { isPaymentProviderConfigured } from '../utils/paymentProviderConfig'
import { commandText as clean } from '../../lib/date-time'

const PROVIDER_QUERY = 'id code name isInstalled credentials createPaymentFunction capturePaymentFunction refundPaymentFunction getPaymentStatusFunction generatePaymentLinkFunction handleWebhookFunction brokerage { id status }'
const PAYMENT_QUERY = `id purpose status amountMinor currency providerPaymentId providerPaymentIntentId idempotencyKey accessToken payerName payerEmail checkoutUrl paidAt refundedMinor
  brokerage { id name slug status } paymentProvider { id } property { id title } lead { id name email } deal { id }`

const asPayment = (value: any) => value as { idempotencyKey: string; id: string; purpose: PaymentPurpose; status: PaymentStatus; amountMinor: number; currency: string; providerPaymentId: string | null; providerPaymentIntentId: string | null; accessToken: string; payerName: string | null; payerEmail: string | null; checkoutUrl: string | null; paidAt: string | null; refundedMinor: number | null; brokerage: { id: string; name: string; slug: string; status: string }; paymentProvider: { id: string } | null; property: { id: string; title: string } | null; lead: { id: string; name: string; email: string } | null; deal: { id: string } | null }

function validToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{20,80}$/.test(token)
}

/** Public origin for return and payment links. Env wins; otherwise the request's own host. */
export function publicBaseUrl(context: Context) {
  const configured = process.env.PUBLIC_APP_URL || process.env.SMTP_STORE_LINK
  if (configured) return configured.replace(/\/+$/, '')
  const headers = ((context as any).req?.headers || {}) as Record<string, string | string[] | undefined>
  const first = (value: string | string[] | undefined) => String(Array.isArray(value) ? value[0] : value || '').split(',')[0].trim()
  const host = first(headers['x-forwarded-host']) || first(headers.host)
  const proto = first(headers['x-forwarded-proto']) || (/^(localhost|127\.)/.test(host) ? 'http' : 'https')
  if (!host || !/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) throw new Error('Public URL is not configured')
  return `${proto}://${host}`
}

/** The brokerage's online provider: installed, configured, and able to host a checkout (not manual). */
async function onlineProvider(context: Context, brokerageId: string) {
  const providers = await context.sudo().query.PaymentProvider.findMany({
    where: { brokerage: { id: { equals: brokerageId } }, isInstalled: { equals: true } },
    orderBy: [{ createdAt: 'asc' }], take: 20, query: PROVIDER_QUERY,
  })
  const usable = [...providers].filter((provider: any) => provider.createPaymentFunction !== 'manual' && isPaymentProviderConfigured(provider))
  return usable.find((provider: any) => String(provider.code).startsWith('pp_stripe')) || usable[0] || null
}

async function loadByToken(context: Context, token: unknown) {
  if (!validToken(token)) return null
  const rows = await context.sudo().query.Payment.findMany({ where: { accessToken: { equals: token } }, take: 1, query: PAYMENT_QUERY })
  const payment = rows[0] ? asPayment(rows[0]) : null
  return payment && payment.brokerage?.status === 'active' ? payment : null
}

function describe(payment: ReturnType<typeof asPayment>) {
  const label = { application_fee: 'Rental application fee', holding_deposit: 'Holding deposit', rent: 'Rent', agent_fee: 'Agent fee' }[payment.purpose]
  return payment.property ? `${label} · ${payment.property.title}` : label
}

function publicView(payment: ReturnType<typeof asPayment>) {
  return {
    token: payment.accessToken,
    purpose: payment.purpose,
    status: payment.status,
    statusMessage: publicStatusMessage(payment.status),
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    description: describe(payment),
    brokerageName: payment.brokerage.name,
    propertyTitle: payment.property?.title || '',
    payerName: payment.payerName || payment.lead?.name || '',
    paidAt: payment.paidAt || null,
    canPay: ['pending', 'failed'].includes(payment.status),
  }
}

export async function paymentByToken(_root: unknown, { token }: { token: string }, context: Context) {
  const payment = await loadByToken(context, token)
  return payment ? publicView(payment) : null
}

async function providerFor(context: Context, payment: ReturnType<typeof asPayment>) {
  if (!payment.paymentProvider?.id) return null
  const provider: any = await context.sudo().query.PaymentProvider.findOne({ where: { id: payment.paymentProvider.id }, query: PROVIDER_QUERY })
  return provider && provider.brokerage?.id === payment.brokerage.id && provider.isInstalled ? provider : null
}

/**
 * Applies a provider result to the local payment under a row lock. Nothing moves money
 * backwards, and an amount/currency that differs from our record parks the payment as `unknown`.
 */
async function applyProviderResult(context: Context, paymentId: string, result: Parameters<typeof nextPaymentState>[1], actor: { eventKey: string; actorId?: string | null }) {
  return context.transaction(async tx => {
    await applyInTransaction(tx, paymentId, result, actor.eventKey, actor.actorId)
    const current = await tx.sudo().query.Payment.findOne({ where: { id: paymentId }, query: PAYMENT_QUERY })
    return current ? asPayment(current) : null
  }, { timeout: 30_000 })
}

/** Asks the provider what happened and settles the local record from that answer. */
async function reconcile(context: Context, payment: ReturnType<typeof asPayment>, source: string, actorId?: string | null) {
  if (!payment.providerPaymentId) return payment
  const provider = await providerFor(context, payment)
  if (!provider) return payment
  let result
  try {
    result = await getPaymentStatus({ provider, paymentId: payment.providerPaymentId })
  } catch {
    return payment
  }
  return (await applyProviderResult(context, payment.id, result, { eventKey: source, actorId })) || payment
}

export async function reconcilePaymentByToken(_root: unknown, { token }: { token: string }, context: Context) {
  const payment = await loadByToken(context, token)
  if (!payment) return null
  return publicView(await reconcile(context, payment, `return:${Date.now()}`))
}

/** Starts (or resumes) the hosted checkout for a pending payment. The amount is the stored one, never an input. */
export async function beginPaymentCheckout(_root: unknown, { token }: { token: string }, context: Context) {
  const payment = await loadByToken(context, token)
  if (!payment) return { ok: false, message: 'This payment link is not valid.', url: null, token: null }
  const settled = await reconcile(context, payment, `begin:${Date.now()}`)
  if (settled.status === 'captured') return { ok: true, message: publicStatusMessage('captured'), url: null, token: settled.accessToken }
  if (!['pending', 'failed'].includes(settled.status)) return { ok: false, message: publicStatusMessage(settled.status), url: null, token: settled.accessToken }
  const provider = await providerFor(context, settled)
  if (!provider || provider.createPaymentFunction === 'manual' || !isPaymentProviderConfigured(provider)) return { ok: false, message: 'Online payment is not available right now. Please contact the brokerage.', url: null, token: settled.accessToken }

  // A still-open hosted session is reused; otherwise a new attempt gets its own idempotency scope.
  if (settled.status === 'pending' && settled.providerPaymentId) {
    try {
      const status = await getPaymentStatus({ provider, paymentId: settled.providerPaymentId }) as any
      if (status.url) return { ok: true, message: 'Continue to secure checkout.', url: status.url as string, token: settled.accessToken }
    } catch { /* fall through to a fresh session */ }
  }
  const attempt = settled.providerPaymentId ? `:retry-${Date.now()}` : ''
  const base = publicBaseUrl(context)
  const page = `${base}/pay/${settled.accessToken}`
  try {
    const created: any = await createPayment({
      provider,
      payment: { id: settled.id, purpose: settled.purpose, description: describe(settled), customerEmail: settled.payerEmail || settled.lead?.email || undefined, successUrl: `${page}?checkout=return`, cancelUrl: `${page}?checkout=cancelled` },
      amount: settled.amountMinor, currency: settled.currency, idempotencyKey: `${settled.idempotencyKey}${attempt}`,
    })
    assertAmountAndCurrency(settled, created.amount, created.currency)
    if (!created.id || !created.url) throw new Error('Provider did not return a checkout')
    await context.sudo().query.Payment.updateOne({ where: { id: settled.id }, data: { providerPaymentId: String(created.id), checkoutUrl: String(created.url), status: 'pending' }, query: 'id' })
    return { ok: true, message: 'Continue to secure checkout.', url: String(created.url) as string, token: settled.accessToken }
  } catch (error) {
    // The provider may have created the session even though we did not hear back: park it for reconciliation.
    const mismatch = error instanceof PaymentMismatchError
    await context.sudo().query.Payment.updateOne({ where: { id: settled.id }, data: { status: 'unknown' }, query: 'id' })
    return { ok: false, message: mismatch ? 'This payment could not be started. Please contact the brokerage.' : 'We could not start checkout. Please try again in a moment.', url: null, token: settled.accessToken }
  }
}

type StartInput = { brokerageSlug: string; propertyId: string; name: string; email?: string | null; phone?: string | null; message?: string | null }

/**
 * "Apply" on a rental listing: capture the lead through the existing inquiry flow, then record
 * a Payment(application_fee) at the amount stored on the Property. The browser never sends an amount.
 */
export async function startApplicationFeeCheckout(root: unknown, { data }: { data: StartInput }, context: Context) {
  const fail = (message: string) => ({ ok: false, message, url: null, token: null })
  const brokerageSlug = clean(data.brokerageSlug).toLowerCase(), propertyId = clean(data.propertyId)
  const name = clean(data.name), email = clean(data.email).toLowerCase(), phone = clean(data.phone)
  if (!propertyId || propertyId.length > 200 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(brokerageSlug) || brokerageSlug.length > 80) return fail('Choose a listing before applying.')
  if (!name || name.length > 120 || (!email && !phone)) return fail('Add your name and an email or phone number.')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Enter a valid email address.')

  const sudo = context.sudo()
  const property: any = (await sudo.query.Property.findMany({
    where: { id: { equals: propertyId }, brokerage: { slug: { equals: brokerageSlug }, status: { equals: 'active' } }, status: { in: ['active', 'coming_soon'] } },
    take: 1, query: 'id title listingType applicationFeeMinor brokerage { id }',
  }))[0]
  const fee = applicationFeeFor(property)
  if (!property || !fee) return fail('This listing is not taking applications online.')
  const provider = await onlineProvider(context, property.brokerage.id)
  if (!provider) return fail('Online payment is not available for this listing yet. Please contact the agent.')

  const inquiry = await submitListingInquiry(root, { data: { brokerageSlug, propertyId, name, email, phone, intent: 'rent', message: clean(data.message) || 'Rental application', preferredTime: '' } }, context)
  if (!inquiry.ok) return fail(inquiry.message)
  const identityKey = leadIdentityKey(email, phone)
  const lead: any = identityKey ? (await sudo.query.Lead.findMany({ where: { identityKey: { equals: identityKey }, property: { id: { equals: propertyId } }, status: { notIn: ['closed', 'lost'] } }, orderBy: [{ createdAt: 'asc' }], take: 1, query: 'id' }))[0] : null
  if (!lead) return fail('We could not record your application. Please try again.')

  const payment = await context.transaction(async tx => {
    const scoped = tx.sudo()
    await tx.prisma.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `application-fee:${propertyId}:${lead.id}`)
    const existing = await scoped.query.Payment.findMany({ where: { lead: { id: { equals: lead.id } }, property: { id: { equals: propertyId } }, purpose: { equals: 'application_fee' }, status: { in: ['pending', 'authorized', 'captured', 'unknown'] } }, orderBy: [{ createdAt: 'desc' }], take: 10, query: 'id status accessToken amountMinor' })
    const settled = existing.find((item: any) => ['captured', 'authorized'].includes(item.status))
    if (settled) return { token: settled.accessToken as string, already: true }
    const reusable = existing.find((item: any) => item.status === 'pending' && item.amountMinor === fee)
    if (reusable) return { token: reusable.accessToken as string, already: false }
    const token = newAccessToken()
    await scoped.query.Payment.createOne({
      data: {
        brokerage: { connect: { id: property.brokerage.id } }, paymentProvider: { connect: { id: provider.id } },
        property: { connect: { id: propertyId } }, lead: { connect: { id: lead.id } },
        purpose: 'application_fee', status: 'pending', amountMinor: fee, currency: 'USD',
        idempotencyKey: `application_fee:${lead.id}:${propertyId}:${token.slice(0, 12)}`, accessToken: token,
        payerName: name, payerEmail: email,
      },
      query: 'id',
    })
    return { token, already: false }
  }, { timeout: 30_000 })

  if (payment.already) return { ok: true, message: 'Your application fee is already paid.', url: null, token: payment.token }
  return beginPaymentCheckout(root, { token: payment.token }, context)
}

// ── Staff commands ────────────────────────────────────────────────────────────

function staffCan(context: Context, brokerageId: string, permission: string, ownerId?: string | null) {
  const session = context.session as any
  const role = session?.data?.role || {}
  if (!session?.itemId || !role[permission] || !activeBrokerageIds(session).includes(brokerageId)) return false
  return Boolean(role.canManagePeople || !ownerId || ownerId === session.itemId)
}

/** "Request payment" on a Lead or Deal: records a Payment at the staff-entered amount and returns a pay link. */
export async function requestPaymentCommand(_root: unknown, { data }: { data: { leadId: string; dealId?: string | null; purpose: string; amountMinor: number; description?: string | null; idempotencyKey: string | null } }, context: Context) {
  const leadId = clean(data.leadId), dealId = clean(data.dealId), purpose = clean(data.purpose) as PaymentPurpose, key = clean(data.idempotencyKey)
  const amountMinor = data.amountMinor
  if (!leadId || !key || key.length > 120 || !REQUESTABLE_PURPOSES.includes(purpose) || !Number.isSafeInteger(amountMinor) || amountMinor < 1 || amountMinor > MAX_REQUEST_MINOR) {
    return { ok: false, message: 'Choose a lead, a purpose, and an amount between $0.01 and $50,000.', itemId: null, url: null, replayed: false }
  }
  const result: any = await runControlledEvidenceCommand(context, {
    eventKey: `command:lead:${leadId}:request-payment:${key}`, lockKey: `aggregate:lead:${leadId}`, permission: 'canManageLeads',
    request: { leadId, dealId, purpose, amountMinor },
    execute: async scoped => {
      const sudo = scoped.sudo() as any
      const lead = await sudo.query.Lead.findOne({ where: { id: leadId }, query: 'id name email brokerage { id name } assignedAgent { id } property { id title }' })
      if (!lead || !staffCan(scoped, lead.brokerage?.id, 'canManageLeads', lead.assignedAgent?.id)) return { result: { ok: false, message: 'Lead not found or access denied.', itemId: null, url: null }, event: null as never }
      let propertyId: string | null = lead.property?.id || null
      if (dealId) {
        const deal = await sudo.query.Deal.findOne({ where: { id: dealId }, query: 'id lead { id } property { id } brokerage { id }' })
        if (!deal || deal.brokerage?.id !== lead.brokerage.id || deal.lead?.id !== leadId) return { result: { ok: false, message: 'That deal does not belong to this lead.', itemId: null, url: null }, event: null as never }
        propertyId = deal.property?.id || propertyId
      }
      const provider = await onlineProvider(scoped, lead.brokerage.id)
      if (!provider) return { result: { ok: false, message: 'Add and configure a payment provider before requesting payments.', itemId: null, url: null }, event: null as never }
      const token = newAccessToken()
      const payment = await sudo.query.Payment.createOne({
        data: {
          brokerage: { connect: { id: lead.brokerage.id } }, paymentProvider: { connect: { id: provider.id } }, lead: { connect: { id: leadId } },
          ...(propertyId ? { property: { connect: { id: propertyId } } } : {}), ...(dealId ? { deal: { connect: { id: dealId } } } : {}),
          purpose, status: 'pending', amountMinor, currency: 'USD', idempotencyKey: `${purpose}:${leadId}:${key}`, accessToken: token,
          payerName: lead.name, payerEmail: lead.email || '',
        },
        query: 'id',
      })
      const url = `${publicBaseUrl(scoped)}/pay/${token}`
      const outcome = { ok: true, message: 'Payment requested. Share the link with the payer.', itemId: payment.id, url }
      return { result: outcome, event: { eventType: 'payment.requested', brokerageId: lead.brokerage.id, aggregateType: 'payment', aggregateId: payment.id, actorId: (scoped.session as any).itemId, action: 'request_payment', before: null, after: { ...outcome, paymentId: payment.id, purpose, amountMinor, currency: 'USD', leadId, dealId: dealId || null } } }
    },
  })
  return result
}

/** "Check status": staff ask the provider, and the local record follows the provider's answer. */
export async function reconcilePaymentCommand(_root: unknown, { paymentId }: { paymentId: string }, context: Context) {
  const session = context.session as any
  if (!session?.itemId || !paymentId || paymentId.length > 200) return { ok: false, message: 'Access denied.', itemId: null, url: null, replayed: false }
  const row: any = await context.sudo().query.Payment.findOne({ where: { id: paymentId }, query: PAYMENT_QUERY })
  const payment = row ? asPayment(row) : null
  if (!payment || !staffCan(context, payment.brokerage.id, 'canManageLeads', null) && !staffCan(context, payment.brokerage.id, 'canManageDeals', null)) return { ok: false, message: 'Payment not found or access denied.', itemId: null, url: null, replayed: false }
  if (!payment.providerPaymentId) return { ok: true, message: 'No checkout has been started for this payment yet.', itemId: payment.id, url: null, replayed: false }
  const provider = await providerFor(context, payment)
  if (!provider) return { ok: false, message: 'The payment provider for this payment is not available.', itemId: payment.id, url: null, replayed: false }
  try {
    const result = await getPaymentStatus({ provider, paymentId: payment.providerPaymentId })
    const updated = await applyProviderResult(context, payment.id, result, { eventKey: `check:${Date.now()}`, actorId: session.itemId })
    return { ok: true, message: `Status: ${updated?.status || payment.status}.`, itemId: payment.id, url: null, replayed: false }
  } catch {
    return { ok: false, message: 'The provider could not be reached. Try again shortly.', itemId: payment.id, url: null, replayed: false }
  }
}

/**
 * "Refund" on a captured payment: refunds what is still unrefunded through the payment's own provider,
 * then settles the local record from the provider's answer (the charge.refunded webhook agrees later).
 * The amount is never an input; the idempotency key is bound to the payment and the refundable amount,
 * so a double click or retry cannot refund twice.
 */
export async function refundPaymentCommand(_root: unknown, { paymentId }: { paymentId: string }, context: Context) {
  const session = context.session as any
  if (!session?.itemId || !paymentId || paymentId.length > 200) return { ok: false, message: 'Access denied.', itemId: null, url: null, replayed: false }
  const row: any = await context.sudo().query.Payment.findOne({ where: { id: paymentId }, query: PAYMENT_QUERY })
  const payment = row ? asPayment(row) : null
  if (!payment || !staffCan(context, payment.brokerage.id, 'canManageDeals', null) && !staffCan(context, payment.brokerage.id, 'canManageLeads', null)) return { ok: false, message: 'Payment not found or access denied.', itemId: null, url: null, replayed: false }
  if (payment.status === 'refunded') return { ok: true, message: 'This payment is already refunded.', itemId: payment.id, url: null, replayed: true }
  if (payment.status !== 'captured') return { ok: false, message: 'Only paid payments can be refunded.', itemId: payment.id, url: null, replayed: false }
  const provider = await providerFor(context, payment)
  if (!provider) return { ok: false, message: 'The payment provider for this payment is not available.', itemId: payment.id, url: null, replayed: false }
  let intentId = payment.providerPaymentIntentId
  if (!intentId && payment.providerPaymentId) {
    try {
      const status: any = await getPaymentStatus({ provider, paymentId: payment.providerPaymentId })
      intentId = status?.paymentIntentId || null
    } catch { /* handled below */ }
  }
  const amount = payment.amountMinor - (payment.refundedMinor || 0)
  if (!intentId || amount < 1) return { ok: false, message: 'The provider payment could not be found. Use Check status, then try again.', itemId: payment.id, url: null, replayed: false }
  try {
    await refundPayment({ provider, paymentId: intentId, amount, currency: payment.currency, idempotencyKey: `refund:${payment.id}:${amount}` })
  } catch {
    return { ok: false, message: 'The provider did not accept the refund. Nothing was changed.', itemId: payment.id, url: null, replayed: false }
  }
  const updated = await reconcile(context, payment, `refund:${Date.now()}`, session.itemId)
  return { ok: true, message: updated.status === 'refunded' ? 'Refunded in full.' : 'Refund sent. The status updates when the provider confirms it.', itemId: payment.id, url: null, replayed: false }
}

// ── Webhook ingress ───────────────────────────────────────────────────────────

export type WebhookResult = { status: number; body: Record<string, unknown> }

/**
 * Verifies the provider signature over the raw body, dedupes durably on (provider, event id), correlates the
 * event to our Payment, asserts amount and currency, then settles. Everything after verification is one
 * transaction, so a failure rolls the dedupe record back and the provider's retry is processed.
 */
export async function handlePaymentProviderWebhook(context: Context, providerId: string, rawBody: string, headers: Record<string, string>): Promise<WebhookResult> {
  if (!providerId || providerId.length > 200) return { status: 404, body: { error: 'Unknown provider' } }
  const provider: any = await context.sudo().query.PaymentProvider.findOne({ where: { id: providerId }, query: PROVIDER_QUERY })
  if (!provider || !provider.isInstalled) return { status: 404, body: { error: 'Unknown provider' } }
  let verified: any
  try {
    verified = await handleWebhook({ provider, event: undefined, headers, rawBody })
  } catch {
    return { status: 400, body: { error: 'Signature verification failed' } }
  }
  const event = verified?.event
  if (!verified?.isValid || !event?.id || typeof event.id !== 'string') return { status: 400, body: { error: 'Invalid event' } }
  const eventKey = `${provider.id}:${event.id}`.slice(0, 240)

  try {
    return await context.transaction(async tx => {
      const sudo = tx.sudo()
      await tx.prisma.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `payment-event:${eventKey}`)
      if (await sudo.query.PaymentWebhookReceipt.findOne({ where: { eventKey }, query: 'id' })) return { status: 200, body: { received: true, duplicate: true } }
      const outcome = stripeEventOutcome(event)
      let handled = 'ignored'
      if (outcome) {
        const { refs, result } = outcome
        const candidates: any[] = []
        for (const [field, value] of [['providerPaymentId', refs.sessionId], ['providerPaymentIntentId', refs.intentId], ['id', refs.paymentId]] as const) {
          if (!value) continue
          const rows = await sudo.query.Payment.findMany({ where: { [field]: { equals: value }, paymentProvider: { id: { equals: provider.id } } }, take: 2, query: 'id providerPaymentId' })
          candidates.push(...rows)
        }
        const ids = [...new Set(candidates.map(item => item.id))]
        // Correlation must be unambiguous, and an explicit session reference must agree with the record.
        const payment = ids.length === 1 ? candidates[0] : null
        if (payment && refs.sessionId && payment.providerPaymentId && payment.providerPaymentId !== refs.sessionId) handled = 'uncorrelated'
        else if (payment) {
          await applyInTransaction(tx, payment.id, result, eventKey)
          handled = 'applied'
        } else handled = 'unmatched'
      }
      await sudo.query.PaymentWebhookReceipt.createOne({ data: { eventKey, eventType: String(event.type || '').slice(0, 120), outcome: handled }, query: 'id' })
      return { status: 200, body: { received: true, outcome: handled } }
    }, { timeout: 30_000 })
  } catch {
    return { status: 500, body: { error: 'Webhook could not be processed' } }
  }
}

/** Same settlement as applyProviderResult, inside the caller's transaction. */
async function applyInTransaction(tx: Context, paymentId: string, result: Parameters<typeof nextPaymentState>[1], eventKey: string, actorId?: string | null) {
  await tx.prisma.$executeRawUnsafe('SELECT "id" FROM "Payment" WHERE "id" = $1 FOR NO KEY UPDATE', paymentId)
  const sudo = tx.sudo()
  const payment = asPayment(await sudo.query.Payment.findOne({ where: { id: paymentId }, query: PAYMENT_QUERY }))
  const next = nextPaymentState({ status: payment.status, amountMinor: payment.amountMinor, currency: payment.currency, refundedMinor: payment.refundedMinor }, result)
  if (!next) return
  const now = new Date().toISOString()
  await sudo.query.Payment.updateOne({
    where: { id: paymentId },
    data: {
      status: next.status,
      ...(next.refundedMinor !== undefined ? { refundedMinor: next.refundedMinor } : {}),
      ...(next.paymentIntentId && !payment.providerPaymentIntentId ? { providerPaymentIntentId: next.paymentIntentId } : {}),
      ...(next.status === 'captured' && !payment.paidAt ? { paidAt: now } : {}),
      lastCheckedAt: now,
    },
    query: 'id',
  })
  if (next.status === payment.status) return
  if (payment.lead && ['captured', 'refunded', 'unknown'].includes(next.status)) {
    await sudo.query.LeadActivity.createOne({
      data: {
        brokerage: { connect: { id: payment.brokerage.id } }, lead: { connect: { id: payment.lead.id } },
        ...(payment.property ? { property: { connect: { id: payment.property.id } } } : {}),
        activityType: 'system', direction: 'inbound', channel: 'website',
        subject: next.status === 'captured' ? `${describe(payment)} paid` : next.status === 'refunded' ? `${describe(payment)} refunded` : `${describe(payment)} needs review`,
        body: `${(payment.amountMinor / 100).toFixed(2)} ${payment.currency} · payment ${payment.id}`,
        occurredAt: now,
      },
      query: 'id',
    })
  }
  await enqueueDomainEvent(sudo, {
    eventKey: `payment:${paymentId}:${next.status}:${eventKey}`, eventType: `payment.${next.status}`, brokerageId: payment.brokerage.id,
    aggregateType: 'payment', aggregateId: paymentId, actorId: actorId || null, action: `payment_${next.status}`,
    request: { source: eventKey }, before: { status: payment.status }, after: { status: next.status, amountMinor: payment.amountMinor, currency: payment.currency, purpose: payment.purpose },
  })
}
