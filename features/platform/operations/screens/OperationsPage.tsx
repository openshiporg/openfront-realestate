import Link from 'next/link'
import type { ReactNode } from 'react'
import { PageBreadcrumbs } from '@/features/dashboard/components/PageBreadcrumbs'
import { Badge } from '@/components/ui/badge'
import { formatMoney as money } from '@/features/lib/money'
import { humanize } from '../../leads/lib/labels'
import { getPlatformLeads } from '../../leads/actions/leads'
import { getPlatformListings } from '../../listings/actions/listings'
import { getPlatformPeople } from '../../people/actions/people'
import { LocalDateTime } from '../../showings/components/LocalDateTime'
import { getPlatformOperations, type OperationsWorkspace } from '../actions/operations'
import { buildOperationsOptions, type OperationsOptions } from '../lib/options'
import { AlertActions, ChecklistForm, CommissionAction, CounterOfferForm, DisclosureAction, DocumentAction, ImportForm, InspectionAction, MilestoneAction, OpenHouseAction, OfferAction, OfferDraftForm, TaskAction } from '../components/TaskForms'
import { CommissionLedgerForms, DocumentEvidenceForm, ListingEngagementForm, ListingPublicationForm, PractitionerLicenseForm, RepresentationForm, RetentionForms, SyndicationAuthorityAction } from '../components/ControlledEvidenceForms'

const sections: Array<[string, string]> = [
  ['offers', 'Offers'],
  ['closings', 'Closings'],
  ['inspections', 'Inspections'],
  ['open-houses', 'Open houses'],
  ['tasks', 'Tasks'],
  ['commissions', 'Commissions'],
  ['agreements', 'Licenses & agreements'],
  ['documents', 'Document history'],
  ['market', 'Comparables'],
  ['alerts', 'Saved search alerts'],
  ['syndication', 'Syndication'],
  ['imports', 'Imports'],
  ['records', 'Records'],
]

const syndicationLabels: Record<string, string> = { published: 'Published', removed: 'Removed', error: 'Error', draft: 'Draft' }

function DateText({ value }: { value?: string | null }) {
  return value ? <LocalDateTime value={value} options={{ dateStyle: 'medium' }} /> : <>Not set</>
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 space-y-3">
      <h2 id={`${id}-title`} className="text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{children}</p>
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <article className={`rounded-lg border border-border bg-card p-4 ${className}`}>{children}</article>
}

