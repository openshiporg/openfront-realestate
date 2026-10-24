'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from 'react'
import { CalendarDays } from 'lucide-react'
import { localDateTimeToIso, SHOWING_HOURS, withinShowingHours, zonedInputValue, zonedWallTimeToIso } from '@/features/lib/date-time'
import { createShowingRequest, type ShowingRequestState } from '@/features/storefront/lib/data/showings'

const initialState: ShowingRequestState = { ok: false, message: '' }

const BROWSER_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone
const HOURS_LABEL = `${SHOWING_HOURS.first} AM to ${SHOWING_HOURS.last - 12} PM`

/** The picked time is the listing's local wall time when its zone is known, otherwise the browser's. */
function toIso(local: string, timeZone: string | null) {
  return timeZone ? zonedWallTimeToIso(local, timeZone) : localDateTimeToIso(local)
}

function timeProblem(local: string, timeZone: string | null, timeZoneName: string) {
  const iso = toIso(local, timeZone)
  if (!iso) return 'Choose a valid time.'
  const start = Date.parse(iso)
  if (start <= Date.now()) return 'Choose a time in the future.'
  if (!withinShowingHours(start, timeZone || BROWSER_ZONE)) return `Choose a time from ${HOURS_LABEL}${timeZoneName ? ` ${timeZoneName}` : ''}.`
  return ''
}

type Prefill = { name: string; email: string; phone: string } | null

export function ShowingRequestForm({ propertyId, customer, accountHref, timeZone = null, timeZoneName = '' }: { propertyId: string; customer: Prefill; accountHref: string; timeZone?: string | null; timeZoneName?: string }) {
  const [state, action, pending] = useActionState(createShowingRequest, initialState)
  const requestKey = useRef('')
  const [showingType, setShowingType] = useState<'in_person' | 'virtual'>('in_person')
  const virtual = showingType === 'virtual'
  const [, startTransition] = useTransition()
  const [problem, setProblem] = useState('')
  const [minTime, setMinTime] = useState<string>()
  const locked = pending || state.uncertain || state.ok

  useEffect(() => { setMinTime(zonedInputValue(Date.now(), timeZone || BROWSER_ZONE)) }, [timeZone])

  // Submitting through a transition (not the form action prop) keeps what the shopper typed when the server refuses it.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const local = String(formData.get('requestedStart') || '')
    const issue = timeProblem(local, timeZone, timeZoneName) || (!String(formData.get('email') || '').trim() && !String(formData.get('phone') || '').trim() ? 'Add an email or phone number.' : '')
    setProblem(issue)
    if (issue) return
    requestKey.current ||= crypto.randomUUID()
    formData.set('idempotencyKey', requestKey.current)
    formData.set('requestedStart', toIso(local, timeZone))
    startTransition(() => action(formData))
  }
  const message = problem || state.message

  return (
    <form onSubmit={submit} onChange={() => { if (problem) setProblem('') }} className="sf-form">
      <h2 className="sr-only">Request a showing</h2>
      <input type="hidden" name="propertyId" value={propertyId} />
      <fieldset disabled={locked} className="sf-form">
        <legend className="sr-only">Showing request details</legend>
        <div className="sf-track sf-track--block" role="radiogroup" aria-label="Visit type">
          <label><input type="radio" name="showingType" value="in_person" checked={!virtual} onChange={() => setShowingType('in_person')} /><span className="sf-track__item">In person</span></label>
          <label><input type="radio" name="showingType" value="virtual" checked={virtual} onChange={() => setShowingType('virtual')} /><span className="sf-track__item">Virtual</span></label>
        </div>
        {virtual ? <p className="sf-hint" style={{ marginTop: 0 }}>Video call. Your advisor emails the link once the time is confirmed.</p> : null}
        <label><span>Preferred time{timeZoneName ? ` (${timeZoneName})` : ''}</span><input className="sf-field" name="requestedStart" type="datetime-local" required min={minTime} aria-describedby="showing-time-hint" /></label>
        <p id="showing-time-hint" className="sf-hint">{HOURS_LABEL}{timeZoneName ? `, ${timeZoneName}` : ''}</p>
        <label><span>Name</span><input className="sf-field" name="name" required autoComplete="name" defaultValue={customer?.name || ''} /></label>
        <div className="sf-form-row">
          <label><span>Email</span><input className="sf-field" name="email" type="email" autoComplete="email" required={virtual} defaultValue={customer?.email || ''} /></label>
          <label><span>Phone</span><input className="sf-field" name="phone" type="tel" autoComplete="tel" defaultValue={customer?.phone || ''} /></label>
        </div>
        <p className="sf-hint">Email or phone required</p>
        <label><span>Notes</span><textarea className="sf-field" name="message" rows={3} /></label>
      </fieldset>
      {message ? <p className={!problem && state.ok ? 'sf-message sf-message--success' : 'sf-message'} role="status">{message}</p> : null}
      <button className="sf-btn sf-btn--primary sf-btn--block" disabled={locked}><CalendarDays aria-hidden /> {pending ? 'Sending…' : state.ok ? 'Request sent' : state.uncertain ? 'Request not confirmed' : 'Request showing'}</button>
      {customer
        ? <Link href="/account" className="sf-link">My showings</Link>
        : <Link href={accountHref} className="sf-link">Sign in to track showings</Link>}
    </form>
  )
}
