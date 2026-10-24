import Link from 'next/link'
import { Mail, Phone } from 'lucide-react'
import { formatMoney as exactMoney, moneyToMinor } from '@/features/lib/money'
import { EmptyState, ErrorBanner, Pager, PlatformPage, SearchField, TitleLine, Track, trackItemClass } from '../../components/PlatformUI'
import { FilterTabs } from '../../listings/components/FilterTabs'
import { getLeadDuplicateGroups, getPlatformLeads, getShowingRequestViewer, type LeadStats, type PlatformLead } from '../actions/leads'
import { LeadStatusForm } from '../components/LeadActionForms'
import { LeadActivityForm } from '../components/LeadActivityForm'
import { OriginalShowingRecovery, ScheduleShowingForm } from '../components/PendingShowingForms'
import { DuplicateLeadResolver } from '../components/DuplicateLeadResolver'
import { NewLeadDrawer } from '../components/NewLeadDrawer'
import { getDealOptions } from '../../pipeline/lib/dealWorkspace'
import type { OperatorViewer } from '../lib/leadDetail'
import { activityTypeLabels, channelLabels, label, leadIntentLabels, leadSourceLabels, leadStatusColors, leadStatusLabels } from '../lib/labels'

const tabs: Array<{ value: string; label: string; stat?: keyof LeadStats }> = [
  { value: 'all', label: 'All', stat: 'total' },
  { value: 'new', label: 'New', stat: 'new' },
  { value: 'attempted_contact', label: 'Attempted' },
  { value: 'qualified', label: 'Qualified', stat: 'hot' },
  { value: 'tour_scheduled', label: 'Tours', stat: 'tourScheduled' },
  { value: 'offer', label: 'Offers', stat: 'offer' },
  { value: 'closed', label: 'Closed' },
  { value: 'lost', label: 'Lost' },
]

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

function ageLabel(iso?: string | null) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.max(0, Math.floor(diff / 36e5))
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function LeadStatusActions({ lead }: { lead: PlatformLead }) {
  const actions = [
    lead.status === 'new' ? <LeadStatusForm key="contacted" leadId={lead.id} nextStatus="attempted_contact" label="Mark contacted" primary /> : null,
    ['new', 'attempted_contact'].includes(lead.status) ? <LeadStatusForm key="qualify" leadId={lead.id} nextStatus="qualified" label="Qualify" primary={lead.status !== 'new'} /> : null,
    !['closed', 'lost'].includes(lead.status) ? <LeadStatusForm key="lost" leadId={lead.id} nextStatus="lost" label="Mark lost" /> : null,
  ].filter(Boolean)
  return (
    <Track label={`${lead.name} actions`}>
      {actions}
      <Link href={`/dashboard/platform/leads/${encodeURIComponent(lead.id)}`} className={trackItemClass(false)}>Open</Link>
    </Track>
  )
}

