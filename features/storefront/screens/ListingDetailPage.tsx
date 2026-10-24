import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, Mail, Phone } from 'lucide-react'
import { LocalDateTime } from '@/features/platform/showings/components/LocalDateTime'
import { BrokerageMark } from '@/features/storefront/components/BrokerageMark'
import { SaveHomeButton } from '@/features/storefront/components/SaveHomeButton'
import { StickyShowingBar } from '@/features/storefront/components/StickyShowingBar'
import { StorefrontFooter } from '@/features/storefront/components/StorefrontFooter'
import { StorefrontNav } from '@/features/storefront/components/StorefrontNav'
import { getCustomer } from '@/features/storefront/lib/data/account'
import { getSavedPropertyIds } from '@/features/storefront/lib/data/saved'
import { getStorefrontListingBySlug } from '@/features/storefront/lib/data/properties'
import { getBrokerageSettings } from '@/features/storefront/lib/data/settings'
import { emailHref, formatLocation, formatPrice, initials, listingMarketLabel, listingStatusLabel, listingTone, phoneHref, propertyTypeLabel } from '@/features/storefront/lib/format'
import { formatMoney } from '@/features/lib/money'
import { stateTimeZone, timeZoneLabel } from '@/features/lib/date-time'
import { ListingActionPanel } from './ListingActionPanel'

type ListingDetailProps = { params: Promise<{ slug: string }> }

export async function generateListingMetadata({ params }: ListingDetailProps): Promise<Metadata> {
  const { slug } = await params
  const result = await getStorefrontListingBySlug(slug)
  const listing = result.listing
  if (!listing) return { title: 'Page not found', robots: { index: false, follow: false } }
  const description = listing.shortDescription || `${formatPrice(listing)} · ${formatLocation(listing)}`
  // Relative paths resolve against the storefront layout's metadataBase. Link previews need a raster photo.
  const photo = [listing.imagePath, ...listing.media.filter(item => item.mediaType === 'photo').map(item => item.imagePath)]
    .find(path => path && /\.(?:jpe?g|png|webp)$/i.test(path))
  const images = photo ? [{ url: photo, alt: listing.title }] : undefined
  return {
    title: listing.title,
    description,
    alternates: { canonical: `/listings/${listing.slug}` },
    openGraph: { type: 'website', title: listing.title, description, url: `/listings/${listing.slug}`, ...(images ? { images } : {}) },
    twitter: { card: images ? 'summary_large_image' : 'summary', title: listing.title, description, ...(images ? { images } : {}) },
  }
}

function positiveMoney(value?: string | null) {
  try {
    return value && Number(value) > 0 ? formatMoney(value) : ''
  } catch {
    return ''
  }
}

/** Future dates only; a date that has passed reads "Now" for a live listing and is dropped otherwise. */
function availability(value: string | null | undefined, status: string) {
  const time = value ? Date.parse(value) : Number.NaN
  if (!Number.isFinite(time)) return ''
  if (time <= Date.now()) return status === 'active' ? 'Now' : ''
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(time))
}

const openHouseDay: Intl.DateTimeFormatOptions = { day: 'numeric' }
const openHouseMonth: Intl.DateTimeFormatOptions = { month: 'short' }
const openHouseTime: Intl.DateTimeFormatOptions = { weekday: 'long', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }

export default async function ListingDetailPage({ params }: ListingDetailProps) {
  const { slug } = await params
  const settingsState = await getBrokerageSettings()
  if (settingsState.status !== 'ready') return null
  const settings = settingsState.settings
  const [result, customer] = await Promise.all([getStorefrontListingBySlug(slug), getCustomer()])
  const savedIds = customer ? await getSavedPropertyIds() : {}
  if (!result.listing && !result.error) notFound()
  const listing = result.listing

  if (!listing) {
    return (
      <>
        <StorefrontNav settings={settings} />
        <main className="sf-container sf-section">
          <div className="sf-state" role="alert">
            <h1>This home could not be loaded</h1>
            <p>Try again later.</p>
            <Link href="/" className="sf-btn sf-btn--primary">All homes</Link>
          </div>
        </main>
        <StorefrontFooter settings={settings} />
      </>
    )
  }

  const land = listing.propertyType === 'land'
  const hoaFee = positiveMoney(listing.hoaFee)
  const availableAt = availability(listing.availableAt, listing.status)
  const keyFacts: Array<[string, string]> = [
    ...(!land && listing.bedrooms ? [['Beds', String(listing.bedrooms)] as [string, string]] : []),
    ...(!land && Number(listing.bathrooms) > 0 ? [['Baths', String(Number(listing.bathrooms))] as [string, string]] : []),
    ...(listing.squareFeet ? [['Sq ft', listing.squareFeet.toLocaleString()] as [string, string]] : []),
    ...(listing.lotSizeSquareFeet ? [['Lot sq ft', listing.lotSizeSquareFeet.toLocaleString()] as [string, string]] : []),
  ]
  const facts: Array<[string, string]> = [
    ['Status', listingStatusLabel(listing.status)],
    ['Home type', propertyTypeLabel(listing.propertyType)],
    ...(listing.yearBuilt ? [['Year built', String(listing.yearBuilt)] as [string, string]] : []),
    ...(hoaFee ? [['HOA', `${hoaFee}/mo`] as [string, string]] : []),
    ...(availableAt ? [['Available', availableAt] as [string, string]] : []),
    ...(listing.neighborhood ? [['Neighborhood', listing.neighborhood] as [string, string]] : []),
    ...(listing.postalCode ? [['ZIP', listing.postalCode] as [string, string]] : []),
  ]
  const rental = listing.listingType === 'rent'
  const rentalTerms: Array<[string, string]> = rental ? [
    ...(listing.leaseTerm ? [['Lease term', listing.leaseTerm] as [string, string]] : []),
    ...(listing.securityDeposit ? [['Security deposit', formatMoney(String(listing.securityDeposit))] as [string, string]] : []),
    ...(listing.petPolicy ? [['Pets', listing.petPolicy] as [string, string]] : []),
  ] : []
  const extraPhotos = [...new Map(listing.media
    .filter(item => item.mediaType === 'photo' && item.imagePath && item.imagePath !== listing.imagePath)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(item => [item.imagePath, item])).values()]
  const photos = [
    ...(listing.imagePath ? [{ imagePath: listing.imagePath, altText: listing.title, caption: '' }] : []),
    ...extraPhotos,
  ].slice(0, 5)
  const galleryClass = photos.length === 1 ? 'sf-gallery sf-gallery--solo' : photos.length === 2 ? 'sf-gallery sf-gallery--two' : photos.length === 3 ? 'sf-gallery sf-gallery--three' : 'sf-gallery'
  const agent = listing.assignedAgent
  const advisorEmail = agent?.email || settings.publicEmail
  const advisorPhone = agent?.phone || settings.publicPhone
  const emailLink = emailHref(advisorEmail)
  const phoneLink = phoneHref(advisorPhone)
  const accountHref = `/account?from=${encodeURIComponent(`/listings/${listing.slug}`)}`
  const prefill = customer ? { name: customer.name, email: customer.email, phone: customer.phone } : null
  const location = listing.neighborhood || listing.city
  const listingTimeZone = stateTimeZone(listing.state)

  return (
    <>
      <StorefrontNav settings={settings} />
      <main>
        <div className="sf-container sf-crumbs">
          <Link href="/#homes"><ArrowLeft aria-hidden /> All homes</Link>
          {location ? <span>{location}</span> : null}
        </div>

        <div className="sf-container">
          {photos.length ? (
            <section className={galleryClass} aria-label="Photos">
              {photos.map((item, index) => (
                <figure key={item.imagePath}>
                  <img src={item.imagePath} alt={item.altText || ''} decoding="async" fetchPriority={index === 0 ? 'high' : 'low'} loading={index === 0 ? 'eager' : 'lazy'} />
                  {item.caption ? <figcaption>{item.caption}</figcaption> : null}
                </figure>
              ))}
            </section>
          ) : (
            <div className="sf-gallery__empty" role="img" aria-label={`${listing.title}: no photo`}>No photo</div>
          )}
        </div>

        <div className="sf-container sf-detail">
          <div className="sf-detail__main">
            <header className="sf-detail__head">
              <div className="sf-detail__top">
                <p className="sf-eyebrow">{listingMarketLabel(listing)} · {propertyTypeLabel(listing.propertyType)}</p>
                <SaveHomeButton propertyId={listing.id} title={listing.title} slug={listing.slug} savedId={savedIds[listing.id] || null} signedIn={Boolean(customer)} />
              </div>
              <h1 className="sf-detail__title"><span className="sf-dot" data-tone={listingTone(listing.status)} aria-hidden />{listing.title}</h1>
              <p className="sf-detail__address">{formatLocation(listing)}</p>
              <p className="sf-detail__price">{formatPrice(listing)}</p>
              {listing.virtualTourUrl ? <a href={listing.virtualTourUrl} className="sf-link" target="_blank" rel="noopener noreferrer">Virtual tour <ArrowUpRight aria-hidden /></a> : null}
            </header>

            {keyFacts.length ? (
              <dl className="sf-keyfacts">
                {keyFacts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
              </dl>
            ) : null}

            {listing.description || listing.shortDescription ? (
              <section className="sf-prose">
                <h2>About this home</h2>
                <p>{listing.description || listing.shortDescription}</p>
              </section>
            ) : null}

            {listing.openHouses.length ? (
              <section className="sf-prose">
                <h2>Open houses</h2>
                <ul className="sf-openhouses">
                  {listing.openHouses.map(openHouse => {
                    return (
                      <li key={openHouse.id} className="sf-openhouse">
                        <span className="sf-openhouse__date" aria-hidden><LocalDateTime value={openHouse.startsAt} options={openHouseMonth} /><b><LocalDateTime value={openHouse.startsAt} options={openHouseDay} /></b></span>
                        <div>
                          <strong>{openHouse.title}</strong>
                          <p><LocalDateTime value={openHouse.startsAt} options={openHouseTime} />{openHouse.hostName ? ` · ${openHouse.hostName}` : ''}</p>
                          <a className="sf-link" href={`/calendar/open-house/${encodeURIComponent(listing.slug)}/${encodeURIComponent(openHouse.id)}`}>Add to calendar</a>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ) : null}

            {rentalTerms.length ? (
              <section className="sf-prose">
                <h2>Rental terms</h2>
                <dl className="sf-facts">
                  {rentalTerms.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
                </dl>
                <p style={{ marginTop: '1rem' }}><a href="#ask" className="sf-link">Ask about applying</a></p>
              </section>
            ) : null}

            <section className="sf-prose">
              <h2>Details</h2>
              <dl className="sf-facts">
                {facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
              </dl>
            </section>
          </div>

          <aside className="sf-detail__aside">
            <div className="sf-advisor-card">
              {agent
                ? agent.imagePath ? <img src={agent.imagePath} alt="" /> : <span className="sf-advisor__initials" aria-hidden>{initials(agent.name)}</span>
                : <span className="sf-advisor-card__mark" aria-hidden><BrokerageMark className="" logoIcon={settings.logoIcon} logoColor={settings.logoColor} /></span>}
              <div>
                <strong title={agent ? agent.name : undefined}>{agent ? agent.name : 'Contact the office'}</strong>
                <span title={agent ? undefined : settings.businessName}>{agent ? agent.brokerageTitle || 'Listing advisor' : settings.businessName}</span>
              </div>
              <span className="sf-advisor-card__links">
                {phoneLink ? <a href={phoneLink} className="sf-icon-btn" aria-label={`Call ${advisorPhone}`}><Phone aria-hidden /></a> : null}
                {emailLink ? <a href={emailLink} className="sf-icon-btn" aria-label={`Email ${advisorEmail}`}><Mail aria-hidden /></a> : null}
              </span>
            </div>
            <ListingActionPanel propertyId={listing.id} intent={listing.listingType === 'rent' ? 'rent' : 'buy'} customer={prefill} accountHref={accountHref} timeZone={listingTimeZone} timeZoneName={listingTimeZone ? timeZoneLabel(listingTimeZone) : ''} />
          </aside>
        </div>
      </main>
      <StickyShowingBar>
        <div>
          <strong>{formatPrice(listing)}</strong>
          <span>{listingMarketLabel(listing)}</span>
        </div>
        <a href="#showing" className="sf-btn sf-btn--primary">Request a showing</a>
      </StickyShowingBar>
      <StorefrontFooter settings={settings} />
    </>
  )
}
