import Link from 'next/link'
import type { StorefrontProperty } from '@/features/storefront/lib/data/properties'
import { formatLocation, formatPrice, listingMarketLabel, listingTone, propertyTypeLabel } from '@/features/storefront/lib/format'

export function ListingCard({ listing, priority = false }: { listing: StorefrontProperty; priority?: boolean }) {
  const href = `/listings/${listing.slug}`
  const land = listing.propertyType === 'land'
  return (
    <article className="sf-card">
      <div className="sf-card__media">
        {listing.imagePath ? <img src={listing.imagePath} alt="" decoding="async" fetchPriority={priority ? 'high' : 'low'} loading={priority ? 'eager' : 'lazy'} /> : <span className="sf-card__placeholder" aria-hidden="true">No photo</span>}
        <span className="sf-card__tag">{propertyTypeLabel(listing.propertyType)}</span>
      </div>
      <div className="sf-card__body">
        <p className="sf-card__price">{formatPrice(listing)}</p>
        <h3 className="sf-card__title">
          <span className="sf-dot" data-tone={listingTone(listing.status)} aria-hidden />
          <span className="sr-only">{listingMarketLabel(listing)}: </span>
          <Link href={href}>{listing.title}</Link>
        </h3>
        <p className="sf-card__facts">
          {!land && listing.bedrooms ? <span><b>{listing.bedrooms}</b> bd</span> : null}
          {!land && Number(listing.bathrooms) > 0 ? <span><b>{Number(listing.bathrooms)}</b> ba</span> : null}
          {listing.squareFeet ? <span><b>{listing.squareFeet.toLocaleString()}</b> sq ft</span> : null}
          {land && listing.lotSizeSquareFeet ? <span><b>{listing.lotSizeSquareFeet.toLocaleString()}</b> sq ft lot</span> : null}
          <span>{listingMarketLabel(listing)}</span>
        </p>
        <p className="sf-card__where">{formatLocation(listing)}</p>
      </div>
    </article>
  )
}
