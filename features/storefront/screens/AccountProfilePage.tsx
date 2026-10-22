import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCustomer } from '../lib/data/account'
import { PasswordForm, ProfileDetailsForm } from '../components/ProfileForms'

export const metadata: Metadata = { title: 'Profile' }

export default async function AccountProfilePage() {
  const customer = await getCustomer()
  if (!customer) notFound()

  return <>
    <header className="sf-account__head">
      <div>
        <p className="sf-eyebrow">{customer.email}</p>
        <h1 style={{ marginTop: '0.5rem' }}>Profile</h1>
      </div>
    </header>
    <div className="sf-account__forms">
      <ProfileDetailsForm customer={customer} />
      <PasswordForm />
    </div>
  </>
}
