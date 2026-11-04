/**
 * A map pin asks the results to bring its home into view: detail `{ id }`. The phone sheet answers by
 * rising and scrolling to the card and calls preventDefault; otherwise the map scrolls the page itself.
 */
export const SHOW_LISTING_EVENT = 'sf:show-listing'

export type ShowListingDetail = { id: string; keepSnap?: boolean }

/** `keepSnap`: scroll the list to the card without moving the sheet (the map has lowered it to its peek). */
export function requestShowListing(id: string, keepSnap = false) {
  const event = new CustomEvent<ShowListingDetail>(SHOW_LISTING_EVENT, { detail: { id, keepSnap }, cancelable: true })
  return !window.dispatchEvent(event)
}

/** The phone sheet's lowest stop: its count and the top of one home. */
export const SHEET_PEEK = 148

/** The map asks the phone results sheet to move, e.g. down to its peek while a home's preview is open. */
export const SHEET_SNAP_EVENT = 'sf:sheet-snap'

export type SheetSnapDetail = { snap: 'peek' | 'half' | 'full' }

export function requestSheetSnap(snap: SheetSnapDetail['snap']) {
  window.dispatchEvent(new CustomEvent<SheetSnapDetail>(SHEET_SNAP_EVENT, { detail: { snap } }))
}

/** A heart anywhere on the page changed: detail `{ id, savedId }`, so every heart and pin for it follows. */
export const SAVED_EVENT = 'sf:saved'

export type SavedDetail = { id: string; savedId: string | null }

export function announceSaved(id: string, savedId: string | null) {
  window.dispatchEvent(new CustomEvent<SavedDetail>(SAVED_EVENT, { detail: { id, savedId } }))
}

/** The card for a home, wherever the results put it. */
export function listingCard(id: string) {
  return document.querySelector<HTMLElement>(`[data-listing-card="${CSS.escape(id)}"]`)
}

export function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Phone and tablet widths, where the results ride over the map in a sheet. */
export const PHONE = '(max-width: 63.99rem)'
/** A phone turned on its side: too short for a sheet, so the results sit beside the map instead. */
export const SHORT_LANDSCAPE = '(max-width: 63.99rem) and (orientation: landscape) and (max-height: 32rem)'

/** True when the results are a draggable sheet over the map. */
export function sheetLayout() {
  return window.matchMedia(PHONE).matches && !window.matchMedia(SHORT_LANDSCAPE).matches
}

/**
 * Each history entry gets its own id in history.state, and the map view and sheet stop are kept under
 * it. Back and Forward land on an entry that already has one and so return to where the shopper left
 * it; a new visit to the same address is a new entry and frames the homes afresh.
 */
export function historyEntry() {
  const state = (window.history.state || {}) as Record<string, unknown>
  if (typeof state.sfEntry === 'string') return state.sfEntry
  const id = Math.random().toString(36).slice(2, 10)
  try {
    window.history.replaceState({ ...state, sfEntry: id }, '')
  } catch {
    return ''
  }
  return id
}

/** The id of the entry on screen, without creating one. */
export function currentEntry() {
  const state = (window.history.state || {}) as Record<string, unknown>
  return typeof state.sfEntry === 'string' ? state.sfEntry : ''
}

/** Where a map last stood for one history entry, so Back returns to it. */
export type SavedView = { center: [number, number]; zoom: number; moved: boolean; selected: string | null }

function store(key: string, value?: unknown) {
  try {
    if (value === undefined) return sessionStorage.getItem(key)
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private mode or a full store: Back simply frames the homes again.
  }
  return null
}

export function readView(entry: string): SavedView | null {
  if (!entry) return null
  try {
    const raw = store(`sf-map:${entry}`)
    if (!raw) return null
    const view = JSON.parse(raw) as SavedView
    const [lng, lat] = view.center || []
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || !Number.isFinite(view.zoom)) return null
    return { center: [lng, lat], zoom: view.zoom, moved: Boolean(view.moved), selected: typeof view.selected === 'string' ? view.selected : null }
  } catch {
    return null
  }
}

export function writeView(entry: string, view: SavedView) {
  if (entry) store(`sf-map:${entry}`, view)
}

/** The phone sheet's stop and list scroll for one history entry. */
export type SavedSheet = { snap: 'peek' | 'half' | 'full'; scroll: number }

export function readSheet(entry: string): SavedSheet | null {
  if (!entry) return null
  try {
    const raw = store(`sf-sheet:${entry}`)
    if (!raw) return null
    const sheet = JSON.parse(raw) as SavedSheet
    if (!['peek', 'half', 'full'].includes(sheet.snap)) return null
    return { snap: sheet.snap, scroll: Math.max(0, Number(sheet.scroll) || 0) }
  } catch {
    return null
  }
}

export function writeSheet(entry: string, sheet: SavedSheet) {
  if (entry) store(`sf-sheet:${entry}`, sheet)
}
