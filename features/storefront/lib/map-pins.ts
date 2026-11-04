import type { MapPin } from '../components/ListingsMap'

type Pinnable = {
  id: string
  slug: string
  title: string
  latitude?: number | null
  longitude?: number | null
  price?: string | number | null
  listingType?: string | null
  imagePath?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  neighborhood?: string | null
  propertyType?: string | null
  bedrooms?: number | null
  bathrooms?: string | number | null
  squareFeet?: number | null
  lotSizeSquareFeet?: number | null
}

/** "4 bd · 3 ba · 2,410 sqft"; land shows its lot. */
export function pinFacts(listing: Pinnable) {
  const land = listing.propertyType === 'land'
  return [
    !land && listing.bedrooms ? `${listing.bedrooms} bd` : '',
    !land && Number(listing.bathrooms) > 0 ? `${Number(listing.bathrooms)} ba` : '',
    listing.squareFeet ? `${listing.squareFeet.toLocaleString('en-US')} sqft` : '',
    land && listing.lotSizeSquareFeet ? `${listing.lotSizeSquareFeet.toLocaleString('en-US')} sqft lot` : '',
  ].filter(Boolean).join(' · ')
}

/**
 * The located homes of a result set as map pins, each carrying what the map's preview card shows:
 * photo, full price, street address, place and facts. `savedIds` marks the shopper's saved homes.
 */
export function listingPins<T extends Pinnable>(listings: T[], label: (listing: T) => string, options: { fullPrice?: (listing: T) => string; savedIds?: Record<string, string> } = {}): MapPin[] {
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
      priceText: options.fullPrice ? options.fullPrice(listing) : '',
      address: [listing.addressLine1, listing.addressLine2].map(part => part?.trim()).filter(Boolean).join(' ') || listing.title,
      place: [listing.neighborhood, listing.city, listing.state].filter(Boolean).join(', '),
      facts: pinFacts(listing),
      imagePath: listing.imagePath || '',
      savedId: options.savedIds?.[listing.id] || null,
    }))
}
