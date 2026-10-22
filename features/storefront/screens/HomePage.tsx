import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { ListingSearchForm } from '@/features/storefront/components/ListingSearchForm'
import { StorefrontFooter } from '@/features/storefront/components/StorefrontFooter'
import { StorefrontNav } from '@/features/storefront/components/StorefrontNav'
import { groupStorefrontNeighborhoods } from '@/features/storefront/lib/data/neighborhoods'
import { getStorefrontListingPageHref, getStorefrontListings, hasListingFilters, type ListingSearchParams } from '@/features/storefront/lib/data/properties'
import { STOREFRONT_LISTING_PAGE_SIZE } from '@/features/storefront/lib/data/listingPagination'
import { getBrokerageSettings } from '@/features/storefront/lib/data/settings'
import { contactHref, emailHref, formatLocation, formatPrice, initials, listingMarketLabel, phoneHref } from '@/features/storefront/lib/format'
import { ListingCard } from './ListingCard'

const typeLabels: Record<string, string> = { house: 'Houses', condo: 'Condos', townhome: 'Townhomes', multi_family: 'Multi-family', land: 'Land', commercial: 'Commercial' }

function activeFilters(params: ListingSearchParams) {
  const chips: string[] = []
  if (params.type === 'sale') chips.push('For sale')
  if (params.type === 'rent') chips.push('For rent')
  if (params.q?.trim()) chips.push(`“${params.q.trim()}”`)
  if (params.propertyType && params.propertyType !== 'any') chips.push(typeLabels[params.propertyType] || params.propertyType)
  if (Number(params.beds) > 0) chips.push(`${params.beds}+ beds`)
  if (params.minPrice?.trim()) chips.push(`From $${params.minPrice.trim()}`)
  if (params.maxPrice?.trim()) chips.push(`Up to $${params.maxPrice.trim()}`)
  return chips
}

