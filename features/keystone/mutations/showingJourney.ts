import type { Context } from '.keystone/types'
import { activeBrokerageIds, type Session } from '../access'
import { freshOperatorCommandContext } from '../lib/commandContext'
import { domainPayloadHash } from '../lib/domainEvents'
import { showingReviewRevision } from '../lib/showingReviewRevision'
import { sameShowingIdentity, scopedSchedulingIdentity, scopedShowingIdentity } from '../lib/showingAssociations'
import { ownedShowingEventHeader, showingEventPayloadMatches, SHOWING_EVENT_HEADER_QUERY } from '../lib/showingEventScope'

export function showingScopeAllows(context: Context, item: any) {
  const session = context.session as any
  return Boolean(session?.itemId && session.data?.role?.canManageShowings
    && activeBrokerageIds(session).includes(item?.brokerage?.id)
    && (session.data.role.canManagePeople || item.assignedAgent?.id === session.itemId))
}

// Receipt authority is deliberately narrower than a Showing read: the original
// command actor + currently permitted Lead + exact request. It conveys no PII,
// Property details, notes or arbitrary Showing membership.
export async function ownsShowingScheduleReceipt(scoped: Context, event: any, leadId: string, propertyId: string) {
  const session = scoped.session as any
  const payload = event?.payload
  if (!session?.data?.role?.canManageShowings || payload?.actorId !== session?.itemId
    || event?.brokerage?.id !== activeBrokerageIds(session)[0] || payload?.brokerageId !== event.brokerage.id
    || payload?.eventType !== 'showing.scheduled' || payload?.aggregate?.type !== 'showing'
    || payload?.request?.leadId !== leadId || payload?.request?.propertyId !== propertyId
    || domainPayloadHash(payload.request) !== event.requestHash || payload?.result?.ok !== true
    || typeof payload.result.itemId !== 'string' || !payload.result.itemId || payload.aggregate.id !== payload.result.itemId) return false
  const identity = await scopedSchedulingIdentity(scoped, leadId, propertyId, false)
  if (!identity || identity.brokerageId !== event.brokerage.id) return false
  const showing = await scopedShowingIdentity(scoped, payload.result.itemId, 'owned_receipt')
  return Boolean(showing && showing.lead.id === leadId && showing.property.id === propertyId)
}

export function showingSnapshot(property: any, input: {
  leadId: string; assignedAgentId: string | null; scheduledStart: string; scheduledEnd: string; showingType: string; notes: string
}, capturedAt: string) {
  return {
    version: 1, capturedAt, ...input,
    propertyId: property.id, listingTitle: property.title || '', listingSlug: property.slug || '',
    addressLine1: property.addressLine1 || '', city: property.city || '', state: property.state || '',
    listingType: property.listingType || '', price: property.price == null ? null : String(property.price), propertyUpdatedAt: property.updatedAt || null,
  }
}

export async function scheduledShowingReceipt(_root: unknown, { data }: { data: any }, context: Context) {
  const session = context.session as any
  if (!session?.itemId || !session.data?.role?.canManageShowings || !activeBrokerageIds(session).length) return null
  const leadId = String(data.leadId || '').trim(), propertyId = String(data.propertyId || '').trim()
  const key = String(data.idempotencyKey || '').trim()
  if (!leadId || leadId.length > 200 || !propertyId || propertyId.length > 200 || !key || key.length > 120) return null
  const request = {
    leadId, propertyId, assignedAgentId: String(data.assignedAgentId || '').trim(),
    scheduledStart: String(data.scheduledStart || '').trim(), notes: String(data.notes || '').trim(),
    ...(data.originalActorId == null && data.originalBrokerageId == null ? {} : {
      originalActorId: String(data.originalActorId || '').trim(), originalBrokerageId: String(data.originalBrokerageId || '').trim(),
    }),
  }
  if (request.assignedAgentId.length > 200 || request.scheduledStart.length > 100 || request.notes.length > 5000) return null
  return context.transaction(async tx => {
    const scoped = await freshOperatorCommandContext(tx.withSession(context.session))
    if (request.originalActorId !== undefined && (request.originalActorId !== (scoped.session as { itemId?: string })?.itemId
      || request.originalBrokerageId !== activeBrokerageIds(scoped.session)[0])) return null
    if (!await scopedSchedulingIdentity(scoped, leadId, propertyId, false)) return null
    const eventKey = `command:lead:${leadId}:schedule-showing:${key}`
    const eventHeader = await scoped.sudo().query.DomainOutboxEvent.findOne({ where: { eventKey }, query: SHOWING_EVENT_HEADER_QUERY })
    if (!eventHeader || eventHeader.requestHash !== domainPayloadHash(request) || !await ownedShowingEventHeader(scoped, eventHeader, { eventKey, eventType: 'showing.scheduled', purpose: 'owned_receipt', leadId, propertyId })) return null
    const event = await scoped.sudo().query.DomainOutboxEvent.findOne({
      where: { eventKey: `command:lead:${leadId}:schedule-showing:${key}` },
      query: 'id requestHash payloadHash payload brokerage { id }',
    }) as any
    if (!showingEventPayloadMatches(eventHeader, event) || event.requestHash !== domainPayloadHash(request)
      || !await ownsShowingScheduleReceipt(scoped, event, leadId, propertyId)) return null
    const receipt = event.payload?.result?.receipt || (event.payload?.result?.ok === true ? {
      version: 1, showingId: event.payload.result.itemId,
      leadId: event.payload?.request?.leadId, propertyId: event.payload?.request?.propertyId,
    } : null)
    if (event.payload?.result?.ok !== true || typeof receipt?.showingId !== 'string' || !receipt.showingId.trim() || receipt.showingId.length > 200
      || event.payload?.aggregate?.type !== 'showing' || receipt.version !== 1 || receipt.leadId !== leadId || receipt.propertyId !== propertyId
      || receipt.showingId !== event.payload?.result?.itemId || event.payload?.aggregate?.id !== receipt.showingId) return null
    // Verify that the stored association still exists; raw query ACLs are NOT widened.
    const showing = await scopedShowingIdentity(scoped, receipt.showingId, 'owned_receipt')
    if (!showing || showing.brokerage.id !== event.brokerage.id || showing.lead.id !== leadId || showing.property.id !== propertyId) return null
    return { version: 1, showingId: showing.id, leadId, propertyId }
  }, { timeout: 30_000 })
}

