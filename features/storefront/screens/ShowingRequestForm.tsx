'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from 'react'
import { CalendarDays } from 'lucide-react'
import { localDateTimeToIso } from '@/features/lib/date-time'
import { createShowingRequest, type ShowingRequestState } from '@/features/storefront/lib/data/showings'

const initialState: ShowingRequestState = { ok: false, message: '' }

// Requests outside these local hours are refused before they reach an advisor.
const FIRST_HOUR = 8
const LAST_HOUR = 20

function localInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function timeProblem(local: string) {
  const iso = localDateTimeToIso(local)
  if (!iso) return 'Choose a valid time.'
  const start = new Date(iso)
  if (start.getTime() <= Date.now()) return 'Choose a time in the future.'
  const minutes = start.getHours() * 60 + start.getMinutes()
  if (minutes < FIRST_HOUR * 60 || minutes > LAST_HOUR * 60) return 'Choose a time between 8 AM and 8 PM.'
  return ''
}

type Prefill = { name: string; email: string; phone: string } | null

export function ShowingRequestForm({ propertyId, customer, accountHref }: { propertyId: string; customer: Prefill; accountHref: string }) {
  const [state, action, pending] = useActionState(createShowingRequest, initialState)
  const requestKey = useRef('')
  const [showingType, setShowingType] = useState<'in_person' | 'virtual'>('in_person')
  const virtual = showingType === 'virtual'
  const [, startTransition] = useTransition()
  const [problem, setProblem] = useState('')
  const [minTime, setMinTime] = useState<string>()
  const locked = pending || state.uncertain || state.ok

  useEffect(() => { setMinTime(localInputValue(new Date())) }, [])

  // Submitting through a transition (not the form action prop) keeps what the shopper typed when the server refuses it.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const local = String(formData.get('requestedStart') || '')
    const issue = timeProblem(local) || (!String(formData.get('email') || '').trim() && !String(formData.get('phone') || '').trim() ? 'Add an email or phone number.' : '')
    setProblem(issue)
    if (issue) return
    requestKey.current ||= crypto.randomUUID()
    formData.set('idempotencyKey', requestKey.current)
    formData.set('requestedStart', localDateTimeToIso(local))
    startTransition(() => action(formData))
  }
  const message = problem || state.message

  return (
    <form onSubmit={submit} className="sf-form">
      <h2 className="sr-only">Request a showing</h2>
      <input type="hidden" name="propertyId" value={propertyId} />
      <fieldset disabled={locked} className="sf-form">
        <legend className="sr-only">Showing request details</legend>
        <div className="sf-track sf-track--block" role="radiogroup" aria-label="Visit type">
          <label><input type="radio" name="showingType" value="in_person" checked={!virtual} onChange={() => setShowingType('in_person')} /><span className="sf-track__item">In person</span></label>
          <label><input type="radio" name="showingType" value="virtual" checked={virtual} onChange={() => setShowingType('virtual')} /><span className="sf-track__item">Virtual</span></label>
        </div>
        {virtual ? <p className="sf-hint" style={{ marginTop: 0 }}>Video call. Your advisor emails the link once the time is confirmed.</p> : null}
        <label><span>Preferred time</span><input className="sf-field" name="requestedStart" type="datetime-local" required min={minTime} aria-describedby="showing-time-hint" /></label>
        <p id="showing-time-hint" className="sf-hint">8 AM to 8 PM</p>
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
