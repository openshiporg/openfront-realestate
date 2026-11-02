'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LocateFixed, Minus, Plus } from 'lucide-react'
import type { Map as MapLibreMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { pinLifts } from '../lib/pin-layout'

export type MapPin = { id: string; slug: string; latitude: number; longitude: number; label: string; title: string }

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'
// With no located homes the map opens on the continental US instead of an arbitrary city.
const EMPTY_VIEW = { center: [-98.5, 39.5] as [number, number], zoom: 3 }

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

/**
 * The map half of the search: every located home as a price pin. Hovering or focusing a result card
 * (anything carrying data-listing-id) lifts its pin; choosing a pin scrolls to that card, or opens
 * the home when its card is not on the page.
 */
export function ListingsMap({ pins, activeId, className = '' }: { pins: MapPin[]; activeId?: string; className?: string }) {
  const router = useRouter()
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markers = useRef(new Map<string, { marker: Marker; element: HTMLButtonElement }>())
  const [hovered, setHovered] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const key = pins.map(pin => `${pin.id}:${pin.latitude}:${pin.longitude}:${pin.label}`).join('|')

  useEffect(() => {
    let cancelled = false
    let map: MapLibreMap | null = null
    const placed = markers.current
    import('maplibre-gl').then(({ default: maplibregl }) => {
      if (cancelled || !box.current) return
      try {
        map = new maplibregl.Map({
          container: box.current,
          style: STYLE_URL,
          ...(pins.length ? { center: [pins[0].longitude, pins[0].latitude] as [number, number], zoom: 11 } : EMPTY_VIEW),
          attributionControl: { compact: true },
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
      map.on('style.load', () => map && tintStyle(map))
      // On a phone the credits sit behind the (i) button instead of across the result cards.
      if (window.matchMedia('(max-width: 39.99rem)').matches) {
        map.once('load', () => box.current?.querySelector('.maplibregl-compact-show')?.classList.remove('maplibregl-compact-show'))
      }
      map.on('error', event => { if (!map?.loaded() && String(event?.error?.message || '').includes('style')) setFailed(true) })

      for (const pin of pins) {
        const element = document.createElement('button')
        element.type = 'button'
        element.className = 'sf-pin'
        element.setAttribute('aria-label', `${pin.title}, ${pin.label}`)
        element.innerHTML = `<span class="sf-pin__label"></span>`
        element.firstElementChild!.textContent = pin.label
        element.addEventListener('click', event => {
          event.stopPropagation()
          const card = document.querySelector<HTMLElement>(`[data-listing-card="${CSS.escape(pin.id)}"]`)
          if (card && pin.id !== activeId) {
            card.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
            card.querySelector<HTMLElement>('a[href]')?.focus({ preventScroll: true })
          } else if (pin.id !== activeId) {
            router.push(`/listings/${pin.slug}`)
          }
        })
        const marker = new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat([pin.longitude, pin.latitude]).addTo(map)
        placed.set(pin.id, { marker, element })
      }

      // Pins that would cover each other are raised on a longer stem, so every price stays readable
      // and still points at its own home. Re-run whenever the view changes.
      const spread = () => {
        if (!map) return
        const boxes = [...placed.entries()].map(([id, { marker, element }]) => {
          const point = map!.project(marker.getLngLat())
          const label = element.firstElementChild as HTMLElement
          return { id, x: point.x, y: point.y, width: label.offsetWidth, height: label.offsetHeight + 8 }
        })
        const lifts = pinLifts(boxes)
        placed.forEach(({ element }, id) => element.style.setProperty('--sf-pin-lift', `${-(lifts[id] || 0)}px`))
      }
      map.on('load', spread)
      map.on('moveend', spread)
      map.on('zoom', spread)

      if (pins.length > 1) {
        const bounds = new maplibregl.LngLatBounds()
        for (const pin of pins) bounds.extend([pin.longitude, pin.latitude])
        map.fitBounds(bounds, { padding: { top: 90, bottom: 60, left: 60, right: 60 }, maxZoom: 13, duration: 0 })
      } else if (pins.length === 1) {
        map.jumpTo({ center: [pins[0].longitude, pins[0].latitude], zoom: 13 })
      }
    }).catch(() => setFailed(true))

    return () => {
      cancelled = true
      placed.forEach(({ marker }) => marker.remove())
      placed.clear()
      map?.remove()
      mapRef.current = null
    }
    // pins are captured by `key`; router and activeId changes do not rebuild the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Cards anywhere on the page lift their pin while hovered or focused.
  useEffect(() => {
    const over = (event: Event) => {
      const card = (event.target as HTMLElement | null)?.closest?.<HTMLElement>('[data-listing-card]')
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
    markers.current.forEach(({ element }, id) => {
      const lifted = id === hovered || id === activeId
      element.toggleAttribute('data-active', lifted)
      element.style.zIndex = lifted ? '3' : ''
      element.setAttribute('aria-current', id === activeId ? 'true' : 'false')
    })
  }, [hovered, activeId, key])

  const zoom = (delta: number) => mapRef.current?.easeTo({ zoom: (mapRef.current.getZoom() || 0) + delta, duration: 200 })
  const recenter = () => {
    const map = mapRef.current
    if (!map) return
    const active = pins.find(pin => pin.id === activeId)
    if (active) return map.easeTo({ center: [active.longitude, active.latitude], zoom: 13, duration: 300 })
    if (pins.length) {
      const lng = pins.map(pin => pin.longitude), lat = pins.map(pin => pin.latitude)
      map.fitBounds([[Math.min(...lng), Math.min(...lat)], [Math.max(...lng), Math.max(...lat)]], { padding: 60, maxZoom: 13, duration: 300 })
    }
  }

  return (
    <div className={`sf-map ${className}`} data-failed={failed || undefined}>
      <div ref={box} className="sf-map__canvas" role="region" aria-label={pins.length ? `Map of ${pins.length} ${pins.length === 1 ? 'home' : 'homes'}` : 'Map'} />
      {failed ? <p className="sf-map__note">The map could not be loaded.</p> : null}
      <div className="sf-map__controls">
        <button type="button" onClick={() => zoom(1)} aria-label="Zoom in"><Plus aria-hidden /></button>
        <button type="button" onClick={() => zoom(-1)} aria-label="Zoom out"><Minus aria-hidden /></button>
        <button type="button" onClick={recenter} aria-label={activeId ? 'Center on this home' : 'Show all homes'}><LocateFixed aria-hidden /></button>
      </div>
    </div>
  )
}
