import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail, Phone } from 'lucide-react'
import { ListingSearchForm } from '@/features/storefront/components/ListingSearchForm'
import { StorefrontFooter } from '@/features/storefront/components/StorefrontFooter'
import { StorefrontNav } from '@/features/storefront/components/StorefrontNav'
import { groupStorefrontNeighborhoods, type StorefrontNeighborhood } from '@/features/storefront/lib/data/neighborhoods'
import { getCustomer } from '@/features/storefront/lib/data/account'
import { getStorefrontListingPageHref, getStorefrontListings, hasListingFilters, normalizeListingParams, type ListingSearchParams, type StorefrontProperty } from '@/features/storefront/lib/data/properties'
import { getSavedPropertyIds } from '@/features/storefront/lib/data/saved'
import { getBrokerageSettings } from '@/features/storefront/lib/data/settings'
import { emailHref, formatPrice, formatPricePerSqFt, initials, listingPlace, listingStatusPlate, listingTone, phoneHref, resultCountLabel, resultsHeading } from '@/features/storefront/lib/format'
import { ListingCard, listingFacts } from './ListingCard'

const RASTER = /\.(?:jpe?g|png|webp)$/i
const HOME_ROWS = 4

const minorOf = (listing: StorefrontProperty) => Number(listing.price || 0)

/** Price span of one kind of listing in an area, e.g. "$1,250,000 to $2,400,000" or "$3,200/mo". */
function priceSpan(listings: StorefrontProperty[]) {
  const priced = listings.filter(listing => minorOf(listing) > 0).sort((a, b) => minorOf(a) - minorOf(b))
  if (!priced.length) return null
  const low = formatPrice(priced[0])
  const high = formatPrice(priced[priced.length - 1])
  return low === high ? low : `${low} to ${high}`
}

/**
 * No photo of the area or of any home in it: a stamped plate with the area's real facts
 * (where it is, what is listed, the price span) instead of an empty roof-metal window.
 */
