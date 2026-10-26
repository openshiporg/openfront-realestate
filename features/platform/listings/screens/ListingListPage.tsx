import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatMoney as money } from '@/features/lib/money'
import { DataTable, EmptyState, ErrorBanner, Pager, PlatformPage, SearchField, StatusCell, Td, pillPrimaryClass } from '../../components/PlatformUI'
import { getPlatformListings, type PlatformListing } from '../actions/listings'
import { ListingStatusTrack } from '../components/ListingStatusTrack'
import { listingStatuses as statuses } from '../lib/listingStatus'
import { FilterTabs } from '../components/FilterTabs'


interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

function listingPageHref(status: string, q: string, cursor: { after?: string; before?: string } = {}) {
  const params = new URLSearchParams()
  if (status !== 'all') params.set('status', status)
  if (q) params.set('q', q)
  if (cursor.after) params.set('after', cursor.after)
  if (cursor.before) params.set('before', cursor.before)
  const query = params.toString()
  return query ? `/dashboard/platform/listings?${query}` : '/dashboard/platform/listings'
}

function cursorParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined
  return typeof value === 'string' ? value : ''
}

function priceLabel(item: PlatformListing) {
  const formatted = money(item.price)
  return item.listingType === 'rent' ? `${formatted}/mo` : formatted
}

function factsLabel(item: PlatformListing) {
  const facts: string[] = []
  if (item.propertyType !== 'land' && item.bedrooms > 0) facts.push(`${item.bedrooms} bd`)
  if (item.propertyType !== 'land' && Number(item.bathrooms) > 0) facts.push(`${Number(item.bathrooms)} ba`)
  if (item.squareFeet) facts.push(`${item.squareFeet.toLocaleString()} sq ft`)
  return facts.join(' · ')
}

const DAY = 86_400_000

