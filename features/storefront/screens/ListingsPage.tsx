import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { X } from 'lucide-react'
import { ListingSearchForm } from '@/features/storefront/components/ListingSearchForm'
import { SaveSearchButton } from '@/features/storefront/components/SaveSearchButton'
import { SortSelect } from '@/features/storefront/components/SortSelect'
import { StorefrontFooter } from '@/features/storefront/components/StorefrontFooter'
import { StorefrontNav } from '@/features/storefront/components/StorefrontNav'
import { getCustomer } from '@/features/storefront/lib/data/account'
import { getStorefrontListingPageHref, getStorefrontListings, hasListingFilters, normalizeListingParams, type ListingSearchParams } from '@/features/storefront/lib/data/properties'
import { getSavedPropertyIds } from '@/features/storefront/lib/data/saved'
import { STOREFRONT_LISTING_PAGE_SIZE } from '@/features/storefront/lib/data/listingPagination'
import { getBrokerageSettings } from '@/features/storefront/lib/data/settings'
import { resultCountLabel, resultsHeading } from '@/features/storefront/lib/format'
import { ListingCard } from './ListingCard'

const typeLabels: Record<string, string> = { house: 'Houses', condo: 'Condos', townhome: 'Townhomes', multi_family: 'Multi-family', land: 'Land', commercial: 'Commercial' }

type Props = { searchParams?: Promise<ListingSearchParams> }

/** Each active filter with the search it leaves behind when removed. */
function activeFilters(params: ListingSearchParams): Array<[string, string]> {
  const without = (...keys: Array<keyof ListingSearchParams>) => {
    const next = { ...params }
    for (const key of keys) delete next[key]
    return getStorefrontListingPageHref(next, 0)
  }
  const money = (value: string) => `$${Number(value).toLocaleString('en-US')}`
  return [
    ...(params.q ? [[`“${params.q}”`, without('q')] as [string, string]] : []),
    ...(params.city ? [[params.city, without('city')] as [string, string]] : []),
    ...(params.propertyType ? [[typeLabels[params.propertyType] || params.propertyType, without('propertyType')] as [string, string]] : []),
    ...(params.beds ? [[`${params.beds}+ beds`, without('beds')] as [string, string]] : []),
    ...(params.baths ? [[`${params.baths}+ baths`, without('baths')] as [string, string]] : []),
    ...(params.minPrice ? [[`From ${money(params.minPrice)}`, without('minPrice')] as [string, string]] : []),
    ...(params.maxPrice ? [[`Up to ${money(params.maxPrice)}`, without('maxPrice')] as [string, string]] : []),
  ]
}

export async function generateListingsMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = normalizeListingParams((await searchParams) || {})
  const state = await getBrokerageSettings()
  const heading = resultsHeading(params.type, state.status === 'ready' ? state.settings.city : '')
  return { title: heading, alternates: { canonical: '/listings' } }
}

export default async function ListingsPage({ searchParams }: Props) {
  const params = normalizeListingParams((await searchParams) || {})
  const settingsState = await getBrokerageSettings()
  if (settingsState.status !== 'ready') return null
  const settings = settingsState.settings
  const filtered = hasListingFilters(params)
  const [result, customer] = await Promise.all([getStorefrontListings(params), getCustomer()])
  const save = { signedIn: Boolean(customer), savedIds: customer ? await getSavedPropertyIds() : {} }
  const { listings, count, error, hasMore, skip, overflow } = result
  const countLabel = resultCountLabel(result)
  const filters = activeFilters(params)
  const range = count ? (skip > 0 || hasMore ? `${skip + 1}–${skip + count}` : '') : ''

  return (
    <>
      <StorefrontNav settings={settings} />
      <ListingSearchForm key={JSON.stringify(params)} params={params} marketCity={settings.city} action="/listings" countLabel={countLabel} />
      <main className="sf-container sf-results">
        <header className="sf-results-head sf-results-head--bar">
          <div>
            <h1>{resultsHeading(params.type, settings.city)}</h1>
            {countLabel ? <p className="sf-num">{range ? `Showing ${range} of ${countLabel}` : countLabel}</p> : null}
          </div>
          {listings.length > 1 || params.sort ? <SortSelect params={params} /> : null}
        </header>

        {filters.length ? (
          <div className="sf-filters" aria-label="Active filters">
            <ul>
              {filters.map(([label, href]) => (
                <li key={label}><Link href={href} className="sf-tag" aria-label={`Remove filter ${label}`}>{label}<X aria-hidden /></Link></li>
              ))}
            </ul>
            <span className="sf-filters__actions">
              <Link href={params.type ? `/listings?type=${params.type}` : '/listings'} className="sf-link">Clear filters</Link>
              {customer ? <SaveSearchButton params={params} /> : null}
            </span>
          </div>
        ) : null}

        {error ? (
          <div className="sf-state" role="alert">
            <h2>{overflow ? 'Search too broad' : 'Homes could not be loaded'}</h2>
            <p>{overflow ? 'Add a filter or go back a page.' : 'Try again later.'}</p>
          </div>
        ) : listings.length ? (
          <div className="sf-modules" style={{ '--sf-count': listings.length } as CSSProperties}>
            {listings.map((listing, index) => <ListingCard key={listing.id} listing={listing} priority={index < 4} save={save} />)}
          </div>
        ) : (
          <div className="sf-state">
            <h2>{skip > 0 ? 'No more homes' : filtered ? 'No homes match this search' : 'No homes listed yet'}</h2>
            {filtered ? <p>Remove a filter above or start over.</p> : null}
            {filtered ? <Link href="/listings" className="sf-btn sf-btn--primary">Clear search</Link> : null}
          </div>
        )}

        {skip > 0 || hasMore ? (
          <nav className="sf-pagination" aria-label="Result pages">
            {skip > 0 ? <Link href={getStorefrontListingPageHref(params, Math.max(0, skip - STOREFRONT_LISTING_PAGE_SIZE))} className="sf-btn sf-btn--quiet">Previous page</Link> : <span />}
            {hasMore ? <Link href={getStorefrontListingPageHref(params, skip + STOREFRONT_LISTING_PAGE_SIZE)} className="sf-btn sf-btn--primary">Next page</Link> : <span />}
          </nav>
        ) : null}
      </main>
      <StorefrontFooter settings={settings} />
    </>
  )
}
