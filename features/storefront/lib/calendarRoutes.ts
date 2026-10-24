import { getCustomerShowing } from './data/account'
import { getStorefrontListingBySlug } from './data/properties'
import { getBrokerageSettings } from './data/settings'
import { calendarFile, calendarResponse } from './calendar'
import { storefrontOrigin } from './metadata'

async function listingContext(slug: string) {
  const [result, settings, origin] = await Promise.all([getStorefrontListingBySlug(slug), getBrokerageSettings(), storefrontOrigin()])
  const listing = result.listing
  const business = settings.status === 'ready' ? settings.settings.businessName : ''
  const url = listing && origin ? new URL(`/listings/${listing.slug}`, origin).toString() : undefined
  return { listing, business, url }
}

/** The signed-in shopper's own scheduled showing; ownership is checked by customerShowingHistory. */
export async function showingCalendar(id: string) {
  const showing = await getCustomerShowing(id)
  if (!showing || !['scheduled', 'requested'].includes(showing.status)) return new Response('Not found', { status: 404 })
  const { listing, business, url } = await listingContext(showing.listingSlug)
  const start = showing.scheduledStart
  const end = showing.scheduledEnd || new Date(Date.parse(start) + 60 * 60_000).toISOString()
  const body = calendarFile({
    uid: `showing-${showing.id}@openfront-real-estate`,
    title: `${showing.showingType === 'virtual' ? 'Virtual tour' : 'Tour'}: ${showing.listingTitle}`,
    start, end,
    location: showing.showingType === 'virtual' ? 'Video call' : listing ? [listing.addressLine1, listing.city, listing.state].filter(Boolean).join(', ') : undefined,
    description: [business, showing.status === 'requested' ? 'Requested; waiting for confirmation.' : ''].filter(Boolean).join('\n'),
    url,
  })
  return calendarResponse(body, 'showing.ics')
}

export async function openHouseCalendar(slug: string, openHouseId: string) {
  const { listing, business, url } = await listingContext(slug)
  const openHouse = listing?.openHouses.find(item => item.id === openHouseId)
  if (!listing || !openHouse) return new Response('Not found', { status: 404 })
  const body = calendarFile({
    uid: `open-house-${openHouse.id}@openfront-real-estate`,
    title: `${openHouse.title}: ${listing.title}`,
    start: openHouse.startsAt, end: openHouse.endsAt,
    location: [listing.addressLine1, listing.city, listing.state].filter(Boolean).join(', '),
    description: [business, openHouse.hostName ? `Host: ${openHouse.hostName}` : ''].filter(Boolean).join('\n'),
    url,
  })
  return calendarResponse(body, 'open-house.ics')
}
