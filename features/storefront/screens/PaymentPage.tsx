import Link from 'next/link'
import { notFound } from 'next/navigation'
import { StorefrontFooter } from '@/features/storefront/components/StorefrontFooter'
import { StorefrontNav } from '@/features/storefront/components/StorefrontNav'
import { getBrokerageSettings } from '@/features/storefront/lib/data/settings'
import { getPublicPayment, payNow } from '@/features/storefront/lib/data/payments'

type PageProps = { params: Promise<{ token: string }>; searchParams: Promise<{ checkout?: string; notice?: string }> }

const usd = (minor: number, currency: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100)

export default async function PaymentPage({ params, searchParams }: PageProps) {
  const { token } = await params
  const query = await searchParams
  const settingsState = await getBrokerageSettings()
  if (settingsState.status !== 'ready') return null
  // Coming back from checkout (or opening the link again) asks the provider, so the page never trusts the URL alone.
  const payment = await getPublicPayment(token, query.checkout === 'return' || query.checkout === undefined)
  if (!payment) notFound()
  const notice = query.checkout === 'cancelled' ? 'Checkout was cancelled. You have not been charged.' : query.notice || ''

  return (
    <>
      <StorefrontNav settings={settingsState.settings} />
      <main className="sf-container sf-section">
        <div className="sf-panel" style={{ maxWidth: '34rem', margin: '0 auto' }}>
          <p className="sf-hint">{payment.brokerageName}</p>
          <h1>{payment.description}</h1>
          <p className="sf-signplate__price"><span className="sf-num">{usd(payment.amountMinor, payment.currency)}</span></p>
          {payment.payerName ? <p>For {payment.payerName}</p> : null}
          <p role="status" className={payment.status === 'captured' ? 'sf-message sf-message--success' : 'sf-message'}>{payment.statusMessage}</p>
          {notice ? <p role="status" className="sf-message">{notice}</p> : null}
          {payment.canPay ? (
            <form action={payNow}>
              <input type="hidden" name="token" value={payment.token} />
              <button type="submit" className="sf-btn sf-btn--primary sf-btn--block">{payment.status === 'failed' ? 'Try again' : 'Pay securely'}</button>
            </form>
          ) : null}
          <p className="sf-prose__after"><Link href="/listings" className="sf-link">Back to homes</Link></p>
        </div>
      </main>
      <StorefrontFooter settings={settingsState.settings} />
    </>
  )
}
