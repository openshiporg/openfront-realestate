import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { json, relationship, text, timestamp } from '@keystone-6/core/fields'

import { permissions, rules } from '../access'
import { trackingFields } from './trackingFields'

export const DomainAuditEvent = list({
  access: {
    operation: { query: permissions.canViewReports, create: denyAll, update: denyAll, delete: denyAll },
    filter: { query: rules.canAccessBrokerageRecords },
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: { initialColumns: ['occurredAt', 'aggregateType', 'aggregateId', 'action', 'actor'] },
  },
  fields: {
    eventKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    brokerage: relationship({ ref: 'Brokerage.auditEvents' }),
    aggregateType: text({ validation: { isRequired: true }, isIndexed: true }),
    aggregateId: text({ validation: { isRequired: true }, isIndexed: true }),
    action: text({ validation: { isRequired: true }, isIndexed: true }),
    actor: relationship({ ref: 'User' }),
    beforeState: json({ access: { create: denyAll, update: denyAll } }),
    afterState: json({ access: { create: denyAll, update: denyAll } }),
    occurredAt: timestamp({ validation: { isRequired: true }, isIndexed: true }),
    ...trackingFields,
  },
})
