import { DataTable, EmptyState, ErrorBanner, PlatformPage, StatusCell, Td } from '../../components/PlatformUI'
import { getBaseUrl } from '@/features/dashboard/lib/getBaseUrl'
import { ProviderDrawer } from '../components/PaymentForms'
import { getPaymentProviders } from '../lib/data'

export async function PaymentProvidersPage() {
  const [{ providers, error }, base] = await Promise.all([getPaymentProviders(), getBaseUrl()])
  return (
    <PlatformPage crumbs={[{ label: 'Payment providers' }]} title="Payment providers" meta="Where application fees, holding deposits and rent are collected" actions={<ProviderDrawer />}>
      {error ? <ErrorBanner>Providers could not be loaded. {error}</ErrorBanner> : providers.length ? (
        <div className="space-y-4 pb-16">
          <DataTable label="Payment providers" head={[{ label: 'Provider' }, { label: 'Code', className: 'hidden md:table-cell' }, { label: 'Keys' }, { label: 'Status' }, { label: 'Webhook URL', className: 'hidden lg:table-cell' }]}>
            {providers.map(provider => (
              <tr key={provider.id}>
                <Td className="font-medium text-foreground">{provider.name}</Td>
                <Td className="hidden md:table-cell">{provider.code}</Td>
                <Td>{provider.createPaymentFunction === 'manual' ? 'Not needed' : provider.metadata?.credentialsSet ? 'Saved' : 'Server environment'}</Td>
                <Td><StatusCell tone={provider.isInstalled ? 'emerald' : 'zinc'}>{provider.isInstalled ? 'Active' : 'Off'}</StatusCell></Td>
                <Td className="hidden break-all text-xs lg:table-cell">{provider.createPaymentFunction === 'manual' ? '—' : `${base}/api/payment-webhooks/${provider.id}`}</Td>
              </tr>
            ))}
          </DataTable>
          <p className="text-sm text-muted-foreground">Add this URL as a Stripe webhook endpoint for checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired and charge.refunded. Rent is collected by ACH bank debit; make sure it is enabled on your Stripe account. Check your state&apos;s cap before setting rental application fees.</p>
        </div>
      ) : <EmptyState title="No payment provider yet">Add Stripe to take rental application fees online.</EmptyState>}
    </PlatformPage>
  )
}
