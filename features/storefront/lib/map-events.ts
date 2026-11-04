/**
 * A map pin asks the results to bring its home into view: detail `{ id }`. The phone sheet answers by
 * rising and scrolling to the card and calls preventDefault; otherwise the map scrolls the page itself.
 */
export const SHOW_LISTING_EVENT = 'sf:show-listing'

export type ShowListingDetail = { id: string }

export function requestShowListing(id: string) {
  const event = new CustomEvent<ShowListingDetail>(SHOW_LISTING_EVENT, { detail: { id }, cancelable: true })
  return !window.dispatchEvent(event)
}

/** The card for a home, wherever the results put it. */
export function listingCard(id: string) {
  return document.querySelector<HTMLElement>(`[data-listing-card="${CSS.escape(id)}"]`)
}

export function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
