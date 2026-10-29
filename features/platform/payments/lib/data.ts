import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type PaymentProviderRow = { id: string; name: string; code: string; isInstalled: boolean; createPaymentFunction: string; metadata: { credentialsSet?: boolean } | null }
export type PaymentRow = {
  id: string; purpose: string; status: string; amountMinor: number; currency: string; providerPaymentId: string | null; createdAt: string; paidAt: string | null; refundedMinor: number | null
  property: { id: string; title: string } | null; lead: { id: string; name: string } | null; deal: { id: string; title: string } | null; paymentProvider: { name: string } | null
}

export async function getPaymentProviders() {
  const response = await keystoneClient<{ paymentProviders: PaymentProviderRow[] }>(
    'query PaymentProviders { paymentProviders(orderBy: [{ createdAt: asc }], take: 50) { id name code isInstalled createPaymentFunction metadata } }', {}, { cache: 'no-store' })
  return response.success ? { providers: response.data.paymentProviders, error: null } : { providers: [] as PaymentProviderRow[], error: response.error }
}

export async function getPayments() {
  const response = await keystoneClient<{ payments: PaymentRow[] }>(
    'query Payments { payments(orderBy: [{ createdAt: desc }], take: 200) { id purpose status amountMinor currency providerPaymentId createdAt paidAt refundedMinor property { id title } lead { id name } deal { id title } paymentProvider { name } } }', {}, { cache: 'no-store' })
  return response.success ? { payments: response.data.payments, error: null } : { payments: [] as PaymentRow[], error: response.error }
}

export const purposeLabels: Record<string, string> = { application_fee: 'Application fee', holding_deposit: 'Holding deposit', rent: 'Rent', agent_fee: 'Agent fee' }
export const statusLabels: Record<string, string> = { pending: 'Pending', authorized: 'Processing', captured: 'Paid', refunded: 'Refunded', failed: 'Failed', unknown: 'Needs review' }
export const statusTones: Record<string, 'emerald' | 'amber' | 'rose' | 'zinc' | 'sky'> = { captured: 'emerald', authorized: 'sky', pending: 'amber', failed: 'zinc', refunded: 'zinc', unknown: 'rose' }
