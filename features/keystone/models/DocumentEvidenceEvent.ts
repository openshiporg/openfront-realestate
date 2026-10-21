import { list } from '@keystone-6/core'
import { json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { permissions, rules } from '../access'
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks'
import { trackingFields } from './trackingFields'

export const DocumentEvidenceEvent = list({
  access: {
    operation: { query: permissions.canReadSensitiveDeals, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords },
  },
  hooks: createTenantOwnedHooks({
    listKey: 'DocumentEvidenceEvent',
    parents: { document: 'DealDocument', deal: 'Deal', offer: 'Offer' },
    users: ['actor'],
    required: ['document', 'deal', 'actor'],
    coherentWith: { field: 'document', listKey: 'DealDocument', matches: { deal: 'deal' } },
    protectDelete: true,
  }),
  ui: {
    hideDelete: true,
    hideCreate: true, listView: { initialColumns: ['eventKey', 'document', 'eventType', 'occurredAt', 'provider'] } },
  fields: {
    brokerage: relationship({ ref: 'Brokerage.documentEvidenceEvents' }),
    eventKey: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    document: relationship({ ref: 'DealDocument.evidenceEvents' }),
    deal: relationship({ ref: 'Deal.documentEvidenceEvents' }),
    offer: relationship({ ref: 'Offer.documentEvidenceEvents' }),
    eventType: select({
      type: 'enum',
      options: [
        { label: 'Generated', value: 'generated' },
        { label: 'Signed', value: 'signed' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Received', value: 'received' },
        { label: 'Presented', value: 'presented' },
        { label: 'Acknowledged', value: 'acknowledged' },
        { label: 'Voided', value: 'voided' },
      ],
      validation: { isRequired: true },
    }),
    documentSha256: text({ validation: { isRequired: true } }),
    templateSha256: text({ validation: { isRequired: true } }),
    certificateSha256: text(),
    recipients: json(),
    channel: select({
      type: 'enum',
      options: [
        { label: 'E-sign provider', value: 'esign' },
        { label: 'Email', value: 'email' },
        { label: 'Secure portal', value: 'portal' },
        { label: 'In person', value: 'in_person' },
        { label: 'Other approved channel', value: 'other' },
      ],
      validation: { isRequired: true },
    }),
    provider: text({ validation: { isRequired: true } }),
    providerReference: text({ validation: { isRequired: true } }),
    occurredAt: timestamp({ validation: { isRequired: true } }),
    providerReportedAt: timestamp(),
    acknowledgedAt: timestamp(),
    acknowledgementReference: text(),
    reason: text({ validation: { isRequired: true }, ui: { displayMode: 'textarea' } }),
    actor: relationship({ ref: 'User.recordedDocumentEvidenceEvents' }),
    ...trackingFields,
  },
})
