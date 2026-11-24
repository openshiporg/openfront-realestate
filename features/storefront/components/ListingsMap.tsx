'use client'

import { createPortal } from 'react-dom'
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Expand, Loader2, Navigation, Search, X } from 'lucide-react'
import type { LngLatBoundsLike, Map as MapLibreMap } from 'maplibre-gl'
import { Map, MapControls, MapMarker, MapPopup, MarkerContent, useMap } from '@/components/ui/map'
import { pinLifts } from '../lib/pin-layout'
import { clusterLabel, groupPins } from '../lib/map-clusters'
import { formatMapArea, type MapArea } from '../lib/map-area'
import { fitPadding, inClearArea, keepView } from '../lib/map-view'
import { currentEntry, historyEntry, listingCard, readView, reducedMotion, requestSheetSnap, requestShowListing, SAVED_EVENT, SHEET_PEEK, sheetLayout, writeView, type SavedDetail } from '../lib/map-events'
import { SaveHomeButton } from './SaveHomeButton'
import { HomePhotoFallback } from './HomePhotoFallback'

export type MapPin = {
  id: string
  slug: string
  latitude: number
  longitude: number
  label: string
  title: string
  price?: number
  rent?: boolean
  /** Shown on the map's preview card. */
  priceText?: string
  address?: string
  place?: string
  facts?: string
  imagePath?: string
  savedId?: string | null
}

// CARTO Voyager: soft streets, readable labels and coloured parks and water, free with credit.
const STYLES = { light: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json' }
// With no located homes the map opens on the continental US instead of an arbitrary city.
const EMPTY_VIEW = { center: [-98.5, 39.5] as [number, number], zoom: 3 }
// Pins whose points fall closer than this on screen merge into one "N homes" marker.
const CLUSTER_RADIUS = 46
// Moves the storefront makes itself carry this, so they never offer "Search this area".
const AUTO = { sfAuto: true }
// The phone preview card's height plus its gap, kept clear when a chosen home is brought into view.
const PREVIEW_ROOM = 150
// The card beside a pin on a wide map: its height above the pin and half its width (plus the controls) to each side.
const FLOAT_ROOM = { above: 380, side: 200 }

/** How much of the map's foot the phone results sheet covers right now. */
function sheetCover(canvas: HTMLElement | null) {
  const map = canvas?.getBoundingClientRect()
  const sheet = canvas?.closest('.sf-split')?.querySelector<HTMLElement>('.sf-sheet[data-live]')
  if (!map || !sheet) return 0
  return Math.max(0, map.bottom - sheet.getBoundingClientRect().top)
}

/** Room around the homes when fitting them, clear of the sheet and wide enough for the price pills. */
function framePadding(canvas: HTMLElement | null, pins: MapPin[]) {
  const rect = canvas?.getBoundingClientRect()
  if (!rect || !rect.height) return { top: 64, bottom: 40, left: 56, right: 56 }
  // Close pins merge into a wider "2 homes · $825K+" pill, so leave room for one.
  const widest = Math.max(150, ...pins.map(pin => 22 + pin.label.length * 8.5))
  const padding = fitPadding(rect, { below: sheetCover(canvas) }, widest)
  // The map controls sit in a corner; keep homes out from under them.
  const controls = canvas?.closest('.sf-map')?.querySelector<HTMLElement>('.sf-map__controls')?.getBoundingClientRect()
  if (controls && controls.width) {
    if (controls.left - rect.left < rect.width / 2) padding.left = Math.max(padding.left, Math.round(controls.right - rect.left + 12))
    else padding.right = Math.max(padding.right, Math.round(rect.right - controls.left + 12))
  }
  return padding
}

function pinBounds(pins: MapPin[]): LngLatBoundsLike {
  const lng = pins.map(pin => pin.longitude), lat = pins.map(pin => pin.latitude)
  return [[Math.min(...lng), Math.min(...lat)], [Math.max(...lng), Math.max(...lat)]]
}

type Located = 'idle' | 'finding' | 'found' | 'denied' | 'unavailable'
type MapProps = { pins: MapPin[]; activeId?: string; area?: MapArea | null; searchable?: boolean; signedIn?: boolean; className?: string }

/** A map that cannot start (no WebGL, blocked script) leaves a plain note instead of breaking the page. */
class MapBoundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onFail() }
  render() { return this.state.failed ? null : this.props.children }
}

