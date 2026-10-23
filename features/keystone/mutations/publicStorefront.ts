import type { Context } from '.keystone/types'

import { upgradeLegacyImagePath } from '../../lib/real-estate-images'
import { ListingAuthorityDeniedError, requireListingAuthority } from '../lib/authorityEvidence'
import {
  collectEligiblePage,
  PUBLIC_LISTING_CANDIDATE_BATCH_SIZE,
  PUBLIC_LISTING_CANDIDATE_SCAN_LIMIT,
} from '../lib/publicListingPagination'

const PUBLIC_STATUSES = ['active', 'coming_soon'] as const
const PUBLIC_LISTING_MEDIA_LIMIT = 20
const PUBLIC_LISTING_QUERY = `
  id title slug status listingType propertyType shortDescription description
  addressLine1 addressLine2 city state postalCode neighborhood
  price bedrooms bathrooms squareFeet lotSizeSquareFeet yearBuilt hoaFee availableAt isFeatured virtualTourUrl
  leaseTerm securityDeposit petPolicy
  primaryImageUrl
  brokerage { id }
  assignedAgent { id name email phone brokerageTitle avatarUrl brokerageMemberships(where: { status: { equals: active } }) { brokerage { id status } } }
`

export type PublicListingFilters = {
  q?: string | null
  city?: string | null
  listingType?: 'sale' | 'rent' | null
  propertyType?: string | null
  minPrice?: string | null
  maxPrice?: string | null
  bedrooms?: number | null
  bathrooms?: number | null
  sort?: string | null
}

const PUBLIC_LISTING_SORTS: Record<string, Array<Record<string, 'asc' | 'desc'>>> = {
  newest: [{ createdAt: 'desc' }, { id: 'asc' }],
  price_asc: [{ price: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
  price_desc: [{ price: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
}

function publicListingOrder(sort?: string | null) {
  return PUBLIC_LISTING_SORTS[clean(sort)] || [{ isFeatured: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }]
}

function clean(value?: string | null) {
  const trimmed = String(value || '').trim()
  return trimmed.length ? trimmed : ''
}

function boundedText(value: string | null | undefined, label: string, max = 120) {
  const text = clean(value)
  if (text.length > max) throw new Error(`${label} is too long.`)
  return text
}

function boundedMoney(value: string | null | undefined) {
  const amount = clean(value)
  if (amount && !/^\d{1,10}(?:\.\d{1,2})?$/.test(amount)) throw new Error('Price filters must be positive decimal amounts.')
  return amount
}

function validBrokerageSlug(value: string) {
  const slug = clean(value).toLowerCase()
  if (slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('A valid brokerage slug is required.')
  return slug
}

function buildPublicListingWhere(brokerageSlug: string, filters: PublicListingFilters = {}) {
  const q = boundedText(filters.q, 'Search')
  const city = boundedText(filters.city, 'City', 80)
  const propertyType = boundedText(filters.propertyType, 'Property type', 40)
  const minPrice = boundedMoney(filters.minPrice)
  const maxPrice = boundedMoney(filters.maxPrice)
  const where: Record<string, unknown> = {
    status: { in: [...PUBLIC_STATUSES] },
    brokerage: { slug: { equals: validBrokerageSlug(brokerageSlug) }, status: { equals: 'active' } },
  }
  const and: Record<string, unknown>[] = []

  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { neighborhood: { contains: q, mode: 'insensitive' } },
        { addressLine1: { contains: q, mode: 'insensitive' } },
        { postalCode: { contains: q, mode: 'insensitive' } },
      ],
    })
  }
  if (city) and.push({ city: { contains: city, mode: 'insensitive' } })
  if (filters.listingType) where.listingType = { equals: filters.listingType }
  if (propertyType) where.propertyType = { equals: propertyType }
  if (filters.bedrooms != null) {
    if (!Number.isInteger(filters.bedrooms) || filters.bedrooms < 0 || filters.bedrooms > 20) throw new Error('Bedrooms must be an integer from 0 to 20.')
    where.bedrooms = { gte: filters.bedrooms }
  }
  if (filters.bathrooms != null) {
    if (!Number.isInteger(filters.bathrooms) || filters.bathrooms < 0 || filters.bathrooms > 20) throw new Error('Bathrooms must be an integer from 0 to 20.')
    where.bathrooms = { gte: String(filters.bathrooms) }
  }
  if (minPrice || maxPrice) {
    if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) throw new Error('Minimum price cannot exceed maximum price.')
    where.price = { ...(minPrice ? { gte: minPrice } : {}), ...(maxPrice ? { lte: maxPrice } : {}) }
  }
  if (and.length) where.AND = and
  return where
}

