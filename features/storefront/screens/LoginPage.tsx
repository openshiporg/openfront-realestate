import type { Metadata } from 'next'
import { AccountForm } from '../components/AccountForm'
import { getCustomer } from '../lib/data/account'
import { storefrontTitle } from '../lib/metadata'

export async function generateMetadata(): Promise<Metadata> {
  // Signed-in visits are named by the account slot.
  return (await getCustomer()) ? {} : { title: await storefrontTitle('Sign in') }
}

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ from?: string }> }) {
  const params = searchParams ? await searchParams : {}
  return <AccountForm from={typeof params.from === 'string' ? params.from : ''} />
}
