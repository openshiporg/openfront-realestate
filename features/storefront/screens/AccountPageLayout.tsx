import type { ReactNode } from 'react'
import Link from 'next/link'
import { AccountShell } from '../components/AccountShell'
import { customerSignOut, getCustomer } from '../lib/data/account'

export async function AccountPageLayout({ dashboard, login }: { children?: ReactNode; dashboard?: ReactNode; login?: ReactNode }) {
  const customer = await getCustomer()

  return (
    <AccountShell>
      <main className="sf-container sf-section">
        {customer ? (
          <div className="sf-account">
            <nav className="sf-account__nav" aria-label="Account">
              <p className="sf-display">{customer.name}</p>
              <Link href="/account">My showings</Link>
              <Link href="/account/profile">Profile</Link>
              <form action={customerSignOut}><button className="sf-btn sf-btn--outline">Sign out</button></form>
            </nav>
            <div className="sf-account__content">{dashboard}</div>
          </div>
        ) : login}
      </main>
    </AccountShell>
  )
}
