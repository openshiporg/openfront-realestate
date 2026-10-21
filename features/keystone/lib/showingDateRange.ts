export type ShowingDateRange = { gte?: string; lt?: string } | null

/** Board ranges use UTC because no brokerage timezone is configured in source. */
export function showingDateRange(range: string, now = new Date()): ShowingDateRange {
  const start = new Date(now)
  start.setUTCHours(0, 0, 0, 0)

  if (range === 'upcoming') return { gte: now.toISOString() }
  if (range === 'past') return { lt: start.toISOString() }
  if (!range || range === 'all') return null

  const end = new Date(start)
  if (range === 'today') end.setUTCDate(end.getUTCDate() + 1)
  else if (range === 'week') end.setUTCDate(end.getUTCDate() + 7)
  else if (range === 'month') end.setUTCDate(end.getUTCDate() + 30)
  else return { gte: start.toISOString() }

  return { gte: start.toISOString(), lt: end.toISOString() }
}
