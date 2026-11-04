'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LocateFixed, Minus, Plus, Search } from 'lucide-react'
import type { LngLatBoundsLike, Map as MapLibreMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { pinLifts } from '../lib/pin-layout'
import { clusterLabel, groupPins } from '../lib/map-clusters'
import { formatMapArea, type MapArea } from '../lib/map-area'
import { listingCard, reducedMotion, requestShowListing } from '../lib/map-events'

export type MapPin = { id: string; slug: string; latitude: number; longitude: number; label: string; title: string; price?: number; rent?: boolean }

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'
// With no located homes the map opens on the continental US instead of an arbitrary city.
const EMPTY_VIEW = { center: [-98.5, 39.5] as [number, number], zoom: 3 }
// Pins whose points fall closer than this on screen merge into one "N homes" marker.
const CLUSTER_RADIUS = 46
// Moves the storefront makes itself carry this, so they never offer "Search this area".
const AUTO = { sfAuto: true }
const PHONE = '(max-width: 63.99rem)'

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

/** Room around the homes when fitting them in view, keeping clear of the phone results sheet. */
function openPadding(canvas: HTMLElement | null) {
  const padding = { top: 72, bottom: 56, left: 56, right: 56 }
  const map = canvas?.getBoundingClientRect()
  const sheet = canvas?.closest('.sf-split')?.querySelector<HTMLElement>('.sf-sheet[data-live]')
  if (!map || !sheet || !map.height) return padding
  const covered = map.bottom - sheet.getBoundingClientRect().top
  if (covered > 0 && covered < map.height - 160) return { top: 64, bottom: covered + 40, left: 40, right: 40 }
  return padding
}

function pinBounds(pins: MapPin[]): LngLatBoundsLike {
  const lng = pins.map(pin => pin.longitude), lat = pins.map(pin => pin.latitude)
  return [[Math.min(...lng), Math.min(...lat)], [Math.max(...lng), Math.max(...lat)]]
}

type Placed = { pin: MapPin; marker: Marker; element: HTMLButtonElement }

/**
 * The map half of the search: every located home as a price pin, close pins merged into an
 * "N homes · from" marker that zooms in when chosen. Cards and pins share a highlight: hovering or
 * focusing a card (anything with data-listing-card) lifts its pin, hovering a pin marks its card.
 * Choosing a pin brings its card into view (the phone sheet rises to it) or opens the home.
 * With `searchable`, moving the map offers "Search this area", which reruns the search inside it.
 */
export function ListingsMap({ pins, activeId, area = null, searchable = false, className = '' }: { pins: MapPin[]; activeId?: string; area?: MapArea | null; searchable?: boolean; className?: string }) {
  const router = useRouter()
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markers = useRef(new Map<string, Placed>())
  const clusterOf = useRef(new Map<string, HTMLButtonElement>())
  const [hovered, setHovered] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [moved, setMoved] = useState(false)
  const key = pins.map(pin => `${pin.id}:${pin.latitude}:${pin.longitude}:${pin.label}`).join('|')
  const areaKey = area ? formatMapArea(area) : ''

  useEffect(() => {
    let cancelled = false
    let map: MapLibreMap | null = null
    const placed = markers.current
    const clusters: Marker[] = []
    setMoved(false)
    import('maplibre-gl').then(({ default: maplibregl }) => {
      if (cancelled || !box.current) return
      const phone = window.matchMedia(PHONE).matches
      try {
        map = new maplibregl.Map({
          container: box.current,
          style: STYLE_URL,
          ...(pins.length ? { center: [pins[0].longitude, pins[0].latitude] as [number, number], zoom: 11 } : EMPTY_VIEW),
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
      // OpenFreeMap / OpenMapTiles / OpenStreetMap credits stay one tap away; on a phone they sit at the
      // top so the results sheet never covers them.
      map.addControl(new maplibregl.AttributionControl({ compact: true }), phone ? 'top-right' : 'bottom-left')
      map.on('style.load', () => map && tintStyle(map))
      map.once('load', () => box.current?.querySelector('.maplibregl-compact-show')?.classList.remove('maplibregl-compact-show'))
      map.on('error', event => { if (!map?.loaded() && String(event?.error?.message || '').includes('style')) setFailed(true) })
      map.on('movestart', event => { if (!(event as unknown as { sfAuto?: boolean }).sfAuto) setMoved(true) })

      const choose = (pin: MapPin) => {
        if (pin.id === activeId) return
        if (!listingCard(pin.id)) return router.push(`/listings/${pin.slug}`)
        setHovered(pin.id)
        if (requestShowListing(pin.id)) {
          // The sheet rose over the lower half: keep the chosen home in the open part above it.
          map?.easeTo({ center: [pin.longitude, pin.latitude], offset: [0, -(box.current?.clientHeight || 0) / 4], duration: reducedMotion() ? 0 : 300 }, AUTO)
          return
        }
        const card = listingCard(pin.id)!
        card.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' })
        card.querySelector<HTMLElement>('a[href]')?.focus({ preventScroll: true })
      }

      for (const pin of pins) {
        const element = document.createElement('button')
        element.type = 'button'
        element.className = 'sf-pin'
        element.setAttribute('aria-label', `${pin.title}, ${pin.label}`)
        // The current home also gets vega's radar ring on the ground under its pointer.
        element.innerHTML = `<span class="sf-pin__label"></span>${pin.id === activeId ? '<span class="sf-pin__radar" aria-hidden="true"><i></i></span>' : ''}`
        element.firstElementChild!.textContent = pin.label
        element.addEventListener('click', event => { event.stopPropagation(); choose(pin) })
        element.addEventListener('pointerenter', () => setHovered(pin.id))
        element.addEventListener('pointerleave', () => setHovered(current => current === pin.id ? null : current))
        const marker = new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat([pin.longitude, pin.latitude]).addTo(map)
        placed.set(pin.id, { pin, marker, element })
      }

      // Close pins merge into one marker; choosing it zooms to them, or lists them when they share a spot.
      const regroup = () => {
        if (!map) return
        clusters.splice(0).forEach(marker => marker.remove())
        clusterOf.current.clear()
        const points = [...placed.values()].map(({ pin, marker }) => ({ id: pin.id, ...map!.project(marker.getLngLat()) }))
        const atMax = map.getZoom() >= map.getMaxZoom() - 0.5
        for (const ids of groupPins(points, atMax ? 0 : CLUSTER_RADIUS)) {
          const members = ids.map(id => placed.get(id)!)
          const single = members.length === 1 || members.some(member => member.pin.id === activeId)
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
            map?.fitBounds(pinBounds(members.map(member => member.pin)), { padding: openPadding(box.current), maxZoom: 17, duration: reducedMotion() ? 0 : 400 })
          })
          const lng = members.reduce((sum, member) => sum + member.pin.longitude, 0) / members.length
          const lat = members.reduce((sum, member) => sum + member.pin.latitude, 0) / members.length
          clusters.push(new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(map))
          ids.forEach(id => clusterOf.current.set(id, element))
        }
        spread()
        setHovered(current => current)
      }

      // Pins that would still cover each other are raised on a longer stem, so every price stays
      // readable and still points at its own home.
      const spread = () => {
        if (!map) return
        const visible = [...placed.values()].filter(({ element }) => !element.hidden)
        const boxes = visible.map(({ pin, marker, element }) => {
          const point = map!.project(marker.getLngLat())
          const label = element.firstElementChild as HTMLElement
          return { id: pin.id, x: point.x, y: point.y, width: label.offsetWidth, height: label.offsetHeight + 8 }
        })
        const lifts = pinLifts(boxes)
        visible.forEach(({ pin, element }) => element.style.setProperty('--sf-pin-lift', `${-(lifts[pin.id] || 0)}px`))
      }
      map.on('load', regroup)
      map.on('moveend', regroup)
      map.on('zoom', spread)

      if (area) {
        map.fitBounds([[area.west, area.south], [area.east, area.north]], { padding: 0, duration: 0 }, AUTO)
      } else if (pins.length > 1) {
        map.fitBounds(pinBounds(pins), { padding: openPadding(box.current), maxZoom: 13, duration: 0 }, AUTO)
      } else if (pins.length === 1) {
        map.jumpTo({ center: [pins[0].longitude, pins[0].latitude], zoom: 13 }, AUTO)
      }
    }).catch(() => setFailed(true))

    return () => {
      cancelled = true
      clusters.forEach(marker => marker.remove())
      placed.forEach(({ marker }) => marker.remove())
      placed.clear()
      map?.remove()
      mapRef.current = null
    }
    // pins are captured by `key`; router and activeId changes do not rebuild the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, areaKey])

  // Cards anywhere on the page lift their pin while hovered or focused.
  useEffect(() => {
    const over = (event: Event) => {
      // A finger has no hover: a tap must not clear the home a pin just chose.
      if ((event as PointerEvent).pointerType === 'touch') return
      const target = event.target as HTMLElement | null
      if (target?.closest?.('.sf-pin')) return
      const card = target?.closest?.<HTMLElement>('[data-listing-card]')
      setHovered(card?.dataset.listingCard || null)
    }
    document.addEventListener('pointerover', over)
    document.addEventListener('focusin', over)
    return () => {
      document.removeEventListener('pointerover', over)
      document.removeEventListener('focusin', over)
    }
  }, [])

  useEffect(() => {
    const lit = new Set<Element>()
    markers.current.forEach(({ element }, id) => {
      const lifted = id === hovered || id === activeId
      element.toggleAttribute('data-active', lifted)
      element.style.zIndex = lifted ? '3' : ''
      element.setAttribute('aria-current', id === activeId ? 'true' : 'false')
      const cluster = clusterOf.current.get(id)
      if (cluster && lifted) lit.add(cluster)
    })
    new Set(clusterOf.current.values()).forEach(cluster => {
      cluster.toggleAttribute('data-active', lit.has(cluster))
      ;(cluster as HTMLElement).style.zIndex = lit.has(cluster) ? '3' : ''
    })
    document.querySelectorAll('[data-listing-card][data-highlight]').forEach(card => card.removeAttribute('data-highlight'))
    if (hovered && hovered !== activeId) listingCard(hovered)?.setAttribute('data-highlight', '')
  }, [hovered, activeId, key])

  const zoom = (delta: number) => mapRef.current?.easeTo({ zoom: (mapRef.current.getZoom() || 0) + delta, duration: 200 })
  const recenter = () => {
    const map = mapRef.current
    if (!map) return
    const active = pins.find(pin => pin.id === activeId)
    if (active) return map.easeTo({ center: [active.longitude, active.latitude], zoom: 13, duration: 300 })
    if (pins.length) map.fitBounds(pinBounds(pins), { padding: openPadding(box.current), maxZoom: 13, duration: 300 })
  }
  const searchHere = () => {
    const map = mapRef.current
    if (!map) return
    const view = map.getBounds()
    const next = new URLSearchParams(window.location.pathname === '/listings' ? window.location.search : '')
    next.delete('skip')
    next.set('bounds', formatMapArea({ west: view.getWest(), south: view.getSouth(), east: view.getEast(), north: view.getNorth() }))
    setMoved(false)
    router.push(`/listings?${next.toString()}`, { scroll: false })
  }

  return (
    <div className={`sf-map ${className}`} data-failed={failed || undefined}>
      <div ref={box} className="sf-map__canvas" role="region" aria-label={pins.length ? `Map of ${pins.length} ${pins.length === 1 ? 'home' : 'homes'}` : 'Map'} />
      {failed ? <p className="sf-map__note">The map could not be loaded.</p> : null}
      {searchable && moved && !failed ? (
        <button type="button" className="sf-map__search" onClick={searchHere}><Search aria-hidden />Search this area</button>
      ) : null}
      <div className="sf-map__controls">
        <button type="button" onClick={() => zoom(1)} aria-label="Zoom in"><Plus aria-hidden /></button>
        <button type="button" onClick={() => zoom(-1)} aria-label="Zoom out"><Minus aria-hidden /></button>
        <button type="button" onClick={recenter} aria-label={activeId ? 'Center on this home' : 'Show all homes'}><LocateFixed aria-hidden /></button>
      </div>
    </div>
  )
}
