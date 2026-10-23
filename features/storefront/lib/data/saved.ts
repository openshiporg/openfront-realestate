'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { getStorefrontBrokerageSlug } from '@/features/storefront/lib/brokerage'
import { normalizeListingParams, type ListingSearchParams, type StorefrontProperty } from './properties'

export type SavedSearch = {
  id: string
  name: string
  keywords: string
  propertyType: string
  minPrice: string | null
  maxPrice: string | null
  minBedrooms: number | null
  minBathrooms: string | null
}

export type SaveHomeState = { savedId: string | null; message: string }
export type SaveSearchState = { ok: boolean; message: string }

type SavedDiscoveryResult = { ok: boolean; message: string; itemId: string | null }

const LISTING_SELECTION = `
  id title slug status listingType propertyType shortDescription description
  addressLine1 addressLine2 city state postalCode neighborhood
  price bedrooms bathrooms squareFeet lotSizeSquareFeet yearBuilt hoaFee availableAt isFeatured virtualTourUrl imagePath
  assignedAgent { name email phone brokerageTitle imagePath }
  media { title mediaType imagePath externalUrl altText caption sortOrder isHero }
  openHouses { id title startsAt endsAt hostName }
`

/** propertyId -> savedPropertyId for the signed-in shopper; empty when signed out. */
export async function getSavedPropertyIds(): Promise<Record<string, string>> {
  const brokerageSlug = await getStorefrontBrokerageSlug()
  if (!brokerageSlug) return {}
  const result = await keystoneClient<{ customerSavedProperties: Array<{ id: string; propertyId: string }> }>(
    'query CustomerSavedProperties($brokerageSlug: String!) { customerSavedProperties(brokerageSlug: $brokerageSlug) { id propertyId } }',
    { brokerageSlug },
    { cache: 'no-store' },
  )
  return result.success ? Object.fromEntries(result.data.customerSavedProperties.map(item => [item.propertyId, item.id])) : {}
}

export async function getSavedHomes() {
  const brokerageSlug = await getStorefrontBrokerageSlug()
  if (!brokerageSlug) return { items: [] as StorefrontProperty[], error: 'Saved homes could not be loaded.' }
  const result = await keystoneClient<{ customerSavedHomes: StorefrontProperty[] }>(
    `query CustomerSavedHomes($brokerageSlug: String!) { customerSavedHomes(brokerageSlug: $brokerageSlug) { ${LISTING_SELECTION} } }`,
    { brokerageSlug },
    { cache: 'no-store' },
  )
  if (!result.success) return { items: [] as StorefrontProperty[], error: 'Saved homes could not be loaded.' }
  const items = result.data.customerSavedHomes.map(listing => ({
    ...listing,
    addressLabel: [listing.addressLine1, listing.city, listing.state].filter(Boolean).join(', '),
    imagePath: listing.imagePath || listing.media.find(item => item.mediaType === 'photo' && item.imagePath)?.imagePath || '',
  }))
  return { items, error: null }
}

export async function getSavedSearches(userId: string) {
  const result = await keystoneClient<{ savedSearches: SavedSearch[] }>(
    `query CustomerSavedSearches($userId: ID!) {
      savedSearches(where: { user: { id: { equals: $userId } } }, orderBy: [{ createdAt: desc }], take: 50) { id name keywords propertyType minPrice maxPrice minBedrooms minBathrooms }
    }`,
    { userId },
    { cache: 'no-store' },
  )
  if (!result.success) return { items: [] as SavedSearch[], error: 'Saved searches could not be loaded.' }
  return { items: result.data.savedSearches, error: null }
}

function listingPath(value: FormDataEntryValue | null) {
  const path = String(value || '')
  return /^\/listings\/[a-z0-9-]+$/.test(path) ? path : ''
}

