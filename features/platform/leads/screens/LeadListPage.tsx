import Link from 'next/link'
import { formatMoney as exactMoney, moneyToMinor } from '@/features/lib/money'
import { DataTable, EmptyState, ErrorBanner, Pager, PlatformPage, SearchField, StatusCell, Td, rowActionLineClass, rowActionsBlockClass } from '../../components/PlatformUI'
import { FilterTabs } from '../../listings/components/FilterTabs'
import { getLeadDuplicateGroups, getPlatformLeads, getShowingRequestViewer, type LeadStats, type PlatformLead } from '../actions/leads'
import { OriginalShowingRecovery } from '../components/PendingShowingForms'
import { DuplicateLeadResolver } from '../components/DuplicateLeadResolver'
import { NewLeadDrawer } from '../components/NewLeadDrawer'
import { LeadRowActions } from '../components/LeadRowActions'
import { ResponseClock, elapsedLabel, minutesSince } from '../components/ResponseClock'
import { getDealOptions } from '../../pipeline/lib/dealWorkspace'
import type { OperatorViewer } from '../lib/leadDetail'
import { label, leadIntentLabels, leadStatusColors, leadStatusLabels } from '../lib/labels'

const tabs: Array<{ value: string; label: string; stat?: keyof LeadStats }> = [
  { value: 'all', label: 'All', stat: 'total' },
  { value: 'new', label: 'New', stat: 'new' },
  { value: 'attempted_contact', label: 'Attempted', stat: 'attemptedContact' },
  { value: 'qualified', label: 'Qualified', stat: 'hot' },
  { value: 'tour_scheduled', label: 'Tours', stat: 'tourScheduled' },
  { value: 'offer', label: 'Offers', stat: 'offer' },
  { value: 'closed', label: 'Closed', stat: 'closed' },
  { value: 'lost', label: 'Lost', stat: 'lost' },
]

/** Statuses where the next move is ours: the call list. */
const NEEDS_RESPONSE = ['new', 'attempted_contact']

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

function leadsHref(status: string, q: string, cursor?: { direction: 'after' | 'before'; value: string }) {
  const params = new URLSearchParams()
  if (status !== 'all') params.set('status', status)
  if (q) params.set('q', q)
  if (cursor) params.set(cursor.direction, cursor.value)
  const query = params.toString()
  return query ? `/dashboard/platform/leads?${query}` : '/dashboard/platform/leads'
}

function cursorParam(value: string | string[] | undefined) {
  if (value === undefined) return undefined
  return typeof value === 'string' ? value : 'invalid-cursor'
}

function formatMoney(value?: string | null, listingType?: string | null) {
  if (moneyToMinor(value || '0') <= 0n) return 'Price TBD'
  const formatted = exactMoney(value || '0')
  return listingType === 'rent' ? `${formatted}/mo` : formatted
}

/** A lead waiting on us is timed from the last contact, or from when it arrived. */
function waitingSince(lead: PlatformLead) {
  return NEEDS_RESPONSE.includes(lead.status) ? lead.lastContactedAt || lead.createdAt : lead.createdAt
}

function byLongestWait(a: PlatformLead, b: PlatformLead) {
  return (Date.parse(waitingSince(a) || '') || Infinity) - (Date.parse(waitingSince(b) || '') || Infinity)
}

const head = [
  { label: 'Lead' },
  { label: 'Status', className: 'hidden md:table-cell' },
  { label: 'Waiting', className: 'hidden w-20 md:table-cell' },
  { label: 'Intent', className: 'hidden xl:table-cell' },
  { label: 'Listing', className: 'hidden md:table-cell' },
  { label: 'Agent', className: 'hidden lg:table-cell' },
  { label: <span className="sr-only">Next action</span>, className: 'hidden w-px md:table-cell' },
]

function LeadRow({ lead, viewer }: { lead: PlatformLead; viewer: OperatorViewer | null }) {
  const href = `/dashboard/platform/leads/${encodeURIComponent(lead.id)}`
  const waiting = NEEDS_RESPONSE.includes(lead.status)
  const actionTarget = { id: lead.id, name: lead.name, status: lead.status, phone: lead.phone, email: lead.email, propertyId: lead.property?.id, assignedAgentId: lead.assignedAgent?.id }
  return (
    <tr className="transition-colors hover:bg-muted/30">
      <Td className="min-w-0 py-2 sm:min-w-44">
        <Link href={href} className="font-medium text-foreground underline-offset-2 hover:underline">{lead.name}</Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 md:hidden">
          <StatusCell tone={leadStatusColors[lead.status] || 'zinc'}>{label(leadStatusLabels, lead.status)}</StatusCell>
          <ResponseClock since={waitingSince(lead)} waiting={waiting} className="text-xs" />
        </div>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {lead.phone ? <a href={`tel:${lead.phone.replace(/[^+\d]/g, '')}`} className="tabular-nums hover:text-foreground hover:underline">{lead.phone}</a>
            : lead.email ? <a href={`mailto:${lead.email}`} className="max-w-[16rem] truncate hover:text-foreground hover:underline">{lead.email}</a>
            : <span>No contact details</span>}
          {lead.property ? <span className="truncate md:hidden">{lead.property.title}</span> : null}
        </div>
        <div className={rowActionLineClass}>
          <LeadRowActions viewer={viewer} lead={actionTarget} className={rowActionsBlockClass} />
        </div>
      </Td>
      <Td className="hidden py-2 md:table-cell"><StatusCell tone={leadStatusColors[lead.status] || 'zinc'}>{label(leadStatusLabels, lead.status)}</StatusCell></Td>
      <Td className="hidden py-2 md:table-cell"><ResponseClock since={waitingSince(lead)} waiting={waiting} /></Td>
      <Td className="hidden whitespace-nowrap py-2 text-[13px] text-muted-foreground xl:table-cell">{label(leadIntentLabels, lead.intent, 'Unknown')}</Td>
      <Td className="hidden max-w-64 py-2 md:table-cell">
        {lead.property ? (
          <>
            <Link href={`/dashboard/properties/${encodeURIComponent(lead.property.id)}`} className="block truncate text-[13px] text-foreground hover:underline">{lead.property.title || 'Listing'}</Link>
            <span className="text-xs tabular-nums text-muted-foreground">{formatMoney(lead.property.price, lead.property.listingType)}</span>
          </>
        ) : <span className="text-[13px] text-muted-foreground">None</span>}
      </Td>
      <Td className="hidden whitespace-nowrap py-2 text-[13px] lg:table-cell">{lead.assignedAgent ? lead.assignedAgent.name || 'Assigned' : <span className="text-muted-foreground">Unassigned</span>}</Td>
      <Td className="hidden py-2 md:table-cell">
        <LeadRowActions viewer={viewer} lead={actionTarget} />
      </Td>
    </tr>
  )
}

