import { list } from '@keystone-6/core'
import { relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { permissions, rules } from '../access'
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks'
import { trackingFields } from './trackingFields'

export const RepresentationAuthority = list({
  access: {
    operation: { query: permissions.canReadSensitiveDeals, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords },
  },
  hooks: createTenantOwnedHooks({
    listKey: 'RepresentationAuthority',
    parents: { lead: 'Lead', property: 'Property', deal: 'Deal', supersedes: 'RepresentationAuthority' },
    users: ['practitioner', 'recordedBy'],
    required: ['lead', 'practitioner', 'recordedBy'],
    protectDelete: true,
  }),
  ui: {
    hideDelete: true,
    hideCreate: true, listView: { initialColumns: ['authorityNumber', 'lead', 'side', 'relationshipType', 'status', 'effectiveThrough'] } },
  fields: {
    brokerage: relationship({ ref: 'Brokerage.representationAuthorities' }),
    authorityNumber: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    lead: relationship({ ref: 'Lead.representationAuthorities' }),
    property: relationship({ ref: 'Property.representationAuthorities' }),
    deal: relationship({ ref: 'Deal.representationAuthorities' }),
    practitioner: relationship({ ref: 'User.representationAuthorities' }),
    side: select({
      type: 'enum',
      options: [
        { label: 'Buyer', value: 'buyer' },
        { label: 'Seller', value: 'seller' },
      ],
      validation: { isRequired: true },
    }),
    relationshipType: select({
      type: 'enum',
      options: [
        { label: 'Exclusive agency', value: 'exclusive_agency' },
        { label: 'Non-exclusive agency', value: 'nonexclusive_agency' },
        { label: 'Transaction brokerage/facilitation', value: 'transaction_brokerage' },
        { label: 'Customer assistance only', value: 'customer_assistance' },
      ],
      validation: { isRequired: true },
    }),
    jurisdictionCode: text({ validation: { isRequired: true } }),
    status: select({
      type: 'enum',
      options: [
        { label: 'Executed', value: 'executed' },
        { label: 'Terminated', value: 'terminated' },
        { label: 'Expired', value: 'expired' },
      ],
      validation: { isRequired: true },
    }),
    effectiveFrom: timestamp({ validation: { isRequired: true } }),
    effectiveThrough: timestamp({ validation: { isRequired: true } }),
    scopeSummary: text({ validation: { isRequired: true }, ui: { displayMode: 'textarea' } }),
    documentSha256: text({ validation: { isRequired: true } }),
    disclosureVersion: text({ validation: { isRequired: true } }),
    consentRecordedAt: timestamp({ validation: { isRequired: true } }),
    supersedes: relationship({ ref: 'RepresentationAuthority.supersededBy' }),
    supersededBy: relationship({ ref: 'RepresentationAuthority.supersedes', many: true }),
    reason: text({ validation: { isRequired: true }, ui: { displayMode: 'textarea' } }),
    recordedBy: relationship({ ref: 'User.recordedRepresentationAuthorities' }),
    recordedAt: timestamp({ validation: { isRequired: true } }),
    ...trackingFields,
  },
})
