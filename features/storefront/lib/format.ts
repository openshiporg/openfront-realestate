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
