import type { Context } from '.keystone/types'
import { activeBrokerageIds, type Session } from '../access'

export type TenantIdentity = Record<string, unknown> & { id: string; brokerage: { id: string; status: string } }
export type ShowingIdentity = TenantIdentity & {
  assignedAgent: { id: string } | null
  lead: TenantIdentity
  property: TenantIdentity
}
export const SHOWING_IDENTITY_QUERY = `id brokerage { id status } assignedAgent { id }
  lead { id brokerage { id status } } property { id brokerage { id status } }`

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
function identifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 200
}
export function tenantIdentity(value: unknown, brokerageId: string): value is TenantIdentity {
  return record(value) && identifier(value.id) && record(value.brokerage)
    && value.brokerage.id === brokerageId && value.brokerage.status === 'active'
}
export function sameShowingIdentity(value: unknown, header: ShowingIdentity): boolean {
  return record(value) && value.id === header.id && tenantIdentity(value, header.brokerage.id)
    && tenantIdentity(value.lead, header.brokerage.id) && value.lead.id === header.lead.id
    && tenantIdentity(value.property, header.brokerage.id) && value.property.id === header.property.id
    && (value.assignedAgent === null ? header.assignedAgent === null
      : record(value.assignedAgent) && value.assignedAgent.id === header.assignedAgent?.id)
}

/** Minimal membership metadata only, never an elevated People profile. */
export async function activeShowingAgent(context: Context, agentId: string | null, brokerageId: string) {
  if (agentId === null) return true // Requested, unrouted records can be reviewed by existing managers.
  if (!identifier(agentId)) return false
  const user = await context.sudo().query.User.findOne({ where: { id: agentId }, query: `id
    brokerageMemberships(where: { status: { equals: active }, brokerage: { id: { equals: ${JSON.stringify(brokerageId)} }, status: { equals: active } } }, take: 1) { status brokerage { id status } }` })
  if (user?.id !== agentId || !Array.isArray(user.brokerageMemberships) || user.brokerageMemberships.length > 1) return false
  return user.brokerageMemberships.some((membership: unknown) => record(membership) && membership.status === 'active'
    && record(membership.brokerage) && membership.brokerage.id === brokerageId && membership.brokerage.status === 'active')
}

/** Called with the fresh transaction Context; validates only identity metadata before PII/evidence. */
export async function scopedShowingIdentity(context: Context, id: string, purpose: 'showing' | 'owned_receipt' = 'showing') {
  const session = context.session as Session | undefined
  const brokerageId = activeBrokerageIds(session)[0]
  if (!identifier(id) || !session?.itemId || !brokerageId || !session.data.role?.canManageShowings) return null
  const item = await context.sudo().query.Showing.findOne({ where: { id }, query: SHOWING_IDENTITY_QUERY })
  if (!record(item) || item.id !== id || !tenantIdentity(item, brokerageId)
    || !tenantIdentity(item.lead, brokerageId) || !tenantIdentity(item.property, brokerageId)
    || !(item.assignedAgent === null || (record(item.assignedAgent) && identifier(item.assignedAgent.id)))) return null
  const header = item as ShowingIdentity
  if (purpose === 'showing' && !session.data.role.canManagePeople && header.assignedAgent?.id !== session.itemId) return null
  if (!await activeShowingAgent(context, header.assignedAgent?.id || null, brokerageId)) return null
  return header
}

/** Existing scheduling purpose allows an unassigned Lead; it does NOT grant a private Lead read. */
export async function scopedSchedulingIdentity(context: Context, leadId: string, propertyId: string, requireCurrentInterest = true) {
  const session = context.session as Session | undefined
  const brokerageId = activeBrokerageIds(session)[0]
  if (!session?.itemId || !brokerageId || !session.data.role?.canManageShowings || !identifier(leadId) || !identifier(propertyId)) return null
  const lead = await context.sudo().query.Lead.findOne({ where: { id: leadId }, query: 'id brokerage { id status } assignedAgent { id } property { id }' })
  if (!record(lead) || lead.id !== leadId || !tenantIdentity(lead, brokerageId)
    || !(lead.assignedAgent === null || (record(lead.assignedAgent) && identifier(lead.assignedAgent.id)))) return null
  if (!session.data.role.canManagePeople && record(lead.assignedAgent) && lead.assignedAgent.id !== session.itemId) return null
  if (requireCurrentInterest && (!record(lead.property) || lead.property.id !== propertyId)) return null
  const property = await context.sudo().query.Property.findOne({ where: { id: propertyId }, query: 'id brokerage { id status }' })
  if (!tenantIdentity(property, brokerageId) || property.id !== propertyId) return null
  return { lead, property, brokerageId }
}