function PlacePlate({ neighborhood }: { neighborhood: StorefrontNeighborhood }) {
  const sale = neighborhood.listings.filter(listing => listing.listingType !== 'rent')
  const rent = neighborhood.listings.filter(listing => listing.listingType === 'rent')
  const facts = [
    sale.length ? { label: `${sale.length} for sale`, value: priceSpan(sale) } : null,
    rent.length ? { label: `${rent.length} for rent`, value: priceSpan(rent) } : null,
  ].filter((fact): fact is { label: string; value: string | null } => Boolean(fact))
  const where = [neighborhood.city !== neighborhood.name ? neighborhood.city : '', neighborhood.listings[0]?.state].filter(Boolean).join(', ')
  return (
    <span className="sf-place-plate">
      <span className="sf-place-plate__name">{neighborhood.name}</span>
      {where ? <span className="sf-place-plate__where">{where}</span> : null}
      <span className="sf-place-plate__facts">
        {facts.map(fact => (
          <span key={fact.label}><b className="sf-num">{fact.label}</b>{fact.value ? <span className="sf-num">{fact.value}</span> : null}</span>
        ))}
      </span>
    </span>
  )
}

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
  const firstRows = listings.slice(0, HOME_ROWS)
  // The featured panel never repeats a row beside it. It shows a photographed home outside the rows;
  // with a short inventory (every home already in the rows) it takes the first photographed home out
  // of the rows instead, so the first viewport keeps its anchor without showing one home twice.
  const firstIds = new Set(firstRows.map(listing => listing.id))
  const outside = inventory.filter(listing => listing.imagePath && !firstIds.has(listing.id))
  const inside = firstRows.length > 1 ? firstRows.filter(listing => listing.imagePath) : []
  const featured = outside.find(listing => listing.isFeatured) || outside[0] || inside.find(listing => listing.isFeatured) || inside[0]
  const shown = featured && firstIds.has(featured.id) ? firstRows.filter(listing => listing.id !== featured.id) : firstRows
  const countLabel = resultCountLabel(listingsResult)
  const moreHref = getStorefrontListingPageHref(params, 0)
  const contactEmail = emailHref(settings.publicEmail)
  const contactPhone = phoneHref(settings.publicPhone)
  const neighborhoods = groupStorefrontNeighborhoods(inventory, settings.city).slice(0, 6)
  const agents = [...new Map(inventory.filter(item => item.assignedAgent?.name).map(item => [item.assignedAgent!.email || item.assignedAgent!.name, item.assignedAgent!])).values()]
  const sections = { neighborhoods: neighborhoods.length > 0, advisors: agents.length > 0 }

  return (
    <>
      <StorefrontNav settings={settings} sections={sections} />
      <ListingSearchForm key={JSON.stringify(params)} params={params} marketCity={settings.city} action="/listings" countLabel={countLabel} />
      <main>
        <section id="homes" className="sf-container sf-lead" data-featured={featured ? true : undefined}>
          <div className="sf-lead__results">
            <header className="sf-results-head">
              <h1>{resultsHeading(params.type, settings.city)}</h1>
              {settings.tagline ? <p>{settings.tagline}</p> : null}
            </header>

            {error ? (
              <div className="sf-state" role="alert">
                <h2>{overflow ? 'Search too broad' : 'Homes could not be loaded'}</h2>
                <p>{overflow ? 'Add a filter or go back a page.' : 'Try again later.'}</p>
              </div>
            ) : shown.length ? (
              <div className="sf-rows">
                {shown.map((listing, index) => <ListingCard key={listing.id} listing={listing} priority={index < 2} save={save} layout="row" />)}
              </div>
            ) : (
              <div className="sf-state">
                <h2>{skip > 0 ? 'No more homes' : filtered ? 'No homes match this search' : 'No homes listed yet'}</h2>
                {filtered ? <Link href="/listings" className="sf-btn sf-btn--primary">Clear search</Link> : null}
              </div>
            )}

            {listings.length > HOME_ROWS || hasMore || (filtered && listings.length > 0) ? (
              <Link href={moreHref} className="sf-btn sf-btn--quiet sf-lead__more">See all {countLabel}</Link>
            ) : null}
          </div>

          {featured ? (
            <aside className="sf-lead__feature" aria-label="Featured home">
              <Link href={`/listings/${featured.slug}`} className="sf-feature">
                <span className="sf-feature__photo">
                  <img src={featured.imagePath} alt={featured.title} fetchPriority="high" loading="eager" />
                  <span className="sf-plate" data-tone={listingTone(featured.status)}>{listingStatusPlate(featured)}</span>
                </span>
                <span className="sf-feature__plaque">
                  <strong>{featured.title}</strong>
                  <span className="sf-feature__figures">
                    <span className="sf-num">{formatPrice(featured)}</span>
                    {formatPricePerSqFt(featured) ? <small className="sf-num">{formatPricePerSqFt(featured)}/sq ft</small> : null}
                  </span>
                  {listingFacts(featured).length ? (
                    <span className="sf-card__facts sf-feature__facts">
                      {listingFacts(featured).map(([value, unit]) => <span key={unit}><b className="sf-num">{value}</b> {unit}</span>)}
                    </span>
                  ) : null}
                  {listingPlace(featured) ? <span className="sf-feature__place">{listingPlace(featured)}</span> : null}
                </span>
              </Link>
            </aside>
          ) : null}
        </section>

        {neighborhoods.length ? (
          <section id="neighborhoods" className="sf-container sf-section" aria-labelledby="neighborhoods-title">
            <h2 id="neighborhoods-title" className="sf-section-title">{settings.city ? `Neighborhoods in ${settings.city}` : 'Neighborhoods'}</h2>
            <ul className="sf-places">
              {neighborhoods.map(neighborhood => (
                <li key={neighborhood.id}>
                  <Link href={`/listings?q=${encodeURIComponent(neighborhood.name)}`} className="sf-place">
                    <span className="sf-place__photo" data-plate={neighborhood.imagePath ? undefined : true}>
                      {neighborhood.imagePath
                        ? <img src={neighborhood.imagePath} alt="" decoding="async" loading="eager" fetchPriority="low" />
                        : <PlacePlate neighborhood={neighborhood} />}
                    </span>
                    <span className="sf-place__plaque">
                      <strong>{neighborhood.name}</strong>
                      <span className="sf-num">{neighborhood.listings.length} {neighborhood.listings.length === 1 ? 'home' : 'homes'}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {agents.length ? (
          <section id="advisors" className="sf-container sf-section" aria-labelledby="advisors-title">
            <h2 id="advisors-title" className="sf-section-title">Advisors at {settings.businessName}</h2>
            <ul className="sf-advisor-grid">
              {agents.map(agent => {
                const agentEmail = emailHref(agent.email)
                const agentPhone = phoneHref(agent.phone)
                return (
                  <li key={agent.email || agent.name} className="sf-advisor">
                    {agent.imagePath ? <img src={agent.imagePath} alt="" decoding="async" loading="eager" fetchPriority="low" /> : <span className="sf-advisor__initials" aria-hidden>{initials(agent.name)}</span>}
                    <div>
                      <h3>{agent.name}</h3>
                      <p>{agent.brokerageTitle || 'Advisor'}</p>
                      <span className="sf-advisor__links">
                        {agentEmail ? <a href={agentEmail} title={agent.email}><Mail aria-hidden /><span>{agent.email}</span></a> : null}
                        {agentPhone ? <a href={agentPhone}><Phone aria-hidden /><span className="sf-num">{agent.phone}</span></a> : null}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}

        {contactEmail || contactPhone ? (
          <section className="sf-container sf-office" aria-label="Contact the office">
            <p>Questions about a home{settings.city ? ` in ${settings.city}` : ''}? The office answers.</p>
            <span className="sf-office__links">
              {contactPhone ? <a href={contactPhone} className="sf-btn sf-btn--quiet"><Phone aria-hidden /><span className="sf-num">{settings.publicPhone}</span></a> : null}
              {contactEmail ? <a href={contactEmail} className="sf-btn sf-btn--quiet"><Mail aria-hidden /><span>{settings.publicEmail}</span></a> : null}
            </span>
          </section>
        ) : null}
      </main>
      <StorefrontFooter settings={settings} sections={sections} />
    </>
  )
}
