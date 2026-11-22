import type { Metadata } from 'next'
import { AccountShell } from '../components/AccountShell'
import { getCustomer } from '../lib/data/account'
import { getBrokerageSettings } from '../lib/data/settings'
import { SellerInquiryForm } from './SellerInquiryForm'

export const metadata: Metadata = { title: 'List your home', description: 'Ask an agent for a price opinion and a plan to list your home.' }

export default async function SellPage() {
  const [customer, state] = await Promise.all([getCustomer(), getBrokerageSettings()])
  const businessName = state.status === 'ready' ? state.settings.businessName : 'us'
  return <AccountShell>
    <main className="sf-container">
      <div className="sf-auth">
        <div className="sf-auth__card">
          <h1>List your home</h1>
          <p className="sf-hint" style={{ marginTop: 0, fontSize: '1rem' }}>Tell {businessName} about your home. An agent will call or email with a price opinion and what listing involves. No obligation.</p>
          <SellerInquiryForm customer={customer ? { name: customer.name, email: customer.email, phone: customer.phone || '' } : null} />
        </div>
      </div>
    </main>
  </AccountShell>
}
