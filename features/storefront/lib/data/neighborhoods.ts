import { getNeighborhoodImagePath } from '@/features/lib/real-estate-images'
import type { StorefrontProperty } from './properties'

export type StorefrontNeighborhood = {
  id: string
  name: string
  city: string
  imagePath: string
  listings: StorefrontProperty[]
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

/** Groups published homes by neighborhood (or city when no neighborhood is set). */
export function groupStorefrontNeighborhoods(listings: StorefrontProperty[], fallbackCity: string): StorefrontNeighborhood[] {
  const groups = new Map<string, StorefrontProperty[]>()
  for (const listing of listings) {
    const name = (listing.neighborhood || listing.city || '').trim()
    if (!name) continue
    groups.set(name, [...(groups.get(name) || []), listing])
  }

  return [...groups.entries()].map(([name, group]) => ({
    id: slugify(name),
    name,
    city: group[0]?.city || fallbackCity,
    // A neighborhood photo when one exists, so the tile doesn't repeat a listing card's photo.
    imagePath: getNeighborhoodImagePath(name) || group.find(listing => listing.imagePath)?.imagePath || '',
    listings: group,
  }))
}
