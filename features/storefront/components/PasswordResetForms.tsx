'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { redeemCustomerPasswordReset, requestCustomerPasswordReset, type PasswordResetState } from '../lib/data/account'

const initialState: PasswordResetState = { ok: false, message: '' }

function Message({ state }: { state: PasswordResetState }) {
  return state.message ? <p className={state.ok ? 'sf-message sf-message--success' : 'sf-message'} role={state.ok ? 'status' : 'alert'}>{state.message}</p> : null
}

export function RequestResetForm() {
  const [state, action, pending] = useActionState(requestCustomerPasswordReset, initialState)
  return <form action={action} className="sf-form">
    <label><span>Email</span><input key={state.email || ''} className="sf-field" name="email" type="email" autoComplete="email" required maxLength={320} defaultValue={state.email || ''} /></label>
    <Message state={state} />
    <button className="sf-btn sf-btn--primary sf-btn--block" disabled={pending || state.ok}>{pending ? 'Sending…' : state.ok ? 'Link sent' : 'Send reset link'}</button>
  </form>
}

export function RedeemResetForm({ token, email = '' }: { token: string; email?: string }) {
  const [state, action, pending] = useActionState(redeemCustomerPasswordReset, initialState)
  if (state.ok) return <div className="sf-form"><Message state={state} /><Link href="/account" className="sf-btn sf-btn--primary sf-btn--block">Sign in</Link></div>
  return <form action={action} className="sf-form">
    <input type="hidden" name="token" value={token} />
    <label><span>Email</span><input key={state.email || email} className="sf-field" name="email" type="email" autoComplete="email" required maxLength={320} defaultValue={state.email || email} /></label>
    <label><span>New password</span><input className="sf-field" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={200} aria-describedby="reset-password-hint" /></label>
    <p id="reset-password-hint" className="sf-hint">At least 12 characters</p>
    <Message state={state} />
    <button className="sf-btn sf-btn--primary sf-btn--block" disabled={pending}>{pending ? 'Saving…' : 'Set password'}</button>
  </form>
}
