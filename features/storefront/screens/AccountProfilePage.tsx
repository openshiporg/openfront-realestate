import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCustomer } from '../lib/data/account'
import { PasswordForm, ProfileDetailsForm } from '../components/ProfileForms'

export const metadata: Metadata = { title: 'Profile' }

export default async function AccountProfilePage() {
  const customer = await getCustomer()
  if (!customer) notFound()

  return <>
    <h1 className="sf-account__title">Profile</h1>
    <div className="sf-account__forms">
      <ProfileDetailsForm customer={customer} />
      <PasswordForm />
    </div>
  </>
}
