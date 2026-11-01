import type { Metadata } from 'next'
import Link from 'next/link'
import { ListingSearchForm } from '@/features/storefront/components/ListingSearchForm'
import { listingPins } from '@/features/storefront/lib/map-pins'
import { SearchSplit } from '@/features/storefront/components/SearchSplit'
import { StorefrontFooter } from '@/features/storefront/components/StorefrontFooter'
import { StorefrontNav } from '@/features/storefront/components/StorefrontNav'
import { groupStorefrontNeighborhoods } from '@/features/storefront/lib/data/neighborhoods'
import { getCustomer } from '@/features/storefront/lib/data/account'
import { getStorefrontListingPageHref, getStorefrontListings, hasListingFilters, normalizeListingParams, type ListingSearchParams, type StorefrontProperty } from '@/features/storefront/lib/data/properties'
import { getSavedPropertyIds } from '@/features/storefront/lib/data/saved'
import { getBrokerageSettings } from '@/features/storefront/lib/data/settings'
import { emailHref, formatPrice, formatPriceShort, initials, phoneHref, resultCountLabel, resultsHeading } from '@/features/storefront/lib/format'
import { ListingCard } from './ListingCard'

const RASTER = /\.(?:jpe?g|png|webp)$/i
const HOME_ROWS = 8

export async function generateHomeMetadata(): Promise<Metadata> {
  const [settingsState, listings] = await Promise.all([getBrokerageSettings(), getStorefrontListings()])
  if (settingsState.status !== 'ready') return {}
  const { settings } = settingsState
  const featured = listings.listings.find(listing => listing.isFeatured && RASTER.test(listing.imagePath)) || listings.listings.find(listing => RASTER.test(listing.imagePath))
  const images = featured ? [{ url: featured.imagePath, alt: settings.businessName }] : undefined
  const description = settings.description || settings.tagline
  // Relative URLs resolve against the storefront layout's metadataBase.
  return {
    alternates: { canonical: '/' },
    openGraph: { type: 'website', url: '/', title: settings.businessName, description, siteName: settings.businessName, ...(images ? { images } : {}) },
    twitter: { card: images ? 'summary_large_image' : 'summary', title: settings.businessName, description, ...(images ? { images } : {}) },
  }
}

type Agent = NonNullable<StorefrontProperty['assignedAgent']> & { listings: number }

/** The brokerage's agents with a live listing, busiest first. */
function listingAgents(listings: StorefrontProperty[]): Agent[] {
  const agents = new Map<string, Agent>()
  for (const listing of listings) {
    const agent = listing.assignedAgent
    if (!agent?.name) continue
    const key = agent.email || agent.name
    const known = agents.get(key)
    agents.set(key, known ? { ...known, listings: known.listings + 1 } : { ...agent, listings: 1 })
  }
  return [...agents.values()].sort((a, b) => b.listings - a.listings)
}

