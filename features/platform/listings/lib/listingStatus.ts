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

export type ListingTransition = { status: string; label: string; kind: 'primary' | 'normal' | 'withdraw' }

/** Status changes allowed from the current status (mirrors transitionPropertyStatus). Publish is the forward step; Withdraw is last. */
export function listingTransitions(status: string, listingType: string | null): ListingTransition[] {
  const isRental = listingType === 'rent'
  const moves: ListingTransition[] = []
  if (['draft', 'coming_soon', 'off_market'].includes(status)) moves.push({ status: 'active', label: 'Publish', kind: 'primary' })
  if (['draft', 'off_market'].includes(status)) moves.push({ status: 'coming_soon', label: 'Mark coming soon', kind: 'normal' })
  if (status === 'active') moves.push({ status: 'pending', label: 'Mark pending', kind: 'normal' })
  if (status === 'pending') moves.push({ status: 'active', label: 'Back to active', kind: 'normal' })
  if (['active', 'pending'].includes(status)) moves.push({ status: isRental ? 'rented' : 'sold', label: isRental ? 'Mark rented' : 'Mark sold', kind: 'normal' })
  if (['draft', 'active', 'coming_soon', 'pending', 'sold', 'rented'].includes(status)) moves.push({ status: 'off_market', label: 'Withdraw', kind: 'withdraw' })
  return moves
}
