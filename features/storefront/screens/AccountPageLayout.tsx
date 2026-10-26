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
              <div className="sf-account__who">
                <span title={customer.email}>{customer.name.trim() || customer.email}</span>
                <form action={customerSignOut}><button className="sf-link">Sign out</button></form>
              </div>
            </div>
            <div className="sf-account__body">{dashboard}</div>
          </div>
        ) : <div className="sf-auth">{login}</div>}
      </main>
    </AccountShell>
  )
}
