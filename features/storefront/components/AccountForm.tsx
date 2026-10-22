'use client'

import { useActionState, useState } from 'react'
import { customerSignIn, customerSignUp } from '../lib/data/account'

function SignInForm({ from }: { from: string }) {
  const [state, action, pending] = useActionState(customerSignIn, { message: '' })
  return <form action={action} className="sf-form">
    <input type="hidden" name="from" value={from} />
    <label><span>Email</span><input className="sf-field" name="email" type="email" autoComplete="email" required maxLength={320} /></label>
    <label><span>Password</span><input className="sf-field" name="password" type="password" autoComplete="current-password" required maxLength={200} /></label>
    {state.message ? <p className="sf-message" role="alert">{state.message}</p> : null}
    <button className="sf-btn sf-btn--primary sf-btn--block" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
  </form>
}

function SignUpForm({ from }: { from: string }) {
  const [state, action, pending] = useActionState(customerSignUp, { message: '' })
  return <form action={action} className="sf-form">
    <input type="hidden" name="from" value={from} />
    <label><span>Name</span><input className="sf-field" name="name" autoComplete="name" required maxLength={120} /></label>
    <label><span>Email</span><input className="sf-field" name="email" type="email" autoComplete="email" required maxLength={320} /></label>
    <label><span>Password</span><input className="sf-field" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={200} aria-describedby="signup-password-hint" /></label>
    <p id="signup-password-hint" className="sf-hint">At least 12 characters</p>
    {state.message ? <p className="sf-message" role="alert">{state.message}</p> : null}
    <button className="sf-btn sf-btn--primary sf-btn--block" disabled={pending}>{pending ? 'Creating account…' : 'Create account'}</button>
  </form>
}

export function AccountForm({ from = '' }: { from?: string }) {
  const [view, setView] = useState<'signin' | 'signup'>('signin')
  const signup = view === 'signup'
  return <div className="sf-auth__card">
    <h1>{signup ? 'Create account' : 'Sign in'}</h1>
    <div className="sf-track sf-track--block" role="tablist" aria-label="Account">
      <button type="button" role="tab" aria-selected={!signup} className="sf-track__item" onClick={() => setView('signin')}>Sign in</button>
      <button type="button" role="tab" aria-selected={signup} className="sf-track__item" onClick={() => setView('signup')}>Create account</button>
    </div>
    {signup ? <SignUpForm from={from} /> : <SignInForm from={from} />}
  </div>
}
