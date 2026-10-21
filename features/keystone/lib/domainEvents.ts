import crypto from 'node:crypto'

export type DomainIdentifier = string | number | bigint

export type DomainEventInput = {
  eventKey: string
  eventType: string
  brokerageId: DomainIdentifier
  aggregateType: string
  aggregateId: DomainIdentifier
  actorId?: DomainIdentifier | null
  action: string
  request: Record<string, unknown>
  before?: unknown
  after?: unknown
  occurredAt?: string
}

const sensitiveKey = /(?:credentials?|password|secret|token|api[_-]?key|private[_-]?key|client[_-]?secret)/i
const decimalPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i

type JsonNormalizationOptions = { redactSensitive?: boolean }

function decimalValue(value: object) {
  const prototype = Object.getPrototypeOf(value)
  const constructorName = prototype?.constructor?.name
  const tag = Object.prototype.toString.call(value)
  if (constructorName !== 'Decimal' && tag !== '[object Decimal]') return null
  const rendered = String((value as { toString: () => string }).toString())
  if (!decimalPattern.test(rendered)) throw new Error('Domain JSON contains an invalid Decimal value')
  return rendered
}

function normalizeJsonValue(value: unknown, options: JsonNormalizationOptions, ancestors: WeakSet<object>, path: string): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Domain JSON contains a non-finite number at ${path}`)
    return Object.is(value, -0) ? 0 : value
  }
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
    throw new Error(`Domain JSON contains unsupported ${typeof value} at ${path}`)
  }
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new Error(`Domain JSON contains an invalid Date at ${path}`)
    return value.toISOString()
  }
  const decimal = decimalValue(value)
  if (decimal !== null) return decimal
  if (ancestors.has(value)) throw new Error(`Domain JSON contains a cyclic reference at ${path}`)

  const prototype = Object.getPrototypeOf(value)
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new Error(`Domain JSON contains unsupported object ${prototype?.constructor?.name || 'prototype'} at ${path}`)
  }
  if (Object.getOwnPropertySymbols(value).length) throw new Error(`Domain JSON contains symbol keys at ${path}`)

  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      return Array.from(value, (child, index) => normalizeJsonValue(child, options, ancestors, `${path}[${index}]`))
    }
    const normalized: Record<string, unknown> = {}
    for (const key of Object.keys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor || !('value' in descriptor)) throw new Error(`Domain JSON contains an accessor at ${path}.${key}`)
      if (options.redactSensitive && sensitiveKey.test(key)) {
        normalizeJsonValue(descriptor.value, { redactSensitive: false }, ancestors, `${path}.${key}`)
        normalized[key] = '[REDACTED]'
      } else {
        normalized[key] = normalizeJsonValue(descriptor.value, options, ancestors, `${path}.${key}`)
      }
    }
    return normalized
  } finally {
    ancestors.delete(value)
  }
}

export function normalizeDomainJson(value: unknown, options: JsonNormalizationOptions = {}) {
  return normalizeJsonValue(value, options, new WeakSet(), '$')
}

export function redactDomainSecrets(value: unknown): unknown {
  return normalizeDomainJson(value, { redactSensitive: true })
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalValue(child)])
    )
  }
  return value
}

export function canonicalDomainJson(value: unknown) {
  return JSON.stringify(canonicalValue(normalizeDomainJson(value)))
}

export function domainPayloadHash(value: unknown) {
  return crypto.createHash('sha256').update(canonicalDomainJson(value)).digest('hex')
}

export function normalizeDomainIdentifier(value: DomainIdentifier, label = 'Domain identifier') {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 0)) {
    throw new Error(`${label} must be a non-negative safe integer or non-empty string`)
  }
  const normalized = String(value).trim()
  if (!normalized) throw new Error(`${label} is required`)
  return normalized
}

function boundedDomainEvent(input: DomainEventInput) {
  const eventKey = String(input.eventKey || '').trim()
  if (!eventKey || eventKey.length > 240) throw new Error('A bounded domain event key is required')

  return {
    ...input,
    eventKey,
    brokerageId: normalizeDomainIdentifier(input.brokerageId, 'Brokerage identifier'),
    aggregateId: normalizeDomainIdentifier(input.aggregateId, 'Aggregate identifier'),
    actorId: input.actorId == null ? null : normalizeDomainIdentifier(input.actorId, 'Actor identifier'),
  }
}

/** Controlled commands: the xact lock and replay check only take effect inside context.transaction. */
export async function enqueueDomainEvent(context: any, command: DomainEventInput) {
  const input = boundedDomainEvent(command)
  const { eventKey } = input
  const sudo = context.sudo()
  const requestHash = domainPayloadHash(input.request)
  await sudo.prisma.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `domain-event:${eventKey}`)

  const existing = await sudo.query.DomainOutboxEvent.findOne({
    where: { eventKey },
    query: 'id eventKey requestHash payload',
  })
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new Error('Domain event idempotency key was reused with a different command')
    }
    return { eventId: existing.id, replayed: true, result: existing.payload?.result ?? null }
  }

  return writeDomainEvent(sudo, input, requestHash)
}

type CrudDomainEventInput = Omit<DomainEventInput, 'eventKey' | 'eventType' | 'action'> & {
  operation: 'create' | 'update' | 'delete'
}

/**
 * Generic CRUD hook evidence. The key embeds a crypto.randomUUID() generated here, so sharing
 * a key with another writer is vanishingly unlikely (not impossible), and a lock or replay
 * lookup on it would serialize nothing in practice. Callers cannot choose the key, so this
 * path cannot be used to skip a controlled command's lock or replay check.
 */
export async function recordCrudDomainEvent(context: any, { operation, ...event }: CrudDomainEventInput) {
  if (operation !== 'create' && operation !== 'update' && operation !== 'delete') {
    throw new Error('CRUD domain events require a create, update or delete operation')
  }
  const input = boundedDomainEvent({
    ...event,
    eventKey: `hook:${event.aggregateType}:${event.aggregateId}:${operation}:${crypto.randomUUID()}`,
    eventType: `${event.aggregateType}.${operation}d`,
    action: operation,
  })
  return writeDomainEvent(context.sudo(), input, domainPayloadHash(input.request))
}

async function writeDomainEvent(sudo: any, input: ReturnType<typeof boundedDomainEvent>, requestHash: string) {
  const { eventKey, brokerageId, aggregateId, actorId } = input
  const occurredAt = input.occurredAt || new Date().toISOString()
  const payload = redactDomainSecrets({
    schemaVersion: 1,
    eventKey,
    eventType: input.eventType,
    brokerageId,
    aggregate: { type: input.aggregateType, id: aggregateId },
    actorId,
    occurredAt,
    request: input.request,
    before: input.before ?? null,
    after: input.after ?? null,
    result: input.after ?? null,
  }) as Record<string, any>
  const payloadHash = domainPayloadHash(payload)

  await sudo.query.DomainAuditEvent.createOne({
    data: {
      eventKey: `${eventKey}:audit`,
      brokerage: { connect: { id: brokerageId } },
      aggregateType: input.aggregateType,
      aggregateId,
      action: input.action,
      ...(actorId ? { actor: { connect: { id: actorId } } } : {}),
      beforeState: payload.before,
      afterState: payload.after,
      occurredAt,
    },
    query: 'id',
  })

  const event = await sudo.query.DomainOutboxEvent.createOne({
    data: {
      eventKey,
      eventType: input.eventType,
      brokerage: { connect: { id: brokerageId } },
      aggregateType: input.aggregateType,
      aggregateId,
      requestHash,
      payloadHash,
      payload,
      status: 'pending',
      attempts: 0,
      replayCount: 0,
      availableAt: occurredAt,
      occurredAt,
    },
    query: 'id eventKey',
  })

  return { eventId: event.id, replayed: false, result: payload.result ?? null }
}
