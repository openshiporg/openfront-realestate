'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Expand, Minus, Navigation, Plus, Search, X } from 'lucide-react'
import type { LngLatBoundsLike, Map as MapLibreMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
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

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'
// With no located homes the map opens on the continental US instead of an arbitrary city.
const EMPTY_VIEW = { center: [-98.5, 39.5] as [number, number], zoom: 3 }
// Pins whose points fall closer than this on screen merge into one "N homes" marker.
const CLUSTER_RADIUS = 46
// Moves the storefront makes itself carry this, so they never offer "Search this area".
const AUTO = { sfAuto: true }
// The preview card's height plus its gap, kept clear when a chosen home is brought into view.
const PREVIEW_ROOM = 150
const HEART = '<svg class="sf-pin__heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C1 8.6 3 5 6.6 5c2.1 0 3.6 1.1 4.4 2.5h2C13.8 6.1 15.3 5 17.4 5 21 5 23 8.6 21.6 11.8 19.5 16.4 12 21 12 21z"/></svg>'

/** Paints the light base map in the storefront's quiet greens and blues. */
function tintStyle(map: MapLibreMap) {
  const paint: Array<[string, string, string]> = [
    ['background', 'background-color', '#f6f7f3'],
    ['park', 'fill-color', '#e1efdc'],
    ['landcover_wood', 'fill-color', '#e3f0de'],
    ['landuse_residential', 'fill-color', '#f3f4f0'],
    ['water', 'fill-color', '#d6e6ee'],
  ]
  for (const [layer, property, value] of paint) {
    try {
      if (map.getLayer(layer)) map.setPaintProperty(layer, property, value)
    } catch {
      // A layer the style does not have keeps its own colour.
    }
  }
}

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
  // The map controls sit in the top-left corner; keep homes out from under them.
  const controls = canvas?.closest('.sf-map')?.querySelector<HTMLElement>('.sf-map__controls')?.getBoundingClientRect()
  if (controls && controls.width) padding.left = Math.max(padding.left, Math.round(controls.right - rect.left + 12))
  return padding
}

function pinBounds(pins: MapPin[]): LngLatBoundsLike {
  const lng = pins.map(pin => pin.longitude), lat = pins.map(pin => pin.latitude)
  return [[Math.min(...lng), Math.min(...lat)], [Math.max(...lng), Math.max(...lat)]]
}

type Placed = { pin: MapPin; marker: Marker; element: HTMLButtonElement }
type Located = { status: 'idle' | 'finding' | 'found' | 'denied' | 'unavailable' }

/**
 * The map half of the search. Every located home is a price pin; close pins merge into an
 * "N homes · from" marker that zooms in when chosen. Choosing a pin opens a preview card over the map
 * (photo, price, address, facts, heart), lowers the phone sheet to its peek and marks the home's card
 * in the list; the card opens the home. Cards and pins share a highlight on hover and focus.
 *
 * The map is built once. New results move the pins in place: when the shopper has not moved the map
 * it frames the new homes, otherwise it stays put. Where the map stood is kept per page address, so
 * Back returns to the same view. With `searchable`, moving the map offers "Search this area".
 */
