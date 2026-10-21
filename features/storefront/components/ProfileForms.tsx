'use client'

import { useActionState } from 'react'
import { updateCustomerPassword, updateCustomerProfile, type CustomerSession, type ProfileState } from '../lib/data/account'

const initialState: ProfileState = { ok: false, message: '' }

function Message({ state }: { state: ProfileState }) {
  return state.message ? <p className={state.ok ? 'sf-form-message sf-form-message--success' : 'sf-form-message'} role="status">{state.message}</p> : null
}

export function ProfileDetailsForm({ customer }: { customer: CustomerSession }) {
  const [state, action, pending] = useActionState(updateCustomerProfile, initialState)
  return <form action={action} className="sf-account-form">
    <h2>Your details</h2>
    <label><span>Name</span><input className="sf-field" name="name" autoComplete="name" required maxLength={120} defaultValue={customer.name} /></label>
    <label><span>Email</span><input className="sf-field" type="email" value={customer.email} readOnly disabled /></label>
    <label><span>Phone</span><input className="sf-field" name="phone" type="tel" autoComplete="tel" maxLength={40} defaultValue={customer.phone} /></label>
    <Message state={state} />
    <button className="sf-btn sf-btn--dark" disabled={pending}>{pending ? 'Saving…' : 'Save details'}</button>
  </form>
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(updateCustomerPassword, initialState)
  return <form action={action} className="sf-account-form">
    <h2>Password</h2>
    <label><span>Current password</span><input className="sf-field" name="currentPassword" type="password" autoComplete="current-password" required maxLength={200} /></label>
    <label><span>New password</span><input className="sf-field" name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={200} /></label>
    <Message state={state} />
    <button className="sf-btn sf-btn--dark" disabled={pending}>{pending ? 'Saving…' : 'Change password'}</button>
  </form>
}
