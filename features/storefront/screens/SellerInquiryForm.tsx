'use client'

import { useActionState, useTransition, type FormEvent } from 'react'
import { Send } from 'lucide-react'
import { createSellerInquiry, type InquiryState } from '@/features/storefront/lib/data/leads'

const initialState: InquiryState = { ok: false, message: '' }

export function SellerInquiryForm({ customer = null }: { customer?: { name: string; email: string; phone: string } | null }) {
  const [state, action, pending] = useActionState(createSellerInquiry, initialState)
  const [, startTransition] = useTransition()
  // A transition (not the form action prop) keeps what the owner typed when the server refuses it.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => action(formData))
  }
  return (
    <form onSubmit={submit} className="sf-form">
      <fieldset disabled={pending || state.ok} className="sf-form">
        <legend className="sr-only">Your home</legend>
        <label><span>Home address</span><input name="address" required className="sf-field" autoComplete="street-address" maxLength={300} /></label>
        <label><span>When would you like to sell?</span>
          <select name="timeline" className="sf-field" defaultValue="">
            <option value="">Not sure yet</option>
            <option>Within 3 months</option>
            <option>3 to 6 months</option>
            <option>6 to 12 months</option>
            <option>Just curious about value</option>
          </select>
        </label>
        <label><span>Name</span><input name="name" required className="sf-field" autoComplete="name" maxLength={120} defaultValue={customer?.name || ''} /></label>
        <div className="sf-form-row">
          <label><span>Email</span><input name="email" type="email" className="sf-field" autoComplete="email" defaultValue={customer?.email || ''} /></label>
          <label><span>Phone</span><input name="phone" type="tel" className="sf-field" autoComplete="tel" defaultValue={customer?.phone || ''} /></label>
        </div>
        <p className="sf-hint">Email or phone required</p>
        <label><span>Anything we should know</span><textarea name="message" rows={3} className="sf-field" maxLength={5000} /></label>
      </fieldset>
      {state.message ? <p role="status" className={state.ok ? 'sf-message sf-message--success' : 'sf-message'}>{state.message}</p> : null}
      <button type="submit" disabled={pending || state.ok} className="sf-btn sf-btn--primary sf-btn--block">
        <Send aria-hidden />
        {pending ? 'Sending…' : state.ok ? 'Request sent' : 'Ask for a valuation'}
      </button>
    </form>
  )
}