export async function toggleSavedHome(previous: SaveHomeState, form: FormData): Promise<SaveHomeState> {
  const propertyId = String(form.get('propertyId') || '').trim()
  const back = listingPath(form.get('listingPath'))
  if (!propertyId || propertyId.length > 200) return { ...previous, message: 'This home could not be saved.' }

  if (previous.savedId) {
    const result = await keystoneClient<{ removeSavedPropertyForCurrentUser: SavedDiscoveryResult }>(
      'mutation RemoveSavedHome($data: SavedPropertyIdInput!) { removeSavedPropertyForCurrentUser(data: $data) { ok message itemId } }',
      { data: { savedPropertyId: previous.savedId } },
      { cache: 'no-store' },
    )
    if (!result.success || !result.data.removeSavedPropertyForCurrentUser.ok) return { ...previous, message: 'This home could not be removed.' }
    revalidatePath('/account/saved')
    return { savedId: null, message: '' }
  }

  const result = await keystoneClient<{ savePropertyForCurrentUser: SavedDiscoveryResult }>(
    'mutation SaveHome($data: SavePropertyForCurrentUserInput!) { savePropertyForCurrentUser(data: $data) { ok message itemId } }',
    { data: { propertyId } },
    { cache: 'no-store' },
  )
  if (!result.success) redirect(`/account${back ? `?from=${encodeURIComponent(back)}` : ''}`)
  const saved = result.data.savePropertyForCurrentUser
  if (!saved.ok || !saved.itemId) {
    if (saved.message.startsWith('Sign in')) redirect(`/account${back ? `?from=${encodeURIComponent(back)}` : ''}`)
    return { ...previous, message: 'This home could not be saved.' }
  }
  revalidatePath('/account/saved')
  return { savedId: saved.itemId, message: '' }
}

function searchName(params: ListingSearchParams) {
  const parts = [
    params.q,
    params.type === 'sale' ? 'For sale' : params.type === 'rent' ? 'For rent' : '',
    params.propertyType ? params.propertyType.replace(/_/g, ' ') : '',
    params.beds ? `${params.beds}+ beds` : '',
    params.baths ? `${params.baths}+ baths` : '',
    params.minPrice ? `from $${Number(params.minPrice).toLocaleString('en-US')}` : '',
    params.maxPrice ? `up to $${Number(params.maxPrice).toLocaleString('en-US')}` : '',
  ].filter(Boolean)
  return (parts.join(' · ') || 'All homes').slice(0, 120)
}

export async function saveCurrentSearch(_previous: SaveSearchState, form: FormData): Promise<SaveSearchState> {
  const params = normalizeListingParams({
    q: String(form.get('q') || ''),
    type: String(form.get('type') || ''),
    propertyType: String(form.get('propertyType') || ''),
    minPrice: String(form.get('minPrice') || ''),
    maxPrice: String(form.get('maxPrice') || ''),
    beds: String(form.get('beds') || ''),
    baths: String(form.get('baths') || ''),
  })
  const data = {
    name: searchName(params),
    keywords: params.q || '',
    propertyType: params.propertyType || '',
    minPrice: params.minPrice || null,
    maxPrice: params.maxPrice || null,
    minBedrooms: params.beds ? Number(params.beds) : null,
    minBathrooms: params.baths || null,
  }
  const result = await keystoneClient<{ saveSearchForCurrentUser: SavedDiscoveryResult }>(
    'mutation SaveSearch($data: SaveSearchForCurrentUserInput!) { saveSearchForCurrentUser(data: $data) { ok message itemId } }',
    { data },
    { cache: 'no-store' },
  )
  if (!result.success || !result.data.saveSearchForCurrentUser.ok) return { ok: false, message: 'This search could not be saved.' }
  revalidatePath('/account/saved')
  return { ok: true, message: 'Search saved' }
}

export async function deleteSavedSearch(form: FormData) {
  const savedSearchId = String(form.get('savedSearchId') || '').trim()
  if (!savedSearchId || savedSearchId.length > 200) return
  await keystoneClient(
    'mutation DeleteSavedSearch($data: SavedSearchIdInput!) { deleteSavedSearchForCurrentUser(data: $data) { ok } }',
    { data: { savedSearchId } },
    { cache: 'no-store' },
  )
  revalidatePath('/account/saved')
}