const DETAIL_QUERY = `id status showingType scheduledStart scheduledEnd notes feedback createdAt updatedAt
  brokerage { id status } assignedAgent { id }
  property { id brokerage { id status } title slug addressLine1 city state price listingType }
  lead { id brokerage { id status } name email phone status intent }`

export async function scopedShowingPresentation(context: Context, id: string) {
  const current = context.session as Session
    const header = await scopedShowingIdentity(context, id)
    if (!header) return null
    const sudo = context.sudo()
    const item = (await sudo.query.Showing.findMany({
      where: { AND: [
        { id: { equals: id } }, { brokerage: { id: { in: activeBrokerageIds(current) } } },
        { lead: { id: { equals: header.lead.id }, brokerage: { id: { equals: header.brokerage.id }, status: { equals: 'active' } } } },
        { property: { id: { equals: header.property.id }, brokerage: { id: { equals: header.brokerage.id }, status: { equals: 'active' } } } },
        ...(!current.data.role.canManagePeople ? [{ assignedAgent: { id: { equals: current.itemId } } }] : []),
      ] }, take: 1, query: DETAIL_QUERY,
    }))[0]
    if (!item || !sameShowingIdentity(item, header) || !showingScopeAllows(context, item)) return null
    // Showing-purpose contact only; no arbitrary Lead history or elevated People profile.
    const profile = header.assignedAgent ? await context.query.User.findOne({
      where: { id: header.assignedAgent.id }, query: 'id name email phone',
    }) : null
    if (profile && profile.id !== header.assignedAgent?.id) return null
    const showing = {
      id: item.id, status: item.status, showingType: item.showingType, scheduledStart: item.scheduledStart,
      scheduledEnd: item.scheduledEnd, notes: item.notes, feedback: item.feedback, createdAt: item.createdAt,
      lead: { id: item.lead.id, name: item.lead.name, email: item.lead.email, phone: item.lead.phone, status: item.lead.status, intent: item.lead.intent },
      property: { id: item.property.id, title: item.property.title, slug: item.property.slug, addressLine1: item.property.addressLine1,
        city: item.property.city, state: item.property.state, price: item.property.price, listingType: item.property.listingType },
      assignedAgent: header.assignedAgent ? { id: header.assignedAgent.id, name: profile?.name || '', email: profile?.email || null, phone: profile?.phone || null } : null,
    }
    return { header, item, showing }
}

export async function platformShowingDetail(_root: unknown, { id, before }: { id: string; before?: string }, context: Context) {
  const session = context.session as any
  if (!session?.itemId || !session.data?.role?.canManageShowings || !activeBrokerageIds(session).length) return null
  if (!id || id.length > 200 || (before && before.length > 200)) throw new Error('Invalid showing/history identity.')
  return context.transaction(async tx => {
    const scoped = await freshOperatorCommandContext(tx.withSession(context.session))
    const current = scoped.session as any
    if (!current?.data?.role?.canManageShowings) return null
    const view = await scopedShowingPresentation(scoped, id)
    if (!view) return null
    const { item, showing } = view
    const sudo = scoped.sudo()
    const where = { brokerage: { id: { equals: item.brokerage.id } }, aggregateType: { equals: 'showing' }, aggregateId: { equals: id } }
    let anchor: any = null
    if (before) {
      anchor = await sudo.query.DomainAuditEvent.findOne({ where: { id: before }, query: 'id occurredAt brokerage { id } aggregateType aggregateId' })
      if (!anchor || anchor.brokerage?.id !== item.brokerage.id || anchor.aggregateType !== 'showing' || anchor.aggregateId !== id) throw new Error('Invalid showing history cursor.')
    }
    const rows = await sudo.query.DomainAuditEvent.findMany({
      where: { AND: [where, ...(anchor ? [{ OR: [
        { occurredAt: { lt: anchor.occurredAt } },
        { occurredAt: { equals: anchor.occurredAt }, id: { lt: anchor.id } },
      ] }] : [])] },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: 51,
      query: 'id action occurredAt beforeState afterState',
    }) as any[]
    // Original source snapshot comes from the first request/schedule event, not
    // today's mutable notes/title. Legacy records remain explicitly unavailable.
    const origins = await sudo.query.DomainAuditEvent.findMany({
      where: { AND: [where, { action: { in: ['request', 'schedule'] } }] },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }], take: 1, query: 'afterState',
    }) as any[]
    const snapshot = origins[0]?.afterState?.snapshot
    const validSnapshot = snapshot?.version === 1 && snapshot.propertyId === item.property?.id && snapshot.leadId === item.lead?.id
    return {
      showing, updatedAt: item.updatedAt, revision: await showingReviewRevision(scoped, item), snapshot: validSnapshot ? snapshot : null,
      history: rows.slice(0, 50).map(row => ({
        id: row.id, action: row.action, occurredAt: row.occurredAt,
        fromStatus: row.beforeState?.status || null, toStatus: row.afterState?.status || null,
      })),
      nextHistoryCursor: rows.length > 50 ? rows[49].id : null,
    }
  }, { timeout: 30_000 })
}