export default async function HomePage({ searchParams }: { searchParams?: Promise<ListingSearchParams> }) {
  const params = (await searchParams) || {}
  const settingsState = await getBrokerageSettings()
  if (settingsState.status !== 'ready') return null
  const settings = settingsState.settings
  const filtered = hasListingFilters(params)
  const [listingsResult, allListingsResult] = await Promise.all([
    getStorefrontListings(params),
    filtered ? getStorefrontListings() : null,
  ])
  const { listings, count, error, hasMore, skip, overflow } = listingsResult
  const inventory = (allListingsResult || listingsResult).listings
  const featured = inventory.find(listing => listing.isFeatured && listing.imagePath) || inventory.find(listing => listing.imagePath) || inventory[0]
  const contact = contactHref(settings)
  const phone = phoneHref(settings.publicPhone)
  const marketLocation = [settings.city, settings.state].filter(Boolean).join(', ')
  const resultSummary = error || count === 0
    ? ''
    : hasMore
      ? `${skip + 1}–${skip + count} of ${skip + count + 1}+ homes`
      : `${skip + 1}–${skip + count} of ${skip + count} ${skip + count === 1 ? 'home' : 'homes'}`
  const chips = activeFilters(params)
  const neighborhoods = groupStorefrontNeighborhoods(inventory, settings.city).slice(0, 5)
  const agents = [...new Map(inventory.filter(item => item.assignedAgent?.name).map(item => [item.assignedAgent!.email || item.assignedAgent!.name, item.assignedAgent!])).values()]
  const sections = { neighborhoods: neighborhoods.length > 0, advisors: agents.length > 0 }

  return (
    <>
      <StorefrontNav settings={settings} sections={sections} />
      <main>
        <section className="sf-hero">
          <div className="sf-container sf-hero__grid">
            <div className="sf-hero__copy">
              {marketLocation || settings.marketLabel ? <p className="sf-eyebrow">{[settings.marketLabel, marketLocation].filter(Boolean).join(' · ')}</p> : null}
              <h1 className="sf-hero__title">{settings.tagline || settings.businessName}</h1>
              <ListingSearchForm params={params} count={count} hasMore={hasMore} marketCity={settings.city} action="/#homes" />
            </div>
            {featured?.imagePath ? (
              <Link href={`/listings/${featured.slug}`} className="sf-hero__feature" aria-label={`${featured.title}, ${formatPrice(featured)}`}>
                <img src={featured.imagePath} alt="" fetchPriority="high" />
                <span className="sf-hero__feature-tag">{listingMarketLabel(featured)}</span>
                <span className="sf-hero__feature-card">
                  <span>
                    <strong>{featured.title}</strong>
                    <span>{formatLocation(featured)}</span>
                  </span>
                  <span className="sf-hero__feature-price">{formatPrice(featured)}</span>
                </span>
              </Link>
            ) : null}
          </div>
        </section>

        <section id="homes" className="sf-container sf-section" style={{ paddingTop: 0, scrollMarginTop: '5rem' }}>
          <div className="sf-section-head">
            <div>
              <p className="sf-eyebrow">{filtered ? 'Search results' : 'Listings'}</p>
              <h2>{filtered ? 'Matching homes' : 'Available homes'}</h2>
            </div>
            {resultSummary ? <p className="sf-num">{resultSummary}</p> : null}
          </div>

          {chips.length ? (
            <div className="sf-results-head">
              <div className="sf-chips" aria-label="Active filters">{chips.map(chip => <span key={chip} className="sf-chip">{chip}</span>)}</div>
              <Link href="/#homes" className="sf-link">Clear search</Link>
            </div>
          ) : null}

          {error ? (
            <div className="sf-state" role="alert">
              <h3>{overflow ? 'Search too broad' : 'Homes could not be loaded'}</h3>
              <p>{overflow ? 'Add a filter or go back a page.' : 'Try again later.'}</p>
            </div>
          ) : listings.length ? (
            <div className="sf-listing-grid">
              {listings.map((listing, index) => <ListingCard key={listing.id} listing={listing} priority={index < 3} />)}
            </div>
          ) : (
            <div className="sf-state">
              <h3>{skip > 0 ? 'No more homes' : filtered ? 'No homes match this search' : 'No homes listed'}</h3>
              {filtered ? <Link href="/#homes" className="sf-btn sf-btn--primary">Clear search</Link> : null}
            </div>
          )}

          {skip > 0 || hasMore ? (
            <nav className="sf-pagination" aria-label="Listing result pages">
              {skip > 0 ? <Link href={getStorefrontListingPageHref(params, Math.max(0, skip - STOREFRONT_LISTING_PAGE_SIZE))} className="sf-btn sf-btn--quiet">Previous</Link> : <span />}
              {hasMore ? <Link href={getStorefrontListingPageHref(params, skip + STOREFRONT_LISTING_PAGE_SIZE)} className="sf-btn sf-btn--primary">Next <ArrowRight aria-hidden /></Link> : <span />}
            </nav>
          ) : null}
        </section>

        {neighborhoods.length ? (
          <section id="neighborhoods" className="sf-container sf-section" style={{ paddingTop: 0, scrollMarginTop: '5rem' }}>
            <div className="sf-section-head">
              <div>
                {settings.city ? <p className="sf-eyebrow">{settings.city}</p> : null}
                <h2>Neighborhoods</h2>
              </div>
            </div>
            <div className="sf-places">
              {neighborhoods.map((neighborhood, index) => (
                <Link key={neighborhood.id} href={`/?q=${encodeURIComponent(neighborhood.name)}#homes`} className={index === 0 && neighborhoods.length > 2 ? 'sf-place sf-place--wide' : 'sf-place'}>
                  {neighborhood.imagePath ? <img src={neighborhood.imagePath} alt="" decoding="async" loading="lazy" /> : null}
                  <span className="sf-place__copy">
                    <span>
                      <strong>{neighborhood.name}</strong>
                      <span>{neighborhood.listings.length} {neighborhood.listings.length === 1 ? 'home' : 'homes'}{neighborhood.city && neighborhood.city !== neighborhood.name ? ` · ${neighborhood.city}` : ''}</span>
                    </span>
                    <ArrowUpRight aria-hidden />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {agents.length ? (
          <section id="advisors" className="sf-advisors sf-section" style={{ scrollMarginTop: '4rem' }}>
            <div className="sf-container">
              <div className="sf-section-head">
                <div>
                  <p className="sf-eyebrow">{settings.businessName}</p>
                  <h2>Advisors</h2>
                </div>
                {contact ? <a href={contact} className="sf-link">Contact the office <ArrowUpRight aria-hidden /></a> : null}
              </div>
              <div className="sf-advisor-grid">
                {agents.map(agent => {
                  const agentEmail = emailHref(agent.email)
                  return (
                    <article key={agent.email || agent.name} className="sf-advisor">
                      {agent.imagePath ? <img src={agent.imagePath} alt="" decoding="async" loading="lazy" /> : <span className="sf-advisor__initials" aria-hidden>{initials(agent.name)}</span>}
                      <div>
                        <h3>{agent.name}</h3>
                        <p>{agent.brokerageTitle || 'Advisor'}</p>
                        {agentEmail ? <a href={agentEmail}>{agent.email}</a> : null}
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          </section>
        ) : null}

        {contact ? (
          <section className="sf-container sf-section" style={{ paddingBottom: 0 }}>
            <div className="sf-closing">
              <div>
                <p className="sf-eyebrow">{settings.businessName}</p>
                <h2 style={{ marginTop: '0.5rem' }}>Contact</h2>
              </div>
              <div className="sf-closing__actions">
                <a href={contact} className="sf-btn sf-btn--primary">Contact an advisor</a>
                {phone && phone !== contact ? <a href={phone} className="sf-btn sf-btn--quiet">{settings.publicPhone}</a> : null}
              </div>
            </div>
          </section>
        ) : null}
      </main>
      <StorefrontFooter settings={settings} sections={sections} />
    </>
  )
}
