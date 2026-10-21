import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { permissions, rules } from '../access'
import { trackingFields } from './trackingFields'

export const DomainOutboxEvent = list({
  access: {
    operation: { query: permissions.canViewReports, create: denyAll, update: denyAll, delete: denyAll },
    filter: { query: rules.canAccessBrokerageRecords },
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: { initialColumns: ['occurredAt', 'eventType', 'aggregateType', 'aggregateId', 'status', 'attempts'] },
  },
  fields: {
    eventKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    eventType: text({ validation: { isRequired: true }, isIndexed: true }),
    brokerage: relationship({ ref: 'Brokerage.outboxEvents' }),
    aggregateType: text({ validation: { isRequired: true }, isIndexed: true }),
    aggregateId: text({ validation: { isRequired: true }, isIndexed: true }),
    requestHash: text({ validation: { isRequired: true } }),
    payloadHash: text({ validation: { isRequired: true } }),
    payload: json({ access: { create: denyAll, update: denyAll } }),
    status: select({
      type: 'enum',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Processing', value: 'processing' },
        { label: 'Dispatched', value: 'dispatched' },
        { label: 'Failed', value: 'failed' },
      ],
      defaultValue: 'pending',
      validation: { isRequired: true },
      isIndexed: true,
    }),
    attempts: integer({ defaultValue: 0, validation: { min: 0 } }),
    replayCount: integer({ defaultValue: 0, validation: { min: 0 } }),
    availableAt: timestamp({ defaultValue: { kind: 'now' }, isIndexed: true }),
    occurredAt: timestamp({ validation: { isRequired: true }, isIndexed: true }),
    dispatchedAt: timestamp(),
    lastError: text({ ui: { displayMode: 'textarea' } }),
    ...trackingFields,
  },
})
