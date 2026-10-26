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

/** Valid forward moves per stage (matches the server transition map), the usual next move first. Closed lost is offered separately. */
export const stageNext: Record<string, string[]> = {
  prospecting: ['active_search'],
  active_search: ['offer_drafted'],
  offer_drafted: ['under_contract', 'active_search'],
  under_contract: ['inspection', 'financing', 'closed_won'],
  inspection: ['financing', 'closed_won', 'under_contract'],
  financing: ['closed_won', 'inspection', 'under_contract'],
}

export function stageLabel(stage: string) {
  return dealStages.find(([value]) => value === stage)?.[1] || stage.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
}

/** Verbed label for moving a deal into a stage. */
export function moveLabel(stage: string) {
  if (stage === 'closed_won') return 'Mark closed won'
  if (stage === 'closed_lost') return 'Mark lost'
  return `Move to ${stageLabel(stage)}`
}
