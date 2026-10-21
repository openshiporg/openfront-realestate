type NullableString = string | null

export type ShowingBoardItem = {
  id: string
  status: string
  showingType: NullableString
  scheduledStart: string
  scheduledEnd: NullableString
  notes: NullableString
  feedback: NullableString
  createdAt: NullableString
  property: null | {
    id: string
    title: string
    slug: NullableString
    addressLine1: NullableString
    city: NullableString
    state: NullableString
    price: NullableString
    listingType: NullableString
  }
  lead: null | {
    id: string
    name: string
    email: NullableString
    phone: NullableString
    status: NullableString
    intent: NullableString
  }
  assignedAgent: null | {
    id: string
    name: string
    email: NullableString
    phone: NullableString
  }
}

export type ShowingBoardStats = {
  total: number
  requested: number
  scheduled: number
  completed: number
  noShow: number
  cancelled: number
}

export type ShowingBoardPageInfo = {
  hasNextPage: boolean
  hasPreviousPage: boolean
  nextCursor: string | null
  previousCursor: string | null
}

export type ShowingBoardProjection = { items: ShowingBoardItem[]; stats: ShowingBoardStats; pageInfo: ShowingBoardPageInfo }

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function hasString(value: Record<string, unknown>, key: string, nonEmpty = false): boolean {
  return typeof value[key] === 'string' && (!nonEmpty || (value[key] as string).trim().length > 0)
}

function hasNullableString(value: Record<string, unknown>, key: string): boolean {
  return hasOwn(value, key) && (value[key] === null || typeof value[key] === 'string')
}

function validProperty(value: unknown): boolean {
  if (value === null) return true
  if (!record(value) || !hasString(value, 'id', true) || !hasString(value, 'title', true)) return false
  return ['slug', 'addressLine1', 'city', 'state', 'price', 'listingType'].every(key => hasNullableString(value, key))
}

function validLead(value: unknown): boolean {
  if (value === null) return true
  if (!record(value) || !hasString(value, 'id', true) || !hasString(value, 'name', true)) return false
  return ['email', 'phone', 'status', 'intent'].every(key => hasNullableString(value, key))
}

function validAgent(value: unknown): boolean {
  if (value === null) return true
  if (!record(value) || !hasString(value, 'id', true) || !hasString(value, 'name', true)) return false
  return ['email', 'phone'].every(key => hasNullableString(value, key))
}

export function isShowingBoardItem(value: unknown): value is ShowingBoardItem {
  if (!record(value) || !hasString(value, 'id', true) || !hasString(value, 'status', true) || !hasString(value, 'scheduledStart', true)) return false
  if (!Number.isFinite(new Date(value.scheduledStart as string).getTime())) return false
  if (!['showingType', 'scheduledEnd', 'notes', 'feedback', 'createdAt'].every(key => hasNullableString(value, key))) return false
  return hasOwn(value, 'property') && validProperty(value.property)
    && hasOwn(value, 'lead') && validLead(value.lead)
    && hasOwn(value, 'assignedAgent') && validAgent(value.assignedAgent)
}

function validStats(value: unknown): value is ShowingBoardStats {
  if (!record(value)) return false
  return ['total', 'requested', 'scheduled', 'completed', 'noShow', 'cancelled']
    .every(key => typeof value[key] === 'number' && Number.isSafeInteger(value[key]) && (value[key] as number) >= 0)
}

function validPageInfo(value: unknown): value is ShowingBoardPageInfo {
  if (!record(value) || typeof value.hasNextPage !== 'boolean' || typeof value.hasPreviousPage !== 'boolean') return false
  if (!(value.nextCursor === null || (typeof value.nextCursor === 'string' && value.nextCursor.length > 0 && value.nextCursor.length <= 2048))) return false
  if (!(value.previousCursor === null || (typeof value.previousCursor === 'string' && value.previousCursor.length > 0 && value.previousCursor.length <= 2048))) return false
  return value.hasNextPage === (value.nextCursor !== null) && value.hasPreviousPage === (value.previousCursor !== null)
}

export function isShowingBoardProjection(value: unknown): value is ShowingBoardProjection {
  if (!record(value)) return false
  const items = value.items
  const stats = value.stats
  const pageInfo = value.pageInfo
  if (!Array.isArray(items) || !items.every(isShowingBoardItem) || !validStats(stats) || !validPageInfo(pageInfo)) return false
  return items.length > 0 || (!pageInfo.hasNextPage && !pageInfo.hasPreviousPage)
}
