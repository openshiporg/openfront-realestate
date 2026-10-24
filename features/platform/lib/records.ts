import { revalidatePath } from 'next/cache'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type RecordResult = { ok: boolean; message: string; id?: string | null }

type BrokerageRef = { id: string; status: string } | null
type SessionShape = { authenticatedItem: { activeBrokerage: BrokerageRef; brokerageMemberships: Array<{ status: string; brokerage: BrokerageRef }> } | null }

/** The brokerage new records belong to; mirrors activeBrokerageIds in features/keystone/access.ts. */
export async function getActiveBrokerageId(): Promise<string | null> {
  const response = await keystoneClient<SessionShape>(
    'query PlatformActiveBrokerage { authenticatedItem { ... on User { activeBrokerage { id status } brokerageMemberships { status brokerage { id status } } } } }',
    {},
    { cache: 'no-store' },
  )
  const item = response.success ? response.data.authenticatedItem : null
  if (!item) return null
  const live = item.brokerageMemberships.filter(membership => membership.status === 'active' && membership.brokerage?.status === 'active')
  const selected = item.activeBrokerage || (live.length === 1 ? live[0].brokerage : null)
  if (!selected || selected.status !== 'active') return null
  return live.filter(membership => membership.brokerage?.id === selected.id).length === 1 ? selected.id : null
}

export type ViewerPermissions = { canManagePeople: boolean; canManageListings: boolean; canManageLeads: boolean; canManageDeals: boolean; canManageShowings: boolean }

export async function getViewerPermissions(): Promise<ViewerPermissions> {
  const response = await keystoneClient<{ authenticatedItem: { role: ViewerPermissions | null } | null }>(
    'query PlatformViewer { authenticatedItem { ... on User { role { canManagePeople canManageListings canManageLeads canManageDeals canManageShowings } } } }',
    {}, { cache: 'no-store' },
  )
  const role = response.success ? response.data.authenticatedItem?.role : null
  return { canManagePeople: Boolean(role?.canManagePeople), canManageListings: Boolean(role?.canManageListings), canManageLeads: Boolean(role?.canManageLeads), canManageDeals: Boolean(role?.canManageDeals), canManageShowings: Boolean(role?.canManageShowings) }
}

/** Runs a create/update/delete mutation whose result field is `field`, then revalidates `paths`. */
export async function runRecordMutation(query: string, variables: Record<string, unknown>, field: string, success: string, paths: string[]): Promise<RecordResult> {
  const response = await keystoneClient<Record<string, { id: string } | null>>(query, variables, { cache: 'no-store' })
  if (!response.success) return { ok: false, message: cleanError(response.error) }
  const item = response.data[field]
  if (!item) return { ok: false, message: 'You do not have access to change this record.' }
  for (const path of paths) revalidatePath(path)
  return { ok: true, message: success, id: item.id }
}

/** Runs a command mutation that answers { ok message }. */
export async function runCommand(query: string, variables: Record<string, unknown>, field: string, paths: string[]): Promise<RecordResult> {
  const response = await keystoneClient<Record<string, { ok: boolean; message: string; itemId?: string | null }>>(query, variables, { cache: 'no-store' })
  if (!response.success) return { ok: false, message: cleanError(response.error) }
  const result = response.data[field]
  if (result?.ok) for (const path of paths) revalidatePath(path)
  return { ok: Boolean(result?.ok), message: result?.message || 'Could not save.', id: result?.itemId ?? null }
}

function cleanError(error: string) {
  const message = String(error || '').replace(/^.*?:\s*/, '').split('\n')[0].trim()
  return message && message.length < 200 ? message : 'Could not save. Please try again.'
}

export function text(form: FormData, key: string) {
  return String(form.get(key) ?? '').trim()
}

export function optionalInt(form: FormData, key: string) {
  const value = text(form, key)
  if (!value) return null
  const number = Number(value)
  return Number.isInteger(number) ? number : null
}

/** Money fields take decimal strings; strip "$" and "," the way people type prices. */
export function money(form: FormData, key: string) {
  const value = text(form, key).replace(/[$,\s]/g, '')
  return /^\d{1,10}(?:\.\d{1,2})?$/.test(value) ? value : null
}

export function isoOrNull(form: FormData, key: string) {
  const value = text(form, key)
  const time = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

export function connect(id: string) {
  return id ? { connect: { id } } : undefined
}
