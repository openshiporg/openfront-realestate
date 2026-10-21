import { list } from '@keystone-6/core'
import { checkbox, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { permissions, rules } from '../access'
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks'
import { trackingFields } from './trackingFields'

export const ListingEngagementAuthority = list({
  access: {
    operation: { query: permissions.canManageListings, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords },
  },
  hooks: createTenantOwnedHooks({
    listKey: 'ListingEngagementAuthority',
    parents: { property: 'Property', supersedes: 'ListingEngagementAuthority' },
    users: ['assignedPractitioner', 'recordedBy'],
    required: ['property', 'assignedPractitioner', 'recordedBy'],
    protectDelete: true,
  }),
  ui: {
    hideDelete: true,
    hideCreate: true, listView: { initialColumns: ['authorityNumber', 'property', 'status', 'effectiveFrom', 'effectiveThrough'] } },
  fields: {
    brokerage: relationship({ ref: 'Brokerage.listingEngagementAuthorities' }),
    authorityNumber: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    property: relationship({ ref: 'Property.listingEngagementAuthorities' }),
    assignedPractitioner: relationship({ ref: 'User.listingEngagementAuthorities' }),
    status: select({
      type: 'enum',
      options: [
        { label: 'Executed', value: 'executed' },
        { label: 'Revoked', value: 'revoked' },
        { label: 'Expired', value: 'expired' },
      ],
      validation: { isRequired: true },
    }),
    jurisdictionCode: text({ validation: { isRequired: true } }),
    effectiveFrom: timestamp({ validation: { isRequired: true } }),
    effectiveThrough: timestamp({ validation: { isRequired: true } }),
    exclusive: checkbox({ defaultValue: false }),
    marketingAuthorized: checkbox({ defaultValue: false }),
    showingAuthorized: checkbox({ defaultValue: false }),
    sellerPartySummary: json(),
    signatoryCapacity: text({ validation: { isRequired: true } }),
    documentSha256: text({ validation: { isRequired: true } }),
    documentProviderReference: text(),
    supersedes: relationship({ ref: 'ListingEngagementAuthority.supersededBy' }),
    supersededBy: relationship({ ref: 'ListingEngagementAuthority.supersedes', many: true }),
    reason: text({ validation: { isRequired: true }, ui: { displayMode: 'textarea' } }),
    recordedBy: relationship({ ref: 'User.recordedListingEngagementAuthorities' }),
    recordedAt: timestamp({ validation: { isRequired: true } }),
    ...trackingFields,
  },
})
