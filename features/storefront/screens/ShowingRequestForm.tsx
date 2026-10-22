'use client'

import Link from 'next/link'
import { useActionState, useRef } from 'react'
import { CalendarDays } from 'lucide-react'
import { localDateTimeToIso } from '@/features/lib/date-time'
import { createShowingRequest, type ShowingRequestState } from '@/features/storefront/lib/data/showings'

const initialState: ShowingRequestState = { ok: false, message: '' }

type Prefill = { name: string; email: string; phone: string } | null

export function ShowingRequestForm({ propertyId, customer, accountHref }: { propertyId: string; customer: Prefill; accountHref: string }) {
  const [state, action, pending] = useActionState(createShowingRequest, initialState)
  const requestKey = useRef('')
  const locked = pending || state.uncertain || state.ok

  return (
    <form action={formData => {
      requestKey.current ||= crypto.randomUUID()
      formData.set('idempotencyKey', requestKey.current)
      formData.set('requestedStart', localDateTimeToIso(String(formData.get('requestedStart') || '')))
      action(formData)
    }} className="sf-form">
      <h2 className="sr-only">Request a showing</h2>
      <input type="hidden" name="propertyId" value={propertyId} />
      <fieldset disabled={locked} className="sf-form">
        <legend className="sr-only">Showing request details</legend>
        <div className="sf-track sf-track--block" role="radiogroup" aria-label="Visit type">
          <label><input type="radio" name="showingType" value="in_person" defaultChecked /><span className="sf-track__item">In person</span></label>
          <label><input type="radio" name="showingType" value="virtual" /><span className="sf-track__item">Virtual</span></label>
        </div>
        <label><span>Preferred time</span><input className="sf-field" name="requestedStart" type="datetime-local" required /></label>
        <label><span>Name</span><input className="sf-field" name="name" required autoComplete="name" defaultValue={customer?.name || ''} /></label>
        <div className="sf-form-row">
          <label><span>Email</span><input className="sf-field" name="email" type="email" autoComplete="email" defaultValue={customer?.email || ''} /></label>
          <label><span>Phone</span><input className="sf-field" name="phone" type="tel" autoComplete="tel" defaultValue={customer?.phone || ''} /></label>
        </div>
        <label><span>Notes</span><textarea className="sf-field" name="message" rows={3} /></label>
      </fieldset>
      {state.message ? <p className={state.ok ? 'sf-message sf-message--success' : 'sf-message'} role="status">{state.message}</p> : null}
      <button className="sf-btn sf-btn--primary sf-btn--block" disabled={locked}><CalendarDays aria-hidden /> {pending ? 'Sending…' : state.ok ? 'Request sent' : state.uncertain ? 'Request not confirmed' : 'Request showing'}</button>
      {customer
        ? <Link href="/account" className="sf-link">My showings</Link>
        : <Link href={accountHref} className="sf-link">Sign in to track showings</Link>}
    </form>
  )
}
