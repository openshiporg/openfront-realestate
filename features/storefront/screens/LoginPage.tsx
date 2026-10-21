import type { Metadata } from 'next'
import { AccountForm } from '../components/AccountForm'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ from?: string }> }) {
  const params = searchParams ? await searchParams : {}
  return <AccountForm from={typeof params.from === 'string' ? params.from : ''} />
}