function TableShell({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="min-w-full text-left text-sm">{children}</table></div>
}

function OffersSection({ workspace }: { workspace: OperationsWorkspace }) {
  const openDeals = workspace.transactions.filter((deal) => !['closed_won', 'closed_lost'].includes(deal.stage))
  return (
    <Section id="offers" title="Offers">
      {workspace.offers.length ? workspace.offers.map((offer) => (
        <Card key={offer.id}>
          <div className="flex flex-col justify-between gap-2 sm:flex-row">
            <div>
              <p className="text-xs text-muted-foreground">{offer.offerNumber} · Version {offer.version}{offer.parentOffer ? ` · Counter to ${offer.parentOffer.offerNumber}` : ''}</p>
              <h3 className="mt-1 text-sm font-semibold text-foreground">{offer.property?.title} · {money(offer.amount)}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{humanize(offer.status)} · {humanize(offer.financingType)} · Response due <DateText value={offer.responseDueAt} /></p>
            </div>
            <Badge variant="outline" className="self-start">{offer.assignedAgent?.name || 'Unassigned'}</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {offer.status === 'draft' ? <OfferAction offerId={offer.id} status="submitted" label="Submit" /> : null}
            {['submitted', 'countered'].includes(offer.status) ? <><OfferAction offerId={offer.id} status="accepted" label="Accept" /><OfferAction offerId={offer.id} status="rejected" label="Reject" /></> : null}
          </div>
          {['submitted', 'countered'].includes(offer.status) ? <CounterOfferForm offerId={offer.id} /> : null}
        </Card>
      )) : <Empty>No offers</Empty>}
      {openDeals.length ? (
        <details className="rounded-lg border border-border bg-card">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">New offer</summary>
          <div className="grid gap-3 border-t border-border p-4 xl:grid-cols-2">
            {openDeals.map((deal) => (
              <div key={deal.id} className="rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{deal.title}</h3>
                    <p className="text-sm text-muted-foreground">{[deal.property?.title, deal.lead?.name].filter(Boolean).join(' · ')}</p>
                  </div>
                  <Badge variant="outline">{humanize(deal.stage)}</Badge>
                </div>
                <OfferDraftForm dealId={deal.id} />
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </Section>
  )
}

function ClosingsSection({ workspace }: { workspace: OperationsWorkspace }) {
  const closingRecords = [
    ...workspace.mortgages.map((item) => ({ id: `mortgage:${item.id}`, label: `Mortgage ${item.applicationNumber}`, detail: `${item.lenderName || 'No lender'} · ${humanize(item.status)} · ${money(item.loanAmount)}` })),
    ...workspace.titleOrders.map((item) => ({ id: `title:${item.id}`, label: `Title ${item.orderNumber}`, detail: `${item.titleCompany || 'No title company'} · ${humanize(item.status)}` })),
    ...workspace.escrows.map((item) => ({ id: `escrow:${item.id}`, label: `Escrow ${item.escrowNumber}`, detail: `${item.escrowCompany || 'No escrow company'} · ${humanize(item.status)} · Deposit ${money(item.depositAmount)}` })),
  ]
  return (
    <Section id="closings" title="Closings">
      {workspace.transactions.length ? workspace.transactions.map((deal) => (
        <Card key={deal.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{deal.title}</h3>
              <p className="text-sm text-muted-foreground">{deal.property?.title} · Expected close <DateText value={deal.expectedCloseDate} /></p>
            </div>
            <Link href="/dashboard/platform/pipeline" className="text-sm font-medium text-foreground underline-offset-4 hover:underline">Pipeline</Link>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <h4 className="text-xs font-medium text-muted-foreground">Checklist</h4>
              <ol className="mt-2 space-y-2">
                {deal.milestones.length ? deal.milestones.map((item: any) => (
                  <li key={item.id} className="flex items-start justify-between gap-3 rounded-md bg-muted/50 p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{humanize(item.status)} · Due <DateText value={item.dueAt} /> · {item.assignedTo?.name || 'Unassigned'}</p>
                    </div>
                    {item.status !== 'complete' ? <MilestoneAction milestoneId={item.id} status="complete" label="Complete" /> : null}
                  </li>
                )) : <li className="text-sm text-muted-foreground">No checklist items</li>}
              </ol>
              <ChecklistForm dealId={deal.id} />
            </div>
            <div>
              <h4 className="text-xs font-medium text-muted-foreground">Documents</h4>
              <ul className="mt-2 space-y-2">
                {deal.documents.length ? deal.documents.map((document: any) => (
                  <li key={document.id} className="flex items-start justify-between gap-3 rounded-md bg-muted/50 p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{document.title}</p>
                      <p className="text-xs text-muted-foreground">{humanize(document.documentType)} · {humanize(document.status)}{document.requiresSignature ? ' · Signature required' : ''}</p>
                    </div>
                    <DocumentAction documentId={document.id} currentStatus={document.status} />
                  </li>
                )) : <li className="text-sm text-muted-foreground">No documents</li>}
              </ul>
            </div>
          </div>
        </Card>
      )) : <Empty>No deals in progress</Empty>}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Disclosures</h3>
          {workspace.disclosures.length ? workspace.disclosures.map((item) => (
            <Card key={item.id}>
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.deal?.title} · {humanize(item.disclosureType)}</p>
                </div>
                <Badge variant="outline" className="self-start">{humanize(item.status)}</Badge>
              </div>
              <div className="mt-3 flex gap-2">
                {item.status === 'draft' ? <DisclosureAction disclosureId={item.id} status="sent" label="Mark sent" /> : null}
                {item.status === 'sent' ? <DisclosureAction disclosureId={item.id} status="acknowledged" label="Mark acknowledged" /> : null}
              </div>
            </Card>
          )) : <Empty>No disclosures</Empty>}
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Mortgage, title and escrow</h3>
          {closingRecords.length ? closingRecords.map((item) => (
            <Card key={item.id}>
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
            </Card>
          )) : <Empty>No mortgage, title or escrow records</Empty>}
        </div>
      </div>
    </Section>
  )
}

function InspectionsSection({ workspace }: { workspace: OperationsWorkspace }) {
  return (
    <Section id="inspections" title="Inspections">
      <div className="grid gap-3 lg:grid-cols-2">
        {workspace.inspections.length ? workspace.inspections.map((item) => (
          <Card key={item.id}>
            <div className="flex justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.property?.title} · {humanize(item.inspectionType)}</p>
              </div>
              <Badge variant="outline" className="self-start">{humanize(item.status)}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{item.inspectorName || 'No inspector'} · <DateText value={item.scheduledAt} /></p>
            {item.findings || item.summary ? <p className="mt-2 text-sm text-foreground/90">{item.findings || item.summary}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {item.status === 'scheduled' ? <><InspectionAction inspectionId={item.id} status="completed" label="Complete" /><InspectionAction inspectionId={item.id} status="needs_follow_up" label="Needs follow-up" /></> : null}
              {item.status === 'needs_follow_up' ? <InspectionAction inspectionId={item.id} status="completed" label="Complete" /> : null}
              {item.status === 'completed' ? <InspectionAction inspectionId={item.id} status="needs_follow_up" label="Reopen" /> : null}
            </div>
          </Card>
        )) : <Empty>No inspections</Empty>}
      </div>
    </Section>
  )
}

function OpenHousesSection({ workspace }: { workspace: OperationsWorkspace }) {
  return (
    <Section id="open-houses" title="Open houses">
      <div className="grid gap-3 lg:grid-cols-2">
        {workspace.openHouses.length ? workspace.openHouses.map((item) => (
          <Card key={item.id}>
            <div className="flex justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.property?.title} · <LocalDateTime value={item.startsAt} /> · {item.hostAgent?.name || 'No host'}</p>
              </div>
              <Badge variant="outline" className="self-start">{humanize(item.status)}</Badge>
            </div>
            {item.status === 'scheduled' ? (
              <div className="mt-3 flex gap-2">
                <OpenHouseAction openHouseId={item.id} status="completed" label="Complete" />
                <OpenHouseAction openHouseId={item.id} status="cancelled" label="Cancel" />
              </div>
            ) : null}
          </Card>
        )) : <Empty>No open houses</Empty>}
      </div>
    </Section>
  )
}

function TasksSection({ workspace }: { workspace: OperationsWorkspace }) {
  return (
    <Section id="tasks" title="Tasks">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {workspace.tasks.length ? workspace.tasks.map((item) => (
          <Card key={item.id}>
            <div className="flex items-start gap-2">
              <h3 className="min-w-0 flex-1 text-sm font-semibold text-foreground">{item.title}</h3>
              <Badge variant="outline" className="shrink-0">{humanize(item.status)}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{humanize(item.priority)} priority</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.assignedAgent?.name || 'Unassigned'} · Due <DateText value={item.dueAt} /></p>
            <p className="mt-1 text-xs text-muted-foreground">{item.property?.title || item.lead?.name || item.deal?.title || 'General'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.status !== 'done' ? <TaskAction taskId={item.id} status="done" label="Complete" /> : <TaskAction taskId={item.id} status="open" label="Reopen" />}
              {item.status === 'open' ? <TaskAction taskId={item.id} status="in_progress" label="Start" /> : null}
            </div>
          </Card>
        )) : <Empty>No tasks</Empty>}
      </div>
    </Section>
  )
}

function centsLabel(amountCents: string | number, currencyCode: string) {
  const value = Number(amountCents) / 100
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode || 'USD' }).format(value)
  } catch {
    return `${value.toFixed(2)} ${currencyCode}`
  }
}

function CommissionsSection({ workspace, options }: { workspace: OperationsWorkspace; options: OperationsOptions }) {
  return (
    <Section id="commissions" title="Commissions">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {workspace.commissions.length ? workspace.commissions.map((item) => (
          <Card key={item.id}>
            <div className="flex items-start gap-2">
              <h3 className="min-w-0 flex-1 text-sm font-semibold text-foreground">{item.title}</h3>
              <Badge variant="outline" className="shrink-0">{humanize(item.status)}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{humanize(item.side)} side</p>
            <p className="mt-1 text-sm text-muted-foreground">{[item.agent?.name, item.deal?.title].filter(Boolean).join(' · ')}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-xs text-muted-foreground">Gross</dt><dd className="font-medium text-foreground">{money(item.grossCommission)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Net</dt><dd className="font-medium text-foreground">{money(item.netCommission)}</dd></div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.status === 'projected' ? <CommissionAction commissionId={item.id} status="approved" label="Approve" /> : null}
              {item.status === 'approved' ? <><CommissionAction commissionId={item.id} status="paid" label="Mark paid" /><CommissionAction commissionId={item.id} status="clawed_back" label="Claw back" /></> : null}
            </div>
          </Card>
        )) : <Empty>No commissions</Empty>}
      </div>
      <h3 className="pt-2 text-sm font-semibold text-foreground">Commission ledger</h3>
      <CommissionLedgerForms options={options} />
      <TableShell>
        <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground"><tr><th className="p-3 font-medium">Split</th><th className="p-3 font-medium">Entry</th><th className="p-3 font-medium">Amount</th><th className="p-3 font-medium">Prepared / approved by</th></tr></thead>
        <tbody>
          {workspace.commissionLedgerEntries.map((item) => (
            <tr key={item.id} className="border-b border-border last:border-0">
              <td className="p-3 font-mono text-xs">{item.batchKey}</td>
              <td className="p-3">{humanize(item.entryType)}{item.allocationType ? ` · ${humanize(item.allocationType)}` : ''}{item.payeeLabel ? ` · ${item.payeeLabel}` : ''}</td>
              <td className="p-3 tabular-nums">{centsLabel(item.amountCents, item.currencyCode)}</td>
              <td className="p-3 text-xs text-muted-foreground">{item.preparedBy?.name || '—'} / {item.approvedBy?.name || '—'}</td>
            </tr>
          ))}
          {workspace.commissionLedgerEntries.length ? null : <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No ledger entries</td></tr>}
        </tbody>
      </TableShell>
    </Section>
  )
}

function AgreementsSection({ workspace, options }: { workspace: OperationsWorkspace; options: OperationsOptions }) {
  return (
    <Section id="agreements" title="Licenses & agreements">
      <div className="grid gap-3 lg:grid-cols-2">
        <PractitionerLicenseForm options={options} />
        <ListingEngagementForm options={options} />
        <ListingPublicationForm options={options} />
        <RepresentationForm options={options} />
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <Card>
          <h3 className="text-sm font-semibold text-foreground">Listing agreements</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {workspace.listingEngagementAuthorities.map((item) => (
              <li key={item.id} className="rounded-md bg-muted/50 p-3">
                <span className="font-medium text-foreground">{item.property?.title}</span> · {humanize(item.status)} · {item.jurisdictionCode}
                <p className="text-xs text-muted-foreground">{item.authorityNumber} · {item.practitioner?.name} · Ends <DateText value={item.effectiveThrough} /></p>
              </li>
            ))}
            {workspace.listingEngagementAuthorities.length ? null : <li className="text-muted-foreground">No listing agreements</li>}
          </ul>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-foreground">Licenses and representation</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {workspace.practitionerLicenses.map((item) => (
              <li key={item.id} className="rounded-md bg-muted/50 p-3">
                <span className="font-medium text-foreground">{item.practitioner?.name}</span> · {humanize(item.status)} · {item.jurisdictionCode}
                <p className="text-xs text-muted-foreground">{humanize(item.licenseType)} {item.licenseNumber} · Verified <DateText value={item.verifiedAt} /></p>
              </li>
            ))}
            {workspace.representationAuthorities.map((item) => (
              <li key={item.id} className="rounded-md bg-muted/50 p-3">
                <span className="font-medium text-foreground">{item.lead?.name}</span> · {humanize(item.side)} · {humanize(item.relationshipType)} · {humanize(item.status)}
                <p className="text-xs text-muted-foreground">{item.authorityNumber} · {item.practitioner?.name} · {item.disclosureVersion}</p>
              </li>
            ))}
            {workspace.practitionerLicenses.length || workspace.representationAuthorities.length ? null : <li className="text-muted-foreground">No licenses or representation agreements</li>}
          </ul>
        </Card>
      </div>
    </Section>
  )
}

