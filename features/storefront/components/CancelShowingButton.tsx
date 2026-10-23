'use client'

import { useActionState, useState } from 'react'
import { cancelCustomerShowing, type CancelShowingState } from '../lib/data/account'

export function CancelShowingButton({ showingId, listingTitle }: { showingId: string; listingTitle: string }) {
  const [state, action, pending] = useActionState(cancelCustomerShowing, { ok: false, message: '' } satisfies CancelShowingState)
  const [confirming, setConfirming] = useState(false)
  if (state.ok) return <span className="sf-trip__note" role="status">Cancelled</span>
  return (
    <form action={action} className="sf-trip__cancel">
      <input type="hidden" name="showingId" value={showingId} />
      {confirming ? (
        <span className="sf-track" role="group" aria-label={`Cancel showing at ${listingTitle}?`}>
          <button type="submit" className="sf-track__item" data-active="true" disabled={pending}>{pending ? 'Cancelling…' : 'Cancel showing'}</button>
          <button type="button" className="sf-track__item" onClick={() => setConfirming(false)} disabled={pending}>Keep</button>
        </span>
      ) : (
        <button type="button" className="sf-btn sf-btn--quiet" onClick={() => setConfirming(true)}>Cancel</button>
      )}
      {state.message && !state.ok ? <span className="sf-message" role="alert">{state.message}</span> : null}
    </form>
  )
}
