import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LocalDateTime } from '@/features/platform/showings/components/LocalDateTime'
import { getCustomer, getCustomerShowings } from '../lib/data/account'
import { CancelShowingButton } from '../components/CancelShowingButton'
import { showingStatusLabel, showingTone, showingTypeLabel } from '../lib/format'
import { storefrontTitle } from '../lib/metadata'

export async function generateMetadata(): Promise<Metadata> {
  // The sign-in slot names signed-out visits.
  return (await getCustomer()) ? { title: await storefrontTitle('My showings') } : {}
}

const requestedTime: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }

export default async function AccountPage() {
  const customer = await getCustomer()
  if (!customer) notFound()
  const showings = await getCustomerShowings()

  return <>
    <header className="sf-account__head">
      <h1>My showings</h1>
    </header>
    {showings.error ? <p className="sf-message" role="alert">{showings.error}</p> : !showings.items.length ? (
      <div className="sf-state">
        <h2>No showings yet</h2>
        <p>Request a showing from any home and it appears here with its status.</p>
        <Link className="sf-btn sf-btn--primary" href="/listings">Browse homes</Link>
      </div>
    ) : (
      <ul className="sf-trips">
        {showings.items.map(showing => (
          <li key={showing.id} className="sf-trip">
            <div>
              <h2><Link href={`/account/showings/${encodeURIComponent(showing.id)}`}>{showing.listingTitle}</Link></h2>
              <p className="sf-trip__meta">
                <span className="sf-plate" data-tone={showingTone(showing.status)}>{showingStatusLabel(showing.status)}</span>
                <LocalDateTime className="sf-num" value={showing.requestedStart} options={requestedTime} />
                <span>{showingTypeLabel(showing.showingType)}{showing.showingType === 'virtual' && ['requested', 'scheduled'].includes(showing.status) ? ', link sent by your advisor' : ''}</span>
              </p>
            </div>
            <div className="sf-trip__actions">
              {['requested', 'scheduled'].includes(showing.status) ? <CancelShowingButton showingId={showing.id} listingTitle={showing.listingTitle} /> : null}
              {showing.listingSlug ? <Link className="sf-link" href={`/listings/${encodeURIComponent(showing.listingSlug)}`}>{['requested', 'scheduled'].includes(showing.status) ? 'View home or request a new time' : 'View home'}</Link> : null}
            </div>
          </li>
        ))}
      </ul>
    )}
  </>
}
