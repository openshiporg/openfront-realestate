import Link from 'next/link'
import type { ReactNode } from 'react'
import { formatMoney as money } from '@/features/lib/money'
import { cn } from '@/lib/utils'
import { humanize } from '../../leads/lib/labels'
import { getPlatformLeads } from '../../leads/actions/leads'
import { getPlatformListings } from '../../listings/actions/listings'
import { FilterTabs } from '../../listings/components/FilterTabs'
import { getPlatformPeople } from '../../people/actions/people'
import { LocalDateTime } from '../../showings/components/LocalDateTime'
import { getPlatformOperations, type OperationsWorkspace } from '../actions/operations'
import { buildOperationsOptions, type OperationsOptions } from '../lib/options'
import { DataTable, EmptyState, ErrorBanner, PlatformPage, StatusCell, Td, rowSingleActionLineClass, trackItemClass, type Tone } from '../../components/PlatformUI'
import { AlertDrawer, CommissionAction, CounterOfferDrawer, DealFileDrawer, DisclosureAction, DocumentAction, ImportDrawer, InspectionAction, MilestoneAction, NewOfferDrawer, OfferAction, OpenHouseAction, TaskAction } from '../components/TaskForms'
import { CommissionLedgerForms, DocumentEvidenceForm, ListingEngagementForm, ListingPublicationForm, PractitionerLicenseForm, RepresentationForm, RetentionForms, SyndicationAuthorityAction } from '../components/ControlledEvidenceForms'
import { SectionSelect } from '../components/SectionSelect'

type SectionKey = 'attention' | 'offers' | 'closings' | 'inspections' | 'open-houses' | 'tasks' | 'commissions' | 'agreements' | 'documents' | 'market' | 'alerts' | 'syndication' | 'imports' | 'records'

const sectionLabels: Array<[SectionKey, string]> = [
  ['attention', 'Needs attention'],
  ['offers', 'Offers'],
  ['closings', 'Closings'],
  ['inspections', 'Inspections'],
  ['open-houses', 'Open houses'],
  ['tasks', 'Tasks'],
  ['commissions', 'Commissions'],
  ['agreements', 'Licenses & agreements'],
  ['documents', 'Document history'],
  ['market', 'Comparables'],
  ['alerts', 'Search alerts'],
  ['syndication', 'Syndication'],
  ['imports', 'Imports'],
  ['records', 'Records'],
]

const syndicationLabels: Record<string, string> = { published: 'Published', removed: 'Removed', error: 'Error', draft: 'Draft' }

const toneByStatus: Record<string, Tone> = {
  draft: 'zinc', open: 'zinc', projected: 'zinc', not_started: 'zinc',
  submitted: 'sky', scheduled: 'sky', sent: 'sky', queued: 'sky', dispatched: 'emerald',
  countered: 'violet', in_progress: 'amber', needs_follow_up: 'amber', pending: 'amber', approved: 'amber', processing: 'amber',
  accepted: 'emerald', completed: 'emerald', complete: 'emerald', done: 'emerald', paid: 'emerald', acknowledged: 'emerald', published: 'emerald', active: 'emerald', succeeded: 'emerald', closed_won: 'emerald', signed: 'emerald', verified_active: 'emerald', executed: 'emerald', authorized: 'emerald',
  rejected: 'rose', cancelled: 'rose', removed: 'rose', error: 'rose', failed: 'rose', clawed_back: 'rose', expired: 'rose', closed_lost: 'rose', blocked: 'rose', revoked: 'rose', suspended: 'rose',
}

function statusTone(status?: string | null): Tone {
  return toneByStatus[status || ''] || 'zinc'
}

function Status({ value, label }: { value?: string | null; label?: string }) {
  return <StatusCell tone={statusTone(value)}>{label || humanize(value)}</StatusCell>
}

function DateText({ value }: { value?: string | null }) {
  return value ? <LocalDateTime value={value} options={{ dateStyle: 'medium' }} /> : <span className="text-muted-foreground">Not set</span>
}

const DAY = 86_400_000
const isPast = (value: string | null | undefined, now: number) => Boolean(value) && new Date(value as string).getTime() < now
const isWithin = (value: string | null | undefined, now: number, days: number) => Boolean(value) && new Date(value as string).getTime() < now + days * DAY

