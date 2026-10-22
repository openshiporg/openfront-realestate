import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCustomer, getCustomerShowings } from '../lib/data/account'
import { showingStatusLabel, showingTone, showingTypeLabel } from '../lib/format'

export const metadata: Metadata = { title: 'My showings' }

const requestedTime = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })

export default async function AccountPage() {
  const customer = await getCustomer()
  if (!customer) notFound()
  const showings = await getCustomerShowings()

  return <>
    <header className="sf-account__head">
      <div>
        <p className="sf-eyebrow">{customer.name}</p>
        <h1 style={{ marginTop: '0.5rem' }}>My showings</h1>
      </div>
      <Link className="sf-btn sf-btn--quiet" href="/#homes">Browse homes</Link>
    </header>
    {showings.error ? <p className="sf-message" role="alert">{showings.error}</p> : !showings.items.length ? (
      <div className="sf-state">
        <h2>No showings</h2>
        <Link className="sf-btn sf-btn--primary" href="/#homes">Browse homes</Link>
      </div>
    ) : (
      <ul className="sf-trips">
        {showings.items.map(showing => (
          <li key={showing.id} className="sf-trip">
            <div>
              <h2><span className="sf-dot" data-tone={showingTone(showing.status)} aria-hidden />{showing.listingTitle}</h2>
              <p className="sf-trip__meta">
                <span><b>{showingStatusLabel(showing.status)}</b></span>
                <span className="sf-num">{requestedTime.format(new Date(showing.requestedStart))} UTC</span>
                <span>{showingTypeLabel(showing.showingType)}</span>
              </p>
            </div>
            {showing.listingSlug ? <Link className="sf-link" href={`/listings/${encodeURIComponent(showing.listingSlug)}`}>View home</Link> : null}
          </li>
        ))}
      </ul>
    )}
  </>
}