function DocumentsSection({ workspace, options }: { workspace: OperationsWorkspace; options: OperationsOptions }) {
  return (
    <Section id="documents" title="Document history">
      <DocumentEvidenceForm options={options} />
      <TableShell>
        <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground"><tr><th className="p-3 font-medium">Document</th><th className="p-3 font-medium">Event</th><th className="p-3 font-medium">Provider</th><th className="p-3 font-medium">Date</th></tr></thead>
        <tbody>
          {workspace.documentEvidenceEvents.map((item) => (
            <tr key={item.id} className="border-b border-border last:border-0">
              <td className="p-3 font-medium text-foreground">{item.document?.title}</td>
              <td className="p-3">{humanize(item.eventType)}</td>
              <td className="p-3">{item.provider} · {item.providerReference}</td>
              <td className="p-3"><LocalDateTime value={item.occurredAt} /></td>
            </tr>
          ))}
          {workspace.documentEvidenceEvents.length ? null : <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No document events</td></tr>}
        </tbody>
      </TableShell>
    </Section>
  )
}

function MarketSection({ workspace }: { workspace: OperationsWorkspace }) {
  return (
    <Section id="market" title="Comparables and valuations">
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          {workspace.comps.length ? workspace.comps.map((item) => (
            <Card key={item.id}>
              <div className="flex justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{item.addressLine1}</h3>
                  <p className="text-sm text-muted-foreground">{item.city}, {item.state}{item.subjectProperty?.title ? ` · ${item.distanceMiles || '—'} mi from ${item.subjectProperty.title}` : ''}</p>
                </div>
                <span className="text-sm font-semibold text-foreground">{money(item.salePrice || item.listPrice)}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{[item.bedrooms ? `${item.bedrooms} beds` : null, item.bathrooms ? `${Number(item.bathrooms)} baths` : null, item.squareFeet ? `${item.squareFeet.toLocaleString()} sq ft` : null, humanize(item.status)].filter(Boolean).join(' · ')}</p>
            </Card>
          )) : <Empty>No comparables</Empty>}
        </div>
        <div className="space-y-3">
          {workspace.valuations.length ? workspace.valuations.map((item) => (
            <Card key={item.id}>
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">{item.valuationNumber}</p>
                  <h3 className="text-sm font-semibold text-foreground">{item.property?.title}</h3>
                </div>
                <Badge variant="outline" className="self-start">{String(item.valuationType || '').toUpperCase()}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Range <span className="font-medium text-foreground">{money(item.lowValue)} – {money(item.highValue)}</span></p>
              <p className="mt-1 text-sm text-muted-foreground">Estimate <span className="font-medium text-foreground">{money(item.estimatedValue)}</span></p>
            </Card>
          )) : <Empty>No valuations</Empty>}
        </div>
      </div>
    </Section>
  )
}