function Section({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}

function Row({ children }: { children: ReactNode }) {
  return <tr className="transition-colors hover:bg-muted/30">{children}</tr>
}

function NoRows({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return <tr><Td colSpan={colSpan} className="py-6 text-center text-muted-foreground">{children}</Td></tr>
}

function Actions({ children }: { children: ReactNode }) {
  return <Td className="w-px whitespace-nowrap py-2 text-right"><div className="flex items-start justify-end gap-1.5">{children}</div></Td>
}

/** Narrow tables keep a sensible width and scroll inside their own frame on phones. */
const wide = '[&_table]:min-w-[44rem]'

/* ---------- Needs attention ---------- */

type AttentionRow = { key: string; kind: string; title: string; context: string; due: string | null; overdue: boolean; tone: Tone; state: string; action: ReactNode; rank: number }

function attentionRows(workspace: OperationsWorkspace, now: number, sectionHref: (key: SectionKey) => string): AttentionRow[] {
  const rows: AttentionRow[] = []
  const openDeals = workspace.transactions.filter((deal) => !['closed_won', 'closed_lost'].includes(deal.stage))
  const goTo = (key: SectionKey, label: string) => <Link href={sectionHref(key)} className={trackItemClass(false)}>{label}</Link>

  for (const deal of openDeals) {
    for (const item of deal.milestones || []) {
      if (item.status === 'complete') continue
      const overdue = isPast(item.dueAt, now)
      if (item.status !== 'blocked' && !overdue && !isWithin(item.dueAt, now, 7)) continue
      rows.push({
        key: `milestone:${item.id}`, kind: 'Checklist', title: item.name, context: deal.title, due: item.dueAt || null, overdue,
        tone: item.status === 'blocked' || overdue ? 'rose' : 'amber', state: item.status === 'blocked' ? 'Blocked' : overdue ? 'Overdue' : 'Due soon',
        action: <MilestoneAction milestoneId={item.id} status="complete" label="Complete" />, rank: item.status === 'blocked' ? 0 : overdue ? 1 : 3,
      })
    }
    for (const document of deal.documents || []) {
      if (!document.requiresSignature || !['draft', 'sent'].includes(document.status)) continue
      const overdue = isPast(document.expiresAt, now)
      rows.push({
        key: `document:${document.id}`, kind: 'Signature', title: document.title, context: deal.title, due: document.expiresAt || null, overdue,
        tone: overdue ? 'rose' : 'amber', state: document.status === 'draft' ? 'Not sent' : 'Awaiting signature',
        action: <DocumentAction documentId={document.id} currentStatus={document.status} />, rank: overdue ? 1 : 4,
      })
    }
    if (isWithin(deal.expectedCloseDate, now, 14)) {
      const overdue = isPast(deal.expectedCloseDate, now)
      rows.push({
        key: `deal:${deal.id}`, kind: 'Closing', title: deal.title, context: deal.property?.title || '', due: deal.expectedCloseDate, overdue,
        tone: overdue ? 'rose' : 'amber', state: overdue ? 'Past close date' : 'Closing soon',
        action: <Link href={`/dashboard/platform/pipeline/${deal.id}`} className={trackItemClass(false)}>Open deal</Link>, rank: overdue ? 1 : 2,
      })
    }
  }

  for (const offer of workspace.offers) {
    if (!['submitted', 'countered'].includes(offer.status)) continue
    const overdue = isPast(offer.responseDueAt, now)
    rows.push({
      key: `offer:${offer.id}`, kind: 'Offer', title: `${offer.offerNumber} · ${money(offer.amount)}`, context: offer.property?.title || '', due: offer.responseDueAt || null, overdue,
      tone: overdue ? 'rose' : 'sky', state: overdue ? 'Response overdue' : 'Awaiting response', action: goTo('offers', 'Respond'), rank: overdue ? 1 : 3,
    })
  }

  for (const item of workspace.disclosures) {
    if (!['draft', 'sent'].includes(item.status)) continue
    rows.push({
      key: `disclosure:${item.id}`, kind: 'Disclosure', title: item.title, context: item.deal?.title || '', due: null, overdue: false,
      tone: 'amber', state: item.status === 'draft' ? 'Not sent' : 'Not acknowledged',
      action: item.status === 'draft' ? <DisclosureAction disclosureId={item.id} status="sent" label="Mark sent" /> : <DisclosureAction disclosureId={item.id} status="acknowledged" label="Mark acknowledged" />, rank: 4,
    })
  }

  for (const item of workspace.inspections) {
    if (item.status !== 'needs_follow_up') continue
    rows.push({
      key: `inspection:${item.id}`, kind: 'Inspection', title: item.title, context: item.property?.title || '', due: item.scheduledAt || null, overdue: false,
      tone: 'amber', state: 'Needs follow-up', action: <InspectionAction inspectionId={item.id} status="completed" label="Complete" />, rank: 3,
    })
  }

  for (const item of workspace.tasks) {
    if (item.status === 'done' || !isPast(item.dueAt, now)) continue
    rows.push({
      key: `task:${item.id}`, kind: 'Task', title: item.title, context: item.property?.title || item.lead?.name || item.deal?.title || 'General', due: item.dueAt, overdue: true,
      tone: 'rose', state: 'Overdue', action: <TaskAction taskId={item.id} status="done" label="Complete" />, rank: 2,
    })
  }

  for (const item of workspace.practitionerLicenses) {
    if (!['verified_active', 'restricted'].includes(item.status) || !isWithin(item.effectiveThrough, now, 30)) continue
    const overdue = isPast(item.effectiveThrough, now)
    rows.push({
      key: `license:${item.id}`, kind: 'License', title: `${item.practitioner?.name || 'Agent'} · ${item.licenseNumber}`, context: item.jurisdictionCode || '', due: item.effectiveThrough, overdue,
      tone: overdue ? 'rose' : 'amber', state: overdue ? 'Expired' : 'Expires soon', action: goTo('agreements', 'Review'), rank: overdue ? 1 : 4,
    })
  }

  for (const item of workspace.syndications) {
    if (item.status !== 'error') continue
    rows.push({
      key: `syndication:${item.id}`, kind: 'Syndication', title: item.property?.title || 'Listing', context: `${String(item.channel || '').toUpperCase()}${item.errorMessage ? ` · ${item.errorMessage}` : ''}`, due: null, overdue: false,
      tone: 'rose', state: 'Error', action: goTo('syndication', 'Review'), rank: 3,
    })
  }

  for (const item of workspace.queue) {
    if (item.status !== 'failed') continue
    rows.push({
      key: `job:${item.id}`, kind: 'Import job', title: humanize(item.eventType), context: item.lastError || '', due: item.availableAt || null, overdue: false,
      tone: 'rose', state: 'Failed', action: goTo('imports', 'Review'), rank: 4,
    })
  }

  const time = (value: string | null) => value ? new Date(value).getTime() : Number.POSITIVE_INFINITY
  return rows.sort((a, b) => a.rank - b.rank || time(a.due) - time(b.due))
}

function AttentionSection({ rows }: { rows: AttentionRow[] }) {
  return (
    <Section title="Overdue and blocked first">
      {rows.length ? (
        <DataTable
          label="Needs attention"
          head={[{ label: 'Item' }, { label: 'Type', className: 'hidden md:table-cell' }, { label: 'Due', className: 'hidden md:table-cell' }, { label: 'Status', className: 'hidden md:table-cell' }, { label: <span className="sr-only">Action</span>, className: 'hidden text-right md:table-cell' }]}
        >
          {rows.map((row) => {
            const due = row.due ? <DateText value={row.due} /> : <span className="text-muted-foreground">—</span>
            const dueClass = row.overdue ? 'whitespace-nowrap font-medium text-rose-700 tabular-nums dark:text-rose-400' : 'whitespace-nowrap tabular-nums'
            return (
              <Row key={row.key}>
                <Td>
                  <p className="max-w-[19rem] truncate font-medium text-foreground md:max-w-[18rem]">{row.title}</p>
                  {row.context ? <p className="max-w-[19rem] truncate text-xs text-muted-foreground md:max-w-[18rem]">{row.context}</p> : null}
                  {/* Phone: type, due and status fold into the item; the action is a full-width line under it. */}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs md:hidden">
                    <StatusCell tone={row.tone}>{row.state}</StatusCell>
                    <span className={dueClass}>{due}</span>
                    <span className="text-muted-foreground">{row.kind}</span>
                  </div>
                  <div className={rowSingleActionLineClass}>{row.action}</div>
                </Td>
                <Td className="hidden whitespace-nowrap text-muted-foreground md:table-cell">{row.kind}</Td>
                <Td className={cn('hidden md:table-cell', dueClass)}>{due}</Td>
                <Td className="hidden whitespace-nowrap md:table-cell"><StatusCell tone={row.tone}>{row.state}</StatusCell></Td>
                <Td className="hidden w-px whitespace-nowrap py-2 text-right md:table-cell"><div className="flex items-start justify-end gap-1.5">{row.action}</div></Td>
              </Row>
            )
          })}
        </DataTable>
      ) : <EmptyState title="Nothing overdue or blocking" />}
    </Section>
  )
}

/* ---------- Sections ---------- */

function OffersSection({ workspace }: { workspace: OperationsWorkspace }) {
  const openDeals = workspace.transactions.filter((deal) => !['closed_won', 'closed_lost'].includes(deal.stage))
  return (
    <Section title="Offers" actions={openDeals.length ? <NewOfferDrawer deals={openDeals.map((deal) => [deal.id, [deal.title, deal.lead?.name].filter(Boolean).join(' · ')] as [string, string])} /> : null}>
      <DataTable
        label="Offers"
        className="[&_table]:min-w-[52rem]"
        head={[{ label: 'Offer' }, { label: 'Amount', className: 'text-right' }, { label: 'Financing' }, { label: 'Response due' }, { label: 'Agent' }, { label: 'Status' }, { label: <span className="sr-only">Actions</span>, className: 'text-right' }]}
      >
        {workspace.offers.length ? workspace.offers.map((offer) => {
          const live = ['submitted', 'countered'].includes(offer.status)
          return (
            <Row key={offer.id}>
              <Td>
                <p className="max-w-[16rem] truncate font-medium text-foreground">{offer.property?.title || offer.deal?.title || 'Offer'}</p>
                <p className="text-xs text-muted-foreground">{offer.offerNumber} · v{offer.version}{offer.parentOffer ? ` · counter to ${offer.parentOffer.offerNumber}` : ''}</p>
              </Td>
              <Td className="whitespace-nowrap text-right font-medium tabular-nums">{money(offer.amount)}</Td>
              <Td className="whitespace-nowrap">{humanize(offer.financingType)}</Td>
              <Td className="whitespace-nowrap tabular-nums"><DateText value={offer.responseDueAt} /></Td>
              <Td className="max-w-[9rem] truncate">{offer.assignedAgent?.name || <span className="text-amber-700 dark:text-amber-400">Unassigned</span>}</Td>
              <Td className="whitespace-nowrap"><Status value={offer.status} /></Td>
              <Actions>
                {offer.status === 'draft' ? <OfferAction offerId={offer.id} status="submitted" label="Submit" /> : null}
                {live ? <>
                  <OfferAction offerId={offer.id} status="accepted" label="Accept" />
                  <CounterOfferDrawer offerId={offer.id} offerLabel={offer.offerNumber} />
                  <OfferAction offerId={offer.id} status="rejected" label="Reject" emphasis="quiet" />
                </> : null}
              </Actions>
            </Row>
          )
        }) : <NoRows colSpan={7}>No offers</NoRows>}
      </DataTable>
    </Section>
  )
}

function ClosingsSection({ workspace, now }: { workspace: OperationsWorkspace; now: number }) {
  const closingRecords = [
    ...workspace.mortgages.map((item) => ({ id: `mortgage:${item.id}`, kind: 'Mortgage', number: item.applicationNumber, company: item.lenderName || 'No lender', status: item.status, deal: item.deal?.title, amount: money(item.loanAmount) })),
    ...workspace.titleOrders.map((item) => ({ id: `title:${item.id}`, kind: 'Title', number: item.orderNumber, company: item.titleCompany || 'No title company', status: item.status, deal: item.deal?.title, amount: '' })),
    ...workspace.escrows.map((item) => ({ id: `escrow:${item.id}`, kind: 'Escrow', number: item.escrowNumber, company: item.escrowCompany || 'No escrow company', status: item.status, deal: item.deal?.title, amount: item.depositAmount ? `Deposit ${money(item.depositAmount)}` : '' })),
  ]
  return (
    <div className="space-y-6">
      <Section title="Deals">
        <DataTable
          label="Deals"
          className="[&_table]:min-w-[50rem]"
          head={[{ label: 'Deal' }, { label: 'Stage' }, { label: 'Expected close' }, { label: 'Checklist', className: 'text-right' }, { label: 'To sign', className: 'text-right' }, { label: <span className="sr-only">Actions</span>, className: 'text-right' }]}
        >
          {workspace.transactions.length ? workspace.transactions.map((deal) => {
            const milestones = deal.milestones || []
            const done = milestones.filter((item: any) => item.status === 'complete').length
            const late = milestones.filter((item: any) => item.status !== 'complete' && (item.status === 'blocked' || isPast(item.dueAt, now))).length
            const toSign = (deal.documents || []).filter((document: any) => document.requiresSignature && ['draft', 'sent'].includes(document.status)).length
            const closed = ['closed_won', 'closed_lost'].includes(deal.stage)
            return (
              <Row key={deal.id}>
                <Td>
                  <Link href={`/dashboard/platform/pipeline/${deal.id}`} className="block max-w-[16rem] truncate font-medium text-foreground underline-offset-2 hover:underline">{deal.title}</Link>
                  <p className="max-w-[16rem] truncate text-xs text-muted-foreground">{[deal.property?.title, deal.assignedAgent?.name].filter(Boolean).join(' · ')}</p>
                </Td>
                <Td className="whitespace-nowrap"><Status value={deal.stage} /></Td>
                <Td className={!closed && isPast(deal.expectedCloseDate, now) ? 'whitespace-nowrap font-medium text-rose-700 tabular-nums dark:text-rose-400' : 'whitespace-nowrap tabular-nums'}><DateText value={deal.expectedCloseDate} /></Td>
                <Td className="whitespace-nowrap text-right tabular-nums">
                  {done}/{milestones.length}
                  {late ? <span className="ml-2 text-xs font-medium text-rose-700 dark:text-rose-400">{late} late</span> : null}
                </Td>
                <Td className={toSign ? 'text-right font-medium tabular-nums text-amber-700 dark:text-amber-400' : 'text-right tabular-nums text-muted-foreground'}>{toSign}</Td>
                <Actions>
                  <DealFileDrawer dealId={deal.id} dealTitle={deal.title} milestones={milestones} documents={deal.documents || []} />
                </Actions>
              </Row>
            )
          }) : <NoRows colSpan={6}>No deals in progress</NoRows>}
        </DataTable>
      </Section>

      <Section title="Disclosures">
        <DataTable label="Disclosures" className={wide} head={[{ label: 'Disclosure' }, { label: 'Type' }, { label: 'Status' }, { label: <span className="sr-only">Actions</span>, className: 'text-right' }]}>
          {workspace.disclosures.length ? workspace.disclosures.map((item) => (
            <Row key={item.id}>
              <Td><p className="font-medium text-foreground">{item.title}</p><p className="text-xs text-muted-foreground">{item.deal?.title}</p></Td>
              <Td className="whitespace-nowrap">{humanize(item.disclosureType)}</Td>
              <Td className="whitespace-nowrap"><Status value={item.status} /></Td>
              <Actions>
                {item.status === 'draft' ? <DisclosureAction disclosureId={item.id} status="sent" label="Mark sent" /> : null}
                {item.status === 'sent' ? <DisclosureAction disclosureId={item.id} status="acknowledged" label="Mark acknowledged" /> : null}
              </Actions>
            </Row>
          )) : <NoRows colSpan={4}>No disclosures</NoRows>}
        </DataTable>
      </Section>

      <Section title="Mortgage, title and escrow">
        <DataTable label="Mortgage, title and escrow" className={wide} head={[{ label: 'Record' }, { label: 'Company' }, { label: 'Deal' }, { label: 'Amount', className: 'text-right' }, { label: 'Status' }]}>
          {closingRecords.length ? closingRecords.map((item) => (
            <Row key={item.id}>
              <Td><p className="font-medium text-foreground">{item.kind}</p><p className="text-xs text-muted-foreground tabular-nums">{item.number}</p></Td>
              <Td>{item.company}</Td>
              <Td className="max-w-[14rem] truncate">{item.deal || '—'}</Td>
              <Td className="whitespace-nowrap text-right tabular-nums">{item.amount || '—'}</Td>
              <Td className="whitespace-nowrap"><Status value={item.status} /></Td>
            </Row>
          )) : <NoRows colSpan={5}>No mortgage, title or escrow records</NoRows>}
        </DataTable>
      </Section>
    </div>
  )
}

function InspectionsSection({ workspace }: { workspace: OperationsWorkspace }) {
  return (
    <Section title="Inspections">
      <DataTable label="Inspections" className="[&_table]:min-w-[50rem]" head={[{ label: 'Inspection' }, { label: 'Inspector' }, { label: 'Scheduled' }, { label: 'Findings' }, { label: 'Status' }, { label: <span className="sr-only">Actions</span>, className: 'text-right' }]}>
        {workspace.inspections.length ? workspace.inspections.map((item) => (
          <Row key={item.id}>
            <Td><p className="max-w-[14rem] truncate font-medium text-foreground">{item.title}</p><p className="max-w-[14rem] truncate text-xs text-muted-foreground">{[item.property?.title, humanize(item.inspectionType)].filter(Boolean).join(' · ')}</p></Td>
            <Td className="whitespace-nowrap">{item.inspectorName || <span className="text-muted-foreground">None</span>}</Td>
            <Td className="whitespace-nowrap tabular-nums"><DateText value={item.scheduledAt} /></Td>
            <Td className="max-w-[16rem] text-muted-foreground"><p className="line-clamp-2">{item.findings || item.summary || '—'}</p></Td>
            <Td className="whitespace-nowrap"><Status value={item.status} /></Td>
            <Actions>
              {item.status === 'scheduled' ? <><InspectionAction inspectionId={item.id} status="completed" label="Complete" /><InspectionAction inspectionId={item.id} status="needs_follow_up" label="Needs follow-up" /></> : null}
              {item.status === 'needs_follow_up' ? <InspectionAction inspectionId={item.id} status="completed" label="Complete" /> : null}
              {item.status === 'completed' ? <InspectionAction inspectionId={item.id} status="needs_follow_up" label="Reopen" /> : null}
            </Actions>
          </Row>
        )) : <NoRows colSpan={6}>No inspections</NoRows>}
      </DataTable>
    </Section>
  )
}

function OpenHousesSection({ workspace }: { workspace: OperationsWorkspace }) {
  return (
    <Section title="Open houses">
      <DataTable label="Open houses" className={wide} head={[{ label: 'Open house' }, { label: 'Starts' }, { label: 'Host' }, { label: 'Status' }, { label: <span className="sr-only">Actions</span>, className: 'text-right' }]}>
        {workspace.openHouses.length ? workspace.openHouses.map((item) => (
          <Row key={item.id}>
            <Td><p className="max-w-[16rem] truncate font-medium text-foreground">{item.title}</p><p className="max-w-[16rem] truncate text-xs text-muted-foreground">{item.property?.title}</p></Td>
            <Td className="whitespace-nowrap tabular-nums"><LocalDateTime value={item.startsAt} options={{ weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }} /></Td>
            <Td className="whitespace-nowrap">{item.hostAgent?.name || <span className="text-muted-foreground">No host</span>}</Td>
            <Td className="whitespace-nowrap"><Status value={item.status} /></Td>
            <Actions>
              {item.status === 'scheduled' ? <><OpenHouseAction openHouseId={item.id} status="completed" label="Complete" /><OpenHouseAction openHouseId={item.id} status="cancelled" label="Cancel" emphasis="quiet" /></> : null}
            </Actions>
          </Row>
        )) : <NoRows colSpan={5}>No open houses</NoRows>}
      </DataTable>
    </Section>
  )
}

function TasksSection({ workspace, now }: { workspace: OperationsWorkspace; now: number }) {
  const time = (value?: string | null) => value ? new Date(value).getTime() : Number.POSITIVE_INFINITY
  const tasks = [...workspace.tasks].sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || time(a.dueAt) - time(b.dueAt))
  return (
    <Section title="Tasks by due date" actions={<Link href="/dashboard/platform/tasks" className={trackItemClass(false)}>All tasks</Link>}>
      <DataTable label="Tasks" className={wide} head={[{ label: 'Task' }, { label: 'Agent' }, { label: 'Priority' }, { label: 'Due' }, { label: 'Status' }, { label: <span className="sr-only">Actions</span>, className: 'text-right' }]}>
        {tasks.length ? tasks.map((item) => {
          const late = item.status !== 'done' && isPast(item.dueAt, now)
          return (
            <Row key={item.id}>
              <Td><p className="max-w-[16rem] truncate font-medium text-foreground">{item.title}</p><p className="max-w-[16rem] truncate text-xs text-muted-foreground">{item.property?.title || item.lead?.name || item.deal?.title || 'General'}</p></Td>
              <Td className="whitespace-nowrap">{item.assignedAgent?.name || <span className="text-amber-700 dark:text-amber-400">Unassigned</span>}</Td>
              <Td className="whitespace-nowrap">{humanize(item.priority)}</Td>
              <Td className={late ? 'whitespace-nowrap font-medium text-rose-700 tabular-nums dark:text-rose-400' : 'whitespace-nowrap tabular-nums'}><DateText value={item.dueAt} /></Td>
              <Td className="whitespace-nowrap"><Status value={item.status} /></Td>
              <Actions>
                {item.status !== 'done' ? <TaskAction taskId={item.id} status="done" label="Complete" /> : <TaskAction taskId={item.id} status="open" label="Reopen" />}
                {item.status === 'open' ? <TaskAction taskId={item.id} status="in_progress" label="Start" /> : null}
              </Actions>
            </Row>
          )
        }) : <NoRows colSpan={6}>No tasks</NoRows>}
      </DataTable>
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
    <div className="space-y-6">
      <Section title="Commissions">
        <DataTable label="Commissions" className="[&_table]:min-w-[48rem]" head={[{ label: 'Commission' }, { label: 'Agent' }, { label: 'Side' }, { label: 'Gross', className: 'text-right' }, { label: 'Net', className: 'text-right' }, { label: 'Status' }, { label: <span className="sr-only">Actions</span>, className: 'text-right' }]}>
          {workspace.commissions.length ? workspace.commissions.map((item) => (
            <Row key={item.id}>
              <Td><p className="max-w-[14rem] truncate font-medium text-foreground">{item.title}</p><p className="max-w-[14rem] truncate text-xs text-muted-foreground">{item.deal?.title}</p></Td>
              <Td className="whitespace-nowrap">{item.agent?.name || '—'}</Td>
              <Td className="whitespace-nowrap">{humanize(item.side)}</Td>
              <Td className="whitespace-nowrap text-right tabular-nums">{money(item.grossCommission)}</Td>
              <Td className="whitespace-nowrap text-right font-medium tabular-nums">{money(item.netCommission)}</Td>
              <Td className="whitespace-nowrap"><Status value={item.status} /></Td>
              <Actions>
                {item.status === 'projected' ? <CommissionAction commissionId={item.id} status="approved" label="Approve" /> : null}
                {item.status === 'approved' ? <><CommissionAction commissionId={item.id} status="paid" label="Mark paid" /><CommissionAction commissionId={item.id} status="clawed_back" label="Claw back" emphasis="quiet" /></> : null}
              </Actions>
            </Row>
          )) : <NoRows colSpan={7}>No commissions</NoRows>}
        </DataTable>
      </Section>
      <Section title="Commission ledger" actions={<CommissionLedgerForms options={options} />}>
        <DataTable label="Commission ledger" className={wide} head={[{ label: 'Split' }, { label: 'Entry' }, { label: 'Amount', className: 'text-right' }, { label: 'Prepared / approved by' }]}>
          {workspace.commissionLedgerEntries.length ? workspace.commissionLedgerEntries.map((item) => (
            <Row key={item.id}>
              <Td className="font-mono text-xs">{item.batchKey}</Td>
              <Td>{humanize(item.entryType)}{item.allocationType ? ` · ${humanize(item.allocationType)}` : ''}{item.payeeLabel ? ` · ${item.payeeLabel}` : ''}</Td>
              <Td className="whitespace-nowrap text-right tabular-nums">{centsLabel(item.amountCents, item.currencyCode)}</Td>
              <Td className="text-xs text-muted-foreground">{item.preparedBy?.name || '—'} / {item.approvedBy?.name || '—'}</Td>
            </Row>
          )) : <NoRows colSpan={4}>No ledger entries</NoRows>}
        </DataTable>
      </Section>
    </div>
  )
}

function AgreementsSection({ workspace, options }: { workspace: OperationsWorkspace; options: OperationsOptions }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <PractitionerLicenseForm options={options} />
        <ListingEngagementForm options={options} />
        <ListingPublicationForm options={options} />
        <RepresentationForm options={options} />
      </div>
      <Section title="Agent licenses">
        <DataTable label="Agent licenses" className={wide} head={[{ label: 'Agent' }, { label: 'License' }, { label: 'Jurisdiction' }, { label: 'Valid until' }, { label: 'Verified' }, { label: 'Status' }]}>
          {workspace.practitionerLicenses.length ? workspace.practitionerLicenses.map((item) => (
            <Row key={item.id}>
              <Td className="font-medium text-foreground">{item.practitioner?.name}</Td>
              <Td className="whitespace-nowrap">{humanize(item.licenseType)} <span className="tabular-nums text-muted-foreground">{item.licenseNumber}</span></Td>
              <Td>{item.jurisdictionCode}</Td>
              <Td className="whitespace-nowrap tabular-nums"><DateText value={item.effectiveThrough} /></Td>
              <Td className="whitespace-nowrap tabular-nums"><DateText value={item.verifiedAt} /></Td>
              <Td className="whitespace-nowrap"><Status value={item.status} /></Td>
            </Row>
          )) : <NoRows colSpan={6}>No licenses</NoRows>}
        </DataTable>
      </Section>
      <Section title="Listing agreements">
        <DataTable label="Listing agreements" className={wide} head={[{ label: 'Listing' }, { label: 'Agreement' }, { label: 'Agent' }, { label: 'Ends' }, { label: 'Status' }]}>
          {workspace.listingEngagementAuthorities.length ? workspace.listingEngagementAuthorities.map((item) => (
            <Row key={item.id}>
              <Td className="max-w-[16rem] truncate font-medium text-foreground">{item.property?.title}</Td>
              <Td className="whitespace-nowrap tabular-nums">{item.authorityNumber} · {item.jurisdictionCode}</Td>
              <Td className="whitespace-nowrap">{item.practitioner?.name}</Td>
              <Td className="whitespace-nowrap tabular-nums"><DateText value={item.effectiveThrough} /></Td>
              <Td className="whitespace-nowrap"><Status value={item.status} /></Td>
            </Row>
          )) : <NoRows colSpan={5}>No listing agreements</NoRows>}
        </DataTable>
      </Section>
      <Section title="Representation agreements">
        <DataTable label="Representation agreements" className={wide} head={[{ label: 'Client' }, { label: 'Side' }, { label: 'Relationship' }, { label: 'Agreement' }, { label: 'Status' }]}>
          {workspace.representationAuthorities.length ? workspace.representationAuthorities.map((item) => (
            <Row key={item.id}>
              <Td><p className="font-medium text-foreground">{item.lead?.name}</p><p className="text-xs text-muted-foreground">{item.practitioner?.name}</p></Td>
              <Td className="whitespace-nowrap">{humanize(item.side)}</Td>
              <Td className="whitespace-nowrap">{humanize(item.relationshipType)}</Td>
              <Td className="whitespace-nowrap tabular-nums">{item.authorityNumber}{item.disclosureVersion ? ` · ${item.disclosureVersion}` : ''}</Td>
              <Td className="whitespace-nowrap"><Status value={item.status} /></Td>
            </Row>
          )) : <NoRows colSpan={5}>No representation agreements</NoRows>}
        </DataTable>
      </Section>
    </div>
  )
}

