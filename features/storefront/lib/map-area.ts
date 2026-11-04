/** A map rectangle a shopper searched ("Search this area"): west, south, east, north in degrees. */
export type MapArea = { west: number; south: number; east: number; north: number }

const round = (value: number) => Math.round(value * 1e5) / 1e5

/** Reads `bounds=w,s,e,n` from a URL; anything malformed or inverted is ignored, so a bad link widens the search. */
export function parseMapArea(value?: string | null): MapArea | null {
  const parts = String(value || '').split(',').map(part => part.trim())
  if (parts.length !== 4 || parts.some(part => !/^-?\d{1,3}(?:\.\d{1,7})?$/.test(part))) return null
  const [west, south, east, north] = parts.map(Number)
  if (![west, east].every(lng => lng >= -180 && lng <= 180) || ![south, north].every(lat => lat >= -90 && lat <= 90)) return null
  if (west >= east || south >= north) return null
  return { west, south, east, north }
}

export function formatMapArea(area: MapArea) {
  return [area.west, area.south, area.east, area.north].map(round).join(',')
}
