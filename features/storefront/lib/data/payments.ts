'use server'

import { redirect } from 'next/navigation'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { getStorefrontBrokerageSlug } from '@/features/storefront/lib/brokerage'

export type PublicPayment = {
  token: string; purpose: string; status: string; statusMessage: string; amountMinor: number; currency: string
  description: string; brokerageName: string; propertyTitle: string; payerName: string; paidAt: string | null; canPay: boolean
}

export type ApplyState = { ok: boolean; message: string }

const PAYMENT_FIELDS = 'token purpose status statusMessage amountMinor currency description brokerageName propertyTitle payerName paidAt canPay'

export async function getPublicPayment(token: string, reconcile = false): Promise<PublicPayment | null> {
  const query = reconcile
    ? `mutation Reconcile($token: String!) { payment: reconcilePaymentByToken(token: $token) { ${PAYMENT_FIELDS} } }`
    : `query PaymentByToken($token: String!) { payment: paymentByToken(token: $token) { ${PAYMENT_FIELDS} } }`
  const response = await keystoneClient<{ payment: PublicPayment | null }>(query, { token }, { cache: 'no-store' })
  return response.success ? response.data.payment : null
}

/** Hosted checkout for an existing payment link. The amount is whatever the server stored. */
export async function payNow(formData: FormData) {
  const token = String(formData.get('token') || '')
  const response = await keystoneClient<{ result: { ok: boolean; message: string; url: string | null } }>(
    'mutation Begin($token: String!) { result: beginPaymentCheckout(token: $token) { ok message url } }',
    { token }, { cache: 'no-store' },
  )
  const url = response.success ? response.data.result.url : null
  if (url) redirect(url)
  redirect(`/pay/${encodeURIComponent(token)}?notice=${encodeURIComponent(response.success ? response.data.result.message : 'We could not start checkout. Please try again.')}`)
}

/** "Apply" on a rental: the lead is captured and the fee is set on the server from the listing. No amount is accepted here. */
export async function applyForRental(_state: ApplyState, formData: FormData): Promise<ApplyState> {
  const brokerageSlug = await getStorefrontBrokerageSlug()
  if (!brokerageSlug) return { ok: false, message: 'We could not start your application. Please try again.' }
  const response = await keystoneClient<{ result: { ok: boolean; message: string; url: string | null; token: string | null } }>(
    `mutation Apply($data: StartApplicationFeeCheckoutInput!) { result: startApplicationFeeCheckout(data: $data) { ok message url token } }`,
    { data: {
      brokerageSlug,
      propertyId: String(formData.get('propertyId') || ''),
      name: String(formData.get('name') || ''),
      email: String(formData.get('email') || ''),
      phone: String(formData.get('phone') || ''),
      message: String(formData.get('message') || ''),
    } },
    { cache: 'no-store' },
  )
  if (!response.success) return { ok: false, message: 'We could not start your application. Please try again.' }
  const { ok, message, url, token } = response.data.result
  if (url) redirect(url)
  if (ok && token) redirect(`/pay/${encodeURIComponent(token)}`)
  return { ok: false, message }
}
