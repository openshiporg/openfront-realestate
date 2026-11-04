/** Where the phone results sheet rests: a peek of the list, half the screen, or the whole list. */
export type Snap = 'peek' | 'half' | 'full'

/** Lowest to highest. */
export const SNAPS: Snap[] = ['peek', 'half', 'full']

/** A release faster than this (px/ms) carries on to the next snap instead of the nearest. */
export const FLICK_VELOCITY = 0.4

/** The sheet's downward offset at each snap, for a sheet `height` px tall that keeps `peek` px when lowest. */
export function snapOffsets(height: number, peek: number): Record<Snap, number> {
  return { full: 0, half: Math.round(height / 2), peek: Math.max(0, Math.round(height - peek)) }
}

/**
 * The snap a released drag settles on. `offset` is where the sheet was let go, `velocity` its speed in
 * px/ms (positive = moving down), `start` where the drag began. The nearest snap wins, except that a
 * flick always leaves the snap it started from: one stop in its direction.
 */
export function releaseSnap(offsets: Record<Snap, number>, offset: number, velocity: number, start = offset): Snap {
  const nearest = SNAPS.reduce((best, snap) => Math.abs(offsets[snap] - offset) < Math.abs(offsets[best] - offset) ? snap : best)
  if (Math.abs(velocity) <= FLICK_VELOCITY) return nearest
  const up = velocity < 0
  const moved = up ? offsets[nearest] < start - 1 : offsets[nearest] > start + 1
  return moved ? nearest : stepSnap(nearest, up ? 1 : -1)
}

/** One step up or down from a snap (keyboard, the handle). */
export function stepSnap(snap: Snap, direction: 1 | -1): Snap {
  return SNAPS[Math.min(SNAPS.length - 1, Math.max(0, SNAPS.indexOf(snap) + direction))]
}

/** Past the ends the sheet follows the finger with growing resistance. */
export function rubberBand(offset: number, min: number, max: number) {
  if (offset < min) return min - Math.sqrt(min - offset) * 2
  if (offset > max) return max + Math.sqrt(offset - max) * 2
  return offset
}
