import type { Context } from '.keystone/types'

import { activeBrokerageIds } from '../access'
import { normalizeDomainIdentifier, normalizeDomainJson } from '../lib/domainEvents'

export async function domainOutboxEventStatus(_root: unknown, { eventKey }: { eventKey: string }, context: Context) {
  const role = (context.session as any)?.data?.role
  if (!context.session?.itemId || !role?.canViewReports) return null
  return context.query.DomainOutboxEvent.findOne({
    where: { eventKey: String(eventKey || '').trim() },
    query: 'id eventKey eventType aggregateType aggregateId status attempts replayCount availableAt occurredAt dispatchedAt lastError',
  })
}

export async function replayDomainOutboxEvent(_root: unknown, { eventId }: { eventId: string }, context: Context) {
  const role = (context.session as any)?.data?.role
  if (!context.session?.itemId || !role?.canViewReports) return { ok: false, message: 'Access denied.', itemId: null, replayed: false }
  return context.transaction(async transactionContext => {
    const scoped = transactionContext.withSession(context.session)
    const sudo = scoped.sudo() as any
    await sudo.prisma.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `outbox-replay:${eventId}`)
    const event = await sudo.query.DomainOutboxEvent.findOne({ where: { id: eventId }, query: 'id status replayCount brokerage { id }' })
    if (!event || !activeBrokerageIds(scoped.session as any).includes(event.brokerage?.id)) return { ok: false, message: 'Event not found or access denied.', itemId: null, replayed: false }
    if (event.status === 'pending') return { ok: true, message: 'Event is already pending.', itemId: event.id, replayed: true }
    if (!['failed', 'dispatched'].includes(event.status)) return { ok: false, message: `Cannot replay event from ${event.status}.`, itemId: event.id, replayed: false }
    await sudo.query.DomainOutboxEvent.updateOne({ where: { id: event.id }, data: { status: 'pending', replayCount: Number(event.replayCount || 0) + 1, availableAt: new Date().toISOString(), lastError: '' }, query: 'id' })
    await sudo.query.DomainAuditEvent.createOne({ data: { eventKey: `outbox:${event.id}:replay:${Number(event.replayCount || 0) + 1}`, brokerage: { connect: { id: event.brokerage.id } }, aggregateType: 'domainOutboxEvent', aggregateId: normalizeDomainIdentifier(event.id, 'Outbox event identifier'), action: 'replay', actor: { connect: { id: context.session.itemId } }, beforeState: normalizeDomainJson({ status: event.status, replayCount: event.replayCount }), afterState: normalizeDomainJson({ status: 'pending', replayCount: Number(event.replayCount || 0) + 1 }), occurredAt: new Date().toISOString() }, query: 'id' })
    return { ok: true, message: 'Event queued for replay.', itemId: event.id, replayed: false }
  }, { timeout: 30_000 })
}
