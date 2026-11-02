/** The time a buyer should see: the showing's current slot, plus the original ask when an advisor moved it. */
export function customerShowingTime(showing: { scheduledStart: string; requestedStart: string }) {
  const current = Date.parse(showing.scheduledStart), asked = Date.parse(showing.requestedStart)
  const start = Number.isFinite(current) ? showing.scheduledStart : showing.requestedStart
  const movedFrom = Number.isFinite(current) && Number.isFinite(asked) && current !== asked ? showing.requestedStart : null
  return { start, movedFrom }
}
