import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarPlus } from 'lucide-react'
import { LocalDateTime } from '@/features/platform/showings/components/LocalDateTime'
import { CancelShowingButton } from '../components/CancelShowingButton'
import { getCustomer, getCustomerShowing } from '../lib/data/account'
import { getStorefrontListingBySlug } from '../lib/data/properties'
import { formatLocation, showingStatusLabel, showingTone, showingTypeLabel } from '../lib/format'
import { storefrontTitle } from '../lib/metadata'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata(): Promise<Metadata> {
  return { title: await storefrontTitle('Showing') }
}

const when: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }

export default async function AccountShowingPage({ params }: Props) {
  const { id } = await params
  const customer = await getCustomer()
  if (!customer) notFound()
  const showing = await getCustomerShowing(id)
  if (!showing) notFound()
  const listing = showing.listingSlug ? (await getStorefrontListingBySlug(showing.listingSlug)).listing : null
  const open = ['requested', 'scheduled'].includes(showing.status)

  return <>
    <nav className="sf-crumbs sf-crumbs--flush" aria-label="Breadcrumb"><Link href="/account"><ArrowLeft aria-hidden />My showings</Link></nav>
    <header className="sf-account__head">
      <h1>{showing.listingTitle}</h1>
      <span className="sf-plate" data-tone={showingTone(showing.status)}>{showingStatusLabel(showing.status)}</span>
    </header>
    <div className="sf-panel">
      <dl className="sf-facts">
        <div><dt>Status</dt><dd>{showingStatusLabel(showing.status)}</dd></div>
        <div><dt>Time</dt><dd><LocalDateTime value={showing.requestedStart} options={when} /></dd></div>
        <div><dt>Visit</dt><dd>{showingTypeLabel(showing.showingType)}</dd></div>
        {listing ? <div><dt>Address</dt><dd>{formatLocation(listing)}</dd></div> : null}
      </dl>
      {showing.status === 'requested' ? <p className="sf-hint" style={{ margin: 0 }}>Waiting for your advisor to confirm the time.</p> : null}
      <div className="sf-trip__actions">
        {open ? <a className="sf-btn sf-btn--quiet" href={`/calendar/showing/${encodeURIComponent(showing.id)}`}><CalendarPlus aria-hidden /> Add to calendar</a> : null}
        {open ? <CancelShowingButton showingId={showing.id} listingTitle={showing.listingTitle} /> : null}
        {showing.listingSlug ? <Link className="sf-link" href={`/listings/${encodeURIComponent(showing.listingSlug)}`}>View home</Link> : null}
      </div>
    </div>
  </>
}
