import type { Tone } from '../../components/PlatformUI'

export const dealStages: Array<[string, string, Tone]> = [
  ['prospecting', 'Prospecting', 'zinc'],
  ['active_search', 'Active search', 'sky'],
  ['offer_drafted', 'Offer drafted', 'violet'],
  ['under_contract', 'Under contract', 'amber'],
  ['inspection', 'Inspection', 'amber'],
  ['financing', 'Financing', 'indigo'],
  ['closed_won', 'Closed won', 'emerald'],
  ['closed_lost', 'Closed lost', 'rose'],
]
