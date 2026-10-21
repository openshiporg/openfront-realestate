import Link from 'next/link'
import { PageBreadcrumbs } from '@/features/dashboard/components/PageBreadcrumbs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/features/lib/money'
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

  return (
    <section className="overflow-hidden flex flex-col">
      <PageBreadcrumbs
        items={[
          { type: 'link', label: 'Dashboard', href: '/' },
          { type: 'page', label: 'Platform' },
          { type: 'link', label: 'Showings', href: '/platform/showings' },
          { type: 'page', label: title },
        ]}
      />
      <div className="max-w-5xl space-y-6 px-4 py-4 md:px-6">
        {!detail || error ? (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error || 'This showing could not be loaded.'}</div>
        ) : (() => {
          const { showing, snapshot, history, updatedAt, nextHistoryCursor } = detail
          const version = { expectedStatus: showing.status, expectedUpdatedAt: updatedAt, expectedRevision: detail.revision }
          return (
            <>
              <header>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
                  <Badge color={showingStatusColors[showing.status] || 'zinc'}>{label(showingStatusLabels, showing.status)}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground"><LocalDateTime value={showing.scheduledStart} options={{ dateStyle: 'full', timeStyle: 'short' }} /> · {label(showingTypeLabels, showing.showingType, 'Showing')}</p>
                {showing.status === 'requested' ? <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">Requested time — not yet confirmed.</p> : null}
              </header>

              <div className="grid gap-4 sm:grid-cols-2">
                <section className="rounded-lg border border-border bg-card p-4">
                  <h2 className="text-base font-semibold text-foreground">Client</h2>
                  <p className="mt-2 text-sm text-foreground">{showing.lead?.name || 'No client'}</p>
                  <p className="break-words text-sm text-muted-foreground">{[showing.lead?.email, showing.lead?.phone].filter(Boolean).join(' · ')}</p>
                  {showing.lead?.id ? <Link className="mt-2 inline-block text-sm text-foreground underline-offset-4 hover:underline" href={`/dashboard/platform/leads/${encodeURIComponent(showing.lead.id)}`}>View lead</Link> : null}
                  <p className="mt-3 text-sm text-muted-foreground">Agent: <span className="text-foreground">{showing.assignedAgent ? showing.assignedAgent.name || 'Assigned' : 'Unassigned'}</span></p>
                </section>
                <section className="rounded-lg border border-border bg-card p-4">
                  <h2 className="text-base font-semibold text-foreground">Notes</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{showing.notes || 'No notes.'}</p>
                  {showing.feedback ? (
                    <>
                      <h3 className="mt-4 text-sm font-semibold text-foreground">Feedback</h3>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{showing.feedback}</p>
                    </>
                  ) : null}
                </section>
              </div>

              {['requested', 'scheduled'].includes(showing.status) ? (
                <section className="rounded-lg border border-border bg-card p-4">
                  <h2 className="text-base font-semibold text-foreground">Actions</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {showing.status === 'requested' ? <ShowingStatusButton showingId={id} status="scheduled" label="Confirm showing" {...version} /> : null}
                    <ShowingStatusButton showingId={id} status="cancelled" label="Cancel showing" {...version} />
                    {showing.status === 'scheduled' ? <ShowingStatusButton showingId={id} status="no_show" label="Mark no show" {...version} /> : null}
                  </div>
                  {showing.status === 'scheduled' ? <ShowingFeedbackForm showingId={id} {...version} /> : null}
                </section>
              ) : null}

              <section className="rounded-lg border border-border bg-card p-4">
                <h2 className="text-base font-semibold text-foreground">Original request</h2>
                {snapshot ? (
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <div><dt className="text-xs text-muted-foreground">Listing</dt><dd className="text-foreground">{snapshot.listingTitle}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Address</dt><dd className="text-foreground">{[snapshot.addressLine1, snapshot.city, snapshot.state].filter(Boolean).join(', ')}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Price</dt><dd className="text-foreground">{snapshot.price ? `${formatMoney(snapshot.price)}${snapshot.listingType === 'rent' ? '/mo' : ''}` : '—'}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Requested time</dt><dd className="text-foreground"><LocalDateTime value={snapshot.scheduledStart} /> – <LocalDateTime value={snapshot.scheduledEnd} options={{ timeStyle: 'short' }} /></dd></div>
                    <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Note</dt><dd className="whitespace-pre-wrap text-foreground">{snapshot.notes || 'None'}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Received</dt><dd className="text-foreground"><LocalDateTime value={snapshot.capturedAt} /></dd></div>
                  </dl>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">No original request recorded.</p>
                )}
              </section>

              <section className="rounded-lg border border-border bg-card p-4">
                <h2 className="text-base font-semibold text-foreground">History</h2>
                {history.length ? (
                  <ol className="mt-3 divide-y divide-border">
                    {history.map((event) => (
                      <li key={event.id} className="py-2 text-sm">
                        <p className="font-medium text-foreground">
                          {label(showingHistoryLabels, event.action)}
                          {event.fromStatus || event.toStatus ? <span className="font-normal text-muted-foreground"> · {label(showingStatusLabels, event.fromStatus)} → {label(showingStatusLabels, event.toStatus)}</span> : null}
                        </p>
                        <p className="text-xs text-muted-foreground"><LocalDateTime value={event.occurredAt} /></p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">No history yet.</p>
                )}
                {before || nextHistoryCursor ? (
                  <nav aria-label="History pages" className="mt-3 flex gap-2">
                    {before ? <Button asChild variant="outline" size="sm"><Link href={href}>Latest</Link></Button> : null}
                    {nextHistoryCursor ? <Button asChild variant="outline" size="sm"><Link href={`${href}?before=${encodeURIComponent(nextHistoryCursor)}`}>Older</Link></Button> : null}
                  </nav>
                ) : null}
              </section>
            </>
          )
        })()}
      </div>
    </section>
  )
}
