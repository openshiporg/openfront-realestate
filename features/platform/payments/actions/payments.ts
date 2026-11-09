'use server'

import { revalidatePath } from 'next/cache'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { getActiveBrokerageId, runRecordMutation, text, type RecordResult } from '../../lib/records'

const PROVIDERS = '/dashboard/platform/payment-providers'
const PAYMENTS = '/dashboard/platform/payments'

const adapterFunctions = (adapter: string) => ({
  createPaymentFunction: adapter, capturePaymentFunction: adapter, refundPaymentFunction: adapter,
  getPaymentStatusFunction: adapter, generatePaymentLinkFunction: adapter, handleWebhookFunction: adapter,
})

/** One provider record per provider; its credentials are write-only and never read back. */
export async function savePaymentProvider(_state: RecordResult, form: FormData): Promise<RecordResult> {
  const kind = text(form, 'kind')
  if (!['stripe', 'manual'].includes(kind)) return { ok: false, message: 'Choose Stripe or manual payments.' }
  const secretKey = text(form, 'secretKey'), webhookSecret = text(form, 'webhookSecret')
  if (kind === 'stripe') {
    if (secretKey && !/^(sk|rk)_(test|live)_[A-Za-z0-9]+$/.test(secretKey)) return { ok: false, message: 'Enter a Stripe secret key that starts with sk_test_ or sk_live_.' }
    if (webhookSecret && !/^whsec_[A-Za-z0-9]+$/.test(webhookSecret)) return { ok: false, message: 'Enter the webhook signing secret that starts with whsec_.' }
  }
  const brokerageId = await getActiveBrokerageId()
  if (!brokerageId) return { ok: false, message: 'Select a brokerage first.' }
  const existing = await keystoneClient<{ paymentProviders: Array<{ id: string }> }>(
    'query ExistingProvider($code: String!) { paymentProviders(where: { code: { equals: $code } }, take: 1) { id } }', { code: `pp_${kind}_${brokerageId.slice(-8).toLowerCase()}` }, { cache: 'no-store' })
  const credentials = kind === 'stripe' ? { ...(secretKey ? { secretKey } : {}), ...(webhookSecret ? { webhookSecret } : {}) } : {}
  const credentialsSet = Boolean(secretKey || webhookSecret)
  const id = existing.success ? existing.data.paymentProviders[0]?.id : null
  const name = kind === 'stripe' ? 'Stripe' : 'Pay at the office (manual)'
  if (id) {
    return runRecordMutation(
      'mutation UpdateProvider($id: ID!, $data: PaymentProviderUpdateInput!) { updatePaymentProvider(where: { id: $id }, data: $data) { id } }',
      { id, data: { isInstalled: form.get('isInstalled') !== 'false', ...(credentialsSet ? { credentials, metadata: { credentialsSet: true } } : {}) } },
      'updatePaymentProvider', 'Provider saved.', [PROVIDERS])
  }
  return runRecordMutation(
    'mutation CreateProvider($data: PaymentProviderCreateInput!) { createPaymentProvider(data: $data) { id } }',
    { data: { name, code: `pp_${kind}_${brokerageId.slice(-8).toLowerCase()}`, isInstalled: true, credentials, metadata: { credentialsSet }, ...adapterFunctions(kind), brokerage: { connect: { id: brokerageId } } } },
    'createPaymentProvider', 'Provider added.', [PROVIDERS])
}

/** "Request payment" from a lead: the amount is entered by staff, validated and stored on the server. */
export async function requestPayment(_state: RecordResult, form: FormData): Promise<RecordResult> {
  const leadId = text(form, 'leadId'), purpose = text(form, 'purpose'), dealId = text(form, 'dealId')
  const amount = text(form, 'amount').replace(/[$,\s]/g, '')
  if (!leadId) return { ok: false, message: 'Lead not found.' }
  if (!['holding_deposit', 'rent'].includes(purpose)) return { ok: false, message: 'Choose holding deposit or rent.' }
  if (!/^\d{1,5}(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) return { ok: false, message: 'Enter an amount in dollars, such as 1500 or 1500.00.' }
  const response = await keystoneClient<{ result: { ok: boolean; message: string; url: string | null; itemId: string | null } }>(
    'mutation RequestPayment($data: RequestPaymentCommandInput!) { result: requestPaymentCommand(data: $data) { ok message url itemId } }',
    { data: { leadId, ...(dealId ? { dealId } : {}), purpose, amountMinor: Math.round(Number(amount) * 100), idempotencyKey: text(form, 'idempotencyKey') || crypto.randomUUID() } },
    { cache: 'no-store' })
  if (!response.success) return { ok: false, message: 'Could not request the payment. Please try again.' }
  const result = response.data.result
  revalidatePath(PAYMENTS)
  return { ok: result.ok, message: result.ok && result.url ? `${result.message} ${result.url}` : result.message, id: result.itemId }
}

export async function checkPaymentStatus(_state: RecordResult, form: FormData): Promise<RecordResult> {
  const paymentId = text(form, 'paymentId')
  if (!paymentId) return { ok: false, message: 'Payment not found.' }
  const response = await keystoneClient<{ result: { ok: boolean; message: string } }>(
    'mutation CheckPayment($paymentId: ID!) { result: reconcilePaymentCommand(paymentId: $paymentId) { ok message } }', { paymentId }, { cache: 'no-store' })
  revalidatePath(PAYMENTS)
  return response.success ? { ok: response.data.result.ok, message: response.data.result.message } : { ok: false, message: 'Could not check the payment. Please try again.' }
}

/** "Refund": refunds the unrefunded balance of a paid payment through its provider. */
export async function refundPaymentAction(_state: RecordResult, form: FormData): Promise<RecordResult> {
  const paymentId = text(form, 'paymentId')
  if (!paymentId) return { ok: false, message: 'Payment not found.' }
  const response = await keystoneClient<{ result: { ok: boolean; message: string } }>(
    'mutation RefundPayment($paymentId: ID!) { result: refundPaymentCommand(paymentId: $paymentId) { ok message } }', { paymentId }, { cache: 'no-store' })
  revalidatePath(PAYMENTS)
  return response.success ? { ok: response.data.result.ok, message: response.data.result.message } : { ok: false, message: 'Could not refund the payment. Please try again.' }
}
