import { list } from '@keystone-6/core'
import { integer, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { permissions, rules } from '../access'
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks'
import { trackingFields } from './trackingFields'

export const RetentionPolicy = list({
  access: {
    operation: { query: permissions.canManageBrokerageSettings, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords },
  },
  hooks: createTenantOwnedHooks({
    listKey: 'RetentionPolicy',
    parents: { supersedes: 'RetentionPolicy' },
    users: ['approvedBy'],
    required: ['approvedBy'],
    protectDelete: true,
  }),
  ui: {
    hideDelete: true,
    hideCreate: true, listView: { initialColumns: ['policyKey', 'retentionClass', 'jurisdictionCode', 'effectiveFrom', 'retentionDays'] } },
  fields: {
    brokerage: relationship({ ref: 'Brokerage.retentionPolicies' }),
    policyKey: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    retentionClass: select({
      type: 'enum',
      options: [
        { label: 'Transaction file', value: 'transaction_file' },
        { label: 'Listing without close', value: 'listing_no_close' },
        { label: 'Consent/suppression proof', value: 'consent_proof' },
        { label: 'Security/access incident', value: 'security_incident' },
      ],
      validation: { isRequired: true },
    }),
    jurisdictionCode: text({ validation: { isRequired: true } }),
    triggerType: select({
      type: 'enum',
      options: [
        { label: 'Deal closed', value: 'deal_closed' },
        { label: 'Listing ended', value: 'listing_ended' },
        { label: 'Document signed', value: 'document_signed' },
        { label: 'Manual verified trigger', value: 'manual_verified' },
      ],
      validation: { isRequired: true },
    }),
    retentionDays: integer({ validation: { isRequired: true, min: 1, max: 36500 } }),
    disposition: select({
      type: 'enum',
      options: [
        { label: 'Tombstone and request object deletion', value: 'tombstone_delete' },
        { label: 'Archive', value: 'archive' },
        { label: 'Review required', value: 'review' },
      ],
      validation: { isRequired: true },
    }),
    legalBasis: text({ validation: { isRequired: true }, ui: { displayMode: 'textarea' } }),
    effectiveFrom: timestamp({ validation: { isRequired: true } }),
    effectiveThrough: timestamp(),
    supersedes: relationship({ ref: 'RetentionPolicy.supersededBy' }),
    supersededBy: relationship({ ref: 'RetentionPolicy.supersedes', many: true }),
    approvedBy: relationship({ ref: 'User.approvedRetentionPolicies' }),
    approvedAt: timestamp({ validation: { isRequired: true } }),
    reason: text({ validation: { isRequired: true }, ui: { displayMode: 'textarea' } }),
    ...trackingFields,
  },
})
