import { showingInterval } from './showingPolicy'

export const RESCHEDULABLE_SHOWING_STATUSES = ['requested', 'scheduled'] as const

type ShowingTimes = { status: string; scheduledStart: string | null; scheduledEnd: string | null }

/**
 * Plans moving an open showing to a new start. Keeps the visit's current length (one hour
 * when it has no end), keeps the status, and refuses closed showings and no-op moves.
 * Slot conflicts are checked by the caller under the brokerage lock.
 */
export function planShowingReschedule(showing: ShowingTimes, nextStart: string, now = Date.now()):
  { ok: true; scheduledStart: string; scheduledEnd: string; durationMinutes: number } | { ok: false; message: string } {
  if (!(RESCHEDULABLE_SHOWING_STATUSES as readonly string[]).includes(showing.status)) {
    return { ok: false, message: `A ${showing.status.replace('_', ' ')} showing can't be rescheduled.` }
  }
  const start = Date.parse(showing.scheduledStart || ''), end = Date.parse(showing.scheduledEnd || '')
  const current = Number.isFinite(start) && Number.isFinite(end) && end > start ? Math.round((end - start) / 60_000) : 60
  const durationMinutes = Math.min(240, Math.max(15, current))
  let interval
  try {
    interval = showingInterval(nextStart, durationMinutes, now)
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Choose a valid showing time.' }
  }
  if (Number.isFinite(start) && Date.parse(interval.scheduledStart) === start) return { ok: false, message: 'Choose a different time to reschedule.' }
  return { ok: true, ...interval, durationMinutes }
}
