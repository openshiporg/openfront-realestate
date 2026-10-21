import type { Context } from '.keystone/types'
import { lockCommandAggregate } from '../lib/aggregateLock'

import { activeBrokerageIds } from '../access'
import { freshOperatorCommandContext } from '../lib/commandContext'
import { domainPayloadHash, enqueueDomainEvent } from '../lib/domainEvents'
import { showingEventPayloadMatches, SHOWING_EVENT_HEADER_QUERY } from '../lib/showingEventScope'

export function evidenceActorId(context: Context) {
  return (context.session as any)?.itemId as string | undefined
}

export function evidenceRole(context: Context) {
  return (context.session as any)?.data?.role || {}
}

export function evidenceBrokerageId(context: Context) {
  return activeBrokerageIds(context.session as any)[0] as string | undefined
}

export async function runControlledEvidenceCommand(context: Context, options: {
  eventKey: string
  lockKey: string
  permission: string
  managerRequired?: boolean
  request: Record<string, unknown>
  authorizeTarget?: (scoped: Context) => Promise<boolean>
  authorizeReplayHeader?: (scoped: Context, header: unknown) => Promise<boolean>
  authorizeReplay?: (scoped: Context, existing: any) => Promise<boolean>
  execute: (scoped: Context) => Promise<{ result: any; event: any }>
}) {
  const actor = evidenceActorId(context)
  const brokerageId = evidenceBrokerageId(context)
  const role = evidenceRole(context)
  if (!actor || !brokerageId || !role[options.permission] || (options.managerRequired && !role.canManagePeople)) {
    return { ok: false, message: 'Access denied.', itemId: null, replayed: false }
  }
  if (!options.eventKey || options.eventKey.length > 240 || !options.lockKey || options.lockKey.length > 240) {
    return { ok: false, message: 'A bounded command key is required.', itemId: null, replayed: false }
  }
  return context.transaction(async transactionContext => {
    const scoped = await freshOperatorCommandContext(context.session ? transactionContext.withSession(context.session) : transactionContext)
    const currentRole = evidenceRole(scoped)
    if (!currentRole[options.permission] || (options.managerRequired && !currentRole.canManagePeople)) {
      return { ok: false, message: 'Access denied.', itemId: null, replayed: false }
    }
    const sudo = scoped.sudo() as any
    await sudo.prisma.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', options.lockKey)
    await lockCommandAggregate(scoped, options.lockKey, evidenceBrokerageId(scoped)!)
    if (options.authorizeTarget && !await options.authorizeTarget(scoped)) return { ok: false, message: 'Access denied.', itemId: null, replayed: false }
    const candidate = await sudo.query.DomainOutboxEvent.findOne({ where: { eventKey: options.eventKey }, query: options.authorizeReplayHeader ? SHOWING_EVENT_HEADER_QUERY : 'id requestHash payload brokerage { id }' })
    if (candidate && options.authorizeReplayHeader && !await options.authorizeReplayHeader(scoped, candidate)) return { ok: false, message: 'Access denied.', itemId: null, replayed: false }
    if (candidate && options.authorizeReplayHeader && candidate.requestHash !== domainPayloadHash(options.request)) throw new Error('Domain command idempotency key was reused with different input')
    const existing = candidate && options.authorizeReplayHeader ? await sudo.query.DomainOutboxEvent.findOne({ where: { eventKey: options.eventKey }, query: 'id requestHash payloadHash payload brokerage { id }' }) : candidate
    if (candidate && (!existing || existing.id !== candidate.id || existing.requestHash !== candidate.requestHash
      || (options.authorizeReplayHeader && !showingEventPayloadMatches(candidate, existing)))) return { ok: false, message: 'Access denied.', itemId: null, replayed: false }
    if (existing) {
      if (existing.brokerage?.id !== evidenceBrokerageId(scoped)) return { ok: false, message: 'Access denied.', itemId: null, replayed: false }
      if (existing.requestHash !== domainPayloadHash(options.request)) throw new Error('Domain command idempotency key was reused with different input')
      if (options.authorizeReplay && !await options.authorizeReplay(scoped, existing)) {
        return { ok: false, message: 'Access denied.', itemId: null, replayed: false }
      }
      return { ...(existing.payload?.result || {}), replayed: true }
    }
    const executed = await options.execute(scoped)
    if (!executed.result.ok) return { ...executed.result, replayed: false }
    await enqueueDomainEvent(sudo, { eventKey: options.eventKey, request: options.request, ...executed.event })
    return { ...executed.result, replayed: false }
  }, { timeout: 30_000 })
}
