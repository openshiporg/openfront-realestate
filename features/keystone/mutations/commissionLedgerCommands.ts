import crypto from 'node:crypto'
import type { Context } from '.keystone/types'

import { boundedIdempotencyKey, boundedReason, isSha256 } from '../lib/authorityEvidence'
import { activeAllocationBatches, commissionBatchState, commissionDecisionEntries } from '../lib/commissionState'
import { evidenceActorId, evidenceBrokerageId, evidenceRole, runControlledEvidenceCommand } from './controlledEvidenceCommand'

function clean(value: unknown) { return String(value || '').trim() }
function cents(value: unknown, label: string, allowZero = false) {
  const raw = clean(value)
  if (!/^-?\d{1,18}$/.test(raw)) throw new Error(`${label} must be an integer cent amount.`)
  const amount = BigInt(raw)
  if ((!allowZero && amount <= BigInt(0)) || (allowZero && amount < BigInt(0))) throw new Error(`${label} must be ${allowZero ? 'non-negative' : 'positive'}.`)
  return amount
}
export function commissionDecimalToCents(value: unknown) {
  const raw = clean(value)
  const match = raw.match(/^(\d+)(?:\.(\d{1,2}))?$/)
  if (!match) throw new Error('Commission gross amount is invalid.')
  return BigInt(match[1]) * BigInt(100) + BigInt((match[2] || '').padEnd(2, '0'))
}
export function commissionCentsConserve(expected: bigint, amounts: readonly (bigint | string)[]) {
  return amounts.reduce<bigint>((sum, amount) => sum + BigInt(amount), BigInt(0)) === expected
}
function currency(value: unknown) {
  const code = clean(value).toUpperCase()
  if (!/^[A-Z]{3}$/.test(code)) throw new Error('A three-letter currency code is required.')
  return code
}
function batchKey(commissionId: string, key: string) { return `CB-${crypto.createHash('sha256').update(`${commissionId}:${key}`).digest('hex').slice(0, 20)}` }

async function loadCommission(scoped: Context, commissionId: string) {
  return scoped.sudo().query.Commission.findOne({ where: { id: commissionId }, query: 'id status grossCommission brokerage { id } deal { id stage } agent { id }' })
}
function commissionAuthorized(scoped: Context, commission: any) {
  const actor = evidenceActorId(scoped)
  return commission?.brokerage?.id === evidenceBrokerageId(scoped) && (evidenceRole(scoped).canManagePeople || commission.agent?.id === actor)
}

export async function proposeCommissionAllocationCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const commissionId = clean(data.commissionId), code = currency(data.currencyCode), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey)
  if (!commissionId || !Array.isArray(data.lines) || data.lines.length < 1 || data.lines.length > 50) throw new Error('One to 50 commission allocation lines are required.')
  const lines = data.lines.map((line: any) => {
    const allocationType = clean(line.allocationType), amountCents = cents(line.amountCents, 'Allocation amount'), payeeUserId = clean(line.payeeUserId), payeeLabel = clean(line.payeeLabel)
    if (!['brokerage', 'agent', 'team', 'referral', 'fee', 'unallocated'].includes(allocationType) || (!payeeUserId && !payeeLabel) || payeeLabel.length > 300) throw new Error('Each allocation requires a type, positive cents, and payee.')
    return { allocationType, amountCents: amountCents.toString(), payeeUserId, payeeLabel }
  })
  const brokerageId = evidenceBrokerageId(context) || '', batch = batchKey(commissionId, key)
  const request = { commissionId, currencyCode: code, lines, reason, batch }
  return runControlledEvidenceCommand(context, {
    eventKey: `command:commission:${commissionId}:allocation:${key}`, lockKey: `ledger:commission:${commissionId}`, permission: 'canManageDeals', request,
    execute: async scoped => {
      const sudo = scoped.sudo() as any
      const commission = await loadCommission(scoped, commissionId)
      if (!commissionAuthorized(scoped, commission) || !['projected', 'approved'].includes(commission.status)) return { result: { ok: false, message: 'Commission is unavailable for allocation.', itemId: null }, event: null as never }
      if (activeAllocationBatches(await commissionDecisionEntries(scoped, commissionId)).size) return { result: { ok: false, message: 'Reverse or review the existing allocation before proposing another batch.', itemId: null }, event: null as never }
      const grossCents = commissionDecimalToCents(commission.grossCommission)
      const allocationTotal = lines.reduce((sum: bigint, line: any) => sum + BigInt(line.amountCents), BigInt(0))
      if (!commissionCentsConserve(grossCents, lines.map((line: any) => line.amountCents))) return { result: { ok: false, message: `Allocation cents must conserve the gross commission (${grossCents}).`, itemId: null }, event: null as never }
      for (const line of lines) {
        if (line.payeeUserId) {
          const payee = await sudo.query.User.findOne({ where: { id: line.payeeUserId }, query: 'id brokerageMemberships(where: { status: { equals: active } }) { brokerage { id status } }' })
          if (!(payee?.brokerageMemberships || []).some((membership: any) => membership.brokerage?.id === brokerageId && membership.brokerage?.status === 'active')) return { result: { ok: false, message: 'An allocation payee is outside the active brokerage.', itemId: null }, event: null as never }
        }
      }
      const created = []
      for (const [index, line] of lines.entries()) {
        created.push(await sudo.query.CommissionLedgerEntry.createOne({ data: { brokerage: { connect: { id: brokerageId } }, entryKey: `${batch}:allocation:${index + 1}`, batchKey: batch, commission: { connect: { id: commission.id } }, deal: { connect: { id: commission.deal.id } }, entryType: 'allocation', allocationType: line.allocationType, amountCents: line.amountCents, currencyCode: code, ...(line.payeeUserId ? { payeeUser: { connect: { id: line.payeeUserId } } } : {}), payeeLabel: line.payeeLabel, reason, preparedBy: { connect: { id: evidenceActorId(scoped)! } }, occurredAt: new Date().toISOString() }, query: 'id' }))
      }
      const result = { ok: true, message: 'Cent-conserving commission allocation proposal appended.', itemId: created[0].id }
      return { result, event: { eventType: 'commission.allocation_proposed', brokerageId, aggregateType: 'commission', aggregateId: commission.id, actorId: evidenceActorId(scoped), action: 'propose_allocation', before: null, after: { ...result, batchKey: batch, grossCents: grossCents.toString(), lineCount: created.length } } }
    },
  })
}

