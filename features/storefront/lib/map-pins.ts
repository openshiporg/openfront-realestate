import type { MapPin } from '../components/ListingsMap'

type Pinnable = { id: string; slug: string; title: string; latitude?: number | null; longitude?: number | null; price?: string | number | null; listingType?: string | null }

/** The located homes of a result set as map pins. */
export function listingPins<T extends Pinnable>(listings: T[], label: (listing: T) => string): MapPin[] {
  return listings
    .filter(listing => typeof listing.latitude === 'number' && typeof listing.longitude === 'number')
    .map(listing => ({
      id: listing.id,
      slug: listing.slug,
      title: listing.title,
      latitude: listing.latitude as number,
      longitude: listing.longitude as number,
      label: label(listing),
      price: Number(listing.price) || 0,
      rent: listing.listingType === 'rent',
    }))
}
