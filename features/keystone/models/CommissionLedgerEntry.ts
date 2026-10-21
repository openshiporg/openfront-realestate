import { list } from '@keystone-6/core'
import { bigInt, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { permissions, rules } from '../access'
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks'
import { trackingFields } from './trackingFields'

export const CommissionLedgerEntry = list({
  access: {
    operation: { query: permissions.canReadSensitiveDeals, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords },
  },
  hooks: createTenantOwnedHooks({
    listKey: 'CommissionLedgerEntry',
    parents: { commission: 'Commission', deal: 'Deal', reverses: 'CommissionLedgerEntry' },
    users: ['payeeUser', 'preparedBy', 'approvedBy'],
    required: ['commission', 'deal', 'preparedBy'],
    coherentWith: { field: 'commission', listKey: 'Commission', matches: { deal: 'deal' } },
    protectDelete: true,
  }),
  ui: {
    hideDelete: true,
    hideCreate: true, listView: { initialColumns: ['entryKey', 'commission', 'entryType', 'amountCents', 'currencyCode', 'occurredAt'] } },
  fields: {
    brokerage: relationship({ ref: 'Brokerage.commissionLedgerEntries' }),
    entryKey: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    batchKey: text({ validation: { isRequired: true } }),
    commission: relationship({ ref: 'Commission.ledgerEntries' }),
    deal: relationship({ ref: 'Deal.commissionLedgerEntries' }),
    entryType: select({
      type: 'enum',
      options: [
        { label: 'Allocation', value: 'allocation' },
        { label: 'Allocation approval', value: 'allocation_approval' },
        { label: 'Receipt', value: 'receipt' },
        { label: 'Reversal', value: 'reversal' },
        { label: 'Reconciliation', value: 'reconciliation' },
      ],
      validation: { isRequired: true },
    }),
    allocationType: select({
      type: 'enum',
      options: [
        { label: 'Brokerage', value: 'brokerage' },
        { label: 'Agent', value: 'agent' },
        { label: 'Team', value: 'team' },
        { label: 'Referral', value: 'referral' },
        { label: 'Fee/adjustment', value: 'fee' },
        { label: 'Unallocated', value: 'unallocated' },
      ],
    }),
    amountCents: bigInt({ validation: { isRequired: true } }),
    currencyCode: text({ validation: { isRequired: true } }),
    payeeUser: relationship({ ref: 'User.commissionLedgerEntries' }),
    payeeLabel: text(),
    externalReference: text(),
    sourceDocumentSha256: text(),
    ledgerStateHash: text({ ui: { description: 'Digest of financial facts at reconciliation; legacy entries require new reconciliation.' } }),
    reverses: relationship({ ref: 'CommissionLedgerEntry.reversedBy' }),
    reversedBy: relationship({ ref: 'CommissionLedgerEntry.reverses', many: true, access: { create: () => false, update: () => false } }),
    reason: text({ validation: { isRequired: true }, ui: { displayMode: 'textarea' } }),
    preparedBy: relationship({ ref: 'User.preparedCommissionLedgerEntries' }),
    approvedBy: relationship({ ref: 'User.approvedCommissionLedgerEntries' }),
    occurredAt: timestamp({ validation: { isRequired: true } }),
    ...trackingFields,
  },
})