export async function approveCommissionAllocationCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const commissionId = clean(data.commissionId), batch = clean(data.batchKey), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey)
  if (!commissionId || !batch) throw new Error('Commission and allocation batch are required.')
  const brokerageId = evidenceBrokerageId(context) || '', request = { commissionId, batchKey: batch, reason }
  return runControlledEvidenceCommand(context, {
    eventKey: `command:commission:${commissionId}:approve-allocation:${key}`, lockKey: `ledger:commission:${commissionId}`, permission: 'canManageDeals', managerRequired: true, request,
    execute: async scoped => {
      const sudo = scoped.sudo() as any, commission = await loadCommission(scoped, commissionId), actor = evidenceActorId(scoped)!
      if (!commissionAuthorized(scoped, commission)) return { result: { ok: false, message: 'Commission is unavailable.', itemId: null }, event: null as never }
      const [allocations, approvals] = await Promise.all([
        sudo.query.CommissionLedgerEntry.findMany({ where: { commission: { id: { equals: commissionId } }, batchKey: { equals: batch }, entryType: { equals: 'allocation' } }, take: 100, query: 'id amountCents currencyCode preparedBy { id }' }),
        sudo.query.CommissionLedgerEntry.findMany({ where: { commission: { id: { equals: commissionId } }, batchKey: { equals: batch }, entryType: { equals: 'allocation_approval' } }, take: 1, query: 'id' }),
      ])
      if (!allocations.length || approvals.length) return { result: { ok: false, message: 'Allocation batch is missing or already approved.', itemId: null }, event: null as never }
      if (allocations.some((entry: any) => entry.preparedBy?.id === actor)) return { result: { ok: false, message: 'Allocation approver must differ from its preparer.', itemId: null }, event: null as never }
      const total = allocations.reduce((sum: bigint, entry: any) => sum + BigInt(entry.amountCents), BigInt(0))
      if (!commissionCentsConserve(commissionDecimalToCents(commission.grossCommission), allocations.map((entry: any) => entry.amountCents)) || new Set(allocations.map((entry: any) => entry.currencyCode)).size !== 1) return { result: { ok: false, message: 'Allocation batch does not conserve commission cents or currency.', itemId: null }, event: null as never }
      const item = await sudo.query.CommissionLedgerEntry.createOne({ data: { brokerage: { connect: { id: brokerageId } }, entryKey: `${batch}:approval:${key}`, batchKey: batch, commission: { connect: { id: commission.id } }, deal: { connect: { id: commission.deal.id } }, entryType: 'allocation_approval', amountCents: '0', currencyCode: allocations[0].currencyCode, reason, preparedBy: { connect: { id: allocations[0].preparedBy.id } }, approvedBy: { connect: { id: actor } }, occurredAt: new Date().toISOString() }, query: 'id' })
      const result = { ok: true, message: 'Commission allocation batch approved by a separate authority.', itemId: item.id }
      return { result, event: { eventType: 'commission.allocation_approved', brokerageId, aggregateType: 'commission', aggregateId: commission.id, actorId: actor, action: 'approve_allocation', before: null, after: { ...result, batchKey: batch, totalCents: total.toString() } } }
    },
  })
}

