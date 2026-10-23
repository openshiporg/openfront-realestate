import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { getStorefrontBrokerageSlug } from '@/features/storefront/lib/brokerage'
import {
  LISTING_SORTS,
  listingPageHref,
  parseListingSkip,
  splitListingPage,
  STOREFRONT_LISTING_QUERY_SIZE,
} from './listingPagination'

export type ListingSearchParams = {
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

export type StorefrontPropertyMedia = {
  title: string
  mediaType: string
  imagePath: string
  externalUrl: string
  altText: string
  caption: string
  sortOrder: number
  isHero: boolean
}

export type StorefrontProperty = {
  id: string
  title: string
  slug: string
  status: string
  listingType: string
  propertyType: string
  shortDescription: string
  description: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  neighborhood: string
  addressLabel: string
  price: string
  bedrooms?: number | null
  bathrooms: string
  squareFeet?: number | null
  lotSizeSquareFeet?: number | null
  yearBuilt?: number | null
  hoaFee: string
  availableAt: string
  isFeatured: boolean
  virtualTourUrl: string
  leaseTerm: string
  securityDeposit?: number | null
  petPolicy: string
  imagePath: string
  assignedAgent?: {
    name: string
    email: string
    phone: string
    brokerageTitle: string
    imagePath: string
  } | null
  media: StorefrontPropertyMedia[]
  openHouses: Array<{ id: string; title: string; startsAt: string; endsAt: string; hostName: string }>
}

type ListingsResponse = { publicRealEstateListings: StorefrontProperty[] }
type ListingResponse = { publicRealEstateListing: StorefrontProperty | null }

const LISTING_SELECTION = `
  id title slug status listingType propertyType shortDescription description
  addressLine1 addressLine2 city state postalCode neighborhood
  price bedrooms bathrooms squareFeet lotSizeSquareFeet yearBuilt hoaFee availableAt isFeatured virtualTourUrl leaseTerm securityDeposit petPolicy imagePath
  assignedAgent { name email phone brokerageTitle imagePath }
  media { title mediaType imagePath externalUrl altText caption sortOrder isHero }
  openHouses { id title startsAt endsAt hostName }
`

function clean(value?: string) {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function normalize(listing: StorefrontProperty): StorefrontProperty {
  const media = listing.media || []
  const persistedPhoto = media.find(item => item.mediaType === 'photo' && item.imagePath)?.imagePath
  return {
    ...listing,
    addressLabel: listing.addressLabel || [listing.addressLine1, listing.city, listing.state].filter(Boolean).join(', '),
    imagePath: listing.imagePath || persistedPhoto || '',
    assignedAgent: listing.assignedAgent ? {
      ...listing.assignedAgent,
      imagePath: listing.assignedAgent.imagePath || '',
    } : null,
    media,
  }
}

const PROPERTY_TYPES = ['house', 'condo', 'townhome', 'multi_family', 'land', 'commercial']

function cleanPrice(value?: string) {
  const amount = String(value || '').replace(/[$,\s]/g, '')
  return /^\d{1,10}(?:\.\d{1,2})?$/.test(amount) && Number(amount) > 0 ? amount : undefined
}

function cleanCount(value?: string) {
  const count = Number(value)
  return Number.isInteger(count) && count > 0 && count <= 20 ? String(count) : undefined
}

/** Drops filter values the listing query would reject, so a bad URL widens the search instead of failing it. */
export function normalizeListingParams(params: ListingSearchParams): ListingSearchParams {
  let minPrice = cleanPrice(params.minPrice), maxPrice = cleanPrice(params.maxPrice)
  if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) [minPrice, maxPrice] = [maxPrice, minPrice]
  const q = clean(params.q)?.slice(0, 120), city = clean(params.city)?.slice(0, 80)
  return {
    ...(q ? { q } : {}),
    ...(city ? { city } : {}),
    ...(params.type === 'sale' || params.type === 'rent' ? { type: params.type } : {}),
    ...(params.propertyType && PROPERTY_TYPES.includes(params.propertyType) ? { propertyType: params.propertyType } : {}),
    ...(minPrice ? { minPrice } : {}),
    ...(maxPrice ? { maxPrice } : {}),
    ...(cleanCount(params.beds) ? { beds: cleanCount(params.beds) } : {}),
    ...(cleanCount(params.baths) ? { baths: cleanCount(params.baths) } : {}),
    ...(LISTING_SORTS.some(([value]) => value && value === params.sort) ? { sort: params.sort } : {}),
    ...(params.skip ? { skip: params.skip } : {}),
  }
}

function buildFilters(raw: ListingSearchParams) {
  const params = normalizeListingParams(raw)
  return {
    ...(params.q ? { q: params.q } : {}),
    ...(params.city ? { city: params.city } : {}),
    ...(params.type ? { listingType: params.type } : {}),
    ...(params.propertyType ? { propertyType: params.propertyType } : {}),
    ...(params.minPrice ? { minPrice: params.minPrice } : {}),
    ...(params.maxPrice ? { maxPrice: params.maxPrice } : {}),
    ...(params.beds ? { bedrooms: Number(params.beds) } : {}),
    ...(params.baths ? { bathrooms: Number(params.baths) } : {}),
    ...(params.sort ? { sort: params.sort } : {}),
  }
}

const UNAVAILABLE = 'Homes could not be loaded right now.'

export async function getStorefrontListings(params: ListingSearchParams = {}) {
  const skip = parseListingSkip(params.skip)
  const brokerageSlug = await getStorefrontBrokerageSlug()
  if (!brokerageSlug) return { listings: [], count: 0, hasMore: false, skip, overflow: false, error: UNAVAILABLE }
  const response = await keystoneClient<ListingsResponse>(`
    query StorefrontListings($brokerageSlug: String!, $filters: PublicRealEstateListingFilters, $take: Int!, $skip: Int!) {
      publicRealEstateListings(brokerageSlug: $brokerageSlug, filters: $filters, take: $take, skip: $skip) { ${LISTING_SELECTION} }
    }
  `, {
    brokerageSlug,
    filters: buildFilters(params),
    take: STOREFRONT_LISTING_QUERY_SIZE,
    skip,
  }, { cache: 'no-store' })

  if (!response.success) {
    const overflow = response.error.includes('PUBLIC_LISTING_SCAN_OVERFLOW')
    return {
      listings: [],
      count: 0,
      hasMore: false,
      skip,
      overflow,
      error: overflow ? 'This search is too broad. Add a filter or go back a page.' : UNAVAILABLE,
    }
  }
  const page = splitListingPage(response.data.publicRealEstateListings)
  const listings = page.items.map(normalize)
  return { listings, count: listings.length, hasMore: page.hasMore, skip, overflow: false, error: null }
}

export function hasListingFilters(raw: ListingSearchParams) {
  const params = normalizeListingParams(raw)
  return Boolean(params.q || params.city || params.type || params.propertyType || params.minPrice || params.maxPrice
    || params.beds || params.baths || parseListingSkip(params.skip) > 0)
}

export function getStorefrontListingPageHref(params: ListingSearchParams, skip: number) {
  return listingPageHref(params, skip)
}

export async function getStorefrontListingBySlug(slug: string) {
  const brokerageSlug = await getStorefrontBrokerageSlug()
  if (!brokerageSlug) return { listing: null, error: UNAVAILABLE }
  const response = await keystoneClient<ListingResponse>(`
    query StorefrontListing($brokerageSlug: String!, $slug: String!) {
      publicRealEstateListing(brokerageSlug: $brokerageSlug, slug: $slug) { ${LISTING_SELECTION} }
    }
  `, { brokerageSlug, slug }, { cache: 'no-store' })

  if (!response.success) return { listing: null, error: response.error }
  return {
    listing: response.data.publicRealEstateListing ? normalize(response.data.publicRealEstateListing) : null,
    error: null,
  }
}
