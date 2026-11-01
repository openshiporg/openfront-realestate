import type { MapPin } from '../components/ListingsMap'

/** The located homes of a result set as map pins. */
export function listingPins<T extends { id: string; slug: string; title: string; latitude?: number | null; longitude?: number | null }>(listings: T[], label: (listing: T) => string): MapPin[] {
  return listings
    .filter(listing => typeof listing.latitude === 'number' && typeof listing.longitude === 'number')
    .map(listing => ({ id: listing.id, slug: listing.slug, title: listing.title, latitude: listing.latitude as number, longitude: listing.longitude as number, label: label(listing) }))
}