function AlertsSection({ workspace }: { workspace: OperationsWorkspace }) {
  return (
    <Section id="alerts" title="Saved search alerts">
      <div className="grid gap-3 lg:grid-cols-2">
        {workspace.alerts.length ? workspace.alerts.map((alert) => (
          <Card key={alert.id}>
            <h3 className="text-sm font-semibold text-foreground">{alert.savedSearch?.name || 'Saved search'}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{alert.user?.name || alert.user?.email} · {alert.sentCount || 0} sent · Last sent <DateText value={alert.lastSentAt} /></p>
            <AlertActions alertId={alert.id} status={alert.status} cadence={alert.cadence} />
          </Card>
        )) : <Empty>No saved search alerts</Empty>}
      </div>
    </Section>
  )
}

function SyndicationSection({ workspace }: { workspace: OperationsWorkspace }) {
  return (
    <Section id="syndication" title="Syndication">
      <TableShell>
        <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground"><tr><th className="p-3 font-medium">Listing</th><th className="p-3 font-medium">Channel</th><th className="p-3 font-medium">Status</th><th className="p-3 font-medium">Update</th></tr></thead>
        <tbody>
          {workspace.syndications.length ? workspace.syndications.map((item) => (
            <tr key={item.id} className="border-b border-border align-top last:border-0">
              <td className="p-3"><p className="font-medium text-foreground">{item.property?.title}</p><p className="text-xs text-muted-foreground">{item.externalListingId || 'No external ID'}</p></td>
              <td className="p-3 uppercase">{item.channel}</td>
              <td className="p-3">{syndicationLabels[item.status] || humanize(item.status)}{item.errorMessage ? <p className="text-xs text-destructive">{item.errorMessage}</p> : null}</td>
              <td className="min-w-64 p-3"><SyndicationAuthorityAction syndicationId={item.id} status={item.status} /></td>
            </tr>
          )) : <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No syndication channels</td></tr>}
        </tbody>
      </TableShell>
    </Section>
  )
}

