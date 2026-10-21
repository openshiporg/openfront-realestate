import { isPlatformLead } from './leadWorkspaceProjection'
import type { PlatformLead } from '../actions/leads'

export type OperatorViewer = { actorId: string; brokerageId: string }
export type LeadPageInfo = { hasNextPage: boolean; hasPreviousPage: boolean; nextCursor: string | null; previousCursor: string | null }
export type PrivateLeadDetail = { lead: PlatformLead; viewer: OperatorViewer; activityAccess: 'available' | 'restricted'; nextActivityCursor: string | null }
export const PRIVATE_LEAD_DETAIL_QUERY = `query PrivateLeadDetail($id: ID!, $before: String) {
  platformLeadDetail(id: $id, before: $before) {
    viewer { actorId brokerageId } activityAccess nextActivityCursor
    lead { id name email phone status intent source message lastContactedAt createdAt updatedAt activityAccess showingsCount
      property { id title slug city state price listingType } assignedAgent { id name email }
      activities { id activityType direction channel subject body occurredAt agent { id name email } }
    }
  }
}`
function record(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)) }
function id(value: unknown): value is string { return typeof value === 'string' && Boolean(value.trim()) && value.length <= 200 }
function cursor(value: unknown): value is string | null { return value === null || (typeof value === 'string' && value.length <= 2048 && /^[A-Za-z0-9_-]+$/.test(value)) }
export function isOperatorViewer(value: unknown): value is OperatorViewer { return record(value) && id(value.actorId) && id(value.brokerageId) }
export function readLeadPageInfo(value: unknown): { pageInfo: LeadPageInfo; viewer: OperatorViewer } | null {
  if (!record(value) || !record(value.platformContacts)) return null
  const { pageInfo, viewer } = value.platformContacts
  if (!record(pageInfo) || !isOperatorViewer(viewer) || typeof pageInfo.hasNextPage !== 'boolean' || typeof pageInfo.hasPreviousPage !== 'boolean'
    || !cursor(pageInfo.nextCursor) || !cursor(pageInfo.previousCursor)
    || pageInfo.hasNextPage !== (pageInfo.nextCursor !== null) || pageInfo.hasPreviousPage !== (pageInfo.previousCursor !== null)) return null
  return { pageInfo: pageInfo as LeadPageInfo, viewer }
}
export function readPrivateLeadDetail(value: unknown, expectedId: string): PrivateLeadDetail | null {
  if (!record(value) || !record(value.platformLeadDetail)) return null
  const detail = value.platformLeadDetail
  if (!isPlatformLead(detail.lead) || detail.lead.id !== expectedId || !isOperatorViewer(detail.viewer)
    || !['available', 'restricted'].includes(String(detail.activityAccess)) || !cursor(detail.nextActivityCursor)
    || detail.lead.activityAccess !== detail.activityAccess
    || (detail.activityAccess === 'restricted' && (detail.lead.activities?.length !== 0 || detail.nextActivityCursor !== null))) return null
  return detail as PrivateLeadDetail
}