export function ListingsMap({ pins, activeId, area = null, searchable = false, signedIn = false, className = '' }: { pins: MapPin[]; activeId?: string; area?: MapArea | null; searchable?: boolean; signedIn?: boolean; className?: string }) {
  const router = useRouter()
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const libRef = useRef<typeof import('maplibre-gl') | null>(null)
  const markers = useRef(new Map<string, Placed>())
  const clusters = useRef<Marker[]>([])
  const clusterOf = useRef(new Map<string, HTMLButtonElement>())
  const pinsRef = useRef(pins)
  const activeRef = useRef(activeId)
  const selectedRef = useRef<string | null>(null)
  // The shopper moved the map since it last framed the homes; new results then keep the view.
  const movedRef = useRef(false)
  const placedKey = useRef('')
  const areaRef = useRef(area ? formatMapArea(area) : '')
  // Only the search map remembers its view for Back; a home's own map always opens on the home.
  const remember = useRef(searchable)
  const youMarker = useRef<Marker | null>(null)
  const [ready, setReady] = useState(false)
  const [tiles, setTiles] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [saved, setSaved] = useState<Record<string, string | null>>({})
  const [failed, setFailed] = useState(false)
  const [offerSearch, setOfferSearch] = useState(false)
  const [located, setLocated] = useState<Located>({ status: 'idle' })
  const key = pins.map(pin => `${pin.id}:${pin.latitude}:${pin.longitude}:${pin.label}`).join('|')
  const areaKey = area ? formatMapArea(area) : ''
  pinsRef.current = pins
  activeRef.current = activeId

  const select = useCallback((id: string | null) => {
    selectedRef.current = id
    setSelected(id)
  }, [])

  // Pins that would still cover each other are raised on a longer stem, so every price stays
  // readable and still points at its own home.
  const spread = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const visible = [...markers.current.values()].filter(({ element }) => !element.hidden)
    const boxes = visible.map(({ pin, marker, element }) => {
      const point = map.project(marker.getLngLat())
      const label = element.firstElementChild as HTMLElement
      return { id: pin.id, x: point.x, y: point.y, width: label.offsetWidth, height: label.offsetHeight + 8 }
    })
    const lifts = pinLifts(boxes)
    visible.forEach(({ pin, element }) => element.style.setProperty('--sf-pin-lift', `${-(lifts[pin.id] || 0)}px`))
  }, [])

  // Choosing a home: its preview opens over the map, the phone sheet lowers to its peek, and its card is
  // marked (and scrolled to) in the list. The home is brought into the open part of the map.
  const choose = useCallback((pin: MapPin) => {
    const map = mapRef.current
    if (pin.id === activeRef.current) return
    select(pin.id)
    setHovered(pin.id)
    const phone = sheetLayout()
    if (phone && box.current?.closest('.sf-split[data-variant="results"]')) requestSheetSnap('peek')
    requestShowListing(pin.id, true)
    if (!phone) listingCard(pin.id)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' })
    if (!map || !box.current) return
    const size = { width: box.current.clientWidth, height: box.current.clientHeight }
    const cover = (phone && box.current.closest('.sf-split[data-variant="results"]') ? SHEET_PEEK : 0) + PREVIEW_ROOM
    const point = map.project([pin.longitude, pin.latitude])
    if (inClearArea(point, size, cover)) return
    const clearMiddle = (size.height - cover) / 2 + 20
    map.easeTo({ center: [pin.longitude, pin.latitude], offset: [0, clearMiddle - size.height / 2], duration: reducedMotion() ? 0 : 320 }, AUTO)
  }, [select])

  // Close pins merge into one marker; choosing it zooms to them, or opens the first when they share a spot.
  const regroup = useCallback(() => {
    const map = mapRef.current
    const maplibregl = libRef.current
    if (!map || !maplibregl) return
    clusters.current.splice(0).forEach(marker => marker.remove())
    clusterOf.current.clear()
    const placed = markers.current
    const points = [...placed.values()].map(({ pin, marker }) => ({ id: pin.id, ...map.project(marker.getLngLat()) }))
    const atMax = map.getZoom() >= map.getMaxZoom() - 0.5
    for (const ids of groupPins(points, atMax ? 0 : CLUSTER_RADIUS)) {
      const members = ids.map(id => placed.get(id)!)
      const single = members.length === 1 || members.some(member => member.pin.id === activeRef.current || member.pin.id === selectedRef.current)
      members.forEach(member => { member.element.hidden = !single })
      if (single) continue
      const { count, from } = clusterLabel(members.map(member => member.pin))
      const element = document.createElement('button')
      element.type = 'button'
      element.className = 'sf-pin sf-pin--cluster'
      element.setAttribute('aria-label', `${count}${from ? ` from ${from.replace(/\+$/, '')}` : ''}. Zoom in`)
      element.innerHTML = '<span class="sf-pin__label"><b></b><span></span></span>'
      element.querySelector('b')!.textContent = count
      element.querySelector('span span')!.textContent = from ? ` · ${from}` : ''
      element.addEventListener('click', event => {
        event.stopPropagation()
        const spots = new Set(members.map(member => `${member.pin.latitude},${member.pin.longitude}`))
        if (spots.size === 1) return choose(members[0].pin)
        select(null)
        movedRef.current = true
        map.fitBounds(pinBounds(members.map(member => member.pin)), { padding: framePadding(box.current, members.map(member => member.pin)), maxZoom: 17, duration: reducedMotion() ? 0 : 400 }, AUTO)
      })
      const lng = members.reduce((sum, member) => sum + member.pin.longitude, 0) / members.length
      const lat = members.reduce((sum, member) => sum + member.pin.latitude, 0) / members.length
      clusters.current.push(new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(map))
      ids.forEach(id => clusterOf.current.set(id, element))
    }
    spread()
    setHovered(current => current)
  }, [choose, select, spread])

  const frame = useCallback((animate: boolean) => {
    const map = mapRef.current
    const list = pinsRef.current
    if (!map) return
    const duration = animate && !reducedMotion() ? 450 : 0
    if (list.length > 1) map.fitBounds(pinBounds(list), { padding: framePadding(box.current, list), maxZoom: 13, duration }, AUTO)
    else if (list.length === 1) map.easeTo({ center: [list[0].longitude, list[0].latitude], zoom: 13, duration }, AUTO)
  }, [])

  // The map itself, built once per mount.
  useEffect(() => {
    let cancelled = false
    let map: MapLibreMap | null = null
    const placed = markers.current
    const grouped = clusters.current
    import('maplibre-gl').then(({ default: maplibregl }) => {
      if (cancelled || !box.current) return
      libRef.current = maplibregl
      const list = pinsRef.current
      const back = remember.current ? readView(currentEntry()) : null
      try {
        map = new maplibregl.Map({
          container: box.current,
          style: STYLE_URL,
          ...(back ? { center: back.center, zoom: back.zoom } : list.length ? { center: [list[0].longitude, list[0].latitude] as [number, number], zoom: 11 } : EMPTY_VIEW),
          attributionControl: false,
          cooperativeGestures: false,
          dragRotate: false,
          pitchWithRotate: false,
        })
      } catch {
        setFailed(true)
        return
      }
      mapRef.current = map
      map.touchZoomRotate.disableRotation()
      map.keyboard.disableRotation()
      // OpenFreeMap / OpenMapTiles / OpenStreetMap credits stay one tap away; on a phone they sit at the
      // top so the results sheet never covers them.
      map.addControl(new maplibregl.AttributionControl({ compact: true }), sheetLayout() ? 'top-right' : 'bottom-left')
      map.on('style.load', () => map && tintStyle(map))
      map.once('load', () => box.current?.querySelector('.maplibregl-compact-show')?.classList.remove('maplibregl-compact-show'))
      map.once('idle', () => setTiles(true))
      map.on('error', event => { if (!map?.loaded() && String(event?.error?.message || '').includes('style')) setFailed(true) })
      map.on('movestart', event => {
        if ((event as unknown as { sfAuto?: boolean }).sfAuto) return
        movedRef.current = true
        setOfferSearch(true)
      })
      map.on('moveend', () => {
        regroup()
        if (!map || !remember.current) return
        const center = map.getCenter()
        writeView(historyEntry(), { center: [center.lng, center.lat], zoom: map.getZoom(), moved: movedRef.current, selected: selectedRef.current })
      })
      map.on('zoom', spread)
      // A tap on the open map closes the preview.
      map.on('click', () => { select(null); setHovered(null) })

      if (back) {
        movedRef.current = back.moved
        if (back.selected && list.some(pin => pin.id === back.selected)) select(back.selected)
      } else if (areaRef.current) {
        const [west, south, east, north] = areaRef.current.split(',').map(Number)
        map.fitBounds([[west, south], [east, north]], { padding: 0, duration: 0 }, AUTO)
        movedRef.current = true
      } else {
        frame(false)
      }
      setReady(true)
    }).catch(() => setFailed(true))

    return () => {
      cancelled = true
      grouped.splice(0).forEach(marker => marker.remove())
      placed.forEach(({ marker }) => marker.remove())
      placed.clear()
      placedKey.current = ''
      youMarker.current?.remove()
      map?.remove()
      mapRef.current = null
    }
  }, [frame, regroup, select, spread])

  // New results: pins are added, moved and removed in place, and the view follows only if the shopper
  // has not moved the map (or none of the new homes would be in view).
  useEffect(() => {
    const map = mapRef.current
    const maplibregl = libRef.current
    if (!ready || !map || !maplibregl || placedKey.current === key && areaRef.current === areaKey) return
    const pins = pinsRef.current
    const placed = markers.current
    const first = placedKey.current === ''
    const changed = placedKey.current !== key
    placedKey.current = key
    const ids = new Set(pins.map(pin => pin.id))
    for (const [id, { marker }] of placed) if (!ids.has(id)) { marker.remove(); placed.delete(id) }
    for (const pin of pins) {
      const existing = placed.get(pin.id)
      if (existing) {
        existing.pin = pin
        existing.marker.setLngLat([pin.longitude, pin.latitude])
        existing.element.querySelector('.sf-pin__text')!.textContent = pin.label
        continue
      }
      const element = document.createElement('button')
      element.type = 'button'
      element.className = 'sf-pin'
      element.setAttribute('aria-label', `${pin.title}, ${pin.label}`)
      // The current home also gets vega's radar ring on the ground under its pointer.
      element.innerHTML = `<span class="sf-pin__label">${HEART}<span class="sf-pin__text"></span></span>${pin.id === activeRef.current ? '<span class="sf-pin__radar" aria-hidden="true"><i></i></span>' : ''}`
      element.querySelector('.sf-pin__text')!.textContent = pin.label
      element.addEventListener('click', event => { event.stopPropagation(); choose(placed.get(pin.id)?.pin || pin) })
      element.addEventListener('pointerenter', () => setHovered(pin.id))
      element.addEventListener('pointerleave', () => setHovered(current => current === pin.id ? null : current))
      const marker = new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat([pin.longitude, pin.latitude]).addTo(map)
      placed.set(pin.id, { pin, marker, element })
    }
    if (selectedRef.current && !ids.has(selectedRef.current)) select(null)

    const areaChanged = areaRef.current !== areaKey
    areaRef.current = areaKey
    if (!first && changed) {
      const bounds = map.getBounds()
      const inView = pins.filter(pin => bounds.contains([pin.longitude, pin.latitude])).length
      // Clearing the map area always widens the view back out to the homes.
      if (areaChanged && !areaKey) movedRef.current = false
      if (!keepView(movedRef.current, inView)) {
        movedRef.current = false
        frame(true)
      }
    }
    regroup()
  }, [ready, key, areaKey, choose, frame, regroup, select])

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

  useEffect(() => {
    markers.current.forEach(({ pin, element }) => element.toggleAttribute('data-saved', Boolean(savedIdOf(pin))))
  }, [savedIdOf, key, ready])

  // Cards anywhere on the page lift their pin while hovered or focused.
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

  useEffect(() => {
    const lit = new Set<Element>()
    markers.current.forEach(({ element }, id) => {
      const lifted = id === hovered || id === activeId || id === selected
      element.toggleAttribute('data-active', lifted)
      element.toggleAttribute('data-selected', id === selected)
      element.style.zIndex = id === selected ? '4' : lifted ? '3' : ''
      element.setAttribute('aria-current', id === activeId ? 'true' : 'false')
      element.setAttribute('aria-expanded', id === selected ? 'true' : 'false')
      const cluster = clusterOf.current.get(id)
      if (cluster && lifted) lit.add(cluster)
    })
    new Set(clusterOf.current.values()).forEach(cluster => {
      cluster.toggleAttribute('data-active', lit.has(cluster))
      ;(cluster as HTMLElement).style.zIndex = lit.has(cluster) ? '3' : ''
    })
    document.querySelectorAll('[data-listing-card][data-highlight]').forEach(card => card.removeAttribute('data-highlight'))
    const marked = selected || hovered
    if (marked && marked !== activeId) listingCard(marked)?.setAttribute('data-highlight', '')
    // A newly chosen home leaves its cluster.
    if (selected && markers.current.get(selected)?.element.hidden) regroup()
  }, [hovered, selected, activeId, key, ready, regroup])

  const zoom = (delta: number) => mapRef.current?.easeTo({ zoom: (mapRef.current.getZoom() || 0) + delta, duration: 200 })
  const showAll = () => {
    const map = mapRef.current
    if (!map) return
    const active = pins.find(pin => pin.id === activeId)
    movedRef.current = false
    setOfferSearch(false)
    if (active) return map.easeTo({ center: [active.longitude, active.latitude], zoom: 13, duration: 300 }, AUTO)
    frame(true)
  }
  const locate = () => {
    const map = mapRef.current
    const maplibregl = libRef.current
    if (!map || !maplibregl) return
    if (!('geolocation' in navigator)) return setLocated({ status: 'unavailable' })
    setLocated({ status: 'finding' })
    navigator.geolocation.getCurrentPosition(position => {
      const here: [number, number] = [position.coords.longitude, position.coords.latitude]
      if (!youMarker.current) {
        const dot = document.createElement('span')
        dot.className = 'sf-you'
        dot.setAttribute('role', 'img')
        dot.setAttribute('aria-label', 'You are here')
        youMarker.current = new maplibregl.Marker({ element: dot }).setLngLat(here).addTo(map)
      } else youMarker.current.setLngLat(here)
      setLocated({ status: 'found' })
      // A move the shopper asked for: it offers "Search this area" like a drag would.
      map.flyTo({ center: here, zoom: Math.max(map.getZoom(), 13), duration: reducedMotion() ? 0 : 900 })
    }, error => setLocated({ status: error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable' }), { timeout: 10000, maximumAge: 60000 })
  }
  useEffect(() => {
    if (located.status !== 'denied' && located.status !== 'unavailable') return
    const timer = setTimeout(() => setLocated({ status: 'idle' }), 4500)
    return () => clearTimeout(timer)
  }, [located.status])

  const searchHere = () => {
    const map = mapRef.current
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

  const preview = selected ? pins.find(pin => pin.id === selected) || null : null
  const note = located.status === 'denied' ? 'Location is off for this site. Turn it on in your browser to see homes near you.' : located.status === 'unavailable' ? 'Your location could not be found.' : ''

  return (
    <div className={`sf-map ${className}`} data-failed={failed || undefined} data-loading={!tiles && !failed ? '' : undefined} data-previewing={preview ? '' : undefined}>
      <div ref={box} className="sf-map__canvas" role="region" aria-label={pins.length ? `Map of ${pins.length} ${pins.length === 1 ? 'home' : 'homes'}` : 'Map'} />
      {!tiles && !failed ? <p className="sf-map__loading" role="status"><span aria-hidden className="sf-map__spinner" />Loading map</p> : null}
      {failed ? <p className="sf-map__note">The map could not be loaded.</p> : null}
      {note ? <p className="sf-map__note" role="status">{note}</p> : null}
      {searchable && offerSearch && !failed ? (
        <button type="button" className="sf-map__search" onClick={searchHere}><Search aria-hidden />Search this area</button>
      ) : null}
      <div className="sf-map__controls">
        <button type="button" className="sf-map__zoom" onClick={() => zoom(1)} aria-label="Zoom in"><Plus aria-hidden /></button>
        <button type="button" className="sf-map__zoom" onClick={() => zoom(-1)} aria-label="Zoom out"><Minus aria-hidden /></button>
        <button type="button" onClick={locate} aria-label="Show homes near me" aria-busy={located.status === 'finding'} data-on={located.status === 'found' || undefined}><Navigation aria-hidden /></button>
        <button type="button" onClick={showAll} aria-label={activeId ? 'Center on this home' : 'Show all homes'}><Expand aria-hidden /></button>
      </div>
      {preview ? (
        <MapPreview key={preview.id} pin={preview} savedId={savedIdOf(preview)} signedIn={signedIn} onClose={() => { select(null); setHovered(null) }} />
      ) : null}
    </div>
  )
}

/** The chosen home over the map: photo, price, address, facts and the heart. The card opens the home. */
function MapPreview({ pin, savedId, signedIn, onClose }: { pin: MapPin; savedId: string | null; signedIn: boolean; onClose: () => void }) {
  const href = `/listings/${pin.slug}`
  const address = pin.address || pin.title
  return (
    <aside className="sf-preview" aria-label={`${address}, ${pin.priceText || pin.label}`}>
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
