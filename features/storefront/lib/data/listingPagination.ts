export const STOREFRONT_LISTING_PAGE_SIZE = 24
export const STOREFRONT_LISTING_QUERY_SIZE = STOREFRONT_LISTING_PAGE_SIZE + 1

export type ListingPageParams = {
  q?: string
  city?: string
  type?: string
  propertyType?: string
  minPrice?: string
  maxPrice?: string
  beds?: string
  baths?: string
  sort?: string
  skip?: string
}

export const LISTING_SORTS = [
  ['', 'Recommended'],
  ['newest', 'Newest'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
] as const

const SEARCH_FILTER_KEYS = ['q', 'city', 'type', 'propertyType', 'minPrice', 'maxPrice', 'beds', 'baths', 'sort'] as const

export function parseListingSkip(value?: string) {
  if (!value || !/^\d+$/.test(value)) return 0
  const skip = Number(value)
  return Number.isSafeInteger(skip) ? Math.min(skip, 10_000) : 0
}

/** The final fetched row is a lookahead only; it is not part of the visible count. */
export function splitListingPage<T>(rows: readonly T[]) {
  return {
    items: rows.slice(0, STOREFRONT_LISTING_PAGE_SIZE),
    hasMore: rows.length > STOREFRONT_LISTING_PAGE_SIZE,
  }
}

export function listingPageHref(params: ListingPageParams, skip: number) {
  const search = new URLSearchParams()
  for (const key of SEARCH_FILTER_KEYS) {
    const value = params[key]?.trim()
    if (value) search.set(key, value)
  }
  if (Number.isSafeInteger(skip) && skip > 0) search.set('skip', String(skip))
  const query = search.toString()
  return `${query ? `/?${query}` : '/'}#homes`
}
