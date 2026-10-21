import Link from 'next/link'
import { PageBreadcrumbs } from '@/features/dashboard/components/PageBreadcrumbs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatMoney as exactMoney, moneyToMinor } from '@/features/lib/money'
import { FilterTabs } from '../../listings/components/FilterTabs'
import { getLeadDuplicateGroups, getPlatformLeads, getShowingRequestViewer, type LeadStats, type PlatformLead } from '../actions/leads'
import { LeadStatusForm } from '../components/LeadActionForms'
import { LeadActivityForm } from '../components/LeadActivityForm'
import { OriginalShowingRecovery, ScheduleShowingForm } from '../components/PendingShowingForms'
import { DuplicateLeadResolver } from '../components/DuplicateLeadResolver'
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

function LeadCard({ lead, viewer }: { lead: PlatformLead; viewer: OperatorViewer | null }) {
  const contact = [lead.email, lead.phone].filter(Boolean).join(' · ')

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <h2 className="min-w-0 flex-1 text-base font-semibold text-foreground">
              <Link href={`/dashboard/platform/leads/${encodeURIComponent(lead.id)}`} className="hover:underline">{lead.name}</Link>
            </h2>
            <Badge color={leadStatusColors[lead.status] || 'zinc'} className="shrink-0">{label(leadStatusLabels, lead.status)}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{label(leadIntentLabels, lead.intent, 'Intent unknown')} · {label(leadSourceLabels, lead.source, 'Website')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{contact || 'No contact details'}</p>
          {lead.property ? (
            <div className="mt-3 rounded-md border border-border bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">Interested in</p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Link href={`/dashboard/properties/${encodeURIComponent(lead.property.id)}`} className="text-sm font-medium text-foreground hover:underline">{lead.property.title || 'Listing'}</Link>
                  {lead.property.city ? <p className="text-sm text-muted-foreground">{[lead.property.city, lead.property.state].filter(Boolean).join(', ')}</p> : null}
                </div>
                {lead.property.title ? <p className="text-sm font-semibold text-foreground">{formatMoney(lead.property.price, lead.property.listingType)}</p> : null}
              </div>
            </div>
          ) : null}
          {lead.message ? <p className="mt-3 line-clamp-3 text-sm text-foreground/90">{lead.message}</p> : null}
        </div>

        <aside className="w-full rounded-md border border-border bg-muted/40 p-3 xl:w-72">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Created</dt>
              <dd className="mt-0.5 font-medium text-foreground">{ageLabel(lead.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Showings</dt>
              <dd className="mt-0.5 font-medium text-foreground">{lead.showingsCount ?? '—'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">Agent</dt>
              <dd className="mt-0.5 font-medium text-foreground">{lead.assignedAgent ? lead.assignedAgent.name || 'Assigned' : 'Unassigned'}</dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            {lead.status === 'new' ? <LeadStatusForm leadId={lead.id} nextStatus="attempted_contact" label="Mark contacted" /> : null}
            {['new', 'attempted_contact'].includes(lead.status) ? <LeadStatusForm leadId={lead.id} nextStatus="qualified" label="Qualify" /> : null}
            {!['closed', 'lost'].includes(lead.status) ? <LeadStatusForm leadId={lead.id} nextStatus="lost" label="Mark lost" /> : null}
          </div>
          {viewer ? <ScheduleShowingForm viewer={viewer} leadId={lead.id} propertyId={lead.property?.id} assignedAgentId={lead.assignedAgent?.id} /> : null}
        </aside>
      </div>

      <div className="mt-4 grid gap-4 border-t border-border pt-4 lg:grid-cols-[1fr_28rem]">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Recent activity</h3>
          {lead.activityAccess === 'restricted' ? (
            <p className="mt-2 text-sm text-muted-foreground">You don’t have access to this lead’s activity.</p>
          ) : lead.activities?.length ? (
            <ol className="mt-2 space-y-2">
              {lead.activities.map((activity) => (
                <li key={activity.id} className="rounded-md border border-border bg-muted/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{activity.subject || label(activityTypeLabels, activity.activityType)}</p>
                    <Badge variant="outline">{label(activityTypeLabels, activity.activityType)} · {label(channelLabels, activity.channel, 'CRM')}</Badge>
                  </div>
                  {activity.body ? <p className="mt-1 line-clamp-3 text-sm text-foreground/90">{activity.body}</p> : null}
                  <p className="mt-1 text-xs text-muted-foreground">{activity.occurredAt ? ageLabel(activity.occurredAt) : ''}{activity.agent?.name ? `${activity.occurredAt ? ' · ' : ''}${activity.agent.name}` : ''}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No activity yet.</p>
          )}
        </div>
        <LeadActivityForm leadId={lead.id} propertyId={lead.property?.id} />
      </div>
    </article>
  )
}

export async function LeadListPage({ searchParams }: PageProps) {
  const params = await searchParams
  const status = typeof params.status === 'string' ? params.status : 'all'
  const q = typeof params.q === 'string' ? params.q : ''
  const after = cursorParam(params.after)
  const before = cursorParam(params.before)
  const [{ leads, stats, error, pageInfo }, viewer, { groups: duplicateGroups, error: duplicateError }] = await Promise.all([
    getPlatformLeads(status, q, after, before),
    getShowingRequestViewer(),
    getLeadDuplicateGroups(),
  ])

  const tabItems = tabs.map((tab) => ({
    label: tab.label,
    href: leadsHref(tab.value, q),
    active: status === tab.value,
    count: tab.stat && stats ? stats[tab.stat] : null,
  }))

  return (
    <section className="overflow-hidden flex flex-col">
      <PageBreadcrumbs
        items={[
          { type: 'link', label: 'Dashboard', href: '/' },
          { type: 'page', label: 'Platform' },
          { type: 'page', label: 'Leads' },
        ]}
      />
      <div className="px-4 pt-4 md:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Leads</h1>
        <p className="text-muted-foreground">Follow up with buyer, renter and seller inquiries</p>
      </div>
      <form action="/dashboard/platform/leads" className="flex gap-2 px-4 py-4 md:px-6">
        {status !== 'all' ? <input type="hidden" name="status" value={status} /> : null}
        <Input name="q" defaultValue={q} aria-label="Search leads" placeholder="Search name, email, phone or city" className="sm:max-w-sm" />
        <Button type="submit" variant="outline">Search</Button>
      </form>
      <FilterTabs label="Lead status" items={tabItems} />

      <div className="space-y-6 px-4 py-4 md:px-6">
        {viewer ? <OriginalShowingRecovery viewer={viewer} /> : null}

        {duplicateGroups.length ? (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">Possible duplicates</h2>
            {duplicateGroups.map((group) => <DuplicateLeadResolver key={group.key} group={group} />)}
          </div>
        ) : duplicateError ? (
          <div role="alert" className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">Duplicates could not be loaded. {duplicateError}</div>
        ) : null}

        {error ? (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
        ) : leads.length ? (
          <div className="space-y-4">
            {leads.map((lead) => <LeadCard key={lead.id} lead={lead} viewer={viewer} />)}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <h2 className="text-base font-semibold text-foreground">{q ? 'No leads match your search' : 'No leads'}</h2>
          </div>
        )}

        {!error && pageInfo && (pageInfo.previousCursor || pageInfo.nextCursor) ? (
          <nav aria-label="Lead pages" className="flex items-center justify-between gap-3">
            {pageInfo.previousCursor ? <Button asChild variant="outline"><Link href={leadsHref(status, q, { direction: 'before', value: pageInfo.previousCursor })}>Previous</Link></Button> : <span />}
            {pageInfo.nextCursor ? <Button asChild variant="outline"><Link href={leadsHref(status, q, { direction: 'after', value: pageInfo.nextCursor })}>Next</Link></Button> : <span />}
          </nav>
        ) : null}
      </div>
    </section>
  )
}
