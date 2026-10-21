import type { LeadDuplicateGroup, PlatformLead } from '../actions/leads'

export type ContactWorkspaceStats = {
  total: number
  new: number
  qualified: number
  tourScheduled: number
  offer: number
}

export type LeadListProjection = {
  items: PlatformLead[]
  stats: ContactWorkspaceStats
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function requiredText(value: Record<string, unknown>, key: string, nonEmpty = false): boolean {
  return typeof value[key] === 'string' && (!nonEmpty || (value[key] as string).trim().length > 0)
}

function nullableText(value: Record<string, unknown>, key: string): boolean {
  return hasOwn(value, key) && (value[key] === null || typeof value[key] === 'string')
}

function nullableDateTime(value: Record<string, unknown>, key: string): boolean {
  if (!nullableText(value, key)) return false
  return value[key] === null || Number.isFinite(new Date(value[key] as string).getTime())
}

function validPerson(value: unknown): boolean {
  if (value === null) return true
  return record(value) && requiredText(value, 'id', true) && requiredText(value, 'name') && requiredText(value, 'email')
}

function validLeadProperty(value: unknown): boolean {
  if (value === null) return true
  if (!record(value) || !requiredText(value, 'id', true) || !requiredText(value, 'title')) return false
  return ['slug', 'city', 'state', 'price', 'listingType'].every(key => nullableText(value, key))
}

function validDuplicateProperty(value: unknown): boolean {
  if (value === null) return true
  if (!record(value) || !requiredText(value, 'id', true) || !requiredText(value, 'title')) return false
  return ['city', 'state'].every(key => nullableText(value, key))
}

function validActivity(value: unknown): boolean {
  if (!record(value) || !requiredText(value, 'id', true) || !requiredText(value, 'activityType', true)) return false
  if (!['direction', 'channel', 'subject', 'body'].every(key => nullableText(value, key)) || !nullableDateTime(value, 'occurredAt')) return false
  return hasOwn(value, 'agent') && validPerson(value.agent)
}

export function isPlatformLead(value: unknown): value is PlatformLead {
  if (!record(value) || !requiredText(value, 'id', true) || !requiredText(value, 'name') || !requiredText(value, 'status', true)) return false
  if (!['email', 'phone', 'intent', 'source', 'message'].every(key => nullableText(value, key))) return false
  if (!nullableDateTime(value, 'lastContactedAt') || !nullableDateTime(value, 'createdAt')) return false
  if (!hasOwn(value, 'property') || !validLeadProperty(value.property)) return false
  if (!hasOwn(value, 'assignedAgent') || !validPerson(value.assignedAgent)) return false
  if (!hasOwn(value, 'showingsCount') || !(value.showingsCount === null || (typeof value.showingsCount === 'number' && Number.isSafeInteger(value.showingsCount) && value.showingsCount >= 0))) return false
  return Array.isArray(value.activities) && value.activities.every(validActivity)
}

function validContactStats(value: unknown): value is ContactWorkspaceStats {
  if (!record(value)) return false
  const keys = ['total', 'new', 'qualified', 'tourScheduled', 'offer'] as const
  if (!keys.every(key => typeof value[key] === 'number' && Number.isSafeInteger(value[key]) && (value[key] as number) >= 0 && (value[key] as number) <= 500)) return false
  const total = value.total as number
  return (value.new as number) <= total
    && (value.qualified as number) <= total
    && (value.tourScheduled as number) <= total
    && (value.offer as number) <= total
}

function contactsWorkspace(value: unknown): Record<string, unknown> | null {
  if (!record(value) || !record(value.platformContacts)) return null
  return value.platformContacts
}

export function readLeadListProjection(value: unknown): LeadListProjection | null {
  const workspace = contactsWorkspace(value)
  if (!workspace) return null
  const rawItems = workspace.items
  const stats = workspace.stats
  if (!Array.isArray(rawItems) || rawItems.length > 50 || !validContactStats(stats)) return null
  const items: PlatformLead[] = []
  for (const item of rawItems) {
    if (!isPlatformLead(item)) return null
    items.push(item)
  }
  return { items, stats }
}

function validDuplicateCandidate(value: unknown): value is LeadDuplicateGroup['candidates'][number] {
  if (!record(value) || !requiredText(value, 'id', true) || !requiredText(value, 'name') || !requiredText(value, 'status', true)) return false
  if (!['email', 'phone', 'source'].every(key => nullableText(value, key)) || !nullableDateTime(value, 'createdAt')) return false
  return hasOwn(value, 'assignedAgent') && validPerson(value.assignedAgent)
    && hasOwn(value, 'property') && validDuplicateProperty(value.property)
}

function validDuplicateGroup(value: unknown): value is LeadDuplicateGroup {
  return record(value)
    && requiredText(value, 'key', true)
    && requiredText(value, 'reason', true)
    && Array.isArray(value.candidates)
    && value.candidates.length >= 2
    && value.candidates.length <= 500
    && value.candidates.every(validDuplicateCandidate)
}

export function readLeadDuplicateGroups(value: unknown): LeadDuplicateGroup[] | null {
  const workspace = contactsWorkspace(value)
  if (!workspace || !Array.isArray(workspace.duplicateGroups) || workspace.duplicateGroups.length > 12) return null
  const groups: LeadDuplicateGroup[] = []
  for (const group of workspace.duplicateGroups) {
    if (!validDuplicateGroup(group)) return null
    groups.push(group)
  }
  return groups
}