function DocumentsSection({ workspace, options }: { workspace: OperationsWorkspace; options: OperationsOptions }) {
  return (
    <Section title="Document history" actions={<DocumentEvidenceForm options={options} />}>
      <DataTable label="Document history" className={wide} head={[{ label: 'Document' }, { label: 'Event' }, { label: 'Provider' }, { label: 'Date' }]}>
        {workspace.documentEvidenceEvents.length ? workspace.documentEvidenceEvents.map((item) => (
          <Row key={item.id}>
            <Td className="font-medium text-foreground">{item.document?.title}</Td>
            <Td className="whitespace-nowrap">{humanize(item.eventType)}</Td>
            <Td>{item.provider} · <span className="text-muted-foreground">{item.providerReference}</span></Td>
            <Td className="whitespace-nowrap tabular-nums"><LocalDateTime value={item.occurredAt} /></Td>
          </Row>
        )) : <NoRows colSpan={4}>No document events</NoRows>}
      </DataTable>
    </Section>
  )
}

function MarketSection({ workspace }: { workspace: OperationsWorkspace }) {
  return (
    <div className="space-y-6">
      <Section title="Comparables">
        <DataTable label="Comparables" className={wide} head={[{ label: 'Address' }, { label: 'Facts' }, { label: 'Distance', className: 'text-right' }, { label: 'Price', className: 'text-right' }, { label: 'Status' }]}>
          {workspace.comps.length ? workspace.comps.map((item) => (
            <Row key={item.id}>
              <Td><p className="font-medium text-foreground">{item.addressLine1}</p><p className="text-xs text-muted-foreground">{item.city}, {item.state}{item.subjectProperty?.title ? ` · for ${item.subjectProperty.title}` : ''}</p></Td>
              <Td className="whitespace-nowrap text-muted-foreground">{[item.bedrooms ? `${item.bedrooms} bd` : null, item.bathrooms ? `${Number(item.bathrooms)} ba` : null, item.squareFeet ? `${item.squareFeet.toLocaleString()} sq ft` : null].filter(Boolean).join(' · ') || '—'}</Td>
              <Td className="whitespace-nowrap text-right tabular-nums">{item.distanceMiles ? `${item.distanceMiles} mi` : '—'}</Td>
              <Td className="whitespace-nowrap text-right font-medium tabular-nums">{money(item.salePrice || item.listPrice)}</Td>
              <Td className="whitespace-nowrap"><Status value={item.status} /></Td>
            </Row>
          )) : <NoRows colSpan={5}>No comparables</NoRows>}
        </DataTable>
      </Section>
      <Section title="Valuations">
        <DataTable label="Valuations" className={wide} head={[{ label: 'Listing' }, { label: 'Type' }, { label: 'Low', className: 'text-right' }, { label: 'Estimate', className: 'text-right' }, { label: 'High', className: 'text-right' }]}>
          {workspace.valuations.length ? workspace.valuations.map((item) => (
            <Row key={item.id}>
              <Td><p className="font-medium text-foreground">{item.property?.title}</p><p className="text-xs text-muted-foreground tabular-nums">{item.valuationNumber}</p></Td>
              <Td className="whitespace-nowrap">{String(item.valuationType || '').toUpperCase()}</Td>
              <Td className="whitespace-nowrap text-right tabular-nums text-muted-foreground">{money(item.lowValue)}</Td>
              <Td className="whitespace-nowrap text-right font-medium tabular-nums">{money(item.estimatedValue)}</Td>
              <Td className="whitespace-nowrap text-right tabular-nums text-muted-foreground">{money(item.highValue)}</Td>
            </Row>
          )) : <NoRows colSpan={5}>No valuations</NoRows>}
        </DataTable>
      </Section>
    </div>
  )
}

