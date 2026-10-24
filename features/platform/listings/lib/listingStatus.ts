import type { Tone } from '../../components/PlatformUI'
import type { PlatformListingStats } from '../actions/listings'

export const listingStatuses: Array<{ value: string; label: string; tone: Tone; stat?: keyof PlatformListingStats }> = [
  { value: 'active', label: 'Active', tone: 'emerald', stat: 'active' },
  { value: 'coming_soon', label: 'Coming soon', tone: 'sky', stat: 'comingSoon' },
  { value: 'pending', label: 'Pending', tone: 'amber', stat: 'pending' },
  { value: 'draft', label: 'Draft', tone: 'zinc' },
  { value: 'sold', label: 'Sold', tone: 'indigo', stat: 'sold' },
  { value: 'rented', label: 'Rented', tone: 'violet' },
  { value: 'off_market', label: 'Off market', tone: 'rose', stat: 'offMarket' },
]
