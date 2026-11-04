'use client'

import { useEffect, useState } from 'react'
import { ListingsMap, type MapPin } from './ListingsMap'

/**
 * The home's spot and its neighbours, inside the detail page below 64rem, where the side map is not
 * shown. From 64rem the split's own map does this job, so nothing is mounted.
 */
export function LocationMap({ pins, activeId, place, signedIn = false }: { pins: MapPin[]; activeId: string; place: string; signedIn?: boolean }) {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 63.99rem)')
    const sync = () => setPhone(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  if (!phone || !pins.some(pin => pin.id === activeId)) return null
  return (
    <section className="sf-prose sf-location" aria-labelledby="sf-location-title">
      <h2 id="sf-location-title">Location</h2>
      {place ? <p>{place}</p> : null}
      <div className="sf-location__map">
        <ListingsMap pins={pins} activeId={activeId} signedIn={signedIn} />
      </div>
    </section>
  )
}