function AlertsSection({ workspace }: { workspace: OperationsWorkspace }) {
  return (
    <Section title="Saved search alerts">
      <DataTable label="Saved search alerts" className={wide} head={[{ label: 'Search' }, { label: 'Frequency' }, { label: 'Sent', className: 'text-right' }, { label: 'Last sent' }, { label: 'Status' }, { label: <span className="sr-only">Actions</span>, className: 'text-right' }]}>
        {workspace.alerts.length ? workspace.alerts.map((alert) => (
          <Row key={alert.id}>
            <Td><p className="font-medium text-foreground">{alert.savedSearch?.name || 'Saved search'}</p><p className="text-xs text-muted-foreground">{alert.user?.name || alert.user?.email}</p></Td>
            <Td className="whitespace-nowrap">{humanize(alert.cadence)}</Td>
            <Td className="text-right tabular-nums">{alert.sentCount || 0}</Td>
            <Td className="whitespace-nowrap tabular-nums"><DateText value={alert.lastSentAt} /></Td>
            <Td className="whitespace-nowrap"><Status value={alert.status} /></Td>
            <Actions><AlertDrawer alertId={alert.id} status={alert.status} cadence={alert.cadence} name={alert.savedSearch?.name || 'Saved search alert'} /></Actions>
          </Row>
        )) : <NoRows colSpan={6}>No saved search alerts</NoRows>}
      </DataTable>
    </Section>
  )
}

