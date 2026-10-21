import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Mail, Phone, Video } from 'lucide-react'
import { StorefrontFooter } from '@/features/storefront/components/StorefrontFooter'
import { StorefrontNav } from '@/features/storefront/components/StorefrontNav'
import { getCustomer } from '@/features/storefront/lib/data/account'
import { getStorefrontListingBySlug } from '@/features/storefront/lib/data/properties'
import { getBrokerageSettings } from '@/features/storefront/lib/data/settings'
import { emailHref, formatLocation, formatPrice, listingStatusLabel, phoneHref, propertyTypeLabel } from '@/features/storefront/lib/format'
import { formatMoney } from '@/features/lib/money'
import { ListingInquiryForm } from './ListingInquiryForm'
import { ShowingRequestForm } from './ShowingRequestForm'

type ListingDetailProps = { params: Promise<{ slug: string }> }

export async function generateListingMetadata({ params }: ListingDetailProps): Promise<Metadata> {
  const { slug } = await params
  const result = await getStorefrontListingBySlug(slug)
  const listing = result.listing
  if (!listing) return { title: 'Home not found', robots: { index: false, follow: false } }
  const description = listing.shortDescription || `${formatPrice(listing)} · ${formatLocation(listing)}`
  return {
    title: listing.title,
    description,
    openGraph: {
      title: listing.title,
      description,
      ...(listing.imagePath ? { images: [{ url: listing.imagePath }] } : {}),
    },
  }
}

function positiveMoney(value?: string | null) {
  try {
    return value && Number(value) > 0 ? formatMoney(value) : ''
  } catch {
    return ''
  }
}

function formatDate(value?: string | null) {
  const time = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(time) ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(time)) : ''
}

export default async function ListingDetailPage({ params }: ListingDetailProps) {
  const { slug } = await params
  const settingsState = await getBrokerageSettings()
  if (settingsState.status !== 'ready') return null
  const settings = settingsState.settings
  const [result, customer] = await Promise.all([getStorefrontListingBySlug(slug), getCustomer()])
  if (!result.listing && !result.error) notFound()
  const listing = result.listing

  if (!listing) return <><StorefrontNav settings={settings} /><main className="sf-container sf-section"><div className="sf-state" role="alert"><h1>This home could not be loaded.</h1><p>Please try again later.</p><Link href="/" className="sf-btn sf-btn--dark">Back to homes</Link></div></main><StorefrontFooter settings={settings} /></>

  const hoaFee = positiveMoney(listing.hoaFee)
  const availableAt = formatDate(listing.availableAt)
  const facts: Array<[string, string | number]> = [
    ['Status', listingStatusLabel(listing.status)],
    ['Bedrooms', listing.bedrooms ?? '—'],
    ['Bathrooms', listing.bathrooms || '—'],
    ['Interior', listing.squareFeet ? `${listing.squareFeet.toLocaleString()} sq ft` : '—'],
    ['Lot', listing.lotSizeSquareFeet ? `${listing.lotSizeSquareFeet.toLocaleString()} sq ft` : '—'],
    ['Year built', listing.yearBuilt || '—'],
    ['Home type', propertyTypeLabel(listing.propertyType)],
    ...(hoaFee ? [['HOA', `${hoaFee}/mo`] as [string, string]] : []),
    ...(availableAt ? [['Available', availableAt] as [string, string]] : []),
  ]
  const gallery = [...new Map(listing.media
    .filter(item => item.mediaType === 'photo' && item.imagePath && item.imagePath !== listing.imagePath)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(item => [item.imagePath, item])).values()]
  const agent = listing.assignedAgent
  const advisorEmail = agent?.email || settings.publicEmail
  const advisorPhone = agent?.phone || settings.publicPhone
  const emailLink = emailHref(advisorEmail)
  const phoneLink = phoneHref(advisorPhone)
  const accountHref = `/account?from=${encodeURIComponent(`/listings/${listing.slug}`)}`
  const prefill = customer ? { name: customer.name, email: customer.email, phone: customer.phone } : null
  const location = listing.neighborhood || listing.city

  return (
    <>
      <StorefrontNav settings={settings} />
      <main>
        <div className="sf-container sf-detail-crumbs"><Link href="/"><ArrowLeft aria-hidden /> All homes</Link>{location ? <span>{location}</span> : null}</div>
        <section className="sf-detail-hero">
          <div className="sf-detail-hero__media">{listing.imagePath ? <img src={listing.imagePath} alt={listing.title} fetchPriority="high" /> : <div className="sf-detail-hero__placeholder" role="img" aria-label={`${listing.title}: no photo`}>No photo</div>}</div>
          <div className="sf-detail-hero__copy">
            <p className="sf-kicker">{listing.status === 'coming_soon' ? 'Coming soon' : listing.listingType === 'rent' ? 'For rent' : 'For sale'} · {formatLocation(listing)}</p>
            <h1>{listing.title}</h1>
            <p className="sf-detail-hero__price">{formatPrice(listing)}</p>
            {listing.shortDescription ? <p>{listing.shortDescription}</p> : null}
            <div className="sf-detail-hero__actions">
              <a href="#showing" className="sf-btn sf-btn--dark">Request a showing</a>
              {listing.virtualTourUrl ? <a href={listing.virtualTourUrl} className="sf-text-link" target="_blank" rel="noopener noreferrer"><Video aria-hidden /> Virtual tour</a> : null}
            </div>
          </div>
        </section>
        <section className="sf-detail-facts"><dl className="sf-container">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
        {gallery.length ? (
          <section className="sf-container sf-detail-gallery" aria-label="Photos">
            {gallery.map(item => (
              <figure key={item.imagePath}>
                <img src={item.imagePath} alt={item.altText || ''} decoding="async" loading="lazy" />
                {item.caption ? <figcaption>{item.caption}</figcaption> : null}
              </figure>
            ))}
          </section>
        ) : null}
        <section className="sf-container sf-detail-body">
          <article className="sf-detail-story">
            <h2>About this home</h2>
            <p>{listing.description || listing.shortDescription}</p>
            {listing.openHouses.length ? <div><h3 className="sf-detail-story__subhead">Open houses</h3><ul>{listing.openHouses.map(openHouse => <li key={openHouse.id}><strong>{openHouse.title}</strong><br/><span>{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(openHouse.startsAt))}{openHouse.hostName ? ` · Hosted by ${openHouse.hostName}` : ''}</span></li>)}</ul></div> : null}
          </article>
          <aside className="sf-detail-aside">
            <div className="sf-property-advisor">
              {agent?.imagePath ? <img src={agent.imagePath} alt="" /> : null}
              <p className="sf-kicker">Listing advisor</p><h2>{agent?.name || settings.businessName}</h2><p>{agent?.brokerageTitle || settings.marketLabel}</p>
              {emailLink ? <a href={emailLink}><Mail aria-hidden /> {advisorEmail}</a> : null}
              {phoneLink ? <a href={phoneLink}><Phone aria-hidden /> {advisorPhone}</a> : null}
            </div>
            <ListingInquiryForm propertyId={listing.id} intent={listing.listingType === 'rent' ? 'rent' : 'buy'} customer={prefill} />
          </aside>
        </section>
        <section id="showing" className="sf-showing-section"><div className="sf-container"><ShowingRequestForm propertyId={listing.id} customer={prefill} accountHref={accountHref} /></div></section>
      </main>
      <StorefrontFooter settings={settings} />
    </>
  )
}
