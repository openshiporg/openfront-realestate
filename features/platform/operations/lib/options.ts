import type { OperationsWorkspace } from '../actions/operations'

export type RecordOption = { value: string; label: string }

export type OperationsOptions = {
  practitioners: RecordOption[]
  properties: RecordOption[]
  leads: RecordOption[]
  deals: RecordOption[]
  documents: RecordOption[]
  offers: RecordOption[]
  commissions: RecordOption[]
  engagements: RecordOption[]
  policies: RecordOption[]
  ledgerEntries: RecordOption[]
  batchKeys: RecordOption[]
}

type Named = { id?: string | null; name?: string | null; title?: string | null } | null | undefined

function collect(items: Named[], text: (item: NonNullable<Named>) => string | null | undefined): RecordOption[] {
  const seen = new Map<string, string>()
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue
    const label = text(item)
    if (label) seen.set(item.id, label)
  }
  return [...seen.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
}

function humanize(value?: string | null) {
  const text = (value || '').replaceAll('_', ' ').trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : ''
}

export function buildOperationsOptions(workspace: OperationsWorkspace, extra: { agents: Named[]; properties: Named[]; leads: Named[] }): OperationsOptions {
  const deals = workspace.transactions || []
  return {
    practitioners: collect([...extra.agents, ...workspace.practitionerLicenses.map((item) => item.practitioner), ...workspace.tasks.map((item) => item.assignedAgent)], (item) => item.name),
    properties: collect([...extra.properties, ...deals.map((deal) => deal.property), ...workspace.offers.map((offer) => offer.property), ...workspace.syndications.map((item) => item.property)], (item) => item.title),
    leads: collect([...extra.leads, ...deals.map((deal) => deal.lead), ...workspace.offers.map((offer) => offer.lead)], (item) => item.name),
    deals: collect(deals, (item) => item.title),
    documents: collect(deals.flatMap((deal) => (deal.documents || []).map((document: { id: string; title: string }) => ({ id: document.id, title: `${document.title} · ${deal.title}` }))), (item) => item.title),
    offers: workspace.offers.map((offer) => ({ value: offer.id, label: [offer.offerNumber, offer.property?.title].filter(Boolean).join(' · ') })),
    commissions: workspace.commissions.map((item) => ({ value: item.id, label: [item.title, item.agent?.name].filter(Boolean).join(' · ') })),
    engagements: workspace.listingEngagementAuthorities.map((item) => ({ value: item.id, label: [item.authorityNumber, item.property?.title].filter(Boolean).join(' · ') })),
    policies: workspace.retentionPolicies.map((item) => ({ value: item.id, label: `${humanize(item.retentionClass)} · ${item.jurisdictionCode} · ${item.retentionDays} days` })),
    ledgerEntries: workspace.commissionLedgerEntries.map((item) => ({ value: item.id, label: `${humanize(item.entryType)} · ${(Number(item.amountCents) / 100).toFixed(2)} ${item.currencyCode} · ${item.batchKey}` })),
    batchKeys: [...new Set(workspace.commissionLedgerEntries.map((item) => String(item.batchKey || '')).filter(Boolean))].map((key) => ({ value: key, label: key })),
  }
}
