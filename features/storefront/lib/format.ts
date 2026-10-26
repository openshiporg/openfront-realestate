import { formatMoney } from '@/features/lib/money'
import type { StorefrontProperty } from '@/features/storefront/lib/data/properties'

const propertyTypeLabels: Record<string, string> = {
  house: 'House',
  condo: 'Condo',
  townhome: 'Townhome',
  multi_family: 'Multi-family',
  land: 'Land',
  commercial: 'Commercial',
}

export function formatPrice(listing: Pick<StorefrontProperty, 'price' | 'listingType'>) {
  const formatted = formatMoney(listing.price || '0')
  return listing.listingType === 'rent' ? `${formatted}/mo` : formatted
}

export function formatLocation(listing: Pick<StorefrontProperty, 'addressLabel' | 'city' | 'state' | 'neighborhood'>) {
  if (listing.addressLabel) return listing.addressLabel
  if (listing.neighborhood) return [listing.neighborhood, listing.city].filter(Boolean).join(', ')
  return [listing.city, listing.state].filter(Boolean).join(', ')
}

export function propertyTypeLabel(value?: string | null) {
  return propertyTypeLabels[value || ''] || 'Home'
}


const statusLabels: Record<string, string> = {
  active: 'Active',
  coming_soon: 'Coming soon',
  pending: 'Pending',
  sold: 'Sold',
  rented: 'Rented',
  off_market: 'Off market',
  draft: 'Draft',
}

export function listingStatusLabel(status?: string | null) {
  return statusLabels[status || ''] || (status ? status.replace(/_/g, ' ') : '')
}

const showingStatusLabels: Record<string, string> = {
  requested: 'Requested',
  scheduled: 'Scheduled',
  completed: 'Completed',
  no_show: 'Missed',
  cancelled: 'Cancelled',
}

const showingTypeLabels: Record<string, string> = {
  in_person: 'In person',
  virtual: 'Virtual',
  open_house: 'Open house',
}

export function showingStatusLabel(value?: string | null) {
  return showingStatusLabels[value || ''] || (value ? value.replace(/_/g, ' ') : '—')
}

export function showingTypeLabel(value?: string | null) {
  return showingTypeLabels[value || ''] || (value ? value.replace(/_/g, ' ') : '—')
}

export function phoneHref(phone?: string | null) {
  const digits = String(phone || '').replace(/[^+\d]/g, '')
  return digits ? `tel:${digits}` : null
}

export function emailHref(email?: string | null) {
  const value = String(email || '').trim()
  return value ? `mailto:${value}` : null
}

/** Email first, then phone; null when the brokerage has published neither. */
export function contactHref(settings: { publicEmail?: string | null; publicPhone?: string | null }) {
  return emailHref(settings.publicEmail) || phoneHref(settings.publicPhone)
}

export type StatusTone = 'active' | 'soon' | 'pending' | 'closed' | 'cancelled'

export function listingTone(status?: string | null): StatusTone {
  if (status === 'coming_soon') return 'soon'
  if (status === 'pending') return 'pending'
  if (status === 'active') return 'active'
  return 'closed'
}

export function listingMarketLabel(listing: Pick<StorefrontProperty, 'status' | 'listingType'>) {
  if (listing.status === 'coming_soon') return 'Coming soon'
  if (listing.status === 'pending') return 'Pending'
  return listing.listingType === 'rent' ? 'For rent' : 'For sale'
}

export function showingTone(status?: string | null): StatusTone {
  if (status === 'scheduled') return 'active'
  if (status === 'requested') return 'pending'
  if (status === 'cancelled' || status === 'no_show') return 'cancelled'
  return 'closed'
}

export function initials(name?: string | null) {
  return String(name || '').split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase()
}

/** Sale price per finished square foot; empty for rentals, land without a building, or missing figures. */
export function formatPricePerSqFt(listing: Pick<StorefrontProperty, 'price' | 'listingType' | 'squareFeet'>) {
  const price = Number(listing.price)
  const area = Number(listing.squareFeet)
  if (listing.listingType === 'rent' || !Number.isFinite(price) || price <= 0 || !Number.isFinite(area) || area <= 0) return ''
  return `$${Math.round(price / area).toLocaleString('en-US')}`
}

/** Literal market status for result modules: "Under contract" rather than a bare "Pending". */
export function listingStatusPlate(listing: Pick<StorefrontProperty, 'status' | 'listingType'>) {
  if (listing.status === 'pending') return 'Under contract'
  return listingMarketLabel(listing)
}

/** The listing's place for a result module: its neighbourhood, else its city. */
export function listingPlace(listing: Pick<StorefrontProperty, 'neighborhood' | 'city'>) {
  return listing.neighborhood || listing.city || ''
}

/** "Homes for sale in Austin" style heading for a search. */
export function resultsHeading(type: string | undefined, city: string) {
  const what = type === 'sale' ? 'Homes for sale' : type === 'rent' ? 'Homes for rent' : 'Homes for sale and rent'
  return city ? `${what} in ${city}` : what
}

/** The rail's count of the results on screen; the loader has no total, so a further page reads "25+". */
export function resultCountLabel(result: { count: number; skip: number; hasMore: boolean; error: string | null }) {
  if (result.error) return ''
  const total = result.skip + result.count
  if (result.count === 0) return 'No homes'
  return result.hasMore ? `${total}+ homes` : `${total} ${total === 1 ? 'home' : 'homes'}`
}