function SyndicationSection({ workspace }: { workspace: OperationsWorkspace }) {
  return (
    <Section title="Syndication">
      <DataTable label="Syndication" className={wide} head={[{ label: 'Listing' }, { label: 'Channel' }, { label: 'Status' }, { label: <span className="sr-only">Actions</span>, className: 'text-right' }]}>
        {workspace.syndications.length ? workspace.syndications.map((item) => (
          <Row key={item.id}>
            <Td><p className="font-medium text-foreground">{item.property?.title}</p><p className="text-xs text-muted-foreground">{item.externalListingId || 'No external ID'}</p></Td>
            <Td className="whitespace-nowrap uppercase">{item.channel}</Td>
            <Td>
              <Status value={item.status} label={syndicationLabels[item.status] || humanize(item.status)} />
              {item.errorMessage ? <p className="mt-0.5 max-w-[18rem] text-xs text-destructive">{item.errorMessage}</p> : null}
            </Td>
            <Actions><SyndicationAuthorityAction syndicationId={item.id} status={item.status} /></Actions>
          </Row>
        )) : <NoRows colSpan={4}>No syndication channels</NoRows>}
      </DataTable>
    </Section>
  )
}

function ImportsSection({ workspace }: { workspace: OperationsWorkspace }) {
  return (
    <div className="space-y-6">
      <Section title="Import feeds">
        <DataTable label="Import feeds" className={wide} head={[{ label: 'Feed' }, { label: 'Type' }, { label: 'Imported', className: 'text-right' }, { label: 'Status' }, { label: <span className="sr-only">Actions</span>, className: 'text-right' }]}>
          {workspace.feeds.length ? workspace.feeds.map((feed) => (
            <Row key={feed.id}>
              <Td><p className="font-medium text-foreground">{feed.name}</p><p className="text-xs text-muted-foreground">{feed.provider}</p></Td>
              <Td className="whitespace-nowrap">{String(feed.feedType || '').toUpperCase()}</Td>
              <Td className="text-right tabular-nums">{feed.recordsImported || 0}</Td>
              <Td className="whitespace-nowrap"><Status value={feed.status} /></Td>
              <Actions><ImportDrawer sourceFeedId={feed.id} feedName={feed.name} /></Actions>
            </Row>
          )) : <NoRows colSpan={5}>No import feeds</NoRows>}
        </DataTable>
      </Section>
      <Section title="Jobs">
        <DataTable label="Import jobs" className={wide} head={[{ label: 'Job' }, { label: 'Status' }, { label: 'Attempts', className: 'text-right' }, { label: 'Scheduled' }]}>
          {workspace.queue.length ? workspace.queue.map((item) => (
            <Row key={item.id}>
              <Td className="font-medium text-foreground">{humanize(item.eventType)}</Td>
              <Td><Status value={item.status} />{item.lastError ? <p className="mt-0.5 max-w-[18rem] text-xs text-destructive">{item.lastError}</p> : null}</Td>
              <Td className="text-right tabular-nums">{item.attempts || 0}</Td>
              <Td className="whitespace-nowrap tabular-nums"><LocalDateTime value={item.availableAt} /></Td>
            </Row>
          )) : <NoRows colSpan={4}>No jobs</NoRows>}
        </DataTable>
      </Section>
    </div>
  )
}

