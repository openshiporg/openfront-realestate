import Link from 'next/link'
import { formatMoney } from '@/features/lib/money'
import { ErrorBanner, Meta, Panel, PlatformPage, TitleLine, Track, trackItemClass } from '../../components/PlatformUI'
import { label } from '../../leads/lib/labels'
import { getShowingDetail } from '../actions/showings'
import { ShowingFeedbackForm, ShowingStatusButton } from '../components/ShowingActionForms'
import { LocalDateTime } from '../components/LocalDateTime'
import { showingHistoryLabels, showingStatusColors, showingStatusLabels, showingTypeLabels } from '../lib/labels'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ before?: string | string[] }>
}

export async function ShowingDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const query = await searchParams
  const before = typeof query.before === 'string' ? query.before : query.before ? 'invalid-history-cursor' : undefined
  const { detail, error } = await getShowingDetail(id, before)
  const href = `/dashboard/platform/showings/${encodeURIComponent(id)}`
  const title = detail?.showing.property?.title || 'Showing'
  const showing = detail && !error ? detail.showing : null

  return (
    <PlatformPage
      crumbs={[{ label: 'Showings', href: '/platform/showings' }, { label: title }]}
      title={showing
        ? <TitleLine as="h1" tone={showingStatusColors[showing.status] || 'zinc'} status={label(showingStatusLabels, showing.status)} headingClassName="text-2xl tracking-tight">{title}</TitleLine>
        : 'Showing'}
      meta={showing ? <><LocalDateTime value={showing.scheduledStart} options={{ dateStyle: 'full', timeStyle: 'short' }} /> · {label(showingTypeLabels, showing.showingType, 'Showing')}{showing.status === 'requested' ? <span className="text-amber-700 dark:text-amber-400"> · Not confirmed</span> : null}</> : null}
    >
      {!detail || error ? (
        <ErrorBanner>{error || 'This showing could not be loaded.'}</ErrorBanner>
      ) : (() => {
        const { snapshot, history, updatedAt, nextHistoryCursor } = detail
        const current = detail.showing
        const version = { expectedStatus: current.status, expectedUpdatedAt: updatedAt, expectedRevision: detail.revision }
        const open = ['requested', 'scheduled'].includes(current.status)
        return (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
            <div className="min-w-0 space-y-5">
              {open ? (
                <Panel title={current.status === 'requested' ? 'Confirm' : 'Outcome'}>
                  <div className="space-y-4">
                    <Track label="Showing status">
                      {current.status === 'requested' ? <ShowingStatusButton showingId={id} status="scheduled" label="Confirm showing" {...version} /> : null}
                      {current.status === 'scheduled' ? <ShowingStatusButton showingId={id} status="no_show" label="No show" {...version} /> : null}
                      <ShowingStatusButton showingId={id} status="cancelled" label="Cancel" {...version} />
                    </Track>
                    {current.status === 'scheduled' ? <ShowingFeedbackForm showingId={id} {...version} /> : null}
                  </div>
                </Panel>
              ) : null}

              <Panel title="Notes">
                <p className="whitespace-pre-wrap text-sm text-foreground/90">{current.notes || 'No notes'}</p>
                {current.feedback ? (
                  <div className="mt-4 border-t border-border pt-4">
                    <h3 className="text-xs font-medium text-muted-foreground">Feedback</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{current.feedback}</p>
                  </div>
                ) : null}
              </Panel>

              <Panel title="Original request">
                {snapshot ? (
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <Meta label="Listing">{snapshot.listingTitle}</Meta>
                    <Meta label="Address">{[snapshot.addressLine1, snapshot.city, snapshot.state].filter(Boolean).join(', ')}</Meta>
                    <Meta label="Price"><span className="tabular-nums">{snapshot.price ? `${formatMoney(snapshot.price)}${snapshot.listingType === 'rent' ? '/mo' : ''}` : '—'}</span></Meta>
                    <Meta label="Requested time"><LocalDateTime value={snapshot.scheduledStart} /> – <LocalDateTime value={snapshot.scheduledEnd} options={{ timeStyle: 'short' }} /></Meta>
                    <Meta label="Received"><LocalDateTime value={snapshot.capturedAt} /></Meta>
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-muted-foreground">Note</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{snapshot.notes || 'None'}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">No original request recorded</p>
                )}
              </Panel>
            </div>

            <aside className="min-w-0 space-y-5 lg:sticky lg:top-4">
              <Panel title="Client">
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-foreground">{current.lead?.name || 'No client'}</p>
                  {current.lead?.phone ? <a className="block text-foreground hover:underline" href={`tel:${current.lead.phone.replace(/[^+\d]/g, '')}`}>{current.lead.phone}</a> : null}
                  {current.lead?.email ? <a className="block break-all text-foreground hover:underline" href={`mailto:${current.lead.email}`}>{current.lead.email}</a> : null}
                  <p className="pt-2 text-muted-foreground">Agent · <span className="text-foreground">{current.assignedAgent ? current.assignedAgent.name || 'Assigned' : 'Unassigned'}</span></p>
                </div>
                {current.lead?.id ? <Link className={`mt-3 ${trackItemClass(true)}`} href={`/dashboard/platform/leads/${encodeURIComponent(current.lead.id)}`}>Open lead</Link> : null}
              </Panel>

              <Panel title="History">
                {history.length ? (
                  <ol className="space-y-3">
                    {history.map((event) => (
                      <li key={event.id} className="relative border-l border-border pl-4 text-sm">
                        <span aria-hidden className="absolute -left-[3px] top-1.5 size-1.5 rounded-full bg-muted-foreground" />
                        <p className="font-medium text-foreground">{label(showingHistoryLabels, event.action)}</p>
                        {event.fromStatus || event.toStatus ? <p className="text-xs text-muted-foreground">{label(showingStatusLabels, event.fromStatus)} to {label(showingStatusLabels, event.toStatus)}</p> : null}
                        <p className="text-xs text-muted-foreground"><LocalDateTime value={event.occurredAt} /></p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">No history</p>
                )}
                {before || nextHistoryCursor ? (
                  <nav aria-label="History pages" className="mt-4">
                    <Track>
                      {before ? <Link href={href} className={trackItemClass(false)}>Latest</Link> : null}
                      {nextHistoryCursor ? <Link href={`${href}?before=${encodeURIComponent(nextHistoryCursor)}`} className={trackItemClass(false)}>Older</Link> : null}
                    </Track>
                  </nav>
                ) : null}
              </Panel>
            </aside>
          </div>
        )
      })()}
    </PlatformPage>
  )
}
