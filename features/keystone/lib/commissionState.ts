import type { Context } from '.keystone/types'
import { decisionRows } from './commandContext'
import { domainPayloadHash } from './domainEvents'

export function decimalCommissionCents(value: unknown) {
  const match = String(value ?? '').trim().match(/^(\d+)(?:\.(\d{1,2}))?$/)
  if (!match) throw new Error('Commission gross amount is invalid.')
  return BigInt(match[1]) * BigInt(100) + BigInt((match[2] || '').padEnd(2, '0'))
}

export function commissionBatchState(entries: readonly any[], batchKey: string, gross: bigint) {
  const financial = entries.filter(entry => ['allocation', 'allocation_approval', 'receipt', 'reversal'].includes(entry.entryType))
  const rows = financial.filter(entry => entry.batchKey === batchKey)
  const sources = new Map(rows.map(row => [row.id, row]))
  const reversed = new Set<string>()
  let allocations = BigInt(0), receipts = BigInt(0), valid = true
  const currencies = new Set(rows.map(row => row.currencyCode))
  for (const row of rows) {
    const amount = BigInt(row.amountCents)
    if (row.entryType === 'allocation') allocations += amount
    if (row.entryType === 'receipt') receipts += amount
    if (row.entryType === 'reversal') {
      const source = sources.get(row.reverses?.id)
      if (!source || !['allocation', 'receipt'].includes(source.entryType) || reversed.has(source.id) || amount !== -BigInt(source.amountCents)) valid = false
      else {
        reversed.add(source.id)
        if (source.entryType === 'allocation') allocations += amount
        else receipts += amount
      }
    }
  }
  const separatelyApproved = rows.some(row => row.entryType === 'allocation_approval' && row.preparedBy?.id && row.approvedBy?.id && row.preparedBy.id !== row.approvedBy.id)
  const validAllocations = valid && separatelyApproved && currencies.size === 1 && allocations === gross
  // Bind reconciliation to ALL financial facts, including other batches. A new
  // allocation, approval, receipt or reversal invalidates an earlier digest.
  const ledgerStateHash = domainPayloadHash([...financial].sort((a, b) => a.id.localeCompare(b.id)).map(row => ({
    id: row.id, batchKey: row.batchKey, entryType: row.entryType,
    amountCents: String(row.amountCents), currencyCode: row.currencyCode,
    reverses: row.reverses?.id || null, preparedBy: row.preparedBy?.id || null,
    approvedBy: row.approvedBy?.id || null, externalReference: row.externalReference || '',
    sourceDocumentSha256: row.sourceDocumentSha256 || '',
  })))
  return { validAllocations, validReceipts: validAllocations && receipts === gross, ledgerStateHash, currencyCode: rows[0]?.currencyCode || '', allocationNet: allocations, receiptNet: receipts }
}

export function activeAllocationBatches(entries: readonly any[]) {
  const allocations = entries.filter(row => row.entryType === 'allocation')
  const reversed = new Set(entries.filter(row => row.entryType === 'reversal' && allocations.some(source => source.id === row.reverses?.id && BigInt(row.amountCents) === -BigInt(source.amountCents))).map(row => row.reverses.id))
  return new Set(allocations.filter(row => !reversed.has(row.id)).map(row => row.batchKey))
}

export async function commissionDecisionEntries(context: Context, commissionId: string) {
  return decisionRows((context.sudo() as any).query.CommissionLedgerEntry, {
    where: { commission: { id: { equals: commissionId } } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    query: 'id batchKey entryType amountCents currencyCode ledgerStateHash externalReference sourceDocumentSha256 reverses { id } preparedBy { id } approvedBy { id }',
  })
}

export async function requireCurrentCommissionState(context: Context, commissionId: string, grossValue: unknown, requireReconciled: boolean) {
  const entries = await commissionDecisionEntries(context, commissionId)
  const gross = decimalCommissionCents(grossValue)
  const activeBatches = activeAllocationBatches(entries)
  if (activeBatches.size !== 1) throw new Error('A single current allocation batch is required; reverse or review conflicting batches before approval or payment recording.')
  const candidates = entries.filter(row => row.entryType === (requireReconciled ? 'reconciliation' : 'allocation_approval')).reverse()
  for (const candidate of candidates) {
    if (!activeBatches.has(candidate.batchKey)) continue
    const state = commissionBatchState(entries, candidate.batchKey, gross)
    if (!state.validAllocations) continue
    if (requireReconciled && (!state.validReceipts || !candidate.externalReference || candidate.ledgerStateHash !== state.ledgerStateHash)) continue
    return { batchKey: candidate.batchKey, ...state }
  }
  throw new Error(requireReconciled
    ? 'Current, separately approved and reconciled allocation/receipt evidence is required. Reconcile again after ledger changes.'
    : 'A current cent-conserving allocation batch approved by a different authority is required.')
}