function updatedLabel(iso: string, now: number) {
  const days = Math.floor((now - new Date(iso).getTime()) / DAY)
  if (!Number.isFinite(days) || days <= 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

function countCell(value: number | null) {
  return value === null ? <span className="text-muted-foreground">—</span> : <span className={value === 0 ? 'text-muted-foreground' : 'text-foreground'}>{value}</span>
}

function ListingRow({ item, now }: { item: PlatformListing; now: number }) {
  const status = statuses.find((entry) => entry.value === item.status)
  const facts = factsLabel(item)
  const place = [item.addressLine1, item.city].filter(Boolean).join(', ')
  const href = `/dashboard/platform/listings/${item.id}`
  const statusCell = <StatusCell tone={status?.tone || 'zinc'}>{status?.label || item.status}</StatusCell>
  return (
    <tr className="transition-colors hover:bg-muted/30">
      <Td className="min-w-0 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="hidden h-9 w-12 shrink-0 rounded-[4px] bg-muted bg-cover bg-center sm:block"
            style={item.primaryImageUrl ? { backgroundImage: `url(${item.primaryImageUrl})` } : undefined}
            role="img"
            aria-label={item.primaryImageUrl ? `${item.title} photo` : 'No photo'}
          />
          <div className="min-w-0">
            <Link href={href} className="block max-w-[11rem] truncate font-medium sm:max-w-[22rem] text-foreground underline-offset-2 hover:underline">{item.title}</Link>
            <p className="max-w-[11rem] truncate text-xs text-muted-foreground sm:max-w-[22rem]">{[place || 'No address', facts].filter(Boolean).join(' · ')}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs md:hidden">
              {statusCell}
              <span className="font-semibold tabular-nums text-foreground">{priceLabel(item)}</span>
              <span className={item.assignedAgent ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-400'}>{item.assignedAgent?.name || 'Unassigned'}</span>
            </div>
          </div>
        </div>
      </Td>
      <Td className="hidden whitespace-nowrap md:table-cell">{statusCell}</Td>
      <Td className="hidden whitespace-nowrap text-right font-medium tabular-nums md:table-cell">{priceLabel(item)}</Td>
      <Td className="hidden text-right tabular-nums lg:table-cell">{countCell(item.leadsCount)}</Td>
      <Td className="hidden text-right tabular-nums lg:table-cell">{countCell(item.showingsCount)}</Td>
      <Td className="hidden max-w-[10rem] truncate md:table-cell">{item.assignedAgent ? item.assignedAgent.name : <span className="text-amber-700 dark:text-amber-400">Unassigned</span>}</Td>
      <Td className="hidden whitespace-nowrap text-muted-foreground tabular-nums xl:table-cell">{updatedLabel(item.updatedAt, now)}</Td>
      <Td className="w-px whitespace-nowrap py-2 text-right">
        <div className="flex justify-end">
          <ListingStatusTrack id={item.id} title={item.title} status={item.status} listingType={item.listingType} />
        </div>
      </Td>
    </tr>
  )
}

function attentionLine(items: PlatformListing[], partial: boolean) {
  const unassigned = items.filter(item => !item.assignedAgent).length
  const noPhoto = items.filter(item => !item.primaryImageUrl).length
  const quiet = items.filter(item => item.status === 'active' && item.leadsCount === 0).length
  const parts = [
    unassigned ? `${unassigned} unassigned` : '',
    noPhoto ? `${noPhoto} without a photo` : '',
    quiet ? `${quiet} active with no leads` : '',
  ].filter(Boolean)
  if (!parts.length) return null
  return `${parts.join(' · ')}${partial ? ' on this page' : ''}`
}

export async function ListingListPage({ searchParams }: PageProps) {
  const params = await searchParams
  const status = typeof params.status === 'string' ? params.status : 'all'
  const q = typeof params.q === 'string' ? params.q : ''
  const after = cursorParam(params.after)
  const before = cursorParam(params.before)
  const { items, stats, pageInfo, error } = await getPlatformListings(status, q, after, before)
  const now = Date.now()

  const tabs = [
    { label: 'All', href: listingPageHref('all', q), active: status === 'all', count: stats?.total ?? null },
    ...statuses.map((entry) => ({
      label: entry.label,
      href: listingPageHref(entry.value, q),
      active: status === entry.value,
      count: entry.stat && stats ? stats[entry.stat] : null,
    })),
  ]

  return (
    <PlatformPage
      crumbs={[{ label: 'Listings' }]}
      title="Listings"
      meta={!error && items.length ? attentionLine(items, Boolean(pageInfo?.hasNextPage || pageInfo?.hasPreviousPage)) : null}
      actions={<Button asChild variant="ghost" size="sm" className={pillPrimaryClass}><Link href="/dashboard/platform/listings/new"><Plus aria-hidden /> New listing</Link></Button>}
      toolbar={<>
        <SearchField action="/dashboard/platform/listings" defaultValue={q} label="Search listings" placeholder="Address, city or title" hidden={{ status: status !== 'all' ? status : undefined }} />
        <FilterTabs label="Listing status" items={tabs} />
      </>}
    >
      <div className="pb-16">
      {error ? (
        <ErrorBanner>Listings could not be loaded. {error}</ErrorBanner>
      ) : items.length ? (
        <DataTable
          label="Listings"
          head={[
            { label: 'Listing' },
            { label: 'Status', className: 'hidden md:table-cell' },
            { label: 'Price', className: 'hidden text-right md:table-cell' },
            { label: 'Leads', className: 'hidden text-right lg:table-cell' },
            { label: 'Showings', className: 'hidden text-right lg:table-cell' },
            { label: 'Agent', className: 'hidden md:table-cell' },
            { label: 'Updated', className: 'hidden xl:table-cell' },
            { label: <span className="sr-only">Actions</span>, className: 'text-right' },
          ]}
        >
          {items.map((item) => <ListingRow key={item.id} item={item} now={now} />)}
        </DataTable>
      ) : (
        <EmptyState title={q ? 'No listings match this search' : 'No listings'}>
          {!q ? <Button asChild variant="ghost" size="sm" className={pillPrimaryClass}><Link href="/dashboard/platform/listings/new">New listing</Link></Button> : null}
        </EmptyState>
      )}
      {!error && pageInfo ? (
        <Pager
          label="Listing pages"
          previous={pageInfo.hasPreviousPage && pageInfo.previousCursor ? listingPageHref(status, q, { before: pageInfo.previousCursor }) : null}
          next={pageInfo.hasNextPage && pageInfo.nextCursor ? listingPageHref(status, q, { after: pageInfo.nextCursor }) : null}
        />
      ) : null}
      </div>
    </PlatformPage>
  )
}
