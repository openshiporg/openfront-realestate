import type { MetadataRoute } from 'next'
import { STOREFRONT_LISTING_PAGE_SIZE } from './data/listingPagination'
import { getStorefrontListings } from './data/properties'
import { getBrokerageSettings } from './data/settings'
import { storefrontOrigin } from './metadata'

const MAX_PAGES = 20

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [state, origin] = await Promise.all([getBrokerageSettings(), storefrontOrigin()])
  if (state.status !== 'ready' || !origin) return []
  const entries: MetadataRoute.Sitemap = [{ url: new URL('/', origin).toString(), changeFrequency: 'daily', priority: 1 }]
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await getStorefrontListings({ skip: String(page * STOREFRONT_LISTING_PAGE_SIZE) })
    for (const listing of result.listings) {
      entries.push({ url: new URL(`/listings/${listing.slug}`, origin).toString(), changeFrequency: 'weekly', priority: 0.8 })
    }
    if (result.error || !result.hasMore) break
  }
  return entries
}
