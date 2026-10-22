import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorBanner, Pager, PlatformPage, SearchField } from '../../components/PlatformUI'
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
  ['week', '7 days'],
  ['month', '30 days'],
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
    <PlatformPage
      crumbs={[{ label: 'Showings' }]}
      title="Showings"
      meta={stats ? `${stats.requested} to confirm · ${stats.scheduled} scheduled` : null}
      actions={<Button asChild variant="outline" className="rounded-full"><Link href="/dashboard/platform/leads">Schedule from a lead</Link></Button>}
      toolbar={<>
        <SearchField action="/dashboard/platform/showings" defaultValue={q} label="Search showings" placeholder="Listing, client or agent" hidden={{ status: status !== 'all' ? status : undefined, range: range !== 'upcoming' ? range : undefined }} />
        <div className="flex flex-col gap-2 xl:flex-row">
          <FilterTabs label="Date range" items={rangeTabs.map(([value, text]) => ({ label: text, href: buildHref(status, value, q), active: range === value }))} />
          <FilterTabs label="Showing status" items={statusTabs.map((tab) => ({ label: tab.label, href: buildHref(tab.value, range, q), active: status === tab.value, count: stats ? stats[tab.stat] : null }))} />
        </div>
      </>}
    >
      {error ? (
        <ErrorBanner>{error}</ErrorBanner>
      ) : showings.length ? (
        <ShowingBoard showings={showings} />
      ) : (
        <EmptyState title="No showings" />
      )}
      {!error && pageInfo ? (
        <Pager
          label="Showing pages"
          previous={pageInfo.hasPreviousPage && pageInfo.previousCursor ? buildHref(status, range, q, { direction: 'before', cursor: pageInfo.previousCursor }) : null}
          next={pageInfo.hasNextPage && pageInfo.nextCursor ? buildHref(status, range, q, { direction: 'after', cursor: pageInfo.nextCursor }) : null}
        />
      ) : null}
    </PlatformPage>
  )
}
