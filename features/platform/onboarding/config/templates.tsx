import { Building, Home } from 'lucide-react'
import seed from '../lib/seed.json'
import expansionSeed from '../lib/expansion-seed.json'

export type TemplateType = 'minimal' | 'full'

type CoreSectionKey = keyof typeof seed.sections

export interface BrokerageTemplate {
  name: string
  description: string
  icon: typeof Home
}

/** The two setups the brokerage owner chooses between; descriptions come from seed.json. */
export const STORE_TEMPLATES: Record<TemplateType, BrokerageTemplate> = {
  minimal: { name: 'Basic setup', description: seed.templateModes.minimal, icon: Home },
  full: { name: 'Complete setup', description: seed.templateModes.full, icon: Building },
}

export interface SectionDefinition {
  id: number
  type: CoreSectionKey
  label: string
  getItemsFn: (template: TemplateType) => string[]
}

function seedLabels(key: CoreSectionKey, template: TemplateType) {
  return seed.sections[key].items.filter(item => item.templates.includes(template)).map(item => item.label)
}

const SECTIONS: Array<[CoreSectionKey, string]> = [
  ['agents', 'Agents'],
  ['properties', 'Listings'],
  ['routingRules', 'Lead routing'],
  ['leads', 'Leads'],
  ['showings', 'Showings'],
  ['deals', 'Deals'],
]

/** Sections shown in the setup preview, in order. */
export const SECTION_DEFINITIONS: SectionDefinition[] = SECTIONS.map(([type, label], index) => ({
  id: index + 1,
  type,
  label,
  getItemsFn: template => seedLabels(type, template),
}))

const OPERATIONS_LABELS: Record<string, string> = {
  Neighborhood: 'Neighborhood guide',
  PropertyMedia: 'Listing photos',
  PropertyInspection: 'Inspection',
  Offer: 'Accepted offer',
  DealDocument: 'Seller disclosure',
  Commission: 'Commission',
  SavedSearch: 'Saved search',
  SavedProperty: 'Saved property',
  MarketComp: 'Market comp',
  AgentTeam: 'Agent team',
  AgentTask: 'Agent task',
  ListingSyndication: 'MLS syndication',
  SourceFeed: 'Listing feed',
  OpenHouse: 'Open house',
  ShowingFeedback: 'Showing feedback',
  Escrow: 'Escrow',
  TitleOrder: 'Title order',
  MortgageApplication: 'Mortgage application',
  TransactionMilestone: 'Closing milestone',
  PropertyValuation: 'Valuation',
  Disclosure: 'HOA disclosure',
  SavedSearchAlert: 'Saved-search alert',
}

/** Transaction records only the complete setup adds. */
export function operationItems(template: TemplateType) {
  return template === 'full' ? expansionSeed.records.map(record => OPERATIONS_LABELS[record.listKey] || record.listKey) : []
}
