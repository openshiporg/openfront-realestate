import { list } from '@keystone-6/core'
import { json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { permissions, rules } from '../access'
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks'
import { trackingFields } from './trackingFields'

export const TransactionFileEvent = list({
  access: {
    operation: { query: permissions.canReadSensitiveDeals, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords },
  },
  hooks: createTenantOwnedHooks({
    listKey: 'TransactionFileEvent',
    parents: { deal: 'Deal', document: 'DealDocument', policy: 'RetentionPolicy', reverses: 'TransactionFileEvent' },
    users: ['actor', 'approvedBy'],
    required: ['deal', 'actor'],
    coherentWith: { field: 'document', listKey: 'DealDocument', matches: { deal: 'deal' } },
    protectDelete: true,
  }),
  ui: {
    hideDelete: true,
    hideCreate: true, listView: { initialColumns: ['eventKey', 'deal', 'document', 'eventType', 'occurredAt'] } },
  fields: {
    brokerage: relationship({ ref: 'Brokerage.transactionFileEvents' }),
    eventKey: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    deal: relationship({ ref: 'Deal.transactionFileEvents' }),
    document: relationship({ ref: 'DealDocument.transactionFileEvents' }),
    policy: relationship({ ref: 'RetentionPolicy' }),
    eventType: select({
      type: 'enum',
      options: [
        { label: 'Retention assigned', value: 'retention_assigned' },
        { label: 'Legal hold placed', value: 'hold_placed' },
        { label: 'Legal hold released', value: 'hold_released' },
        { label: 'Export manifested', value: 'export_manifested' },
        { label: 'Disposition requested', value: 'disposition_requested' },
        { label: 'Tombstoned', value: 'tombstoned' },
      ],
      validation: { isRequired: true },
    }),
    triggerAt: timestamp(),
    disposeAfter: timestamp(),
    holdKey: text(),
    manifestKey: text(),
    manifestSha256: text(),
    manifestItems: json(),
    documentSha256: text(),
    externalDeletionReference: text(),
    reverses: relationship({ ref: 'TransactionFileEvent.reversedBy' }),
    reversedBy: relationship({ ref: 'TransactionFileEvent.reverses', many: true }),
    reason: text({ validation: { isRequired: true }, ui: { displayMode: 'textarea' } }),
    actor: relationship({ ref: 'User.recordedTransactionFileEvents' }),
    approvedBy: relationship({ ref: 'User.approvedTransactionFileEvents' }),
    occurredAt: timestamp({ validation: { isRequired: true } }),
    ...trackingFields,
  },
})
