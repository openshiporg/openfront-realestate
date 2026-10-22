import type { ReactNode } from 'react'
import { AccountShell } from '../components/AccountShell'
import { AccountTabs } from '../components/AccountTabs'
import { customerSignOut, getCustomer } from '../lib/data/account'

export async function AccountPageLayout({ dashboard, login }: { children?: ReactNode; dashboard?: ReactNode; login?: ReactNode }) {
  const customer = await getCustomer()

  return (
    <AccountShell>
      <main className="sf-container">
        {customer ? (
          <div className="sf-account">
            <div className="sf-account__bar">
              <AccountTabs />
              <form action={customerSignOut}><button className="sf-btn sf-btn--quiet">Sign out</button></form>
            </div>
            <div className="sf-account__body">{dashboard}</div>
          </div>
        ) : <div className="sf-auth">{login}</div>}
      </main>
    </AccountShell>
  )
}
