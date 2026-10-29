import Link from 'next/link'
import { DataTable, EmptyState, ErrorBanner, PlatformPage, StatusCell, Td } from '../../components/PlatformUI'
import { formatMoney } from '@/features/lib/money'
import { LocalDateTime } from '../../showings/components/LocalDateTime'
import { CheckStatusButton } from '../components/PaymentForms'
import { getPayments, purposeLabels, statusLabels, statusTones } from '../lib/data'

const dollars = (minor: number, currency: string) => currency === 'USD' ? formatMoney((minor / 100).toFixed(2)) : `${(minor / 100).toFixed(2)} ${currency}`

export async function PaymentsPage() {
  const { payments, error } = await getPayments()
  const paid = payments.filter(item => item.status === 'captured').reduce((sum, item) => sum + item.amountMinor - (item.refundedMinor || 0), 0)
  const review = payments.filter(item => item.status === 'unknown').length
  return (
    <PlatformPage
      crumbs={[{ label: 'Payments' }]}
      title="Payments"
      meta={!error && payments.length ? `${payments.length} ${payments.length === 1 ? 'payment' : 'payments'} · ${dollars(paid, 'USD')} received${review ? ` · ${review} need review` : ''}` : null}
      actions={<Link href="/dashboard/platform/payment-providers" className="text-sm underline-offset-2 hover:underline">Payment providers</Link>}
    >
      {error ? <ErrorBanner>Payments could not be loaded. {error}</ErrorBanner> : payments.length ? (
        <div className="pb-16">
          <p className="mb-3 text-sm text-muted-foreground">Application fees, holding deposits, rent and agent fees. Earnest money is paid to escrow or title and is only recorded on the deal.</p>
          <DataTable label="Payments" head={[{ label: 'For' }, { label: 'Amount', className: 'text-right' }, { label: 'Status' }, { label: 'Listing', className: 'hidden md:table-cell' }, { label: 'Payer', className: 'hidden md:table-cell' }, { label: 'Created', className: 'hidden lg:table-cell' }, { label: <span className="sr-only">Actions</span>, className: 'text-right' }]}>
            {payments.map(payment => (
              <tr key={payment.id} className="transition-colors hover:bg-muted/30">
                <Td>{purposeLabels[payment.purpose] || payment.purpose}</Td>
                <Td className="text-right tabular-nums">{dollars(payment.amountMinor, payment.currency)}</Td>
                <Td><StatusCell tone={statusTones[payment.status] || 'zinc'}>{statusLabels[payment.status] || payment.status}</StatusCell></Td>
                <Td className="hidden max-w-[14rem] truncate md:table-cell">{payment.property?.title || '—'}</Td>
                <Td className="hidden md:table-cell">{payment.lead ? <Link href={`/dashboard/platform/leads/${encodeURIComponent(payment.lead.id)}`} className="hover:underline">{payment.lead.name}</Link> : '—'}</Td>
                <Td className="hidden whitespace-nowrap lg:table-cell"><LocalDateTime value={payment.createdAt} options={{ dateStyle: 'medium' }} /></Td>
                <Td className="text-right">{payment.providerPaymentId && !['refunded', 'failed'].includes(payment.status) ? <CheckStatusButton paymentId={payment.id} /> : null}</Td>
              </tr>
            ))}
          </DataTable>
        </div>
      ) : <EmptyState title="No payments yet">Application fees and requested payments appear here.</EmptyState>}
    </PlatformPage>
  )
}
