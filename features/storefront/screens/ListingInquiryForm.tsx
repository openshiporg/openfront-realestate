'use client'

import { useActionState, useState, useTransition, type FormEvent } from 'react'
import { Send } from 'lucide-react'
import { createListingInquiry, type InquiryState } from '@/features/storefront/lib/data/leads'

const initialState: InquiryState = { ok: false, message: '' }

type Prefill = { name: string; email: string; phone: string } | null

export function ListingInquiryForm({ propertyId, intent, customer = null }: { propertyId: string; intent: 'buy' | 'rent'; customer?: Prefill }) {
  const [state, action, pending] = useActionState(createListingInquiry, initialState)
  const [, startTransition] = useTransition()
  const [problem, setProblem] = useState('')

  // Submitting through a transition (not the form action prop) keeps what the shopper typed when the server refuses it.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const issue = !String(formData.get('email') || '').trim() && !String(formData.get('phone') || '').trim() ? 'Add an email or phone number.' : ''
    setProblem(issue)
    if (!issue) startTransition(() => action(formData))
  }
  const message = problem || state.message

  return (
    <form onSubmit={submit} className="sf-form">
      <h2 className="sr-only">Ask about this home</h2>
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="intent" value={intent} />
      <fieldset disabled={pending || state.ok} className="sf-form">
        <legend className="sr-only">Question details</legend>
        <label><span>Message</span><textarea name="message" rows={4} className="sf-field" maxLength={5000} /></label>
        <label><span>Name</span><input name="name" required className="sf-field" autoComplete="name" maxLength={120} defaultValue={customer?.name || ''} /></label>
        <div className="sf-form-row">
          <label><span>Email</span><input name="email" type="email" className="sf-field" autoComplete="email" defaultValue={customer?.email || ''} /></label>
          <label><span>Phone</span><input name="phone" type="tel" className="sf-field" autoComplete="tel" defaultValue={customer?.phone || ''} /></label>
        </div>
        <p className="sf-hint">Email or phone required</p>
        <label><span>Best time to reach you</span><input name="preferredTime" className="sf-field" maxLength={200} /></label>
      </fieldset>
      {message ? <p role="status" className={!problem && state.ok ? 'sf-message sf-message--success' : 'sf-message'}>{message}</p> : null}
      <button type="submit" disabled={pending || state.ok} className="sf-btn sf-btn--primary sf-btn--block">
        <Send aria-hidden />
        {pending ? 'Sending…' : state.ok ? 'Message sent' : 'Send message'}
      </button>
    </form>
  )
}