function ImportsSection({ workspace }: { workspace: OperationsWorkspace }) {
  return (
    <Section id="imports" title="Imports">
      <div className="grid gap-3 lg:grid-cols-2">
        {workspace.feeds.length ? workspace.feeds.map((feed) => (
          <Card key={feed.id}>
            <div className="flex justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{feed.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{feed.provider} · {String(feed.feedType || '').toUpperCase()} · {feed.recordsImported || 0} imported</p>
              </div>
              <Badge variant="outline" className="self-start">{humanize(feed.status)}</Badge>
            </div>
            <ImportForm sourceFeedId={feed.id} />
          </Card>
        )) : <Empty>No import feeds</Empty>}
      </div>
      <TableShell>
        <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground"><tr><th className="p-3 font-medium">Job</th><th className="p-3 font-medium">Status</th><th className="p-3 font-medium">Attempts</th><th className="p-3 font-medium">Scheduled</th></tr></thead>
        <tbody>
          {workspace.queue.length ? workspace.queue.map((item) => (
            <tr key={item.id} className="border-b border-border last:border-0">
              <td className="p-3 font-medium text-foreground">{humanize(item.eventType)}</td>
              <td className="p-3">{humanize(item.status)}{item.lastError ? <p className="text-xs text-destructive">{item.lastError}</p> : null}</td>
              <td className="p-3 tabular-nums">{item.attempts || 0}</td>
              <td className="p-3"><LocalDateTime value={item.availableAt} /></td>
            </tr>
          )) : <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No jobs</td></tr>}
        </tbody>
      </TableShell>
    </Section>
  )
}

