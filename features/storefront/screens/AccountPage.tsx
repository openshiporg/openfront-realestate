import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCustomer, getCustomerShowings } from '../lib/data/account'
import { showingStatusLabel, showingTypeLabel } from '../lib/format'

export const metadata: Metadata = { title: 'My showings' }

const requestedTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })

export default async function AccountPage() {
  const customer = await getCustomer()
  if (!customer) notFound()
  const showings = await getCustomerShowings()
  const firstName = customer.name.split(' ')[0] || customer.name

  return <>
    <h1 className="sf-account__title">Hello, {firstName}</h1>
    <h2 className="sf-account__subtitle">My showings</h2>
    {showings.error ? <p className="sf-form-message" role="alert">{showings.error}</p> : !showings.items.length ? (
      <div className="sf-state">
        <h3>No showings yet.</h3>
        <Link className="sf-btn sf-btn--dark" href="/#homes">Browse homes</Link>
      </div>
    ) : <ul className="sf-account__list">{showings.items.map(showing => <li key={showing.id} className="sf-account__item">
      <div className="sf-account__item-head"><h3>{showing.listingTitle}</h3><span className="sf-account__status"><span className="sf-status-dot" aria-hidden />{showingStatusLabel(showing.status)}</span></div>
      <dl><div><dt>Requested time</dt><dd>{requestedTime.format(new Date(showing.requestedStart))} UTC</dd></div><div><dt>Visit type</dt><dd>{showingTypeLabel(showing.showingType)}</dd></div></dl>
      {showing.listingSlug ? <Link className="sf-text-link" href={`/listings/${encodeURIComponent(showing.listingSlug)}`}>View home</Link> : null}
    </li>)}</ul>}
  </>
}
