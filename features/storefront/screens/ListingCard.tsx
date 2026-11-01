import Link from 'next/link'
import type { StorefrontProperty } from '@/features/storefront/lib/data/properties'
import { formatPrice, initials, listingAddress, listingStatusPlate, listingTone, openHouseWindow } from '@/features/storefront/lib/format'
import { stateTimeZone } from '@/features/lib/date-time'
import { SaveHomeButton } from '@/features/storefront/components/SaveHomeButton'
import { HomePhotoFallback } from '@/features/storefront/components/HomePhotoFallback'

/** Beds, baths and size as [value, unit] pairs; land shows its lot instead. */
export function listingFacts(listing: StorefrontProperty): Array<[string, string]> {
  const land = listing.propertyType === 'land'
  return [
    ...(!land && listing.bedrooms ? [[String(listing.bedrooms), 'bd'] as [string, string]] : []),
    ...(!land && Number(listing.bathrooms) > 0 ? [[String(Number(listing.bathrooms)), 'ba'] as [string, string]] : []),
    ...(listing.squareFeet ? [[listing.squareFeet.toLocaleString('en-US'), 'sqft'] as [string, string]] : []),
    ...(land && listing.lotSizeSquareFeet ? [[listing.lotSizeSquareFeet.toLocaleString('en-US'), 'sqft lot'] as [string, string]] : []),
  ]
}

export type SaveState = { signedIn: boolean; savedIds: Record<string, string> }

/** The next open house on the photo, else the market status when it is not a plain active listing. */
function photoBadge(listing: StorefrontProperty) {
  const next = listing.openHouses.find(openHouse => Date.parse(openHouse.endsAt || openHouse.startsAt) > Date.now())
  if (next) {
    const window = openHouseWindow(next.startsAt, next.endsAt, stateTimeZone(listing.state))
    return window ? { tone: 'open', text: <>Open House <span className="sf-num">{window}</span></> } : null
  }
  if (listing.status !== 'active') return { tone: listingTone(listing.status), text: listingStatusPlate(listing) }
  if (listing.listingType === 'rent') return { tone: 'active', text: 'For rent' }
  return null
}

/**
 * One result: photo, then the price set large, the street address, beds · baths · sqft,
 * the listing agent and "Book a showing". `row` lays it out beside the map; `module` stacks it in a grid.
 */
export function ListingCard({ listing, priority = false, save, layout = 'module' }: { listing: StorefrontProperty; priority?: boolean; save?: SaveState; layout?: 'module' | 'row' }) {
  const href = `/listings/${listing.slug}`
  const saved = Boolean(save?.savedIds[listing.id])
  const facts = listingFacts(listing)
  const badge = photoBadge(listing)
  const agent = listing.assignedAgent

  return (
    <article className={`sf-card sf-card--${layout}`} data-saved={saved || undefined} data-listing-card={listing.id}>
      <div className="sf-card__media">
        {listing.imagePath
          ? <img src={listing.imagePath} alt="" decoding="async" fetchPriority={priority ? 'high' : 'low'} loading="eager" />
          : <HomePhotoFallback label={listingAddress(listing)} />}
        {badge ? <span className="sf-badge" data-tone={badge.tone}>{badge.text}</span> : null}
      </div>
      {save ? <SaveHomeButton className="sf-card__save" propertyId={listing.id} title={listing.title} slug={listing.slug} savedId={save.savedIds[listing.id] || null} signedIn={save.signedIn} /> : null}
      <div className="sf-card__body">
        <p className="sf-card__price sf-num">{formatPrice(listing)}</p>
        <h3 className="sf-card__title"><Link href={href}>{listingAddress(listing)}</Link></h3>
        {facts.length ? (
          <ul className="sf-card__facts" aria-label="Beds, baths and size">
            {facts.map(([value, unit]) => <li key={unit}><span className="sf-num">{value}</span> {unit}</li>)}
          </ul>
        ) : null}
        <div className="sf-card__foot">
          {agent ? (
            <span className="sf-card__agent">
              {agent.imagePath ? <img src={agent.imagePath} alt="" decoding="async" loading="lazy" /> : <span className="sf-avatar" aria-hidden>{initials(agent.name)}</span>}
              <span><span className="sf-card__agent-by">Listed by </span>{agent.name}</span>
            </span>
          ) : null}
          <Link href={`${href}#showing`} className="sf-btn sf-btn--outline sf-card__book" aria-label={`Book a showing at ${listingAddress(listing)}`}>Book a showing</Link>
        </div>
      </div>
    </article>
  )
}
