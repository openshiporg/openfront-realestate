'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { getStorefrontBrokerageSlug } from '@/features/storefront/lib/brokerage'

export type CustomerSession = { id: string; name: string; email: string; phone: string }
export type CustomerShowing = { id: string; status: string; showingType: string; scheduledStart: string; scheduledEnd: string | null; listingTitle: string; listingSlug: string; requestedStart: string }

export async function getCustomer(): Promise<CustomerSession | null> {
  const result = await keystoneClient<{ authenticatedItem: (Omit<CustomerSession, 'phone'> & { phone: string | null }) | null }>('query CustomerSession { authenticatedItem { ... on User { id name email phone } } }', {}, { cache: 'no-store' })
  const customer = result.success ? result.data.authenticatedItem : null
  return customer ? { ...customer, phone: customer.phone || '' } : null
}

export async function getCustomerShowings() {
  const brokerageSlug = await getStorefrontBrokerageSlug()
  if (!brokerageSlug) return { items: [] as CustomerShowing[], error: 'Your showings could not be loaded.' }
  const result = await keystoneClient<{ customerShowingHistory: CustomerShowing[] }>(`query CustomerShowings($brokerageSlug: String!) { customerShowingHistory(brokerageSlug: $brokerageSlug) { id status showingType scheduledStart scheduledEnd listingTitle listingSlug requestedStart } }`, { brokerageSlug }, { cache: 'no-store' })
  return result.success ? { items: result.data.customerShowingHistory, error: null } : { items: [] as CustomerShowing[], error: 'Your showings could not be loaded.' }
}

export type AccountState = { message: string }
export type ProfileState = { ok: boolean; message: string }

function destination(value: FormDataEntryValue | null) {
  const path = String(value || '')
  return /^\/listings\/[a-z0-9-]+$/.test(path) ? path : '/account'
}

async function authenticate(email: string, password: string) {
  const result = await keystoneClient<{ authenticateUserWithPassword: { sessionToken?: string } | null }>(`mutation CustomerSignIn($email: String!, $password: String!) { authenticateUserWithPassword(email: $email, password: $password) { ... on UserAuthenticationWithPasswordSuccess { sessionToken } } }`, { email, password }, { cache: 'no-store' })
  return result.success ? result.data.authenticateUserWithPassword?.sessionToken || null : null
}

export async function customerSignIn(_previous: AccountState, form: FormData): Promise<AccountState> {
  const email = String(form.get('email') || '').trim().toLowerCase(), password = String(form.get('password') || '')
  if (!email || email.length > 320 || !password || password.length > 200) return { message: 'Invalid email or password.' }
  const sessionToken = await authenticate(email, password)
  if (!sessionToken) return { message: 'Invalid email or password.' }
  ;(await cookies()).set('keystonejs-session', sessionToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
  revalidatePath('/', 'layout')
  redirect(destination(form.get('from')))
}

export async function customerSignUp(previous: AccountState, form: FormData): Promise<AccountState> {
  const brokerageSlug = await getStorefrontBrokerageSlug()
  if (!brokerageSlug) return { message: 'Account could not be created.' }
  const data = { name: String(form.get('name') || '').trim(), email: String(form.get('email') || '').trim().toLowerCase(), password: String(form.get('password') || ''), brokerageSlug }
  const result = await keystoneClient<{ registerRealEstateCustomer: { ok: boolean; message: string } }>(`mutation CustomerSignUp($data: RealEstateCustomerInput!) { registerRealEstateCustomer(data: $data) { ok message } }`, { data }, { cache: 'no-store' })
  if (!result.success || !result.data.registerRealEstateCustomer?.ok) return { message: result.success ? result.data.registerRealEstateCustomer.message : 'Account could not be created.' }
  return customerSignIn(previous, form)
}

export async function customerSignOut() {
  await keystoneClient('mutation CustomerSignOut { endSession }', {}, { cache: 'no-store' })
  ;(await cookies()).delete('keystonejs-session')
  revalidatePath('/', 'layout')
  redirect('/account')
}

export async function updateCustomerProfile(_previous: ProfileState, form: FormData): Promise<ProfileState> {
  const customer = await getCustomer()
  if (!customer) return { ok: false, message: 'Sign in to update your profile.' }
  const name = String(form.get('name') || '').trim(), phone = String(form.get('phone') || '').trim()
  if (!name || name.length > 120) return { ok: false, message: 'Enter your name.' }
  if (phone.length > 40) return { ok: false, message: 'Enter a shorter phone number.' }
  const result = await keystoneClient<{ updateUser: { id: string } | null }>(`mutation UpdateCustomerProfile($id: ID!, $data: UserUpdateInput!) { updateUser(where: { id: $id }, data: $data) { id } }`, { id: customer.id, data: { name, phone } }, { cache: 'no-store' })
  if (!result.success || !result.data.updateUser) return { ok: false, message: 'Your profile could not be updated.' }
  revalidatePath('/account', 'layout')
  return { ok: true, message: 'Profile updated.' }
}

export async function updateCustomerPassword(_previous: ProfileState, form: FormData): Promise<ProfileState> {
  const customer = await getCustomer()
  if (!customer) return { ok: false, message: 'Sign in to change your password.' }
  const currentPassword = String(form.get('currentPassword') || ''), newPassword = String(form.get('newPassword') || '')
  if (newPassword.length < 12 || newPassword.length > 200) return { ok: false, message: 'Use a new password of at least 12 characters.' }
  if (!currentPassword || currentPassword.length > 200 || !await authenticate(customer.email, currentPassword)) return { ok: false, message: 'Current password is incorrect.' }
  const result = await keystoneClient<{ updateUser: { id: string } | null }>(`mutation UpdateCustomerPassword($id: ID!, $data: UserUpdateInput!) { updateUser(where: { id: $id }, data: $data) { id } }`, { id: customer.id, data: { password: newPassword } }, { cache: 'no-store' })
  if (!result.success || !result.data.updateUser) return { ok: false, message: 'Your password could not be changed.' }
  return { ok: true, message: 'Password changed.' }
}
