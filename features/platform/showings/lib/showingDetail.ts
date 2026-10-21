import { isShowingBoardItem, type ShowingBoardItem } from './showingProjection'

export type ShowingSnapshot = {
  version: number; capturedAt: string; propertyId: string; leadId: string; assignedAgentId: string | null
  scheduledStart: string; scheduledEnd: string; showingType: string; listingTitle: string; listingSlug: string
  addressLine1: string; city: string; state: string; listingType: string; price: string | null; notes: string; propertyUpdatedAt: string | null
}
export type ShowingDetail = {
  showing: ShowingBoardItem; updatedAt: string; revision: string; snapshot: ShowingSnapshot | null
  history: Array<{ id: string; action: string; occurredAt: string; fromStatus: string | null; toStatus: string | null }>
  nextHistoryCursor: string | null
}
function record(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
function date(value: unknown) { return typeof value === 'string' && Number.isFinite(new Date(value).getTime()) }
function text(value: unknown) { return typeof value === 'string' }
function nullableText(value: unknown) { return value === null || text(value) }

export function isShowingDetail(value: unknown, id: string): value is ShowingDetail {
  if (!record(value) || !isShowingBoardItem(value.showing) || value.showing.id !== id || !date(value.updatedAt)
    || typeof value.revision !== 'string' || !/^[a-f0-9]{64}$/.test(value.revision)
    || !nullableText(value.nextHistoryCursor) || (value.nextHistoryCursor !== null && !value.nextHistoryCursor)) return false
  if (!Array.isArray(value.history) || value.history.length > 50 || !value.history.every(row =>
    record(row) && text(row.id) && row.id && text(row.action) && row.action && date(row.occurredAt)
    && nullableText(row.fromStatus) && nullableText(row.toStatus))) return false
  if (value.snapshot === null) return true
  const snapshot = value.snapshot
  return record(snapshot) && snapshot.version === 1 && snapshot.propertyId === value.showing.property?.id
    && snapshot.leadId === value.showing.lead?.id && date(snapshot.capturedAt)
    && date(snapshot.scheduledStart) && date(snapshot.scheduledEnd)
    && new Date(snapshot.scheduledEnd).getTime() > new Date(snapshot.scheduledStart).getTime()
    && nullableText(snapshot.assignedAgentId) && nullableText(snapshot.price) && (snapshot.propertyUpdatedAt === null || date(snapshot.propertyUpdatedAt))
    && ['showingType', 'listingTitle', 'listingSlug', 'addressLine1', 'city', 'state', 'listingType', 'notes'].every(key => text(snapshot[key]))
}

export const SHOWING_DETAIL_QUERY = `
  query ShowingDetail($id: ID!, $before: String) {
    platformShowingDetail(id: $id, before: $before) {
      showing { id status showingType scheduledStart scheduledEnd notes feedback createdAt
        property { id title slug addressLine1 city state price listingType }
        lead { id name email phone status intent }
        assignedAgent { id name email phone }
      }
      updatedAt revision
      snapshot { version capturedAt propertyId leadId assignedAgentId scheduledStart scheduledEnd showingType
        listingTitle listingSlug addressLine1 city state listingType price notes propertyUpdatedAt }
      history { id action occurredAt fromStatus toStatus }
      nextHistoryCursor
    }
  }
`
export async function readShowingDetail(id: string, before: string | undefined,
  request: (query: string, variables: Record<string, unknown>) => Promise<unknown>,
): Promise<{ detail: ShowingDetail | null; error: string | null }> {
  try {
    const result = await request(SHOWING_DETAIL_QUERY, { id, before })
    if (!record(result) || result.success !== true || !record(result.data)) throw new Error('Unavailable')
    if (result.data.platformShowingDetail === null) return { detail: null, error: 'Showing not found.' }
    if (!isShowingDetail(result.data.platformShowingDetail, id)) throw new Error('Invalid projection')
    return { detail: result.data.platformShowingDetail, error: null }
  } catch {
    return { detail: null, error: 'This showing could not be loaded. Please try again.' }
  }
}