/**
 * The map half of the search, built on mapcn (MapLibre). Every located home is a price pin; close pins
 * merge into an "N homes · from" marker that zooms in when chosen. Choosing a pin opens the home's card
 * (beside the pin on a wide screen, over the foot of the map on a phone), lowers the phone sheet to its
 * peek and marks the home's card in the list; the card opens the home. Cards and pins share a highlight
 * on hover and focus.
 *
 * New results move the pins in place: when the shopper has not moved the map it frames the new homes,
 * otherwise it stays put. Where the map stood is kept per page address, so Back returns to the same
 * view. With `searchable`, moving the map offers "Search this area".
 */
export function ListingsMap(props: MapProps) {
  const { pins, className = '' } = props
  const [failed, setFailed] = useState(false)
  // The first view: the homes' first spot; the effects below frame them or restore Back's view at once.
  const [start] = useState(() => pins.length ? { center: [pins[0].longitude, pins[0].latitude] as [number, number], zoom: 11 } : EMPTY_VIEW)
  return (
    <div className={`sf-map ${className}`} data-failed={failed || undefined}>
      <div className="sf-map__canvas" role="region" aria-label={pins.length ? `Map of ${pins.length} ${pins.length === 1 ? 'home' : 'homes'}` : 'Map'}>
        {failed ? null : (
          <MapBoundary onFail={() => setFailed(true)}>
            <Map theme="light" styles={STYLES} center={start.center} zoom={start.zoom} attributionControl={false} dragRotate={false} pitchWithRotate={false} renderWorldCopies>
              <ListingsLayer {...props} onFail={() => setFailed(true)} />
            </Map>
          </MapBoundary>
        )}
      </div>
      {failed ? <p className="sf-map__note">The map could not be loaded.</p> : null}
    </div>
  )
}

