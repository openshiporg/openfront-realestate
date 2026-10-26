import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCustomer } from '../lib/data/account'
import { PasswordForm, ProfileDetailsForm } from '../components/ProfileForms'
import { storefrontTitle } from '../lib/metadata'

export async function generateMetadata(): Promise<Metadata> {
  return { title: await storefrontTitle('Profile') }
}

export default async function AccountProfilePage() {
  const customer = await getCustomer()
  if (!customer) notFound()

  return <>
    <header className="sf-account__head">
      <h1>Profile</h1>
    </header>
    <div className="sf-account__forms">
      <ProfileDetailsForm customer={customer} />
      <PasswordForm />
    </div>
  </>
}
