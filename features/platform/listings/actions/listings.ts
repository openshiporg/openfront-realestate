'use server'

import { revalidatePath } from 'next/cache'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { projectListingWorkspaceResponse } from '../lib/listingWorkspaceProjection'

export type PlatformListing = {
  id: string
  title: string
  slug: string
  status: string
  listingType: string | null
  propertyType: string | null
  shortDescription: string | null
  addressLine1: string
  city: string
  state: string
  postalCode: string | null
  price: string
  bedrooms: number
  bathrooms: string
  squareFeet: number | null
  isFeatured: boolean
  primaryImageUrl: string | null
  updatedAt: string
  leadsCount: number | null
  showingsCount: number | null
  assignedAgent: { id: string; name: string; email: string } | null
}

export type PlatformListingStats = {
  total: number
  active: number
  comingSoon: number
  pending: number
  sold: number
  offMarket: number
}

export type PlatformListingPageInfo = {
  hasNextPage: boolean
  hasPreviousPage: boolean
  nextCursor: string | null
  previousCursor: string | null
}

export type GetPlatformListingsResult = {
  items: PlatformListing[]
  stats: PlatformListingStats | null
  pageInfo: PlatformListingPageInfo | null
  error: string | null
}

const LISTING_PAGE_SIZE = 60

export async function getPlatformListings(status = 'all', q = '', after?: string, before?: string): Promise<GetPlatformListingsResult> {
  const query = `
    query PlatformListings($status: String, $q: String, $take: Int!, $after: String, $before: String) {
      platformListings(status: $status, q: $q, take: $take, after: $after, before: $before) {
        items { id title slug status listingType propertyType shortDescription addressLine1 city state postalCode price bedrooms bathrooms squareFeet isFeatured primaryImageUrl updatedAt leadsCount showingsCount assignedAgent { id name email } }
        stats { total active comingSoon pending sold offMarket }
        pageInfo { hasNextPage hasPreviousPage nextCursor previousCursor }
      }
    }
  `
  const response = await keystoneClient<unknown>(query, { status, q, take: LISTING_PAGE_SIZE, after: after ?? null, before: before ?? null }, { cache: 'no-store' })
  return projectListingWorkspaceResponse(response)
}

export async function transitionListingStatus(_state: { ok: boolean; message: string }, formData: FormData) {
  const id = String(formData.get('propertyId') || ''), status = String(formData.get('status') || '')
  if (!id || !status) return { ok: false, message: 'Listing and status are required.' }
  const mutation = `mutation TransitionListing($id: ID!, $status: String!, $key: String!) { transitionPropertyStatus(data: { id: $id, status: $status, idempotencyKey: $key }) { ok message } }`
  const response = await keystoneClient<any>(mutation, { id, status, key: crypto.randomUUID() }, { cache: 'no-store' })
  if (!response.success || !response.data.transitionPropertyStatus.ok) return { ok: false, message: response.success ? response.data.transitionPropertyStatus.message : 'Could not update the listing.' }
  revalidatePath('/dashboard/platform/listings')
  return { ok: true, message: 'Listing status updated.' }
}
