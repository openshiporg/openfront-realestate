import Link from 'next/link'
import { PageBreadcrumbs } from '@/features/dashboard/components/PageBreadcrumbs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatMoney as money } from '@/features/lib/money'
import { getPlatformListings, type PlatformListing, type PlatformListingStats } from '../actions/listings'
import { ListingStatusButton } from '../components/ListingStatusButton'
import { FilterTabs } from '../components/FilterTabs'

type BadgeColor = 'zinc' | 'sky' | 'emerald' | 'amber' | 'indigo' | 'violet' | 'rose'

const statuses: Array<{ value: string; label: string; color: BadgeColor; stat?: keyof PlatformListingStats }> = [
  { value: 'draft', label: 'Draft', color: 'zinc' },
  { value: 'coming_soon', label: 'Coming soon', color: 'sky', stat: 'comingSoon' },
  { value: 'active', label: 'Active', color: 'emerald', stat: 'active' },
  { value: 'pending', label: 'Pending', color: 'amber', stat: 'pending' },
  { value: 'sold', label: 'Sold', color: 'indigo', stat: 'sold' },
  { value: 'rented', label: 'Rented', color: 'violet' },
  { value: 'off_market', label: 'Off market', color: 'rose', stat: 'offMarket' },
]

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
  if (item.propertyType !== 'land' && item.bedrooms > 0) facts.push(`${item.bedrooms} ${item.bedrooms === 1 ? 'bed' : 'beds'}`)
  if (item.propertyType !== 'land' && Number(item.bathrooms) > 0) facts.push(`${Number(item.bathrooms)} ${Number(item.bathrooms) === 1 ? 'bath' : 'baths'}`)
  if (item.squareFeet) facts.push(`${item.squareFeet.toLocaleString()} sq ft`)
  return facts.join(' · ')
}

function ListingActions({ item }: { item: PlatformListing }) {
  const isRental = item.listingType === 'rent'
  const closeStatus = isRental ? 'rented' : 'sold'
  const closeLabel = isRental ? 'Mark rented' : 'Mark sold'
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {['draft', 'off_market'].includes(item.status) ? <ListingStatusButton propertyId={item.id} status="coming_soon" label="Mark coming soon" /> : null}
      {['draft', 'coming_soon', 'off_market'].includes(item.status) ? <ListingStatusButton propertyId={item.id} status="active" label="Publish" /> : null}
      {item.status === 'active' ? <ListingStatusButton propertyId={item.id} status="pending" label="Mark pending" /> : null}
      {item.status === 'pending' ? <ListingStatusButton propertyId={item.id} status="active" label="Back to active" /> : null}
      {['active', 'pending'].includes(item.status) ? <ListingStatusButton propertyId={item.id} status={closeStatus} label={closeLabel} /> : null}
      {['draft', 'active', 'coming_soon', 'pending', 'sold', 'rented'].includes(item.status) ? <ListingStatusButton propertyId={item.id} status="off_market" label="Withdraw" /> : null}
      <Button asChild variant="outline" size="sm">
        <Link href={`/dashboard/properties/${item.id}`}>Edit</Link>
      </Button>
    </div>
  )
}

function ListingCard({ item }: { item: PlatformListing }) {
  const status = statuses.find((entry) => entry.value === item.status)
  const facts = factsLabel(item)
  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="grid md:grid-cols-[13rem_1fr]">
        <div
          className="min-h-44 bg-muted bg-cover bg-center"
          style={item.primaryImageUrl ? { backgroundImage: `url(${item.primaryImageUrl})` } : undefined}
          role="img"
          aria-label={item.primaryImageUrl ? `${item.title} photo` : 'No photo'}
        />
        <div className="p-4">
          <div className="flex items-start gap-3">
            <h2 className="min-w-0 flex-1 text-base font-semibold text-foreground">{item.title}</h2>
            <Badge color={status?.color || 'zinc'} className="shrink-0">{status?.label || item.status}</Badge>
          </div>
          <p className="mt-1 text-base font-semibold text-foreground">{priceLabel(item)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{[item.addressLine1, item.city, [item.state, item.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</p>
          {facts ? <p className="mt-2 text-sm text-muted-foreground">{facts}</p> : null}
          <p className="mt-2 text-sm text-muted-foreground">{item.assignedAgent?.name || 'Unassigned'}</p>
          <ListingActions item={item} />
        </div>
      </div>
    </article>
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
    <section className="overflow-hidden flex flex-col">
      <PageBreadcrumbs
        items={[
          { type: 'link', label: 'Dashboard', href: '/' },
          { type: 'page', label: 'Platform' },
          { type: 'page', label: 'Listings' },
        ]}
      />
      <div className="flex flex-col gap-4 px-4 pt-4 md:px-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Listings</h1>
          <p className="text-muted-foreground">Manage listings for sale and for rent</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/properties/create">Create listing</Link>
        </Button>
      </div>
      <form action="/dashboard/platform/listings" className="flex gap-2 px-4 py-4 md:px-6">
        {status !== 'all' ? <input type="hidden" name="status" value={status} /> : null}
        <Input name="q" defaultValue={q} aria-label="Search listings" placeholder="Search address, city or title" className="sm:max-w-sm" />
        <Button type="submit" variant="outline">Search</Button>
      </form>
      <FilterTabs label="Listing status" items={tabs} />
      <div className="px-4 py-4 md:px-6">
        {error ? (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Listings could not be loaded. {error}</div>
        ) : items.length ? (
          <div className="grid gap-4 xl:grid-cols-2">{items.map((item) => <ListingCard key={item.id} item={item} />)}</div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <h2 className="text-base font-semibold text-foreground">{q ? 'No listings match your search' : 'No listings'}</h2>
          </div>
        )}
        {!error && pageInfo && (pageInfo.hasPreviousPage || pageInfo.hasNextPage) ? (
          <nav aria-label="Listing pages" className="mt-6 flex items-center justify-between gap-3">
            {pageInfo.hasPreviousPage && pageInfo.previousCursor ? (
              <Button asChild variant="outline"><Link href={listingPageHref(status, q, { before: pageInfo.previousCursor })}>Previous</Link></Button>
            ) : <span />}
            {pageInfo.hasNextPage && pageInfo.nextCursor ? (
              <Button asChild variant="outline"><Link href={listingPageHref(status, q, { after: pageInfo.nextCursor })}>Next</Link></Button>
            ) : <span />}
          </nav>
        ) : null}
      </div>
    </section>
  )
}
