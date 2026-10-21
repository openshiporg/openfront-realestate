import Link from 'next/link'
import { PageBreadcrumbs } from '@/features/dashboard/components/PageBreadcrumbs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LocalDateTime } from '../../showings/components/LocalDateTime'
import { getPlatformLeadDetail, getShowingRequestViewer } from '../actions/leads'
import { LeadStatusForm } from '../components/LeadActionForms'
import { LeadActivityForm } from '../components/LeadActivityForm'
import { OriginalShowingRecovery, ScheduleShowingForm } from '../components/PendingShowingForms'
import { activityTypeLabels, label, leadSourceLabels, leadStatusColors, leadStatusLabels } from '../lib/labels'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ before?: string | string[] }>
}

export async function LeadDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const query = await searchParams
  const before = typeof query.before === 'string' ? query.before : query.before ? 'invalid-cursor' : undefined
  const [{ detail, error }, viewer] = await Promise.all([getPlatformLeadDetail(id, before), getShowingRequestViewer()])
  const href = `/dashboard/platform/leads/${encodeURIComponent(id)}`
  const lead = detail?.lead

  return (
    <section className="overflow-hidden flex flex-col">
      <PageBreadcrumbs
        items={[
          { type: 'link', label: 'Dashboard', href: '/' },
          { type: 'page', label: 'Platform' },
          { type: 'link', label: 'Leads', href: '/platform/leads' },
          { type: 'page', label: lead?.name || 'Lead' },
        ]}
      />
      <div className="max-w-5xl space-y-6 px-4 py-4 md:px-6">
        {viewer ? <OriginalShowingRecovery viewer={viewer} /> : null}
        {!detail || !lead || error ? (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error || 'This lead could not be loaded.'}</div>
        ) : (
          <>
            <header>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">{lead.name}</h1>
                <Badge color={leadStatusColors[lead.status] || 'zinc'}>{label(leadStatusLabels, lead.status)}</Badge>
              </div>
              <p className="mt-1 break-words text-muted-foreground">{[lead.email, lead.phone].filter(Boolean).join(' · ') || 'No contact details'}</p>
              <p className="mt-1 text-sm text-muted-foreground">Source: {label(leadSourceLabels, lead.source, 'Website')}</p>
            </header>

            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-base font-semibold text-foreground">Inquiry</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{lead.message || 'No message.'}</p>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Listing</dt>
                  <dd className="text-foreground">
                    {lead.property ? <Link href={`/dashboard/properties/${encodeURIComponent(lead.property.id)}`} className="hover:underline">{lead.property.title || 'Listing'}</Link> : 'None'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Agent</dt>
                  <dd className="text-foreground">{lead.assignedAgent ? lead.assignedAgent.name || 'Assigned' : 'Unassigned'}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                {lead.status === 'new' ? <LeadStatusForm leadId={id} nextStatus="attempted_contact" label="Mark contacted" /> : null}
                {['new', 'attempted_contact'].includes(lead.status) ? <LeadStatusForm leadId={id} nextStatus="qualified" label="Qualify" /> : null}
                {!['closed', 'lost'].includes(lead.status) ? <LeadStatusForm leadId={id} nextStatus="lost" label="Mark lost" /> : null}
              </div>
              {viewer ? <div className="max-w-md"><ScheduleShowingForm viewer={viewer} leadId={id} propertyId={lead.property?.id} assignedAgentId={lead.assignedAgent?.id} /></div> : null}
            </section>

            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-base font-semibold text-foreground">Activity</h2>
              {detail.activityAccess === 'restricted' ? (
                <p className="mt-2 text-sm text-muted-foreground">You don’t have access to this lead’s activity.</p>
              ) : lead.activities?.length ? (
                <ol className="mt-3 divide-y divide-border">
                  {lead.activities.map((activity) => (
                    <li key={activity.id} className="py-3">
                      <h3 className="text-sm font-medium text-foreground">{activity.subject || label(activityTypeLabels, activity.activityType)}</h3>
                      {activity.body ? <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{activity.body}</p> : null}
                      <p className="mt-1 text-xs text-muted-foreground"><LocalDateTime value={activity.occurredAt} />{activity.agent?.name ? ` · ${activity.agent.name}` : ''}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No activity yet.</p>
              )}
              {before || detail.nextActivityCursor ? (
                <nav aria-label="Activity pages" className="mt-3 flex gap-2">
                  {before ? <Button asChild variant="outline" size="sm"><Link href={href}>Latest</Link></Button> : null}
                  {detail.nextActivityCursor ? <Button asChild variant="outline" size="sm"><Link href={`${href}?before=${encodeURIComponent(detail.nextActivityCursor)}`}>Older</Link></Button> : null}
                </nav>
              ) : null}
            </section>

            <LeadActivityForm leadId={id} propertyId={lead.property?.id} />
          </>
        )}
      </div>
    </section>
  )
}
