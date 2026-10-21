'use client'

import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

const DEFAULT_OPTIONS: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }

/** Formats a timestamp in the viewer's own time zone once the page is running in the browser. */
export function LocalDateTime({ value, options = DEFAULT_OPTIONS, className }: { value: string | null | undefined; options?: Intl.DateTimeFormatOptions; className?: string }) {
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot)
  if (!value) return <span className={className}>—</span>
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return <span className={className}>—</span>
  const showsTime = Boolean(options.timeStyle || options.hour || options.minute)
  const formatOptions: Intl.DateTimeFormatOptions = hydrated
    ? options
    : { ...options, timeZone: 'UTC', ...(showsTime && !options.timeStyle ? { timeZoneName: 'short' } : {}) }
  const text = new Intl.DateTimeFormat('en-US', formatOptions).format(date)
  return <time dateTime={date.toISOString()} className={className} suppressHydrationWarning>{text}{!hydrated && showsTime && options.timeStyle ? ' UTC' : ''}</time>
}