export async function recordCommissionReceiptCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const commissionId = clean(data.commissionId), batch = clean(data.batchKey), amount = cents(data.amountCents, 'Receipt amount'), code = currency(data.currencyCode), externalReference = clean(data.externalReference), sourceDocumentSha256 = clean(data.sourceDocumentSha256).toLowerCase(), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey)
  if (!commissionId || !batch || !externalReference || externalReference.length > 500 || !isSha256(sourceDocumentSha256)) throw new Error('Receipt requires an approved batch, external reference, and source-document hash.')
  const brokerageId = evidenceBrokerageId(context) || '', request = { commissionId, batchKey: batch, amountCents: amount.toString(), currencyCode: code, externalReference, sourceDocumentSha256, reason }
  return runControlledEvidenceCommand(context, {
    eventKey: `command:commission:${commissionId}:receipt:${key}`, lockKey: `ledger:commission:${commissionId}`, permission: 'canManageDeals', managerRequired: true, request,
    execute: async scoped => {
      const sudo = scoped.sudo() as any, commission = await loadCommission(scoped, commissionId)
      if (!commissionAuthorized(scoped, commission) || commission.deal?.stage !== 'closed_won') return { result: { ok: false, message: 'A closed-won commission is required.', itemId: null }, event: null as never }
      if (['paid', 'clawed_back'].includes(commission.status)) return { result: { ok: false, message: 'Terminal commission receipt changes require a reviewed correction; no receipt was appended.', itemId: null }, event: null as never }
      const approvals = await sudo.query.CommissionLedgerEntry.findMany({ where: { commission: { id: { equals: commissionId } }, batchKey: { equals: batch }, entryType: { equals: 'allocation_approval' } }, take: 1, query: 'id currencyCode' })
      if (!approvals.length || approvals[0].currencyCode !== code) return { result: { ok: false, message: 'A matching approved allocation batch is required.', itemId: null }, event: null as never }
      const duplicates = await sudo.query.CommissionLedgerEntry.findMany({ where: { commission: { id: { equals: commissionId } }, entryType: { equals: 'receipt' }, externalReference: { equals: externalReference } }, take: 1, query: 'id' })
      if (duplicates.length) return { result: { ok: false, message: 'This external receipt reference is already recorded.', itemId: null }, event: null as never }
      const item = await sudo.query.CommissionLedgerEntry.createOne({ data: { brokerage: { connect: { id: brokerageId } }, entryKey: `${batch}:receipt:${key}`, batchKey: batch, commission: { connect: { id: commission.id } }, deal: { connect: { id: commission.deal.id } }, entryType: 'receipt', amountCents: amount.toString(), currencyCode: code, externalReference, sourceDocumentSha256, reason, preparedBy: { connect: { id: evidenceActorId(scoped)! } }, approvedBy: { connect: { id: evidenceActorId(scoped)! } }, occurredAt: new Date().toISOString() }, query: 'id' })
      const result = { ok: true, message: 'External commission receipt evidence appended; no funds were moved.', itemId: item.id }
      return { result, event: { eventType: 'commission.receipt_recorded', brokerageId, aggregateType: 'commission', aggregateId: commission.id, actorId: evidenceActorId(scoped), action: 'record_receipt', before: null, after: { ...result, amountCents: amount.toString(), externalReference } } }
    },
  })
}

export async function reverseCommissionLedgerEntryCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const entryId = clean(data.entryId), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey)
  if (!entryId) throw new Error('Ledger entry is required.')
  const brokerageId = evidenceBrokerageId(context) || '', request = { entryId, reason }
  return runControlledEvidenceCommand(context, {
    eventKey: `command:commission-ledger:${entryId}:reverse:${key}`, lockKey: `ledger-entry:${entryId}`, permission: 'canManageDeals', managerRequired: true, request,
    execute: async scoped => {
      const sudo = scoped.sudo() as any
      const entry = await sudo.query.CommissionLedgerEntry.findOne({ where: { id: entryId }, query: 'id entryKey batchKey entryType amountCents currencyCode brokerage { id } commission { id } deal { id } preparedBy { id }' })
      if (!entry || entry.brokerage?.id !== brokerageId || !['allocation', 'receipt'].includes(entry.entryType)) return { result: { ok: false, message: 'Reversible ledger entry not found.', itemId: null }, event: null as never }
      const existing = await sudo.query.CommissionLedgerEntry.findMany({ where: { reverses: { id: { equals: entry.id } }, entryType: { equals: 'reversal' } }, take: 1, query: 'id' })
      if (existing.length) return { result: { ok: false, message: 'Ledger entry already has a reversal.', itemId: null }, event: null as never }
      const item = await sudo.query.CommissionLedgerEntry.createOne({ data: { brokerage: { connect: { id: brokerageId } }, entryKey: `${entry.entryKey}:reversal:${key}`, batchKey: entry.batchKey, commission: { connect: { id: entry.commission.id } }, deal: { connect: { id: entry.deal.id } }, entryType: 'reversal', amountCents: (-BigInt(entry.amountCents)).toString(), currencyCode: entry.currencyCode, reverses: { connect: { id: entry.id } }, reason, preparedBy: { connect: { id: evidenceActorId(scoped)! } }, approvedBy: { connect: { id: evidenceActorId(scoped)! } }, occurredAt: new Date().toISOString() }, query: 'id' })
      const commission = await loadCommission(scoped, entry.commission.id)
      if (commission?.status === 'paid') await sudo.query.Commission.updateOne({ where: { id: commission.id }, data: { status: 'clawed_back' }, query: 'id' })
      const result = { ok: true, message: 'Append-only commission reversal recorded; previous reconciliation is no longer current.', itemId: item.id }
      return { result, event: { eventType: 'commission.entry_reversed', brokerageId, aggregateType: 'commission', aggregateId: entry.commission.id, actorId: evidenceActorId(scoped), action: 'reverse_entry', before: entry, after: result } }
    },
  })
}

export async function reconcileCommissionLedgerCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const commissionId = clean(data.commissionId), batch = clean(data.batchKey), externalReference = clean(data.externalReference), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey)
  if (!commissionId || !batch || !externalReference || externalReference.length > 500) throw new Error('Commission, batch, and accounting reconciliation reference are required.')
  const brokerageId = evidenceBrokerageId(context) || '', request = { commissionId, batchKey: batch, externalReference, reason }
  return runControlledEvidenceCommand(context, {
    eventKey: `command:commission:${commissionId}:reconcile:${key}`, lockKey: `ledger:commission:${commissionId}`, permission: 'canManageDeals', managerRequired: true, request,
    execute: async scoped => {
      const sudo = scoped.sudo() as any, commission = await loadCommission(scoped, commissionId)
      if (!commissionAuthorized(scoped, commission)) return { result: { ok: false, message: 'Commission is unavailable.', itemId: null }, event: null as never }
      const entries = await commissionDecisionEntries(scoped, commissionId)
      const gross = commissionDecimalToCents(commission.grossCommission)
      const state = commissionBatchState(entries, batch, gross)
      if (!state.validReceipts) return { result: { ok: false, message: `Reconciliation requires separately approved allocations and conserved allocation/receipt cents (${gross}).`, itemId: null }, event: null as never }
      const code = state.currencyCode
      const item = await sudo.query.CommissionLedgerEntry.createOne({ data: { brokerage: { connect: { id: brokerageId } }, entryKey: `${batch}:reconciliation:${key}`, batchKey: batch, commission: { connect: { id: commission.id } }, deal: { connect: { id: commission.deal.id } }, entryType: 'reconciliation', amountCents: '0', currencyCode: code, ledgerStateHash: state.ledgerStateHash, externalReference, reason, preparedBy: { connect: { id: evidenceActorId(scoped)! } }, approvedBy: { connect: { id: evidenceActorId(scoped)! } }, occurredAt: new Date().toISOString() }, query: 'id' })
      const result = { ok: true, message: 'Commission ledger reconciled with cent conservation; accounting remains authoritative.', itemId: item.id }
      return { result, event: { eventType: 'commission.reconciled', brokerageId, aggregateType: 'commission', aggregateId: commission.id, actorId: evidenceActorId(scoped), action: 'reconcile', before: null, after: { ...result, grossCents: gross.toString(), externalReference } } }
    },
  })
}
