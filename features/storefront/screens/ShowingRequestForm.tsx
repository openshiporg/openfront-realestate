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
    }} className="sf-showing-form">
      <h2>Request a showing</h2>
      <input type="hidden" name="propertyId" value={propertyId} />
      <fieldset disabled={locked} className="contents">
      <legend className="sr-only">Showing request details</legend>
      <div className="sf-form-row"><label><span>Name</span><input className="sf-field" name="name" required autoComplete="name" defaultValue={customer?.name || ''} /></label><label><span>Preferred time</span><input className="sf-field" name="requestedStart" type="datetime-local" required /></label></div>
      <div className="sf-form-row"><label><span>Email</span><input className="sf-field" name="email" type="email" autoComplete="email" defaultValue={customer?.email || ''} /></label><label><span>Phone</span><input className="sf-field" name="phone" type="tel" autoComplete="tel" defaultValue={customer?.phone || ''} /></label></div>
      <label><span>Visit type</span><select className="sf-field" name="showingType"><option value="in_person">In person</option><option value="virtual">Virtual</option></select></label>
      <label><span>Notes</span><textarea className="sf-field" name="message" rows={4} /></label>
      </fieldset>
      {state.message ? <p className={state.ok ? 'sf-form-message sf-form-message--success' : 'sf-form-message'} role="status">{state.message}</p> : null}
      <div className="sf-form-actions">
        <button className="sf-btn sf-btn--light" disabled={locked}><CalendarDays aria-hidden /> {pending ? 'Sending…' : state.ok ? 'Request sent' : state.uncertain ? 'Request not confirmed' : 'Request showing'}</button>
        {customer
          ? <Link href="/account" className="sf-text-link sf-text-link--light">View my showings</Link>
          : <Link href={accountHref} className="sf-text-link sf-text-link--light">Sign in to track your showings</Link>}
      </div>
    </form>
  )
}
