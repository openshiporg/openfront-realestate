import Link from 'next/link'
import type { StorefrontProperty } from '@/features/storefront/lib/data/properties'
import { formatPrice, formatPricePerSqFt, listingPlace, listingStatusPlate, listingTone, propertyTypeLabel } from '@/features/storefront/lib/format'
import { SaveHomeButton } from '@/features/storefront/components/SaveHomeButton'
import { HomePhotoFallback } from '@/features/storefront/components/HomePhotoFallback'

export type SaveState = { signedIn: boolean; savedIds: Record<string, string> }

/**
 * One result module: photo with its status plate, then price, $/sq ft, beds, baths, sq ft and
 * neighbourhood packed into seam-ruled cells. `row` lays the same module out sideways.
 */
export function ListingCard({ listing, priority = false, save, layout = 'module' }: { listing: StorefrontProperty; priority?: boolean; save?: SaveState; layout?: 'module' | 'row' }) {
  const href = `/listings/${listing.slug}`
  const land = listing.propertyType === 'land'
  const perFoot = formatPricePerSqFt(listing)
  const place = listingPlace(listing)
  const saved = Boolean(save?.savedIds[listing.id])
  const facts: Array<[string, string]> = [
    ...(!land && listing.bedrooms ? [[String(listing.bedrooms), 'bd'] as [string, string]] : []),
    ...(!land && Number(listing.bathrooms) > 0 ? [[String(Number(listing.bathrooms)), 'ba'] as [string, string]] : []),
    ...(listing.squareFeet ? [[listing.squareFeet.toLocaleString('en-US'), 'sq ft'] as [string, string]] : []),
    ...(land && listing.lotSizeSquareFeet ? [[listing.lotSizeSquareFeet.toLocaleString('en-US'), 'sq ft lot'] as [string, string]] : []),
  ]

  return (
    <article className={`sf-card sf-card--${layout}`} data-saved={saved || undefined}>
      <div className="sf-card__media">
        {listing.imagePath
          ? <img src={listing.imagePath} alt="" decoding="async" fetchPriority={priority ? 'high' : 'low'} loading="eager" />
          : <HomePhotoFallback label={listing.addressLine1 || listing.title} />}
        <span className="sf-plate" data-tone={listingTone(listing.status)}>{listingStatusPlate(listing)}</span>
      </div>
      {save ? <SaveHomeButton className="sf-card__save" propertyId={listing.id} title={listing.title} slug={listing.slug} savedId={save.savedIds[listing.id] || null} signedIn={save.signedIn} /> : null}
      <div className="sf-card__body">
        <p className="sf-card__price">
          <span className="sf-num">{formatPrice(listing)}</span>
          {perFoot ? <small className="sf-num">{perFoot}<span>/sq ft</span></small> : null}
        </p>
        {facts.length ? (
          <ul className="sf-card__facts" aria-label="Beds, baths and size">
            {facts.map(([value, unit]) => <li key={unit}><b className="sf-num">{value}</b> {unit}</li>)}
          </ul>
        ) : null}
        <h3 className="sf-card__title"><Link href={href}>{listing.title}</Link></h3>
        <p className="sf-card__where">
          <span>{propertyTypeLabel(listing.propertyType)}</span>
          {place ? <span>{place}</span> : null}
        </p>
      </div>
    </article>
  )
}
