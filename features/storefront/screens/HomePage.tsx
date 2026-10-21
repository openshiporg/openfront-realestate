import Link from 'next/link'
import { ArrowRight, BedDouble, Building2, MapPin, MoveUpRight } from 'lucide-react'
import { ListingSearchForm } from '@/features/storefront/components/ListingSearchForm'
import { StorefrontFooter } from '@/features/storefront/components/StorefrontFooter'
import { StorefrontNav } from '@/features/storefront/components/StorefrontNav'
import { groupStorefrontNeighborhoods } from '@/features/storefront/lib/data/neighborhoods'
import { getStorefrontListingPageHref, getStorefrontListings, hasListingFilters, type ListingSearchParams, type StorefrontProperty } from '@/features/storefront/lib/data/properties'
import { STOREFRONT_LISTING_PAGE_SIZE } from '@/features/storefront/lib/data/listingPagination'
import { getBrokerageSettings } from '@/features/storefront/lib/data/settings'
import { contactHref, emailHref, formatLocation, formatPrice } from '@/features/storefront/lib/format'
import { ListingCard } from './ListingCard'

function listingPhotos(listing: StorefrontProperty) {
  const photos = listing.media.filter(item => item.mediaType === 'photo' && item.imagePath).map(item => item.imagePath)
  return [...new Set([listing.imagePath, ...photos].filter(Boolean))]
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
  const featuredListing = inventory.find(listing => listing.isFeatured) || inventory[0]
  const featuredPhotos = featuredListing ? listingPhotos(featuredListing) : []
  const heroPhoto = featuredPhotos[0] || ''
  const showingPhoto = featuredPhotos[1] || featuredPhotos[0] || ''
  const contact = contactHref(settings)
  const marketLocation = [settings.city, settings.state].filter(Boolean).join(', ')
  const resultSummary = error
    ? ''
    : count === 0
      ? ''
      : hasMore
        ? `Showing ${skip + 1}–${skip + count} of ${skip + count + 1}+ homes.`
        : `Showing ${skip + 1}–${skip + count} ${count === 1 && skip === 0 ? 'home' : 'homes'}.`
  const neighborhoods = groupStorefrontNeighborhoods(inventory, settings.city).slice(0, 4)
  const agents = [...new Map(inventory.filter(item => item.assignedAgent?.name).map(item => [item.assignedAgent!.email || item.assignedAgent!.name, item.assignedAgent!])).values()]
  const sections = { neighborhoods: neighborhoods.length > 0, advisors: agents.length > 0 }

  return (
    <>
      <StorefrontNav settings={settings} sections={sections} />
      <main>
        <section className={heroPhoto ? 'sf-hero' : 'sf-hero sf-hero--plain'}>
          {heroPhoto ? (
            <div className="sf-hero__photo" aria-hidden>
              <img src={heroPhoto} alt="" fetchPriority="high" />
            </div>
          ) : null}
          <div className="sf-container sf-hero__content">
            <p className="sf-kicker">{[settings.marketLabel, marketLocation].filter(Boolean).join(' · ')}</p>
            <h1>{settings.tagline}</h1>

            <div className="sf-hero__actions">
              <a href="#homes" className="sf-btn sf-btn--light">Explore homes</a>
              {contact ? <a href={contact} className="sf-text-link sf-text-link--light">Speak with an advisor <ArrowRight aria-hidden /></a> : null}
            </div>
          </div>
          {featuredListing ? (
            <Link href={`/listings/${featuredListing.slug}`} className="sf-hero__listing">
              <span>Featured home</span>
              <strong>{featuredListing.title}</strong>
              <span>{formatLocation(featuredListing)} · {formatPrice(featuredListing)}</span>
              <MoveUpRight aria-hidden />
            </Link>
          ) : null}
        </section>

        <section className="sf-search-band" aria-label="Search homes">
          <div className="sf-container">
            <ListingSearchForm params={params} count={count} hasMore={hasMore} marketCity={settings.city} compact action="/#homes" />
          </div>
        </section>

        <section id="homes" className="sf-container sf-section">
          <div className="sf-section-heading">
            <div>
              <p className="sf-kicker">{settings.businessName}</p>
              <h2>Available homes</h2>
            </div>
            {resultSummary ? <p>{resultSummary}</p> : null}
          </div>

          {error ? (
            <div className="sf-state" role="alert">
              <h3>{overflow ? 'Try a narrower search.' : 'Homes could not be loaded.'}</h3>
              <p>{overflow ? 'Add a filter or go back a page.' : 'Please try again later.'}</p>
            </div>
          ) : listings.length ? (
            <div className="sf-listing-grid">
              {listings.map((listing, index) => <ListingCard key={listing.id} listing={listing} priority={index < 2} />)}
            </div>
          ) : (
            <div className="sf-state"><h3>{skip > 0 ? 'No more homes.' : filtered ? 'No homes match this search.' : 'No homes listed yet.'}</h3>{filtered ? <Link href="/#homes" className="sf-btn sf-btn--dark">Clear search</Link> : null}</div>
          )}
          {skip > 0 || hasMore ? (
            <nav className="sf-pagination" aria-label="Listing result pages">
              {skip > 0 ? <Link href={getStorefrontListingPageHref(params, Math.max(0, skip - STOREFRONT_LISTING_PAGE_SIZE))} className="sf-btn sf-btn--dark">Previous homes</Link> : <span />}
              {hasMore ? <Link href={getStorefrontListingPageHref(params, skip + STOREFRONT_LISTING_PAGE_SIZE)} className="sf-btn sf-btn--dark">Next homes</Link> : <span />}
            </nav>
          ) : null}
        </section>

        {featuredListing ? (
          <section className={showingPhoto ? 'sf-editorial-split' : 'sf-editorial-split sf-editorial-split--solo'}>
            {showingPhoto ? (
              <div className="sf-editorial-split__photo">
                <img src={showingPhoto} alt="" decoding="async" fetchPriority="low" />
              </div>
            ) : null}
            <div className="sf-editorial-split__copy">
              <p className="sf-kicker">{featuredListing.title}</p>
              <h2>Private showings</h2>
              <Link href={`/listings/${featuredListing.slug}#showing`} className="sf-btn sf-btn--light">Request a private tour</Link>
            </div>
          </section>
        ) : null}

        {neighborhoods.length ? (
          <section id="neighborhoods" className="sf-container sf-section">
            <div className="sf-section-heading">
              <div>{settings.city ? <p className="sf-kicker">{settings.city}</p> : null}<h2>Neighborhoods</h2></div>
            </div>

            <div className="sf-neighborhood-grid">
              {neighborhoods.map((neighborhood, index) => (
                <a key={neighborhood.id} href={`/?q=${encodeURIComponent(neighborhood.name)}#homes`} className={`sf-neighborhood-card ${index === 0 && neighborhoods.length > 1 ? 'sf-neighborhood-card--wide' : ''}`}>
                  {neighborhood.imagePath ? <img src={neighborhood.imagePath} alt="" decoding="async" fetchPriority="low" /> : <span className="sf-neighborhood-card__plain" aria-hidden />}
                  <span className="sf-neighborhood-card__overlay">
                    <MapPin aria-hidden />
                    <strong>{neighborhood.name}</strong>
                    <span>{neighborhood.listings.length} {neighborhood.listings.length === 1 ? 'home' : 'homes'}{neighborhood.city && neighborhood.city !== neighborhood.name ? ` · ${neighborhood.city}` : ''}</span>
                  </span>
                </a>
              ))}
            </div>
          </section>
        ) : null}

        {agents.length ? (
          <section id="advisors" className="sf-advisor-band">
            <div className="sf-container sf-advisor-band__grid">
              <div className="sf-advisor-band__intro">
                <p className="sf-kicker">{settings.businessName}</p>
                <h2>Advisors</h2>
                {contact ? <a href={contact} className="sf-text-link">Contact {settings.businessName} <ArrowRight aria-hidden /></a> : null}
              </div>
              <div className="sf-advisor-list">
                {agents.map(agent => {
                  const agentEmail = emailHref(agent.email)
                  return (
                    <article key={agent.email || agent.name} className="sf-advisor">
                      {agent.imagePath ? (
                        <img src={agent.imagePath} alt="" decoding="async" fetchPriority="low" />
                      ) : <span className="sf-advisor__fallback"><Building2 aria-hidden /></span>}
                      <div><h3>{agent.name}</h3><p>{agent.brokerageTitle || 'Advisor'}</p>{agentEmail ? <a href={agentEmail}>{agent.email}</a> : null}</div>
                    </article>
                  )
                })}
              </div>
            </div>
          </section>
        ) : null}

        {contact ? (
          <section className="sf-container sf-closing">
            <div><BedDouble aria-hidden /><p>Contact</p></div>
            <h2>{settings.businessName}</h2>
            <a href={contact} className="sf-btn sf-btn--dark">Talk to an advisor</a>
          </section>
        ) : null}
      </main>
      <StorefrontFooter settings={settings} sections={sections} />
    </>
  )
}