function publicImagePath(value?: string | null) {
  const path = clean(value)
  return path.startsWith('/images/real-estate/') ? upgradeLegacyImagePath(path) : ''
}

function toPublicAgent(agent: any, brokerageId: string) {
  if (!agent || !(agent.brokerageMemberships || []).some((membership: any) => membership.brokerage?.id === brokerageId && membership.brokerage?.status === 'active')) return null
  return {
    name: agent.name || '',
    email: agent.email || '',
    phone: agent.phone || '',
    brokerageTitle: agent.brokerageTitle || '',
    imagePath: publicImagePath(agent.avatarUrl),
  }
}

function toPublicListing(property: any, media: readonly any[], openHouses: readonly any[]) {
  return {
    id: property.id,
    title: property.title,
    slug: property.slug,
    status: property.status,
    listingType: property.listingType,
    propertyType: property.propertyType || '',
    shortDescription: property.shortDescription || '',
    description: property.description || '',
    addressLine1: property.addressLine1,
    addressLine2: property.addressLine2 || '',
    city: property.city,
    state: property.state,
    postalCode: property.postalCode || '',
    neighborhood: property.neighborhood || '',
    price: String(property.price),
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms == null ? '' : String(property.bathrooms),
    squareFeet: property.squareFeet,
    lotSizeSquareFeet: property.lotSizeSquareFeet,
    yearBuilt: property.yearBuilt,
    hoaFee: property.hoaFee == null ? '' : String(property.hoaFee),
    availableAt: property.availableAt || '',
    isFeatured: Boolean(property.isFeatured),
    virtualTourUrl: property.virtualTourUrl || '',
    leaseTerm: property.leaseTerm || '',
    securityDeposit: property.securityDeposit ?? null,
    petPolicy: property.petPolicy || '',
    imagePath: publicImagePath(property.primaryImageUrl),
    assignedAgent: toPublicAgent(property.assignedAgent, property.brokerage.id),
    openHouses: openHouses.map(item => ({
      id: item.id,
      title: item.title,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      hostName: item.hostAgent?.name || '',
    })),
    media: media.map(item => ({
      title: item.title,
      mediaType: item.mediaType,
      imagePath: publicImagePath(item.url),
      externalUrl: publicImagePath(item.url) ? '' : item.url,
      altText: item.altText || '',
      caption: item.caption || '',
      sortOrder: item.sortOrder || 0,
      isHero: Boolean(item.isHero),
    })),
  }
}

