import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { StorefrontProperty } from '@/features/storefront/lib/data/properties'
import { formatLocation, formatPrice, propertyTypeLabel } from '@/features/storefront/lib/format'

export function ListingCard({ listing, priority = false }: { listing: StorefrontProperty; priority?: boolean }) {
  return (
    <article className="sf-listing-card">
      <Link href={`/listings/${listing.slug}`} className="sf-listing-card__media" aria-label={`View ${listing.title}`}>
        {listing.imagePath ? <img src={listing.imagePath} alt="" decoding="async" fetchPriority={priority ? 'high' : 'low'} /> : <span className="sf-listing-card__media-placeholder" aria-hidden="true">No photo</span>}
        <span className="sf-listing-card__status">{listing.status === 'coming_soon' ? 'Coming soon' : listing.listingType === 'rent' ? 'For rent' : 'For sale'}</span>
      </Link>
      <div className="sf-listing-card__body">
        <div className="sf-listing-card__topline"><p>{formatPrice(listing)}</p><span>{propertyTypeLabel(listing.propertyType)}</span></div>
        <h3><span className="sf-status-dot" aria-hidden /><Link href={`/listings/${listing.slug}`}>{listing.title}</Link></h3>
        <p className="sf-listing-card__location">{formatLocation(listing)}</p>
        <dl>
          <div><dt>Beds</dt><dd>{listing.bedrooms ?? '—'}</dd></div>
          <div><dt>Baths</dt><dd>{listing.bathrooms || '—'}</dd></div>
          <div><dt>Interior</dt><dd>{listing.squareFeet ? `${listing.squareFeet.toLocaleString()} sq ft` : '—'}</dd></div>
        </dl>
        <Link href={`/listings/${listing.slug}`} className="sf-text-link">View home <ArrowUpRight aria-hidden /></Link>
      </div>
    </article>
  )
}
