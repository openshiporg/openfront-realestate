import type { Context } from '.keystone/types'
import { type Session } from '../access'
import { domainPayloadHash } from './domainEvents'
import { scopedShowingIdentity } from './showingAssociations'

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
export const SHOWING_EVENT_HEADER_QUERY = 'id eventKey eventType requestHash payloadHash aggregateType aggregateId brokerage { id }'

export function showingEventPayloadMatches(header: unknown, event: unknown) {
  if (!record(header) || !record(event) || !record(event.payload) || typeof header.payloadHash !== 'string'
    || event.id !== header.id || event.requestHash !== header.requestHash || event.payloadHash !== header.payloadHash) return false
  const payload = event.payload
  if (!record(header.brokerage) || !record(event.brokerage) || !record(payload.aggregate)
    || event.brokerage.id !== header.brokerage.id || payload.brokerageId !== header.brokerage.id
    || payload.eventKey !== header.eventKey || payload.eventType !== header.eventType
    || payload.aggregate.type !== header.aggregateType || payload.aggregate.id !== header.aggregateId) return false
  try { return domainPayloadHash(payload) === header.payloadHash } catch { return false }
}

/** Validate immutable original actor/aggregate metadata before fetching a JSON event payload. */
export async function ownedShowingEventHeader(context: Context, event: unknown, input: {
  eventKey: string; eventType: string; purpose: 'showing' | 'owned_receipt'; leadId?: string; propertyId?: string
}) {
  const session = context.session as Session | undefined
  if (!session?.itemId || !record(event) || event.eventKey !== input.eventKey || event.eventType !== input.eventType
    || typeof event.payloadHash !== 'string' || !/^[a-f0-9]{64}$/.test(event.payloadHash)
    || event.aggregateType !== 'showing' || typeof event.aggregateId !== 'string' || !record(event.brokerage)) return false
  const header = await scopedShowingIdentity(context, event.aggregateId, input.purpose)
  if (!header || event.brokerage.id !== header.brokerage.id
    || (input.leadId !== undefined && header.lead.id !== input.leadId)
    || (input.propertyId !== undefined && header.property.id !== input.propertyId)) return false
  const audit = await context.sudo().query.DomainAuditEvent.findOne({
    where: { eventKey: `${input.eventKey}:audit` }, query: 'id brokerage { id } actor { id } aggregateType aggregateId',
  })
  return Boolean(audit?.brokerage?.id === header.brokerage.id && audit.actor?.id === session.itemId
    && audit.aggregateType === 'showing' && audit.aggregateId === header.id)
}
