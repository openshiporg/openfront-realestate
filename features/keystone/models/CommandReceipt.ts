import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { json, relationship, text, timestamp } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { auditRowFilter, gatedPayloadField } from '../lib/auditScope'
import { trackingFields } from './trackingFields'

export const CommandReceipt = list({
  access: {
    operation: { query: permissions.canViewReports, create: denyAll, update: denyAll, delete: denyAll },
    filter: { query: auditRowFilter },
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: { initialColumns: ['occurredAt', 'eventType', 'aggregateType', 'aggregateId'] },
  },
  fields: {
    eventKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    eventType: text({ validation: { isRequired: true }, isIndexed: true }),
    brokerage: relationship({ ref: 'Brokerage.commandReceipts' }),
    aggregateType: text({ validation: { isRequired: true }, isIndexed: true }),
    aggregateId: text({ validation: { isRequired: true }, isIndexed: true }),
    requestHash: text({ validation: { isRequired: true } }),
    payloadHash: text({ validation: { isRequired: true } }),
    payload: json({ ...gatedPayloadField }),
    occurredAt: timestamp({ validation: { isRequired: true }, isIndexed: true }),
    ...trackingFields,
  },
})
