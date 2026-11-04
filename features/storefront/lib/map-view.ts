/** Map framing rules shared by the results map. Plain numbers in and out, so they are testable. */

export type Padding = { top: number; bottom: number; left: number; right: number }
export type Rect = { top: number; bottom: number; left: number; right: number; width: number; height: number }

/**
 * Room around the homes when the map fits them. A pin hangs above its point and a price pill reaches
 * out to each side, so the sides keep about half the widest pill clear and the top a pin's height.
 * Whatever covers the map (the phone results sheet from below, the open filters from above) is
 * added, as long as a usable band of map is left between them.
 */
export function fitPadding(map: Rect, cover: { above?: number; below?: number } = {}, pillWidth = 132): Padding {
  const side = Math.round(Math.min(Math.max(pillWidth / 2 + 12, 40), map.width * 0.22))
  const base = { top: 64, bottom: 40, left: side, right: side }
  const above = Math.max(0, cover.above || 0)
  const below = Math.max(0, cover.below || 0)
  const top = above ? Math.max(base.top, above + 56) : base.top
  const bottom = below ? Math.max(base.bottom, below + 28) : base.bottom
  // Too little map left between the covers: fall back to the plain frame rather than a sliver.
  if (map.height - top - bottom < 120) return base
  return { ...base, top, bottom }
}

/**
 * After the results change, does the map stay where the shopper left it? It stays when they moved it
 * themselves and at least one of the new homes is still in view; otherwise it frames the new homes.
 */
export function keepView(movedByShopper: boolean, inView: number) {
  return movedByShopper && inView > 0
}

/**
 * Whether a point sits in the clear part of the map: inside it with `margin` to spare and above
 * whatever covers its foot (the preview card and the lowered sheet).
 */
export function inClearArea(point: { x: number; y: number }, size: { width: number; height: number }, coveredBelow: number, margin = 48) {
  return point.x >= margin && point.x <= size.width - margin && point.y >= margin + 24 && point.y <= size.height - coveredBelow - margin / 2
}
