/** Convert a datetime-local value in the browser's timezone, before server submission. */
export function localDateTimeToIso(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return ''
  const [, year, month, day, hour, minute] = match.map(Number)
  const date = new Date(year, month - 1, day, hour, minute)
  // Reject invalid dates and DST gaps instead of silently moving the requested time.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute) return ''
  return date.toISOString()
}

/** Keystone DateTime arguments arrive as Date instances, not always strings. */
export function commandText(value: unknown): string {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : ''
  return String(value ?? '').trim()
}

/** Server boundaries must never guess a timezone for a bare datetime-local string. */
export function explicitDateTimeToIso(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return ''
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time).toISOString() : ''
}