function LeadTable({ title, count, leads, viewer }: { title?: string; count?: number; leads: PlatformLead[]; viewer: OperatorViewer | null }) {
  return (
    <section className="space-y-2">
      {title ? <h2 className="flex items-baseline gap-2 text-sm font-semibold text-foreground">{title}<span className="text-xs font-medium tabular-nums text-muted-foreground">{count ?? leads.length}</span></h2> : null}
      <DataTable label={title || 'Leads'} head={head}>
        {leads.map(lead => <LeadRow key={lead.id} lead={lead} viewer={viewer} />)}
      </DataTable>
    </section>
  )
}

export async function LeadListPage({ searchParams }: PageProps) {
  const params = await searchParams
  const status = typeof params.status === 'string' ? params.status : 'all'
  const q = typeof params.q === 'string' ? params.q : ''
  const after = cursorParam(params.after)
  const before = cursorParam(params.before)
  const [{ leads, stats, error, pageInfo }, viewer, { groups: duplicateGroups, error: duplicateError }, options] = await Promise.all([
    getPlatformLeads(status, q, after, before),
    getShowingRequestViewer(),
    getLeadDuplicateGroups(),
    getDealOptions(),
  ])

  const tabItems = tabs.map((tab) => ({
    label: tab.label,
    href: leadsHref(tab.value, q),
    active: status === tab.value,
    count: tab.stat && stats ? stats[tab.stat] : null,
  }))

  const waiting = leads.filter(lead => NEEDS_RESPONSE.includes(lead.status)).sort(byLongestWait)
  const rest = leads.filter(lead => !NEEDS_RESPONSE.includes(lead.status))
  const paged = Boolean(pageInfo && (pageInfo.nextCursor || pageInfo.previousCursor))
  const oldest = waiting.length ? minutesSince(waitingSince(waiting[0])) : null
  const meta = !error && waiting.length
    ? `${waiting.length} waiting for a response${paged ? ' on this page' : ''}${oldest !== null ? ` · longest ${elapsedLabel(oldest)}` : ''}`
    : null

  return (
    <PlatformPage
      crumbs={[{ label: 'Leads' }]}
      title="Leads"
      meta={meta}
      actions={<NewLeadDrawer properties={options.properties} agents={options.agents} />}
      toolbar={<>
        <SearchField action="/dashboard/platform/leads" defaultValue={q} label="Search leads" placeholder="Name, email, phone or city" hidden={{ status: status !== 'all' ? status : undefined }} />
        <FilterTabs label="Lead status" items={tabItems} />
      </>}
    >
      <div className="space-y-6 pb-16">
        {viewer ? <OriginalShowingRecovery viewer={viewer} /> : null}

        {error ? (
          <ErrorBanner>{error}</ErrorBanner>
        ) : !leads.length ? (
          <EmptyState title={q ? 'No leads match this search' : 'No leads'} />
        ) : status === 'all' ? (
          <>
            {waiting.length ? <LeadTable title="Needs response" leads={waiting} viewer={viewer} /> : <EmptyState title="No leads waiting for a response" />}
            {rest.length ? <LeadTable title="In progress" leads={rest} viewer={viewer} /> : null}
          </>
        ) : (
          <LeadTable leads={NEEDS_RESPONSE.includes(status) ? waiting : leads} viewer={viewer} />
        )}

        {!error && pageInfo ? (
          <Pager
            label="Lead pages"
            previous={pageInfo.previousCursor ? leadsHref(status, q, { direction: 'before', value: pageInfo.previousCursor }) : null}
            next={pageInfo.nextCursor ? leadsHref(status, q, { direction: 'after', value: pageInfo.nextCursor }) : null}
          />
        ) : null}

        {duplicateGroups.length ? (
          <details className="group rounded-[6px] border border-amber-300/60 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between rounded-[6px] px-4 py-2 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
              <span>Possible duplicates</span>
              <span className="tabular-nums text-xs font-medium text-muted-foreground">{duplicateGroups.length}</span>
            </summary>
            <div className="space-y-3 border-t border-amber-300/60 p-4 dark:border-amber-900/50">
              {duplicateGroups.map((group) => <DuplicateLeadResolver key={group.key} group={group} />)}
            </div>
          </details>
        ) : duplicateError ? (
          <ErrorBanner>Duplicates could not be loaded. {duplicateError}</ErrorBanner>
        ) : null}
      </div>
    </PlatformPage>
  )
}
