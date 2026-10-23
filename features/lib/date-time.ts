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

// Primary IANA zone for each US state; listings are read in their own local time.
const STATE_TIME_ZONES: Record<string, string> = {
  AL: 'America/Chicago', AK: 'America/Anchorage', AZ: 'America/Phoenix', AR: 'America/Chicago', CA: 'America/Los_Angeles',
  CO: 'America/Denver', CT: 'America/New_York', DE: 'America/New_York', DC: 'America/New_York', FL: 'America/New_York',
  GA: 'America/New_York', HI: 'Pacific/Honolulu', ID: 'America/Boise', IL: 'America/Chicago', IN: 'America/Indiana/Indianapolis',
  IA: 'America/Chicago', KS: 'America/Chicago', KY: 'America/New_York', LA: 'America/Chicago', ME: 'America/New_York',
  MD: 'America/New_York', MA: 'America/New_York', MI: 'America/Detroit', MN: 'America/Chicago', MS: 'America/Chicago',
  MO: 'America/Chicago', MT: 'America/Denver', NE: 'America/Chicago', NV: 'America/Los_Angeles', NH: 'America/New_York',
  NJ: 'America/New_York', NM: 'America/Denver', NY: 'America/New_York', NC: 'America/New_York', ND: 'America/Chicago',
  OH: 'America/New_York', OK: 'America/Chicago', OR: 'America/Los_Angeles', PA: 'America/New_York', RI: 'America/New_York',
  SC: 'America/New_York', SD: 'America/Chicago', TN: 'America/Chicago', TX: 'America/Chicago', UT: 'America/Denver',
  VT: 'America/New_York', VA: 'America/New_York', WA: 'America/Los_Angeles', WV: 'America/New_York', WI: 'America/Chicago',
  WY: 'America/Denver', PR: 'America/Puerto_Rico',
}

/** Showing requests are accepted from 8:00 to 20:00 in the listing's local time. */
export const SHOWING_HOURS = { first: 8, last: 20 } as const

export function stateTimeZone(state?: string | null): string | null {
  return STATE_TIME_ZONES[String(state || '').trim().toUpperCase()] || null
}

function zonedParts(time: number, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(time)).map(part => [part.type, part.value]))
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute) }
}

/** A `YYYY-MM-DDTHH:mm` value for `<input type="datetime-local">`, as wall time in `timeZone`. */
export function zonedInputValue(time: number, timeZone: string) {
  const p = zonedParts(time, timeZone)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

/** Reads a datetime-local value as wall time in `timeZone`; '' for malformed values and DST gaps. */
export function zonedWallTimeToIso(value: string, timeZone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return ''
  const [, year, month, day, hour, minute] = match.map(Number)
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  const offsetAt = (time: number) => {
    const p = zonedParts(time, timeZone)
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(time / 60_000) * 60_000
  }
  let time = wall - offsetAt(wall)
  time = wall - offsetAt(time)
  return zonedInputValue(time, timeZone) === value ? new Date(time).toISOString() : ''
}

export function withinShowingHours(time: number, timeZone: string) {
  const p = zonedParts(time, timeZone)
  const minutes = p.hour * 60 + p.minute
  return minutes >= SHOWING_HOURS.first * 60 && minutes <= SHOWING_HOURS.last * 60
}

/** "Central Time"-style label for a zone. */
export function timeZoneLabel(timeZone: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longGeneric' }).formatToParts(new Date()).find(part => part.type === 'timeZoneName')?.value || timeZone
}