function RecordsSection({ workspace, options }: { workspace: OperationsWorkspace; options: OperationsOptions }) {
  return (
    <Section id="records" title="Record retention">
      <RetentionForms options={options} />
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <h3 className="text-sm font-semibold text-foreground">Policies</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {workspace.retentionPolicies.map((item) => (
              <li key={item.id} className="rounded-md bg-muted/50 p-3">
                <span className="font-medium text-foreground">{humanize(item.retentionClass)}</span> · {item.jurisdictionCode} · {item.retentionDays} days
                <p className="text-xs text-muted-foreground">Starts when {humanize(item.triggerType).toLowerCase()} · Then {humanize(item.disposition).toLowerCase()}</p>
              </li>
            ))}
            {workspace.retentionPolicies.length ? null : <li className="text-muted-foreground">No policies</li>}
          </ul>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-foreground">Activity</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {workspace.transactionFileEvents.map((item) => (
              <li key={item.id} className="rounded-md bg-muted/50 p-3">
                <span className="font-medium text-foreground">{humanize(item.eventType)}</span> · {item.document?.title || item.deal?.title}
                <p className="text-xs text-muted-foreground">{item.holdKey || item.manifestKey || ''}{item.holdKey || item.manifestKey ? ' · ' : ''}<LocalDateTime value={item.occurredAt} /></p>
              </li>
            ))}
            {workspace.transactionFileEvents.length ? null : <li className="text-muted-foreground">No activity</li>}
          </ul>
        </Card>
      </div>
    </Section>
  )
}

export async function OperationsPage() {
  const [{ workspace, error }, people, listings, leads] = await Promise.all([
    getPlatformOperations(),
    getPlatformPeople(),
    getPlatformListings('all'),
    getPlatformLeads('all'),
  ])
  const options = buildOperationsOptions(workspace, { agents: people.agents, properties: listings.items, leads: leads.leads })

  return (
    <section className="overflow-hidden flex flex-col">
      <PageBreadcrumbs
        items={[
          { type: 'link', label: 'Dashboard', href: '/' },
          { type: 'page', label: 'Platform' },
          { type: 'page', label: 'Operations' },
        ]}
      />
      <div className="px-4 pt-4 md:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Operations</h1>
        <p className="text-muted-foreground">Offers, closings, commissions and records</p>
        <nav aria-label="Operations sections" className="mt-4 flex gap-1 overflow-x-auto border-b border-border">
          {sections.map(([href, text]) => <a key={href} href={`#${href}`} className="-mb-px shrink-0 border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">{text}</a>)}
        </nav>
      </div>
      <div className="space-y-10 px-4 py-6 md:px-6">
        {error ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Operations could not be loaded. {error}</div> : null}
        <OffersSection workspace={workspace} />
        <ClosingsSection workspace={workspace} />
        <InspectionsSection workspace={workspace} />
        <OpenHousesSection workspace={workspace} />
        <TasksSection workspace={workspace} />
        <CommissionsSection workspace={workspace} options={options} />
        <AgreementsSection workspace={workspace} options={options} />
        <DocumentsSection workspace={workspace} options={options} />
        <MarketSection workspace={workspace} />
        <AlertsSection workspace={workspace} />
        <SyndicationSection workspace={workspace} />
        <ImportsSection workspace={workspace} />
        <RecordsSection workspace={workspace} options={options} />
      </div>
    </section>
  )
}
