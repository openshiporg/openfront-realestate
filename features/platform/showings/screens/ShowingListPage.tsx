import Link from 'next/link'
import { EmptyState, ErrorBanner, Pager, PlatformPage, SearchField, trackItemClass } from '../../components/PlatformUI'
import { FilterTabs } from '../../listings/components/FilterTabs'
import { getPlatformShowings, getShowingDetail, type ShowingStats } from '../actions/showings'
import { ShowingBoard, type ShowingVersion } from '../components/ShowingBoard'
import { RangeSelect } from '../components/RangeSelect'

/** The page opens on the confirmation queue; "All" is an explicit choice. */
const DEFAULT_STATUS = 'requested'

const statusTabs: Array<{ value: string; label: string; stat: keyof ShowingStats }> = [
  { value: 'requested', label: 'To confirm', stat: 'requested' },
  { value: 'scheduled', label: 'Scheduled', stat: 'scheduled' },
  { value: 'completed', label: 'Completed', stat: 'completed' },
  { value: 'no_show', label: 'No show', stat: 'noShow' },
  { value: 'cancelled', label: 'Cancelled', stat: 'cancelled' },
  { value: 'all', label: 'All', stat: 'total' },
]

const rangeOptions: Array<[string, string]> = [
  ['upcoming', 'Upcoming'],
  ['today', 'Today'],
  ['week', 'Next 7 days'],
  ['month', 'Next 30 days'],
  ['past', 'Past'],
  ['all', 'All dates'],
]

/** Requests to confirm and finished showings are not bounded by date by default; the calendar views are. */
function defaultRange(status: string) {
  return status === 'scheduled' || status === 'all' ? 'upcoming' : 'all'
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

function buildHref(status: string, range: string, q: string, pagination?: { direction: 'after' | 'before'; cursor: string }) {
  const params = new URLSearchParams()
  if (status !== DEFAULT_STATUS) params.set('status', status)
  if (range !== defaultRange(status)) params.set('range', range)
  if (q) params.set('q', q)
  if (pagination) params.set(pagination.direction, pagination.cursor)
  const query = params.toString()
  return query ? `/dashboard/platform/showings?${query}` : '/dashboard/platform/showings'
}

export async function ShowingListPage({ searchParams }: PageProps) {
  const params = await searchParams
  const status = typeof params.status === 'string' ? params.status : DEFAULT_STATUS
  const range = typeof params.range === 'string' ? params.range : defaultRange(status)
  const q = typeof params.q === 'string' ? params.q : ''
  const after = params.after === undefined ? undefined : typeof params.after === 'string' ? params.after : 'invalid-cursor'
  const before = params.before === undefined ? undefined : typeof params.before === 'string' ? params.before : 'invalid-cursor'
  const { showings, stats, pageInfo, error } = await getPlatformShowings(status, range, q, after, before)

  // Confirming from the row needs each request's current version, which only the detail projection carries.
  const versions: Record<string, ShowingVersion> = {}
  const requested = showings.filter(showing => showing.status === 'requested')
  const details = await Promise.all(requested.map(showing => getShowingDetail(showing.id).catch(() => ({ detail: null, error: 'unavailable' }))))
  details.forEach(({ detail }, index) => {
    if (detail && detail.showing.status === 'requested') versions[requested[index].id] = { expectedStatus: detail.showing.status, expectedUpdatedAt: detail.updatedAt, expectedRevision: detail.revision }
  })

  const toConfirm = stats?.requested ?? 0
  const activeTab = statusTabs.find(tab => tab.value === status)

  return (
    <PlatformPage
      crumbs={[{ label: 'Showings' }]}
      title="Showings"
      meta={stats ? (toConfirm ? <span className="font-medium text-amber-700 dark:text-amber-400">{toConfirm} to confirm</span> : 'Nothing to confirm') : null}
      actions={<Link href="/dashboard/platform/leads" className={trackItemClass(false)}>Schedule from a lead</Link>}
      toolbar={<>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchField action="/dashboard/platform/showings" defaultValue={q} label="Search showings" placeholder="Listing, client or agent" hidden={{ status: status !== DEFAULT_STATUS ? status : undefined, range: range !== defaultRange(status) ? range : undefined }} />
          <RangeSelect value={range} options={rangeOptions.map(([value, text]) => ({ value, label: text, href: buildHref(status, value, q) }))} />
        </div>
        <FilterTabs label="Showing status" items={statusTabs.map((tab) => ({ label: tab.label, href: buildHref(tab.value, defaultRange(tab.value), q), active: status === tab.value, count: stats ? stats[tab.stat] : null }))} />
      </>}
    >
      <div className="pb-16">
        {error ? (
          <ErrorBanner>{error}</ErrorBanner>
        ) : showings.length ? (
          <ShowingBoard showings={showings} versions={versions} />
        ) : (
          <EmptyState title={status === 'requested' ? 'No showings to confirm' : `No ${activeTab && activeTab.value !== 'all' ? activeTab.label.toLowerCase() + ' ' : ''}showings in this range`}>
            {status === 'requested' ? <Link href={buildHref('scheduled', 'upcoming', q)} className={trackItemClass(false)}>Upcoming showings</Link> : null}
          </EmptyState>
        )}
        {!error && pageInfo ? (
          <Pager
            label="Showing pages"
            previous={pageInfo.hasPreviousPage && pageInfo.previousCursor ? buildHref(status, range, q, { direction: 'before', cursor: pageInfo.previousCursor }) : null}
            next={pageInfo.hasNextPage && pageInfo.nextCursor ? buildHref(status, range, q, { direction: 'after', cursor: pageInfo.nextCursor }) : null}
          />
        ) : null}
      </div>
    </PlatformPage>
  )
}
