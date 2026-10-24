import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatMoney as money } from '@/features/lib/money'
import { EmptyState, ErrorBanner, Pager, PlatformPage, SearchField, TitleLine, pillClass } from '../../components/PlatformUI'
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

function ListingActions({ item }: { item: PlatformListing }) {
  return (
    <ListingStatusTrack id={item.id} title={item.title} status={item.status} listingType={item.listingType}>
      <Button asChild variant="ghost" size="sm" className={pillClass}>
        <Link href={`/dashboard/platform/listings/${item.id}`}>Open</Link>
      </Button>
    </ListingStatusTrack>
  )
}

function ListingRow({ item }: { item: PlatformListing }) {
  const status = statuses.find((entry) => entry.value === item.status)
  const facts = factsLabel(item)
  const address = [item.addressLine1, item.city, [item.state, item.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  return (
    <li className="grid gap-4 p-4 sm:grid-cols-[7.5rem_minmax(0,1fr)] lg:grid-cols-[7.5rem_minmax(0,1fr)_auto] lg:items-start">
      <div
        className="aspect-[4/3] w-full rounded-lg bg-muted bg-cover bg-center sm:w-30"
        style={item.primaryImageUrl ? { backgroundImage: `url(${item.primaryImageUrl})` } : undefined}
        role="img"
        aria-label={item.primaryImageUrl ? `${item.title} photo` : 'No photo'}
      />
      <div className="min-w-0 space-y-1">
        <TitleLine tone={status?.tone || 'zinc'} status={status?.label || item.status} headingClassName="text-base">
          <Link href={`/dashboard/platform/listings/${item.id}`} className="hover:underline">{item.title}</Link>
        </TitleLine>
        <p className="truncate text-sm text-muted-foreground">{address || 'No address'}</p>
        <p className="text-sm text-muted-foreground">
          {[facts, item.listingType === 'rent' ? 'Rental' : 'Sale', item.assignedAgent?.name || 'Unassigned'].filter(Boolean).join(' · ')}
        </p>
        <p className="pt-1 text-lg font-semibold tabular-nums tracking-tight text-foreground lg:hidden">{priceLabel(item)}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-3 sm:col-span-2 lg:col-span-1 lg:items-end">
        <p className="hidden text-lg font-semibold tabular-nums tracking-tight text-foreground lg:block">{priceLabel(item)}</p>
        <ListingActions item={item} />
      </div>
    </li>
  )
}

export async function ListingListPage({ searchParams }: PageProps) {
  const params = await searchParams
  const status = typeof params.status === 'string' ? params.status : 'all'
  const q = typeof params.q === 'string' ? params.q : ''
  const after = cursorParam(params.after)
  const before = cursorParam(params.before)
  const { items, stats, pageInfo, error } = await getPlatformListings(status, q, after, before)

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
      meta={stats ? `${stats.active} active · ${stats.pending} pending · ${stats.total} total` : null}
      actions={<Button asChild className="rounded-full"><Link href="/dashboard/platform/listings/new"><Plus aria-hidden /> New listing</Link></Button>}
      toolbar={<>
        <SearchField action="/dashboard/platform/listings" defaultValue={q} label="Search listings" placeholder="Address, city or title" hidden={{ status: status !== 'all' ? status : undefined }} />
        <FilterTabs label="Listing status" items={tabs} />
      </>}
    >
      {error ? (
        <ErrorBanner>Listings could not be loaded. {error}</ErrorBanner>
      ) : items.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">{items.map((item) => <ListingRow key={item.id} item={item} />)}</ul>
      ) : (
        <EmptyState title={q ? 'No listings match this search' : 'No listings'}>
          {!q ? <Button asChild size="sm" className="rounded-full"><Link href="/dashboard/platform/listings/new">New listing</Link></Button> : null}
        </EmptyState>
      )}
      {!error && pageInfo ? (
        <Pager
          label="Listing pages"
          previous={pageInfo.hasPreviousPage && pageInfo.previousCursor ? listingPageHref(status, q, { before: pageInfo.previousCursor }) : null}
          next={pageInfo.hasNextPage && pageInfo.nextCursor ? listingPageHref(status, q, { after: pageInfo.nextCursor }) : null}
        />
      ) : null}
    </PlatformPage>
  )
}
