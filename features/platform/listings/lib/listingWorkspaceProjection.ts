import type { GetPlatformListingsResult, PlatformListing, PlatformListingPageInfo, PlatformListingStats } from '../actions/listings'

const DECIMAL = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/
const UNSAFE_CSS_URL = /[\s"'()\\\u0000-\u001f\u007f]/

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function requiredString(value: Record<string, unknown>, key: string, nonEmpty = false): boolean {
  return typeof value[key] === 'string' && (!nonEmpty || (value[key] as string).trim().length > 0)
}

function nullableString(value: Record<string, unknown>, key: string): boolean {
  return hasOwn(value, key) && (value[key] === null || typeof value[key] === 'string')
}

function decimalString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && DECIMAL.test(value) && Number.isFinite(Number(value))
}

function validImageReference(value: unknown): boolean {
  if (value === null || value === '') return true
  if (typeof value !== 'string' || UNSAFE_CSS_URL.test(value)) return false
  if (value.startsWith('/')) return !value.startsWith('//')
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname)
  } catch {
    return false
  }
}

function validNullableCount(value: unknown): boolean {
  return value === null || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
}

function validAgent(value: unknown): boolean {
  return value === null || (record(value)
    && requiredString(value, 'id', true)
    && requiredString(value, 'name')
    && requiredString(value, 'email'))
}

function validListing(value: unknown): value is PlatformListing {
  if (!record(value) || !requiredString(value, 'id', true) || !requiredString(value, 'title') || !requiredString(value, 'slug', true) || !requiredString(value, 'status', true)) return false
  if (!['listingType', 'propertyType', 'shortDescription', 'postalCode'].every(key => nullableString(value, key))) return false
  if (!requiredString(value, 'addressLine1') || !requiredString(value, 'city') || !requiredString(value, 'state')) return false
  if (!decimalString(value.price) || !decimalString(value.bathrooms)) return false
  if (typeof value.bedrooms !== 'number' || !Number.isSafeInteger(value.bedrooms) || value.bedrooms < 0) return false
  if (!(value.squareFeet === null || (typeof value.squareFeet === 'number' && Number.isSafeInteger(value.squareFeet)))) return false
  if (typeof value.isFeatured !== 'boolean') return false
  if (!nullableString(value, 'primaryImageUrl') || !validImageReference(value.primaryImageUrl)) return false
  if (typeof value.updatedAt !== 'string' || !Number.isFinite(new Date(value.updatedAt).getTime())) return false
  if (!validNullableCount(value.leadsCount) || !validNullableCount(value.showingsCount)) return false
  return hasOwn(value, 'assignedAgent') && validAgent(value.assignedAgent)
}

function validPageInfo(value: unknown): value is PlatformListingPageInfo {
  if (!record(value) || typeof value.hasNextPage !== 'boolean' || typeof value.hasPreviousPage !== 'boolean') return false
  const validCursor = (cursor: unknown) => cursor === null || (typeof cursor === 'string' && cursor.length <= 2048 && /^[A-Za-z0-9_-]+$/.test(cursor))
  if (!hasOwn(value, 'nextCursor') || !hasOwn(value, 'previousCursor')) return false
  if (!validCursor(value.nextCursor) || !validCursor(value.previousCursor)) return false
  return value.hasNextPage === (value.nextCursor !== null) && value.hasPreviousPage === (value.previousCursor !== null)
}

function validStats(value: unknown): value is PlatformListingStats {
  if (!record(value)) return false
  const keys = ['total', 'active', 'comingSoon', 'pending', 'sold', 'offMarket'] as const
  if (!keys.every(key => typeof value[key] === 'number' && Number.isSafeInteger(value[key]) && (value[key] as number) >= 0 && (value[key] as number) <= 500)) return false
  const total = value.total as number
  const active = value.active as number
  const comingSoon = value.comingSoon as number
  const pending = value.pending as number
  const sold = value.sold as number
  const offMarket = value.offMarket as number
  return active + comingSoon + pending + sold + offMarket <= total
}

function readListingWorkspace(value: unknown): { items: PlatformListing[]; stats: PlatformListingStats; pageInfo: PlatformListingPageInfo } | null {
  if (!record(value)) return null
  const workspace = value.platformListings
  if (!record(workspace)) return null
  const rawItems = workspace.items
  const stats = workspace.stats
  const pageInfo = workspace.pageInfo
  if (!Array.isArray(rawItems) || rawItems.length > 60 || !validStats(stats) || !validPageInfo(pageInfo)) return null
  const items: PlatformListing[] = []
  for (const item of rawItems) {
    if (!validListing(item)) return null
    items.push(item)
  }
  if (items.length > stats.total) return null
  return { items, stats, pageInfo }
}

export function projectListingWorkspaceResponse(response: unknown): GetPlatformListingsResult {
  if (!record(response) || response.success !== true) {
    const message = record(response) && typeof response.error === 'string' && response.error
      ? response.error
      : 'Please try again.'
    return { items: [], stats: null, pageInfo: null, error: message }
  }

  const workspace = readListingWorkspace(response.data)
  if (!workspace) {
    return { items: [], stats: null, pageInfo: null, error: 'Please refresh and try again.' }
  }
  return { ...workspace, error: null }
}