function RecordsSection({ workspace, options }: { workspace: OperationsWorkspace; options: OperationsOptions }) {
  return (
    <div className="space-y-6">
      <RetentionForms options={options} />
      <Section title="Retention policies">
        <DataTable label="Retention policies" className={wide} head={[{ label: 'Records' }, { label: 'Jurisdiction' }, { label: 'Keep for', className: 'text-right' }, { label: 'Starts when' }, { label: 'Then' }]}>
          {workspace.retentionPolicies.length ? workspace.retentionPolicies.map((item) => (
            <Row key={item.id}>
              <Td className="font-medium text-foreground">{humanize(item.retentionClass)}</Td>
              <Td>{item.jurisdictionCode}</Td>
              <Td className="whitespace-nowrap text-right tabular-nums">{item.retentionDays} days</Td>
              <Td>{humanize(item.triggerType)}</Td>
              <Td>{humanize(item.disposition)}</Td>
            </Row>
          )) : <NoRows colSpan={5}>No policies</NoRows>}
        </DataTable>
      </Section>
      <Section title="File activity">
        <DataTable label="File activity" className={wide} head={[{ label: 'Event' }, { label: 'Record' }, { label: 'Reference' }, { label: 'Date' }]}>
          {workspace.transactionFileEvents.length ? workspace.transactionFileEvents.map((item) => (
            <Row key={item.id}>
              <Td className="font-medium text-foreground">{humanize(item.eventType)}</Td>
              <Td>{item.document?.title || item.deal?.title}</Td>
              <Td className="text-muted-foreground">{item.holdKey || item.manifestKey || '—'}</Td>
              <Td className="whitespace-nowrap tabular-nums"><LocalDateTime value={item.occurredAt} /></Td>
            </Row>
          )) : <NoRows colSpan={4}>No activity</NoRows>}
        </DataTable>
      </Section>
    </div>
  )
}

