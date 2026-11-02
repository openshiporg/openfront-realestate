/** A pin's label box on screen, anchored at the bottom centre (the home's point). */
export type PinBox = { id: string; x: number; y: number; width: number; height: number }

const GAP = 4

function overlaps(a: { left: number; right: number; top: number; bottom: number }, b: { left: number; right: number; top: number; bottom: number }) {
  return a.left < b.right + GAP && b.left < a.right + GAP && a.top < b.bottom + GAP && b.top < a.bottom + GAP
}

/**
 * Vertical lifts (in px, 0 or negative) that keep price pins from covering each other. Pins are
 * placed in order of their point, lowest first; a pin that would land on one already placed is
 * raised just above it, so its pointer still drops to its own home.
 */
export function pinLifts(boxes: PinBox[]): Record<string, number> {
  const placed: Array<{ left: number; right: number; top: number; bottom: number }> = []
  const lifts: Record<string, number> = {}
  const order = [...boxes].sort((a, b) => b.y - a.y || a.x - b.x || a.id.localeCompare(b.id))
  for (const box of order) {
    let lift = 0
    const rect = () => ({ left: box.x - box.width / 2, right: box.x + box.width / 2, top: box.y - box.height + lift, bottom: box.y + lift })
    for (let tries = 0; tries < boxes.length; tries++) {
      const hit = placed.find(other => overlaps(rect(), other))
      if (!hit) break
      lift = hit.top - GAP - box.y
    }
    placed.push(rect())
    lifts[box.id] = Math.round(lift)
  }
  return lifts
}
