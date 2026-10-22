'use client'

import { useActionState } from 'react'
import { Send } from 'lucide-react'
import { createListingInquiry, type InquiryState } from '@/features/storefront/lib/data/leads'

const initialState: InquiryState = { ok: false, message: '' }

type Prefill = { name: string; email: string; phone: string } | null

export function ListingInquiryForm({ propertyId, intent, customer = null }: { propertyId: string; intent: 'buy' | 'rent'; customer?: Prefill }) {
  const [state, action, pending] = useActionState(createListingInquiry, initialState)

  return (
    <form action={action} className="sf-form">
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
        <label><span>Best time to reach you</span><input name="preferredTime" className="sf-field" maxLength={200} /></label>
      </fieldset>
      {state.message ? <p role="status" className={state.ok ? 'sf-message sf-message--success' : 'sf-message'}>{state.message}</p> : null}
      <button type="submit" disabled={pending || state.ok} className="sf-btn sf-btn--primary sf-btn--block">
        <Send aria-hidden />
        {pending ? 'Sending…' : state.ok ? 'Message sent' : 'Send message'}
      </button>
    </form>
  )
}