const sectionHref = (key: SectionKey) => key === 'attention' ? '/dashboard/platform/operations' : `/dashboard/platform/operations?section=${key}`

export async function OperationsPage({ searchParams }: { searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = (await searchParams) || {}
  const requested = typeof params.section === 'string' ? params.section : 'attention'
  const section: SectionKey = sectionLabels.some(([key]) => key === requested) ? requested as SectionKey : 'attention'
  const [{ workspace, error }, people, listings, leads] = await Promise.all([
    getPlatformOperations(),
    getPlatformPeople(),
    getPlatformListings('all'),
    getPlatformLeads('all'),
  ])
  const options = buildOperationsOptions(workspace, { agents: people.agents, properties: listings.items, leads: leads.leads })
  const now = Date.now()
  const attention = attentionRows(workspace, now, sectionHref)
  const overdue = attention.filter((row) => row.overdue || row.state === 'Blocked').length

  const counts: Partial<Record<SectionKey, number>> = {
    attention: attention.length,
    offers: workspace.offers.filter((offer) => ['draft', 'submitted', 'countered'].includes(offer.status)).length,
    closings: workspace.transactions.filter((deal) => !['closed_won', 'closed_lost'].includes(deal.stage)).length,
    tasks: workspace.tasks.filter((task) => task.status !== 'done').length,
  }
  const tabs = sectionLabels.map(([key, label]) => ({ value: key, label, href: sectionHref(key), active: key === section, count: counts[key] ?? null }))

  return (
    <PlatformPage
      crumbs={[{ label: 'Operations' }]}
      title="Operations"
      meta={error ? null : attention.length ? `${overdue} overdue or blocked · ${attention.length - overdue} due soon or waiting` : 'Nothing overdue or blocking'}
      toolbar={<>
        <SectionSelect current={section} sections={tabs} />
        <FilterTabs label="Operations sections" items={tabs} className="hidden md:block" />
      </>}
    >
      <div className="min-w-0 space-y-6 pb-20">
        {error ? <ErrorBanner>Operations could not be loaded. {error}</ErrorBanner> : null}
        {section === 'attention' ? <AttentionSection rows={attention} /> : null}
        {section === 'offers' ? <OffersSection workspace={workspace} /> : null}
        {section === 'closings' ? <ClosingsSection workspace={workspace} now={now} /> : null}
        {section === 'inspections' ? <InspectionsSection workspace={workspace} /> : null}
        {section === 'open-houses' ? <OpenHousesSection workspace={workspace} /> : null}
        {section === 'tasks' ? <TasksSection workspace={workspace} now={now} /> : null}
        {section === 'commissions' ? <CommissionsSection workspace={workspace} options={options} /> : null}
        {section === 'agreements' ? <AgreementsSection workspace={workspace} options={options} /> : null}
        {section === 'documents' ? <DocumentsSection workspace={workspace} options={options} /> : null}
        {section === 'market' ? <MarketSection workspace={workspace} /> : null}
        {section === 'alerts' ? <AlertsSection workspace={workspace} /> : null}
        {section === 'syndication' ? <SyndicationSection workspace={workspace} /> : null}
        {section === 'imports' ? <ImportsSection workspace={workspace} /> : null}
        {section === 'records' ? <RecordsSection workspace={workspace} options={options} /> : null}
      </div>
    </PlatformPage>
  )
}
