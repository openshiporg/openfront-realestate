import Link from 'next/link'
import { PageBreadcrumbs } from '@/features/dashboard/components/PageBreadcrumbs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FilterTabs } from '../../listings/components/FilterTabs'
import { getPlatformShowings, type ShowingStats } from '../actions/showings'
import { ShowingBoard } from '../components/ShowingBoard'

const statusTabs: Array<{ value: string; label: string; stat: keyof ShowingStats }> = [
  { value: 'all', label: 'All', stat: 'total' },
  { value: 'requested', label: 'Requested', stat: 'requested' },
  { value: 'scheduled', label: 'Scheduled', stat: 'scheduled' },
  { value: 'completed', label: 'Completed', stat: 'completed' },
  { value: 'no_show', label: 'No show', stat: 'noShow' },
  { value: 'cancelled', label: 'Cancelled', stat: 'cancelled' },
]

const rangeTabs = [
  ['upcoming', 'Upcoming'],
  ['today', 'Today'],
  ['week', 'Next 7 days'],
  ['month', 'Next 30 days'],
  ['past', 'Past'],
  ['all', 'All time'],
]

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

function buildHref(status: string, range: string, q: string, pagination?: { direction: 'after' | 'before'; cursor: string }) {
  const params = new URLSearchParams()
  if (status !== 'all') params.set('status', status)
  if (range !== 'upcoming') params.set('range', range)
  if (q) params.set('q', q)
  if (pagination) params.set(pagination.direction, pagination.cursor)
  const query = params.toString()
  return query ? `/dashboard/platform/showings?${query}` : '/dashboard/platform/showings'
}

export async function ShowingListPage({ searchParams }: PageProps) {
  const params = await searchParams
  const status = typeof params.status === 'string' ? params.status : 'all'
  const range = typeof params.range === 'string' ? params.range : 'upcoming'
  const q = typeof params.q === 'string' ? params.q : ''
  const after = params.after === undefined ? undefined : typeof params.after === 'string' ? params.after : 'invalid-cursor'
  const before = params.before === undefined ? undefined : typeof params.before === 'string' ? params.before : 'invalid-cursor'
  const { showings, stats, pageInfo, error } = await getPlatformShowings(status, range, q, after, before)

  return (
    <section className="overflow-hidden flex flex-col">
      <PageBreadcrumbs
        items={[
          { type: 'link', label: 'Dashboard', href: '/' },
          { type: 'page', label: 'Platform' },
          { type: 'page', label: 'Showings' },
        ]}
      />
      <div className="flex flex-col gap-4 px-4 pt-4 md:px-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Showings</h1>
          <p className="text-muted-foreground">Confirm tours and record feedback</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/platform/leads">Schedule from a lead</Link>
        </Button>
      </div>
      <form action="/dashboard/platform/showings" className="flex flex-wrap gap-2 px-4 py-4 md:px-6">
        {status !== 'all' ? <input type="hidden" name="status" value={status} /> : null}
        {range !== 'upcoming' ? <input type="hidden" name="range" value={range} /> : null}
        <Input name="q" defaultValue={q} aria-label="Search showings" placeholder="Search listing, client or agent" className="min-w-0 flex-1 sm:max-w-sm" />
        <Button type="submit" variant="outline">Search</Button>
      </form>
      <FilterTabs label="Date range" items={rangeTabs.map(([value, text]) => ({ label: text, href: buildHref(status, value, q), active: range === value }))} />
      <FilterTabs label="Showing status" items={statusTabs.map((tab) => ({ label: tab.label, href: buildHref(tab.value, range, q), active: status === tab.value, count: stats ? stats[tab.stat] : null }))} />

      <div className="px-4 py-4 md:px-6">
        {error ? (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
        ) : showings.length ? (
          <ShowingBoard showings={showings} />
        ) : (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <h2 className="text-base font-semibold text-foreground">No showings</h2>
          </div>
        )}

        {!error && pageInfo && (pageInfo.hasPreviousPage || pageInfo.hasNextPage) ? (
          <nav aria-label="Showing pages" className="mt-6 flex items-center justify-between gap-3">
            {pageInfo.hasPreviousPage && pageInfo.previousCursor ? (
              <Button asChild variant="outline"><Link href={buildHref(status, range, q, { direction: 'before', cursor: pageInfo.previousCursor })}>Previous</Link></Button>
            ) : <span />}
            {pageInfo.hasNextPage && pageInfo.nextCursor ? (
              <Button asChild variant="outline"><Link href={buildHref(status, range, q, { direction: 'after', cursor: pageInfo.nextCursor })}>Next</Link></Button>
            ) : <span />}
          </nav>
        ) : null}
      </div>
    </section>
  )
}
