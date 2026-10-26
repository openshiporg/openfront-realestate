import Link from 'next/link'
import { Mail, Phone } from 'lucide-react'
import { formatMoney as exactMoney, moneyToMinor } from '@/features/lib/money'
import { LocalDateTime } from '../../showings/components/LocalDateTime'
import { ErrorBanner, Meta, Panel, PlatformPage, TitleLine, trackItemClass } from '../../components/PlatformUI'
import { getPlatformLeadDetail, getShowingRequestViewer } from '../actions/leads'
import { LeadActivityForm } from '../components/LeadActivityForm'
import { LeadRowActions } from '../components/LeadRowActions'
import { LocalizedText } from '../components/LocalizedText'
import { OriginalShowingRecovery, ScheduleShowingForm } from '../components/PendingShowingForms'
import { ResponseClock } from '../components/ResponseClock'
import { activityTypeLabels, channelLabels, label, leadIntentLabels, leadSourceLabels, leadStatusColors, leadStatusLabels } from '../lib/labels'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ before?: string | string[] }>
}

const NEEDS_RESPONSE = ['new', 'attempted_contact']

function price(value?: string | null, listingType?: string | null) {
  if (moneyToMinor(value || '0') <= 0n) return 'Price TBD'
  return `${exactMoney(value || '0')}${listingType === 'rent' ? '/mo' : ''}`
}

export async function LeadDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const query = await searchParams
  const before = typeof query.before === 'string' ? query.before : query.before ? 'invalid-cursor' : undefined
  const [{ detail, error }, viewer] = await Promise.all([getPlatformLeadDetail(id, before), getShowingRequestViewer()])
  const href = `/dashboard/platform/leads/${encodeURIComponent(id)}`
  const lead = detail?.lead
  const failed = !detail || !lead || error
  const waiting = lead ? NEEDS_RESPONSE.includes(lead.status) : false

  return (
    <PlatformPage
      crumbs={[{ label: 'Leads', href: '/platform/leads' }, { label: lead?.name || 'Lead' }]}
      title={lead && !failed
        ? <TitleLine as="h1" tone={leadStatusColors[lead.status] || 'zinc'} status={label(leadStatusLabels, lead.status)} headingClassName="text-2xl tracking-tight">{lead.name}</TitleLine>
        : 'Lead'}
      meta={lead && !failed ? (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{[label(leadIntentLabels, lead.intent, 'Intent unknown'), label(leadSourceLabels, lead.source, 'Website')].join(' · ')}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1.5">{waiting ? 'Waiting' : 'Age'} <ResponseClock since={waiting ? lead.lastContactedAt || lead.createdAt : lead.createdAt} waiting={waiting} /></span>
        </span>
      ) : null}
      actions={lead && !failed ? (
        <LeadRowActions
          showContact
          viewer={viewer}
          lead={{ id, name: lead.name, status: lead.status, phone: lead.phone, email: lead.email, propertyId: lead.property?.id, assignedAgentId: lead.assignedAgent?.id }}
        />
      ) : null}
    >
      <div className="space-y-5 pb-16">
        {viewer ? <OriginalShowingRecovery viewer={viewer} /> : null}
        {!detail || !lead || error ? (
          <ErrorBanner>{error || 'This lead could not be loaded.'}</ErrorBanner>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
            <div className="min-w-0 space-y-5">
              <Panel title="Contact">
                <div className="space-y-4">
                  <div className="flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:gap-x-6">
                    {lead.phone ? <a href={`tel:${lead.phone.replace(/[^+\d]/g, '')}`} className="inline-flex min-h-9 items-center gap-2 text-base font-semibold tabular-nums text-foreground underline-offset-2 hover:underline"><Phone aria-hidden className="size-4 text-muted-foreground" />{lead.phone}</a> : null}
                    {lead.email ? <a href={`mailto:${lead.email}`} className="inline-flex min-h-9 min-w-0 items-center gap-2 break-all text-base font-medium text-foreground underline-offset-2 hover:underline"><Mail aria-hidden className="size-4 shrink-0 text-muted-foreground" />{lead.email}</a> : null}
                    {!lead.phone && !lead.email ? <p className="text-muted-foreground">No contact details</p> : null}
                  </div>
                  <dl className="grid gap-3 border-t border-border pt-3 sm:grid-cols-3">
                    <Meta label="Listing">
                      {lead.property ? <Link href={`/dashboard/properties/${encodeURIComponent(lead.property.id)}`} className="hover:underline">{lead.property.title || 'Listing'}</Link> : 'None'}
                    </Meta>
                    <Meta label="Price">{lead.property ? <span className="tabular-nums">{price(lead.property.price, lead.property.listingType)}</span> : '—'}</Meta>
                    <Meta label="Agent">{lead.assignedAgent ? lead.assignedAgent.name || 'Assigned' : 'Unassigned'}</Meta>
                    <Meta label="Received"><LocalDateTime value={lead.createdAt} /></Meta>
                    <Meta label="Last contact">{lead.lastContactedAt ? <LocalDateTime value={lead.lastContactedAt} /> : 'Not yet'}</Meta>
                    <Meta label="Showings"><span className="tabular-nums">{lead.showingsCount ?? 0}</span></Meta>
                  </dl>
                </div>
              </Panel>

              <Panel title="Inquiry">
                {lead.message ? <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90"><LocalizedText text={lead.message} /></p> : <p className="text-sm text-muted-foreground">No message</p>}
              </Panel>

              <Panel title="Activity">
                {detail.activityAccess === 'restricted' ? (
                  <p className="text-sm text-muted-foreground">No access to this lead’s activity</p>
                ) : lead.activities?.length ? (
                  <ol className="divide-y divide-border">
                    {lead.activities.map((activity) => (
                      <li key={activity.id} className="grid gap-x-4 gap-y-0.5 py-3 first:pt-0 last:pb-0 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
                        <p className="text-xs tabular-nums text-muted-foreground sm:pt-0.5"><LocalDateTime value={activity.occurredAt} /></p>
                        <div className="min-w-0">
                          <h3 className="text-sm font-medium text-foreground">{activity.subject ? <LocalizedText text={activity.subject} /> : label(activityTypeLabels, activity.activityType)}</h3>
                          {activity.body ? <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground/90"><LocalizedText text={activity.body} /></p> : null}
                          <p className="mt-0.5 text-xs text-muted-foreground">{[label(activityTypeLabels, activity.activityType), label(channelLabels, activity.channel, 'CRM'), activity.agent?.name].filter(Boolean).join(' · ')}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">No activity</p>
                )}
                {before || detail.nextActivityCursor ? (
                  <nav aria-label="Activity pages" className="mt-4 flex gap-1.5">
                    {before ? <Link href={href} className={trackItemClass(false)}>Latest</Link> : null}
                    {detail.nextActivityCursor ? <Link href={`${href}?before=${encodeURIComponent(detail.nextActivityCursor)}`} className={trackItemClass(false)}>Older</Link> : null}
                  </nav>
                ) : null}
              </Panel>
            </div>

            <aside className="min-w-0 space-y-5 lg:sticky lg:top-4">
              <Panel title="Log activity">
                <LeadActivityForm leadId={id} propertyId={lead.property?.id} />
              </Panel>
              {viewer && !['closed', 'lost'].includes(lead.status) ? (
                <Panel title="Schedule showing">
                  <ScheduleShowingForm viewer={viewer} leadId={id} propertyId={lead.property?.id} assignedAgentId={lead.assignedAgent?.id} />
                </Panel>
              ) : null}
            </aside>
          </div>
        )}
      </div>
    </PlatformPage>
  )
}
