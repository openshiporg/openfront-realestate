import { notFound } from 'next/navigation'
import { getAuthenticatedUser } from '@/features/dashboard/actions/auth'
import { platformNavItems } from './navigation'

/** 404 when the signed-in role lacks every flag the sidebar requires for this page (same rule as visiblePlatformItems). */
export async function requirePlatformAccess(href: string) {
  const requires = platformNavItems.find((item) => item.href === href)?.requires
  if (!requires?.length) return
  const response = await getAuthenticatedUser()
  const item = response.success ? (response.data as { authenticatedItem?: { role?: Record<string, boolean | null> | null } | null })?.authenticatedItem : null
  const role = item?.role
  if (role && requires.every((flag) => role[flag] === false)) notFound()
}

/** True when the signed-in role has every listed flag (a role the API would let write). */
export async function roleHasAll(flags: string[]) {
  const response = await getAuthenticatedUser()
  const item = response.success ? (response.data as { authenticatedItem?: { role?: Record<string, boolean | null> | null } | null })?.authenticatedItem : null
  const role = item?.role
  return Boolean(role && flags.every((flag) => role[flag] === true))
}
