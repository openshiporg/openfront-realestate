import crypto from 'node:crypto'
import type { Context } from '.keystone/types'

import { boundedIdempotencyKey, boundedReason, isSha256 } from '../lib/authorityEvidence'
import { canonicalDomainJson } from '../lib/domainEvents'
import { evidenceActorId, evidenceBrokerageId, runControlledEvidenceCommand } from './controlledEvidenceCommand'
import { commandText as clean } from '../../lib/date-time'
function at(value: unknown, label: string) {
  const date = new Date(clean(value))
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} must be a valid timestamp.`)
  return date
}
function policySuffix(key: string) { return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16) }
export function transactionManifestSha256(manifestKey: string, dealId: string, items: readonly { documentId: string; sha256: string }[]) {
  const canonicalItems = [...items].sort((left, right) => left.documentId.localeCompare(right.documentId))
  return crypto.createHash('sha256').update(canonicalDomainJson({ manifestKey, dealId, items: canonicalItems })).digest('hex')
}

export async function recordRetentionPolicyCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const retentionClass = clean(data.retentionClass), jurisdictionCode = clean(data.jurisdictionCode).toUpperCase(), triggerType = clean(data.triggerType), retentionDays = Number(data.retentionDays), disposition = clean(data.disposition), legalBasis = clean(data.legalBasis), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey)
  const effectiveFrom = at(data.effectiveFrom, 'Effective from').toISOString(), effectiveThrough = clean(data.effectiveThrough) ? at(data.effectiveThrough, 'Effective through').toISOString() : ''
  if (!['transaction_file', 'listing_no_close', 'consent_proof', 'security_incident'].includes(retentionClass) || !jurisdictionCode || !['deal_closed', 'listing_ended', 'document_signed', 'manual_verified'].includes(triggerType) || !Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 36500 || !['tombstone_delete', 'archive', 'review'].includes(disposition) || !legalBasis || legalBasis.length > 5000 || (effectiveThrough && new Date(effectiveThrough) <= new Date(effectiveFrom))) throw new Error('Valid effective-dated retention policy evidence is required.')
  const brokerageId = evidenceBrokerageId(context) || '', request = { retentionClass, jurisdictionCode, triggerType, retentionDays, disposition, legalBasis, effectiveFrom, effectiveThrough, reason }
  return runControlledEvidenceCommand(context, {
    eventKey: `command:retention-policy:${retentionClass}:${jurisdictionCode}:${key}`, lockKey: `retention-policy:${brokerageId}:${retentionClass}:${jurisdictionCode}`, permission: 'canAccessDashboard', managerRequired: true, request,
    execute: async scoped => {
      const sudo = scoped.sudo() as any
      const prior = await sudo.query.RetentionPolicy.findMany({ where: { brokerage: { id: { equals: brokerageId } }, retentionClass: { equals: retentionClass }, jurisdictionCode: { equals: jurisdictionCode } }, orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }], take: 1, query: 'id' })
      const item = await sudo.query.RetentionPolicy.createOne({ data: { brokerage: { connect: { id: brokerageId } }, policyKey: `RP-${retentionClass}-${jurisdictionCode}-${policySuffix(key)}`, retentionClass, jurisdictionCode, triggerType, retentionDays, disposition, legalBasis, effectiveFrom, effectiveThrough: effectiveThrough || null, ...(prior[0]?.id ? { supersedes: { connect: { id: prior[0].id } } } : {}), approvedBy: { connect: { id: evidenceActorId(scoped)! } }, approvedAt: new Date().toISOString(), reason }, query: 'id' })
      const result = { ok: true, message: 'Immutable effective-dated retention policy appended.', itemId: item.id }
      return { result, event: { eventType: 'retention.policy_recorded', brokerageId, aggregateType: 'retentionPolicy', aggregateId: item.id, actorId: evidenceActorId(scoped), action: 'record_policy', before: prior[0] || null, after: { ...result, retentionClass, jurisdictionCode } } }
    },
  })
}

export async function assignTransactionFileRetentionCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const dealId = clean(data.dealId), documentId = clean(data.documentId), policyId = clean(data.policyId), documentSha256 = clean(data.documentSha256).toLowerCase(), triggerAt = at(data.triggerAt, 'Retention trigger').toISOString(), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey)
  if (!dealId || !documentId || !policyId || !isSha256(documentSha256)) throw new Error('Deal, document, policy, and checksum are required.')
  const brokerageId = evidenceBrokerageId(context) || '', request = { dealId, documentId, policyId, documentSha256, triggerAt, reason }
  return runControlledEvidenceCommand(context, {
    eventKey: `command:transaction-file:${documentId}:assign-retention:${key}`, lockKey: `transaction-file:${documentId}`, permission: 'canManageDeals', managerRequired: true, request,
    execute: async scoped => {
      const sudo = scoped.sudo() as any
      const [deal, document, policy, evidence] = await Promise.all([
        sudo.query.Deal.findOne({ where: { id: dealId }, query: 'id stage closedAt property { state } brokerage { id }' }),
        sudo.query.DealDocument.findOne({ where: { id: documentId }, query: 'id status signedAt createdAt deal { id } brokerage { id }' }),
        sudo.query.RetentionPolicy.findOne({ where: { id: policyId }, query: 'id retentionClass jurisdictionCode triggerType retentionDays disposition effectiveFrom effectiveThrough brokerage { id }' }),
        sudo.query.DocumentEvidenceEvent.findMany({ where: { document: { id: { equals: documentId } }, documentSha256: { equals: documentSha256 } }, take: 1, query: 'id' }),
      ])
      const trigger = new Date(triggerAt), policyEffective = policy && new Date(policy.effectiveFrom) <= trigger && (!policy.effectiveThrough || new Date(policy.effectiveThrough) >= trigger)
      const triggerValid = policy?.triggerType === 'deal_closed'
        ? ['closed_won', 'closed_lost'].includes(deal?.stage) && Boolean(deal?.closedAt) && trigger.getTime() === new Date(deal.closedAt).getTime()
        : policy?.triggerType === 'document_signed'
          ? ['signed', 'archived'].includes(document?.status) && Boolean(document?.signedAt) && trigger.getTime() === new Date(document.signedAt).getTime()
          : policy?.triggerType === 'manual_verified' && trigger.getTime() >= new Date(document?.createdAt).getTime() && trigger.getTime() <= Date.now()
      if (policy?.retentionClass !== 'transaction_file' || policy?.jurisdictionCode !== String(deal?.property?.state || '').toUpperCase()) return { result: { ok: false, message: 'The transaction-file policy must match the listing jurisdiction.', itemId: null }, event: null as never }
      if (!deal || !document || document.deal?.id !== dealId || deal.brokerage?.id !== brokerageId || document.brokerage?.id !== brokerageId || !policy || policy.brokerage?.id !== brokerageId || !policyEffective || !triggerValid || !evidence.length) return { result: { ok: false, message: 'Retention assignment lacks coherent trigger, policy, checksum evidence, or brokerage scope.', itemId: null }, event: null as never }
      const disposeAfter = new Date(trigger.getTime() + Number(policy.retentionDays) * 24 * 60 * 60_000).toISOString()
      const item = await sudo.query.TransactionFileEvent.createOne({ data: { brokerage: { connect: { id: brokerageId } }, eventKey: `TF-${policySuffix(`${documentId}:${key}`)}`, deal: { connect: { id: dealId } }, document: { connect: { id: documentId } }, policy: { connect: { id: policyId } }, eventType: 'retention_assigned', triggerAt, disposeAfter, documentSha256, reason, actor: { connect: { id: evidenceActorId(scoped)! } }, approvedBy: { connect: { id: evidenceActorId(scoped)! } }, occurredAt: new Date().toISOString() }, query: 'id' })
      const result = { ok: true, message: 'Transaction-file retention trigger and disposition date recorded.', itemId: item.id }
      return { result, event: { eventType: 'retention.assigned', brokerageId, aggregateType: 'dealDocument', aggregateId: documentId, actorId: evidenceActorId(scoped), action: 'assign_retention', before: null, after: { ...result, triggerAt, disposeAfter, documentSha256 } } }
    },
  })
}

export async function recordTransactionLegalHoldCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const dealId = clean(data.dealId), documentId = clean(data.documentId), holdKey = clean(data.holdKey), action = clean(data.action), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey)
  if (!dealId || !holdKey || holdKey.length > 160 || !['place', 'release'].includes(action)) throw new Error('Deal, bounded hold key, and hold action are required.')
  const brokerageId = evidenceBrokerageId(context) || '', request = { dealId, documentId, holdKey, action, reason }
  return runControlledEvidenceCommand(context, {
    eventKey: `command:legal-hold:${holdKey}:${action}:${key}`, lockKey: `legal-hold:${brokerageId}:${holdKey}`, permission: 'canManageDeals', managerRequired: true, request,
    execute: async scoped => {
      const sudo = scoped.sudo() as any
      const [deal, document, prior] = await Promise.all([
        sudo.query.Deal.findOne({ where: { id: dealId }, query: 'id brokerage { id }' }),
        documentId ? sudo.query.DealDocument.findOne({ where: { id: documentId }, query: 'id deal { id } brokerage { id }' }) : null,
        sudo.query.TransactionFileEvent.findMany({ where: { brokerage: { id: { equals: brokerageId } }, holdKey: { equals: holdKey }, eventType: { in: ['hold_placed', 'hold_released'] } }, orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }], take: 1, query: 'id eventType deal { id } document { id }' }),
      ])
      if (prior[0] && (prior[0].deal?.id !== dealId || (prior[0].document?.id || '') !== documentId)) return { result: { ok: false, message: 'A hold key cannot be moved to another transaction or document.', itemId: null }, event: null as never }
      if (!deal || deal.brokerage?.id !== brokerageId || (documentId && (!document || document.brokerage?.id !== brokerageId || document.deal?.id !== dealId)) || (action === 'place' && prior[0]?.eventType === 'hold_placed') || (action === 'release' && prior[0]?.eventType !== 'hold_placed')) return { result: { ok: false, message: 'Legal-hold state or transaction-file scope is invalid.', itemId: null }, event: null as never }
      const item = await sudo.query.TransactionFileEvent.createOne({ data: { brokerage: { connect: { id: brokerageId } }, eventKey: `HOLD-${policySuffix(`${holdKey}:${action}:${key}`)}`, deal: { connect: { id: dealId } }, ...(documentId ? { document: { connect: { id: documentId } } } : {}), eventType: action === 'place' ? 'hold_placed' : 'hold_released', holdKey, ...(prior[0]?.id ? { reverses: { connect: { id: prior[0].id } } } : {}), reason, actor: { connect: { id: evidenceActorId(scoped)! } }, approvedBy: { connect: { id: evidenceActorId(scoped)! } }, occurredAt: new Date().toISOString() }, query: 'id' })
      const result = { ok: true, message: `Legal hold ${action === 'place' ? 'placed' : 'released'} without deleting transaction evidence.`, itemId: item.id }
      return { result, event: { eventType: `retention.hold_${action === 'place' ? 'placed' : 'released'}`, brokerageId, aggregateType: 'deal', aggregateId: dealId, actorId: evidenceActorId(scoped), action: `hold_${action}`, before: prior[0] || null, after: { ...result, holdKey, documentId: documentId || null } } }
    },
  })
}

export async function createTransactionExportManifestCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const dealId = clean(data.dealId), manifestKey = clean(data.manifestKey), manifestSha256 = clean(data.manifestSha256).toLowerCase(), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey)
  if (!dealId || !manifestKey || manifestKey.length > 200 || !Array.isArray(data.items) || data.items.length < 1 || data.items.length > 500) throw new Error('Deal, manifest key, and one to 500 checksummed items are required.')
  const items = data.items.map((item: any) => ({ documentId: clean(item.documentId), sha256: clean(item.sha256).toLowerCase() })).sort((left: any, right: any) => left.documentId.localeCompare(right.documentId))
  if (items.some((item: any) => !item.documentId || !isSha256(item.sha256))) throw new Error('Every export item requires a document and SHA-256 checksum.')
  const computedHash = transactionManifestSha256(manifestKey, dealId, items)
  if (manifestSha256 !== computedHash) throw new Error('Export manifest checksum does not match its canonical contents.')
  const brokerageId = evidenceBrokerageId(context) || '', request = { dealId, manifestKey, manifestSha256, items, reason }
  return runControlledEvidenceCommand(context, {
    eventKey: `command:transaction-file:${dealId}:manifest:${key}`, lockKey: `transaction-file-manifest:${dealId}`, permission: 'canManageDeals', managerRequired: true, request,
    execute: async scoped => {
      const sudo = scoped.sudo() as any
      const deal = await sudo.query.Deal.findOne({ where: { id: dealId }, query: 'id brokerage { id }' })
      if (!deal || deal.brokerage?.id !== brokerageId) return { result: { ok: false, message: 'Deal not found or access denied.', itemId: null }, event: null as never }
      for (const entry of items) {
        const [document, evidence] = await Promise.all([
          sudo.query.DealDocument.findOne({ where: { id: entry.documentId }, query: 'id deal { id } brokerage { id }' }),
          sudo.query.DocumentEvidenceEvent.findMany({ where: { document: { id: { equals: entry.documentId } }, documentSha256: { equals: entry.sha256 } }, take: 1, query: 'id' }),
        ])
        if (!document || document.deal?.id !== dealId || document.brokerage?.id !== brokerageId || !evidence.length) return { result: { ok: false, message: 'Manifest contains an unscoped or unverified document checksum.', itemId: null }, event: null as never }
      }
      const item = await sudo.query.TransactionFileEvent.createOne({ data: { brokerage: { connect: { id: brokerageId } }, eventKey: `MANIFEST-${policySuffix(`${manifestKey}:${key}`)}`, deal: { connect: { id: dealId } }, eventType: 'export_manifested', manifestKey, manifestSha256, manifestItems: items, reason, actor: { connect: { id: evidenceActorId(scoped)! } }, approvedBy: { connect: { id: evidenceActorId(scoped)! } }, occurredAt: new Date().toISOString() }, query: 'id' })
      const result = { ok: true, message: 'Immutable checksummed transaction export manifest appended.', itemId: item.id }
      return { result, event: { eventType: 'retention.export_manifested', brokerageId, aggregateType: 'deal', aggregateId: dealId, actorId: evidenceActorId(scoped), action: 'manifest_export', before: null, after: { ...result, manifestKey, manifestSha256, itemCount: items.length } } }
    },
  })
}

export async function tombstoneTransactionFileCommand(_root: unknown, _args: { data: any }, _context: Context) {
  // A supplied manager ID is not that manager's consent. Preserve all existing
  // files/history until a reviewed proposal + independently authenticated,
  // version-bound approval + verified export/object-disposition protocol exists.
  return { ok: false, message: 'Automatic document disposal is turned off. Keep the file and ask an administrator to review it.', itemId: null, replayed: false }
}