function LeadCard({ lead, viewer }: { lead: PlatformLead; viewer: OperatorViewer | null }) {
  const activityCount = lead.activitiesCount ?? lead.activities?.length ?? 0
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <TitleLine tone={leadStatusColors[lead.status] || 'zinc'} status={label(leadStatusLabels, lead.status)} headingClassName="text-base">
              <Link href={`/dashboard/platform/leads/${encodeURIComponent(lead.id)}`} className="hover:underline">{lead.name}</Link>
            </TitleLine>
            <p className="text-xs tabular-nums text-muted-foreground">{ageLabel(lead.createdAt)}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {[label(leadIntentLabels, lead.intent, 'Intent unknown'), label(leadSourceLabels, lead.source, 'Website'), lead.assignedAgent ? lead.assignedAgent.name || 'Assigned' : 'Unassigned', `${lead.showingsCount ?? 0} ${lead.showingsCount === 1 ? 'showing' : 'showings'}`].join(' · ')}
          </p>
          {lead.email || lead.phone ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {lead.phone ? <a href={`tel:${lead.phone.replace(/[^+\d]/g, '')}`} className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline"><Phone aria-hidden className="size-3.5 text-muted-foreground" />{lead.phone}</a> : null}
              {lead.email ? <a href={`mailto:${lead.email}`} className="inline-flex min-w-0 items-center gap-1.5 break-all font-medium text-foreground hover:underline"><Mail aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />{lead.email}</a> : null}
            </div>
          ) : <p className="text-sm text-muted-foreground">No contact details</p>}
          {lead.property ? (
            <Link href={`/dashboard/properties/${encodeURIComponent(lead.property.id)}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm hover:bg-muted">
              <span className="min-w-0">
                <span className="font-medium text-foreground">{lead.property.title || 'Listing'}</span>
                {lead.property.city ? <span className="text-muted-foreground"> · {[lead.property.city, lead.property.state].filter(Boolean).join(', ')}</span> : null}
              </span>
              {lead.property.title ? <span className="font-semibold tabular-nums text-foreground">{formatMoney(lead.property.price, lead.property.listingType)}</span> : null}
            </Link>
          ) : null}
          {lead.message ? <blockquote className="line-clamp-3 border-l-2 border-border pl-3 text-sm text-foreground/90">{lead.message}</blockquote> : null}
          <LeadStatusActions lead={lead} />
        </div>

        {viewer ? (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Schedule showing</h3>
            <ScheduleShowingForm viewer={viewer} leadId={lead.id} propertyId={lead.property?.id} assignedAgentId={lead.assignedAgent?.id} />
          </div>
        ) : null}
      </div>

      <details className="group border-t border-border">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <span>Activity</span>
          <span className="tabular-nums text-xs">{activityCount}</span>
        </summary>
        <div className="grid gap-4 border-t border-border p-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
          {lead.activityAccess === 'restricted' ? (
            <p className="text-sm text-muted-foreground">No access to this lead’s activity</p>
          ) : lead.activities?.length ? (
            <ol className="space-y-3">
              {lead.activities.map((activity) => (
                <li key={activity.id} className="relative border-l border-border pl-4">
                  <span aria-hidden className="absolute -left-[3px] top-1.5 size-1.5 rounded-full bg-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">{activity.subject || label(activityTypeLabels, activity.activityType)}</p>
                  {activity.body ? <p className="mt-0.5 line-clamp-3 text-sm text-foreground/90">{activity.body}</p> : null}
                  <p className="mt-0.5 text-xs text-muted-foreground">{[label(activityTypeLabels, activity.activityType), label(channelLabels, activity.channel, 'CRM'), activity.occurredAt ? ageLabel(activity.occurredAt) : '', activity.agent?.name].filter(Boolean).join(' · ')}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No activity</p>
          )}
          <LeadActivityForm leadId={lead.id} propertyId={lead.property?.id} />
        </div>
      </details>
    </article>
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

  return (
    <PlatformPage
      crumbs={[{ label: 'Leads' }]}
      title="Leads"
      meta={stats ? `${stats.new} new · ${stats.hot} qualified · ${stats.stale} stale` : null}
      actions={<Track><NewLeadDrawer properties={options.properties} agents={options.agents} /></Track>}
      toolbar={<>
        <SearchField action="/dashboard/platform/leads" defaultValue={q} label="Search leads" placeholder="Name, email, phone or city" hidden={{ status: status !== 'all' ? status : undefined }} />
        <FilterTabs label="Lead status" items={tabItems} />
      </>}
    >
      <div className="space-y-6">
        {viewer ? <OriginalShowingRecovery viewer={viewer} /> : null}

        {duplicateGroups.length ? (
          <details className="rounded-xl border border-amber-300/60 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-foreground">
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

        {error ? (
          <ErrorBanner>{error}</ErrorBanner>
        ) : leads.length ? (
          <div className="space-y-3">
            {leads.map((lead) => <LeadCard key={lead.id} lead={lead} viewer={viewer} />)}
          </div>
        ) : (
          <EmptyState title={q ? 'No leads match this search' : 'No leads'} />
        )}
      </div>

      {!error && pageInfo ? (
        <Pager
          label="Lead pages"
          previous={pageInfo.previousCursor ? leadsHref(status, q, { direction: 'before', value: pageInfo.previousCursor }) : null}
          next={pageInfo.nextCursor ? leadsHref(status, q, { direction: 'after', value: pageInfo.nextCursor }) : null}
        />
      ) : null}
    </PlatformPage>
  )
}