export default async function HomePage({ searchParams }: { searchParams?: Promise<ListingSearchParams> }) {
  const params = normalizeListingParams((await searchParams) || {})
  const settingsState = await getBrokerageSettings()
  if (settingsState.status !== 'ready') return null
  const settings = settingsState.settings
  const filtered = hasListingFilters(params)
  const [listingsResult, allListingsResult, customer] = await Promise.all([
    getStorefrontListings(params),
    filtered ? getStorefrontListings() : null,
    getCustomer(),
  ])
  const save = { signedIn: Boolean(customer), savedIds: customer ? await getSavedPropertyIds() : {} }
  const { listings, error, hasMore, skip, overflow } = listingsResult
  const inventory = (allListingsResult || listingsResult).listings
  // Featured homes lead the list, then the rest in the brokerage's own order.
  const rows = [...listings].sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured)).slice(0, HOME_ROWS)
  const countLabel = resultCountLabel(listingsResult)
  const moreHref = getStorefrontListingPageHref(params, 0)
  const neighborhoods = groupStorefrontNeighborhoods(inventory, settings.city).slice(0, 6)
  const agents = listingAgents(inventory)
  const sections = { neighborhoods: neighborhoods.length > 0, advisors: agents.length > 0 }
  const pins = listingPins(rows, listing => formatPriceShort(listing))
  const area = settings.city ? ` in ${settings.city}` : ''

  return (
    <>
      <StorefrontNav settings={settings} sections={sections} search={<ListingSearchForm key={JSON.stringify(params)} params={params} marketCity={settings.city} action="/listings" countLabel={countLabel} />} />
      <main className="sf-home">
        <SearchSplit pins={pins}>
          <h1 className="sr-only">{resultsHeading(params.type, settings.city)}</h1>
          <section id="homes" aria-label="Homes">
            {error ? (
              <div className="sf-state" role="alert">
                <h2>{overflow ? 'Search too broad' : 'Homes could not be loaded'}</h2>
                <p>{overflow ? 'Add a filter or go back a page.' : 'Try again later.'}</p>
              </div>
            ) : rows.length ? (
              <div className="sf-rows">
                {rows.map((listing, index) => <ListingCard key={listing.id} listing={listing} priority={index < 2} save={save} layout="row" />)}
              </div>
            ) : (
              <div className="sf-state">
                <h2>{skip > 0 ? 'No more homes' : filtered ? 'No homes match this search' : 'No homes listed yet'}</h2>
                {filtered ? <Link href="/listings" className="sf-btn sf-btn--primary">Clear search</Link> : null}
              </div>
            )}

            {listings.length > HOME_ROWS || hasMore || (filtered && listings.length > 0) ? (
              <Link href={moreHref} className="sf-btn sf-btn--outline sf-more">See all {countLabel}</Link>
            ) : null}
          </section>

          {agents.length ? (
            <section id="agents" className="sf-agents" aria-labelledby="agents-title">
              <h2 id="agents-title" className="sf-agents__title">Top Agents{area}</h2>
              <ul className="sf-agents__list">
                {agents.slice(0, 4).map(agent => {
                  const contact = emailHref(agent.email) || phoneHref(agent.phone)
                  return (
                    <li key={agent.email || agent.name} className="sf-agent">
                      {agent.imagePath ? <img src={agent.imagePath} alt="" decoding="async" loading="lazy" /> : <span className="sf-agent__initials" aria-hidden>{initials(agent.name)}</span>}
                      <div className="sf-agent__who">
                        <h3>{agent.name}</h3>
                        <p>{agent.brokerageTitle || 'Agent'}</p>
                        <p className="sf-agent__meta sf-num">{agent.listings} {agent.listings === 1 ? 'listing' : 'listings'}</p>
                      </div>
                      {contact ? <a href={contact} className="sf-btn sf-btn--primary sf-btn--sm" aria-label={`Contact ${agent.name}`}>Contact</a> : null}
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}

          {neighborhoods.length ? (
            <section id="neighborhoods" className="sf-areas" aria-labelledby="areas-title">
              <h2 id="areas-title" className="sf-agents__title">{settings.city ? `Neighborhoods in ${settings.city}` : 'Neighborhoods'}</h2>
              <ul className="sf-areas__list">
                {neighborhoods.map(neighborhood => {
                  const prices = neighborhood.listings.filter(listing => Number(listing.price) > 0).sort((a, b) => Number(a.price) - Number(b.price))
                  return (
                    <li key={neighborhood.id}>
                      <Link href={`/listings?q=${encodeURIComponent(neighborhood.name)}`} className="sf-area">
                        {neighborhood.imagePath ? <img src={neighborhood.imagePath} alt="" decoding="async" loading="lazy" /> : <span className="sf-area__blank" aria-hidden />}
                        <span className="sf-area__text">
                          <strong>{neighborhood.name}</strong>
                          <span className="sf-num">{neighborhood.listings.length} {neighborhood.listings.length === 1 ? 'home' : 'homes'}{prices[0] ? ` · from ${formatPrice(prices[0])}` : ''}</span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}
        </SearchSplit>
      </main>
      <StorefrontFooter settings={settings} sections={sections} />
    </>
  )
}
