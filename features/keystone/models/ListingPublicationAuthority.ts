import { list } from '@keystone-6/core'
import { relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { permissions, rules } from '../access'
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks'
import { trackingFields } from './trackingFields'

export const ListingPublicationAuthority = list({
  access: {
    operation: { query: permissions.canManageListings, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords },
  },
  hooks: createTenantOwnedHooks({
    listKey: 'ListingPublicationAuthority',
    parents: { property: 'Property', engagement: 'ListingEngagementAuthority', supersedes: 'ListingPublicationAuthority' },
    users: ['recordedBy'],
    required: ['property', 'engagement', 'recordedBy'],
    coherentWith: { field: 'engagement', listKey: 'ListingEngagementAuthority', matches: { property: 'property' } },
    protectDelete: true,
  }),
  ui: {
    hideDelete: true,
    hideCreate: true, listView: { initialColumns: ['authorityNumber', 'property', 'destination', 'status', 'effectiveFrom', 'effectiveThrough'] } },
  fields: {
    brokerage: relationship({ ref: 'Brokerage.listingPublicationAuthorities' }),
    authorityNumber: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    property: relationship({ ref: 'Property.listingPublicationAuthorities' }),
    engagement: relationship({ ref: 'ListingEngagementAuthority' }),
    destination: select({
      type: 'enum',
      options: [
        { label: 'Public website', value: 'public_site' },
        { label: 'MLS submission', value: 'mls' },
        { label: 'IDX display', value: 'idx' },
        { label: 'Syndication', value: 'syndication' },
      ],
      validation: { isRequired: true },
    }),
    status: select({
      type: 'enum',
      options: [
        { label: 'Authorized', value: 'authorized' },
        { label: 'Revoked', value: 'revoked' },
        { label: 'Expired', value: 'expired' },
      ],
      validation: { isRequired: true },
    }),
    effectiveFrom: timestamp({ validation: { isRequired: true } }),
    effectiveThrough: timestamp({ validation: { isRequired: true } }),
    authorityBasis: text({ validation: { isRequired: true } }),
    localRuleReference: text(),
    dataUseGrantReference: text(),
    supersedes: relationship({ ref: 'ListingPublicationAuthority.supersededBy' }),
    supersededBy: relationship({ ref: 'ListingPublicationAuthority.supersedes', many: true }),
    reason: text({ validation: { isRequired: true }, ui: { displayMode: 'textarea' } }),
    recordedBy: relationship({ ref: 'User.recordedListingPublicationAuthorities' }),
    recordedAt: timestamp({ validation: { isRequired: true } }),
    ...trackingFields,
  },
})