function ListingsLayer({ pins, activeId, area = null, searchable = false, signedIn = false, onFail }: MapProps & { onFail: () => void }) {
  const router = useRouter()
  const { map, mapLib, isLoaded } = useMap()
  const elements = useRef(new globalThis.Map<string, HTMLButtonElement>())
  const pinsRef = useRef(pins)
  const activeRef = useRef(activeId)
  const selectedRef = useRef<string | null>(null)
  // The shopper moved the map since it last framed the homes; new results then keep the view.
  const movedRef = useRef(false)
  const placedKey = useRef('')
  const areaRef = useRef(area ? formatMapArea(area) : '')
  // Only the search map remembers its view for Back; a home's own map always opens on the home.
  const remember = useRef(searchable)
  const [ready, setReady] = useState(false)
  const [groups, setGroups] = useState<string[][]>(() => pins.map(pin => [pin.id]))
  const [hovered, setHovered] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [saved, setSaved] = useState<Record<string, string | null>>({})
  const [offerSearch, setOfferSearch] = useState(false)
  const [located, setLocated] = useState<Located>('idle')
  const [here, setHere] = useState<[number, number] | null>(null)
  const [floating, setFloating] = useState(false)
  const key = pins.map(pin => `${pin.id}:${pin.latitude}:${pin.longitude}:${pin.label}`).join('|')
  const areaKey = area ? formatMapArea(area) : ''
  pinsRef.current = pins
  activeRef.current = activeId

  const box = useCallback(() => map?.getContainer() ?? null, [map])

  const select = useCallback((id: string | null) => {
    selectedRef.current = id
    setSelected(id)
  }, [])

  // Wide screens show the chosen home beside its pin; phones and the small detail map keep it at the foot.
  useEffect(() => {
    const sync = () => setFloating(!sheetLayout() && (box()?.clientWidth || 0) >= 560)
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [box, isLoaded])

  // Pins that would still cover each other are raised on a longer stem, so every price stays readable.
  const spread = useCallback(() => {
    if (!map) return
    const boxes = [...elements.current.entries()].filter(([, element]) => element.isConnected).map(([id, element]) => {
      const pin = pinsRef.current.find(item => item.id === id)
      const point = pin ? map.project([pin.longitude, pin.latitude]) : { x: -9999, y: -9999 }
      const label = element.firstElementChild as HTMLElement
      return { id, x: point.x, y: point.y, width: label.offsetWidth, height: label.offsetHeight + 8 }
    })
    const lifts = pinLifts(boxes)
    boxes.forEach(({ id }) => elements.current.get(id)?.style.setProperty('--sf-pin-lift', `${-(lifts[id] || 0)}px`))
  }, [map])

  // Close pins merge into one marker, unless one of them is the current or chosen home.
  const regroup = useCallback(() => {
    if (!map) return
    const points = pinsRef.current.map(pin => ({ id: pin.id, ...map.project([pin.longitude, pin.latitude]) }))
    const atMax = map.getZoom() >= map.getMaxZoom() - 0.5
    const next: string[][] = []
    for (const ids of groupPins(points, atMax ? 0 : CLUSTER_RADIUS)) {
      if (ids.length > 1 && ids.some(id => id === activeRef.current || id === selectedRef.current)) ids.forEach(id => next.push([id]))
      else next.push(ids)
    }
    setGroups(current => JSON.stringify(current) === JSON.stringify(next) ? current : next)
  }, [map])
  useEffect(() => { requestAnimationFrame(spread) }, [groups, spread])

  // Choosing a home: its card opens, the phone sheet lowers to its peek, and its card is marked (and
  // scrolled to) in the list. The home is brought into the open part of the map.
  const choose = useCallback((pin: MapPin) => {
    if (pin.id === activeRef.current) return
    select(pin.id)
    setHovered(pin.id)
    const container = box()
    const phone = sheetLayout()
    const results = Boolean(container?.closest('.sf-split[data-variant="results"]'))
    if (phone && results) requestSheetSnap('peek')
    requestShowListing(pin.id, true)
    if (!phone) listingCard(pin.id)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' })
    if (!map || !container) return
    const size = { width: container.clientWidth, height: container.clientHeight }
    const wide = !phone && size.width >= 560
    const cover = (phone && results ? SHEET_PEEK : 0) + PREVIEW_ROOM
    const point = map.project([pin.longitude, pin.latitude])
    // Beside the pin the card stands above it: keep about its height clear over the pin and half its width each side.
    const fits = wide
      ? point.x >= FLOAT_ROOM.side && point.x <= size.width - FLOAT_ROOM.side && point.y >= FLOAT_ROOM.above && point.y <= size.height - 40
      : inClearArea(point, size, cover)
    if (fits) return
    const target = wide ? Math.min(size.height - 48, FLOAT_ROOM.above + (size.height - FLOAT_ROOM.above - 48) / 2) : (size.height - cover) / 2 + 20
    map.easeTo({ center: [pin.longitude, pin.latitude], offset: [0, target - size.height / 2], duration: reducedMotion() ? 0 : 320 }, AUTO)
  }, [box, map, select])

  const frame = useCallback((animate: boolean) => {
    const list = pinsRef.current
    if (!map) return
    const duration = animate && !reducedMotion() ? 450 : 0
    if (list.length > 1) map.fitBounds(pinBounds(list), { padding: framePadding(box(), list), maxZoom: 13, duration }, AUTO)
    else if (list.length === 1) map.easeTo({ center: [list[0].longitude, list[0].latitude], zoom: 13, duration }, AUTO)
  }, [box, map])

  // The map's own wiring, once per map: credits, events and the first view.
  useEffect(() => {
    if (!map || !mapLib) return
    map.touchZoomRotate.disableRotation()
    map.keyboard.disableRotation()
    // OpenStreetMap / CARTO credits stay one tap away; on a phone they sit at the top so the results
    // sheet never covers them.
    const credits = new mapLib.AttributionControl({ compact: true })
    map.addControl(credits, sheetLayout() ? 'top-right' : 'bottom-left')
    map.once('load', () => map.getContainer().querySelector('.maplibregl-compact-show')?.classList.remove('maplibregl-compact-show'))
    const onError = (event: { error?: { message?: string } }) => { if (!map.loaded() && String(event?.error?.message || '').includes('style')) onFail() }
    const onMoveStart = (event: unknown) => {
      if ((event as { sfAuto?: boolean }).sfAuto) return
      movedRef.current = true
      setOfferSearch(true)
    }
    const onMoveEnd = () => {
      regroup()
      spread()
      if (!remember.current) return
      const center = map.getCenter()
      writeView(historyEntry(), { center: [center.lng, center.lat], zoom: map.getZoom(), moved: movedRef.current, selected: selectedRef.current })
    }
    // A tap on the open map closes the card; taps on pins and cards are theirs.
    const onClick = (event: { originalEvent?: Event }) => {
      if (event.originalEvent && event.originalEvent.target !== map.getCanvas()) return
      select(null)
      setHovered(null)
    }
    map.on('error', onError)
    map.on('movestart', onMoveStart)
    map.on('moveend', onMoveEnd)
    map.on('zoom', spread)
    map.on('click', onClick)

    const list = pinsRef.current
    const back = remember.current ? readView(currentEntry()) : null
    if (back) {
      map.jumpTo({ center: back.center, zoom: back.zoom }, AUTO)
      movedRef.current = back.moved
      if (back.selected && list.some(pin => pin.id === back.selected)) select(back.selected)
    } else if (areaRef.current) {
      const [west, south, east, north] = areaRef.current.split(',').map(Number)
      map.fitBounds([[west, south], [east, north]], { padding: 0, duration: 0 }, AUTO)
      movedRef.current = true
    } else {
      frame(false)
    }
    placedKey.current = pinsRef.current.map(pin => `${pin.id}:${pin.latitude}:${pin.longitude}:${pin.label}`).join('|')
    regroup()
    setReady(true)
    return () => {
      map.off('error', onError)
      map.off('movestart', onMoveStart)
      map.off('moveend', onMoveEnd)
      map.off('zoom', spread)
      map.off('click', onClick)
      try { map.removeControl(credits) } catch { /* the map is already gone */ }
    }
  }, [map, mapLib, frame, onFail, regroup, select, spread])

  // New results: the view follows only if the shopper has not moved the map (or none of the new homes
  // would be in view).
  useEffect(() => {
    if (!ready || !map || placedKey.current === key && areaRef.current === areaKey) return
    const list = pinsRef.current
    const changed = placedKey.current !== key
    placedKey.current = key
    if (selectedRef.current && !list.some(pin => pin.id === selectedRef.current)) select(null)
    const areaChanged = areaRef.current !== areaKey
    areaRef.current = areaKey
    if (changed) {
      const bounds = map.getBounds()
      const inView = list.filter(pin => bounds.contains([pin.longitude, pin.latitude])).length
      // Clearing the map area always widens the view back out to the homes.
      if (areaChanged && !areaKey) movedRef.current = false
      if (!keepView(movedRef.current, inView)) {
        movedRef.current = false
        frame(true)
      }
    }
    regroup()
  }, [ready, map, key, areaKey, frame, regroup, select])

  // A newly chosen home leaves its cluster.
  useEffect(() => { regroup() }, [selected, activeId, regroup])

  // Saved homes carry a heart on their pin, as soon as a heart anywhere on the page changes.
  useEffect(() => {
    const onSaved = (event: Event) => {
      const { id, savedId } = (event as CustomEvent<SavedDetail>).detail
      setSaved(current => ({ ...current, [id]: savedId }))
    }
    window.addEventListener(SAVED_EVENT, onSaved)
    return () => window.removeEventListener(SAVED_EVENT, onSaved)
  }, [])
  const savedIdOf = useCallback((pin: MapPin) => pin.id in saved ? saved[pin.id] : pin.savedId || null, [saved])

  // Cards anywhere on the page lift their pin while hovered or focused; Escape closes the chosen home.
  useEffect(() => {
    const over = (event: Event) => {
      // A finger has no hover: a tap must not clear the home a pin just chose.
      if ((event as PointerEvent).pointerType === 'touch') return
      const target = event.target as HTMLElement | null
      if (target?.closest?.('.sf-pin, .sf-preview')) return
      const card = target?.closest?.<HTMLElement>('[data-listing-card]')
      setHovered(card?.dataset.listingCard || selectedRef.current)
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && selectedRef.current) select(null) }
    document.addEventListener('pointerover', over)
    document.addEventListener('focusin', over)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerover', over)
      document.removeEventListener('focusin', over)
      document.removeEventListener('keydown', escape)
    }
  }, [select])

  // The list card of the chosen or hovered home is marked.
  useEffect(() => {
    document.querySelectorAll('[data-listing-card][data-highlight]').forEach(card => card.removeAttribute('data-highlight'))
    const marked = selected || hovered
    if (marked && marked !== activeId) listingCard(marked)?.setAttribute('data-highlight', '')
  }, [hovered, selected, activeId, key])

  const showAll = () => {
    if (!map) return
    const active = pins.find(pin => pin.id === activeId)
    movedRef.current = false
    setOfferSearch(false)
    if (active) return void map.easeTo({ center: [active.longitude, active.latitude], zoom: 13, duration: 300 }, AUTO)
    frame(true)
  }
  const locate = () => {
    if (!map) return
    if (!('geolocation' in navigator)) return setLocated('unavailable')
    setLocated('finding')
    navigator.geolocation.getCurrentPosition(position => {
      const spot: [number, number] = [position.coords.longitude, position.coords.latitude]
      setHere(spot)
      setLocated('found')
      // A move the shopper asked for: it offers "Search this area" like a drag would.
      map.flyTo({ center: spot, zoom: Math.max(map.getZoom(), 13), duration: reducedMotion() ? 0 : 900 })
    }, error => setLocated(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable'), { timeout: 10000, maximumAge: 60000 })
  }
  useEffect(() => {
    if (located !== 'denied' && located !== 'unavailable') return
    const timer = setTimeout(() => setLocated('idle'), 4500)
    return () => clearTimeout(timer)
  }, [located])

  const searchHere = () => {
    if (!map) return
    const view = map.getBounds()
    const next = new URLSearchParams(window.location.pathname === '/listings' ? window.location.search : '')
    next.delete('skip')
    next.set('bounds', formatMapArea({ west: view.getWest(), south: view.getSouth(), east: view.getEast(), north: view.getNorth() }))
    // The map is already on the area; the new results must not move it.
    movedRef.current = true
    areaRef.current = next.get('bounds') || ''
    setOfferSearch(false)
    router.push(`/listings?${next.toString()}`, { scroll: false })
  }

  const byId = useMemo(() => new globalThis.Map(pins.map(pin => [pin.id, pin])), [pins])
  const preview = selected ? byId.get(selected) || null : null
  const note = located === 'denied' ? 'Location is off for this site. Turn it on in your browser to see homes near you.' : located === 'unavailable' ? 'Your location could not be found.' : ''
  const lit = (id: string) => id === hovered || id === activeId || id === selected

  const clusterZoom = (members: MapPin[]) => {
    if (!map) return
    const spots = new Set(members.map(member => `${member.latitude},${member.longitude}`))
    if (spots.size === 1) return choose(members[0])
    select(null)
    movedRef.current = true
    map.fitBounds(pinBounds(members), { padding: framePadding(box(), members), maxZoom: 17, duration: reducedMotion() ? 0 : 400 }, AUTO)
  }

  return (
    <>
      <MapState previewing={Boolean(preview)} />
      {groups.map(ids => {
        const members = ids.map(id => byId.get(id)).filter((pin): pin is MapPin => Boolean(pin))
        if (!members.length) return null
        if (members.length === 1) {
          const pin = members[0]
          return (
            <PricePin
              key={pin.id}
              pin={pin}
              active={pin.id === activeId}
              lifted={lit(pin.id)}
              chosen={pin.id === selected}
              saved={Boolean(savedIdOf(pin))}
              onChoose={() => choose(byId.get(pin.id) || pin)}
              onHover={on => setHovered(current => on ? pin.id : current === pin.id ? null : current)}
              register={element => { if (element) elements.current.set(pin.id, element); else elements.current.delete(pin.id) }}
            />
          )
        }
        const { count, from } = clusterLabel(members)
        const lng = members.reduce((sum, member) => sum + member.longitude, 0) / members.length
        const lat = members.reduce((sum, member) => sum + member.latitude, 0) / members.length
        const active = members.some(member => lit(member.id))
        return (
          <MapMarker key={`c:${ids.join(',')}`} longitude={lng} latitude={lat} anchor="bottom" onClick={event => { event.stopPropagation(); clusterZoom(members) }}>
            <MarkerContent>
              <button type="button" className="sf-pin sf-pin--cluster" data-active={active || undefined} style={{ zIndex: active ? 3 : undefined }} aria-label={`${count}${from ? ` from ${from.replace(/\+$/, '')}` : ''}. Zoom in`}>
                <span className="sf-pin__label"><b>{count}</b><span>{from ? ` · ${from}` : ''}</span></span>
              </button>
            </MarkerContent>
          </MapMarker>
        )
      })}
      {here ? (
        <MapMarker longitude={here[0]} latitude={here[1]}>
          <MarkerContent><span className="sf-you" role="img" aria-label="You are here" /></MarkerContent>
        </MapMarker>
      ) : null}

      <Overlay>
      {note ? <p className="sf-map__note" role="status">{note}</p> : null}
      {searchable && offerSearch ? (
        <button type="button" className="sf-map__search" onClick={searchHere}><Search aria-hidden />Search this area</button>
      ) : null}
      <div className="sf-map__controls">
        <MapControls className="sf-map__zoomgroup static" />
        <div className="sf-map__group">
          <button type="button" onClick={locate} aria-label="Show homes near me" aria-busy={located === 'finding'} data-on={located === 'found' || undefined}>
            {located === 'finding' ? <Loader2 aria-hidden /> : <Navigation aria-hidden />}
          </button>
          <button type="button" onClick={showAll} aria-label={activeId ? 'Center on this home' : 'Show all homes'}><Expand aria-hidden /></button>
        </div>
      </div>

        {preview && !floating ? (
          <PreviewCard key={preview.id} pin={preview} savedId={savedIdOf(preview)} signedIn={signedIn} onClose={() => { select(null); setHovered(null) }} />
        ) : null}
      </Overlay>
      {preview && floating ? (
        <MapPopup key={preview.id} longitude={preview.longitude} latitude={preview.latitude} offset={[0, -52]} anchor="bottom" closeOnClick={false} focusAfterOpen={false} className="max-w-none rounded-none border-0 bg-transparent p-0 shadow-none" onClose={() => { if (selectedRef.current === preview.id) select(null) }}>
          <PreviewCard pin={preview} savedId={savedIdOf(preview)} signedIn={signedIn} floating onClose={() => { select(null); setHovered(null) }} />
        </MapPopup>
      ) : null}
    </>
  )
}

/** Controls, notes and the phone card sit over the map but outside MapLibre's own element, so they never pan it. */
function Overlay({ children }: { children: ReactNode }) {
  const { map } = useMap()
  const host = map?.getContainer().closest<HTMLElement>('.sf-map')
  return host ? createPortal(children, host) : null
}

/** Marks the map while a home is open, so corner controls step aside on small maps. */
function MapState({ previewing }: { previewing: boolean }) {
  const { map } = useMap()
  useEffect(() => {
    const root = map?.getContainer().closest('.sf-map')
    root?.toggleAttribute('data-previewing', previewing)
    return () => root?.removeAttribute('data-previewing')
  }, [map, previewing])
  return null
}

const HEART = 'M12 21s-7.5-4.6-9.6-9.2C1 8.6 3 5 6.6 5c2.1 0 3.6 1.1 4.4 2.5h2C13.8 6.1 15.3 5 17.4 5 21 5 23 8.6 21.6 11.8 19.5 16.4 12 21 12 21z'

/** One home's price pin. The current home also gets a radar ring on the ground under its pointer. */
function PricePin({ pin, active, lifted, chosen, saved, onChoose, onHover, register }: {
  pin: MapPin; active: boolean; lifted: boolean; chosen: boolean; saved: boolean
  onChoose: () => void; onHover: (on: boolean) => void; register: (element: HTMLButtonElement | null) => void
}) {
  return (
    <MapMarker
      longitude={pin.longitude}
      latitude={pin.latitude}
      anchor="bottom"
      onClick={event => { event.stopPropagation(); onChoose() }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <MarkerContent className="sf-pin-host">
        <button
          ref={register}
          type="button"
          className="sf-pin"
          data-active={lifted || undefined}
          data-selected={chosen || undefined}
          data-saved={saved || undefined}
          style={{ zIndex: chosen ? 4 : lifted ? 3 : undefined }}
          aria-label={`${pin.title}, ${pin.label}`}
          aria-current={active ? 'true' : 'false'}
          aria-expanded={chosen}
        >
          <span className="sf-pin__label">
            <svg className="sf-pin__heart" viewBox="0 0 24 24" aria-hidden="true"><path d={HEART} /></svg>
            <span className="sf-pin__text">{pin.label}</span>
          </span>
          {active ? <span className="sf-pin__radar" aria-hidden="true"><i /></span> : null}
        </button>
      </MarkerContent>
    </MapMarker>
  )
}

/** The chosen home: photo, price, address, facts and the heart. The card opens the home. */
function PreviewCard({ pin, savedId, signedIn, floating = false, onClose }: { pin: MapPin; savedId: string | null; signedIn: boolean; floating?: boolean; onClose: () => void }) {
  const href = `/listings/${pin.slug}`
  const address = pin.address || pin.title
  return (
    <aside className="sf-preview" data-floating={floating || undefined} aria-label={`${address}, ${pin.priceText || pin.label}`}>
      <Link href={href} className="sf-preview__link">
        <span className="sf-preview__photo">
          {pin.imagePath ? <img src={pin.imagePath} alt="" decoding="async" /> : <HomePhotoFallback label={address} showLabel={false} />}
        </span>
        <span className="sf-preview__text">
          <strong className="sf-preview__price sf-num">{pin.priceText || pin.label}</strong>
          <span className="sf-preview__address">{address}</span>
          {pin.facts ? <span className="sf-preview__facts sf-num">{pin.facts}</span> : null}
          {pin.place ? <span className="sf-preview__place">{pin.place}</span> : null}
        </span>
      </Link>
      <SaveHomeButton key={`${pin.id}:${savedId || ''}`} className="sf-preview__save" propertyId={pin.id} title={pin.title} slug={pin.slug} savedId={savedId} signedIn={signedIn} />
      <button type="button" className="sf-preview__close" onClick={onClose} aria-label="Close preview"><X aria-hidden /></button>
    </aside>
  )
}

export type { MapLibreMap }
