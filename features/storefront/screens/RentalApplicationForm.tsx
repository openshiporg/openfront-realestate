'use client'

import { useActionState } from 'react'
import { CreditCard } from 'lucide-react'
import { applyForRental, type ApplyState } from '@/features/storefront/lib/data/payments'

const initialState: ApplyState = { ok: false, message: '' }
type Prefill = { name: string; email: string; phone: string } | null

export function RentalApplicationForm({ propertyId, feeLabel, customer = null }: { propertyId: string; feeLabel: string; customer?: Prefill }) {
  const [state, action, pending] = useActionState(applyForRental, initialState)
  return (
    <form action={action} className="sf-form">
      <h2 className="sr-only">Apply for this rental</h2>
      <input type="hidden" name="propertyId" value={propertyId} />
      <fieldset disabled={pending} className="sf-form">
        <legend className="sr-only">Applicant details</legend>
        <label><span>Name</span><input name="name" required className="sf-field" autoComplete="name" maxLength={120} defaultValue={customer?.name || ''} /></label>
        <div className="sf-form-row">
          <label><span>Email</span><input name="email" type="email" className="sf-field" autoComplete="email" defaultValue={customer?.email || ''} /></label>
          <label><span>Phone</span><input name="phone" type="tel" className="sf-field" autoComplete="tel" defaultValue={customer?.phone || ''} /></label>
        </div>
        <p className="sf-hint">Email or phone required</p>
        <label><span>Anything the agent should know</span><textarea name="message" rows={3} className="sf-field" maxLength={2000} /></label>
      </fieldset>
      <p className="sf-hint">The application fee is {feeLabel}, set by the brokerage. You pay it on the next page.</p>
      {state.message ? <p role="status" className="sf-message">{state.message}</p> : null}
      <button type="submit" disabled={pending} className="sf-btn sf-btn--primary sf-btn--block">
        <CreditCard aria-hidden />
        {pending ? 'Starting…' : `Apply and pay ${feeLabel}`}
      </button>
    </form>
  )
}