async function findPublicMedia(context: Context, propertyId: string) {
  return context.sudo().query.PropertyMedia.findMany({
    where: { property: { id: { equals: propertyId } } },
    orderBy: [{ isHero: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    take: PUBLIC_LISTING_MEDIA_LIMIT,
    query: 'title mediaType url altText caption sortOrder isHero',
  })
}

async function findPublicOpenHouses(context: Context, propertyId: string, brokerageId: string) {
  return context.sudo().query.OpenHouse.findMany({
    where: {
      property: { id: { equals: propertyId } },
      status: { equals: 'scheduled' },
      endsAt: { gte: new Date().toISOString() },
    },
    orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    take: 10,
    query: 'id title startsAt endsAt hostAgent { name brokerageMemberships(where: { status: { equals: active } }) { brokerage { id status } } }',
  }).then(items => items.map(item => ({
    ...item,
    hostAgent: (item.hostAgent?.brokerageMemberships || []).some((membership: any) => membership.brokerage?.id === brokerageId && membership.brokerage?.status === 'active') ? item.hostAgent : null,
  })))
}

async function hasPublicListingAuthority(context: Context, property: any) {
  try {
    await requireListingAuthority(context, {
      brokerageId: property.brokerage.id,
      propertyId: property.id,
      practitionerId: property.assignedAgent?.id || '',
      jurisdictionCode: property.state,
      destination: 'public_site',
    })
    return true
  } catch (error) {
    if (error instanceof ListingAuthorityDeniedError) return false
    throw error
  }
}

export async function publicRealEstateListings(
  _root: unknown,
  { brokerageSlug, filters = {}, take = 24, skip = 0 }: { brokerageSlug: string; filters?: PublicListingFilters; take?: number; skip?: number },
  context: Context
) {
  const boundedTake = Number.isInteger(take) ? Math.min(Math.max(take, 1), 100) : 24
  const boundedSkip = Number.isInteger(skip) ? Math.min(Math.max(skip, 0), 10_000) : 0
  const where = buildPublicListingWhere(brokerageSlug, filters)
  const page = await collectEligiblePage({
    take: boundedTake,
    skip: boundedSkip,
    candidateBatchSize: PUBLIC_LISTING_CANDIDATE_BATCH_SIZE,
    candidateScanLimit: PUBLIC_LISTING_CANDIDATE_SCAN_LIMIT,
    fetchCandidates: (candidateSkip, candidateTake) => context.sudo().query.Property.findMany({
      where,
      orderBy: publicListingOrder(filters?.sort),
      take: candidateTake,
      skip: candidateSkip,
      query: PUBLIC_LISTING_QUERY,
    }),
    isEligible: property => hasPublicListingAuthority(context, property),
  })

  // Worst case: 11 candidate reads + 250 × 3 authority reads + 100 × 2
  // projection reads = 961 bounded reads; media and open houses are capped.
  const listings = []
  for (const property of page.items) {
    const [media, openHouses] = await Promise.all([
      findPublicMedia(context, property.id),
      findPublicOpenHouses(context, property.id, property.brokerage.id),
    ])
    listings.push(toPublicListing(property, media, openHouses))
  }
  return listings
}

export async function publicRealEstateListing(
  _root: unknown,
  { brokerageSlug, slug }: { brokerageSlug: string; slug: string },
  context: Context
) {
  const properties = await context.sudo().query.Property.findMany({
    where: { ...buildPublicListingWhere(brokerageSlug), slug: { equals: clean(slug) } },
    take: 1,
    query: PUBLIC_LISTING_QUERY,
  })
  const property = properties[0]
  if (!property) return null
  if (!await hasPublicListingAuthority(context, property)) return null
  const [media, openHouses] = await Promise.all([
    findPublicMedia(context, property.id),
    findPublicOpenHouses(context, property.id, property.brokerage.id),
  ])
  return toPublicListing(property, media, openHouses)
}

const SAVED_HOME_STATUSES = ['saved', 'interested'] as const

function savedHomesWhere(actor: string, brokerageSlug: string) {
  return {
    user: { id: { equals: actor } },
    status: { in: [...SAVED_HOME_STATUSES] },
    property: { brokerage: { slug: { equals: validBrokerageSlug(brokerageSlug) }, status: { equals: 'active' as const } } },
  }
}

/** The signed-in shopper's saved property ids for this brokerage, for save toggles. */
export async function customerSavedProperties(
  _root: unknown,
  { brokerageSlug }: { brokerageSlug: string },
  context: Context
) {
  const actor = context.session?.itemId
  if (!actor) return []
  const rows = await context.sudo().query.SavedProperty.findMany({
    where: savedHomesWhere(actor, brokerageSlug),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 200,
    query: 'id property { id }',
  })
  return rows.filter(row => row.property?.id).map(row => ({ id: row.id, propertyId: row.property.id }))
}

/** Saved homes that are still publicly listed, projected exactly like the public listing query. */
export async function customerSavedHomes(
  _root: unknown,
  { brokerageSlug }: { brokerageSlug: string },
  context: Context
) {
  const actor = context.session?.itemId
  if (!actor) throw new Error('Sign in to view saved homes.')
  const listingWhere = buildPublicListingWhere(brokerageSlug)
  const rows = await context.sudo().query.SavedProperty.findMany({
    where: savedHomesWhere(actor, brokerageSlug),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 100,
    query: 'id property { id }',
  })
  const listings = []
  for (const row of rows) {
    if (!row.property?.id) continue
    const property = (await context.sudo().query.Property.findMany({
      where: { ...listingWhere, id: { equals: row.property.id } },
      take: 1,
      query: PUBLIC_LISTING_QUERY,
    }))[0]
    if (!property || !await hasPublicListingAuthority(context, property)) continue
    const [media, openHouses] = await Promise.all([
      findPublicMedia(context, property.id),
      findPublicOpenHouses(context, property.id, property.brokerage.id),
    ])
    listings.push(toPublicListing(property, media, openHouses))
  }
  return listings
}
