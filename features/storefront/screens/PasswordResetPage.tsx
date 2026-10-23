import type { Metadata } from 'next'
import Link from 'next/link'
import { AccountShell } from '../components/AccountShell'
import { RedeemResetForm, RequestResetForm } from '../components/PasswordResetForms'

export const metadata: Metadata = { title: 'Reset password', robots: { index: false, follow: false } }

export default async function PasswordResetPage({ searchParams }: { searchParams?: Promise<{ token?: string | string[]; email?: string | string[] }> }) {
  const params = searchParams ? await searchParams : {}
  const token = typeof params.token === 'string' ? params.token.slice(0, 200) : ''
  const email = typeof params.email === 'string' ? params.email.slice(0, 320) : ''
  return <AccountShell>
    <main className="sf-container">
      <div className="sf-auth">
        <div className="sf-auth__card">
          <h1>{token ? 'Set a new password' : 'Reset password'}</h1>
          {token ? <RedeemResetForm token={token} email={email} /> : <RequestResetForm />}
          <div className="sf-auth__foot"><Link href="/account" className="sf-link">Back to sign in</Link></div>
        </div>
      </div>
    </main>
  </AccountShell>
}
