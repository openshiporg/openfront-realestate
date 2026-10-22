import Link from 'next/link'
import { Mail, Phone } from 'lucide-react'
import { LocalDateTime } from '../../showings/components/LocalDateTime'
import { ErrorBanner, Meta, Panel, PlatformPage, TitleLine, Track, trackItemClass } from '../../components/PlatformUI'
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
  const failed = !detail || !lead || error

  return (
    <PlatformPage
      crumbs={[{ label: 'Leads', href: '/platform/leads' }, { label: lead?.name || 'Lead' }]}
      title={lead && !failed
        ? <TitleLine as="h1" tone={leadStatusColors[lead.status] || 'zinc'} status={label(leadStatusLabels, lead.status)} headingClassName="text-2xl tracking-tight">{lead.name}</TitleLine>
        : 'Lead'}
      meta={lead && !failed ? label(leadSourceLabels, lead.source, 'Website') : null}
    >
      <div className="space-y-5">
        {viewer ? <OriginalShowingRecovery viewer={viewer} /> : null}
        {!detail || !lead || error ? (
          <ErrorBanner>{error || 'This lead could not be loaded.'}</ErrorBanner>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
            <div className="min-w-0 space-y-5">
              <Panel title="Inquiry">
                <div className="space-y-4">
                  {lead.message ? <blockquote className="whitespace-pre-wrap border-l-2 border-border pl-3 text-sm text-foreground/90">{lead.message}</blockquote> : <p className="text-sm text-muted-foreground">No message</p>}
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <Meta label="Listing">
                      {lead.property ? <Link href={`/dashboard/properties/${encodeURIComponent(lead.property.id)}`} className="hover:underline">{lead.property.title || 'Listing'}</Link> : 'None'}
                    </Meta>
                    <Meta label="Agent">{lead.assignedAgent ? lead.assignedAgent.name || 'Assigned' : 'Unassigned'}</Meta>
                  </dl>
                  <Track label="Lead status">
                    {lead.status === 'new' ? <LeadStatusForm leadId={id} nextStatus="attempted_contact" label="Mark contacted" primary /> : null}
                    {['new', 'attempted_contact'].includes(lead.status) ? <LeadStatusForm leadId={id} nextStatus="qualified" label="Qualify" primary={lead.status !== 'new'} /> : null}
                    {!['closed', 'lost'].includes(lead.status) ? <LeadStatusForm leadId={id} nextStatus="lost" label="Mark lost" /> : null}
                    {lead.phone ? <a href={`tel:${lead.phone.replace(/[^+\d]/g, '')}`} className={trackItemClass(false)}><Phone aria-hidden className="size-3.5" />Call</a> : null}
                    {lead.email ? <a href={`mailto:${lead.email}`} className={trackItemClass(false)}><Mail aria-hidden className="size-3.5" />Email</a> : null}
                  </Track>
                </div>
              </Panel>

              <Panel title="Activity">
                {detail.activityAccess === 'restricted' ? (
                  <p className="text-sm text-muted-foreground">No access to this lead’s activity</p>
                ) : lead.activities?.length ? (
                  <ol className="space-y-4">
                    {lead.activities.map((activity) => (
                      <li key={activity.id} className="relative border-l border-border pl-4">
                        <span aria-hidden className="absolute -left-[3px] top-1.5 size-1.5 rounded-full bg-muted-foreground" />
                        <h3 className="text-sm font-medium text-foreground">{activity.subject || label(activityTypeLabels, activity.activityType)}</h3>
                        {activity.body ? <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{activity.body}</p> : null}
                        <p className="mt-1 text-xs text-muted-foreground"><LocalDateTime value={activity.occurredAt} />{activity.agent?.name ? ` · ${activity.agent.name}` : ''}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">No activity</p>
                )}
                {before || detail.nextActivityCursor ? (
                  <nav aria-label="Activity pages" className="mt-4">
                    <Track>
                      {before ? <Link href={href} className={trackItemClass(false)}>Latest</Link> : null}
                      {detail.nextActivityCursor ? <Link href={`${href}?before=${encodeURIComponent(detail.nextActivityCursor)}`} className={trackItemClass(false)}>Older</Link> : null}
                    </Track>
                  </nav>
                ) : null}
              </Panel>
            </div>

            <aside className="min-w-0 space-y-5 lg:sticky lg:top-4">
              <Panel title="Contact">
                <div className="space-y-2 text-sm">
                  {lead.phone ? <a href={`tel:${lead.phone.replace(/[^+\d]/g, '')}`} className="flex items-center gap-2 font-medium text-foreground hover:underline"><Phone aria-hidden className="size-4 text-muted-foreground" />{lead.phone}</a> : null}
                  {lead.email ? <a href={`mailto:${lead.email}`} className="flex min-w-0 items-center gap-2 break-all font-medium text-foreground hover:underline"><Mail aria-hidden className="size-4 shrink-0 text-muted-foreground" />{lead.email}</a> : null}
                  {!lead.phone && !lead.email ? <p className="text-muted-foreground">No contact details</p> : null}
                </div>
              </Panel>
              {viewer ? (
                <Panel title="Schedule showing">
                  <ScheduleShowingForm viewer={viewer} leadId={id} propertyId={lead.property?.id} assignedAgentId={lead.assignedAgent?.id} />
                </Panel>
              ) : null}
              <Panel title="Log activity">
                <LeadActivityForm leadId={id} propertyId={lead.property?.id} />
              </Panel>
            </aside>
          </div>
        )}
      </div>
    </PlatformPage>
  )
}
