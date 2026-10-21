import { list } from '@keystone-6/core';
import { checkbox, decimal, integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { canCreateForManagedProperty, canMoveToActiveBrokerage, permissions, rules } from '../access';
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks'
import { trackingFields } from './trackingFields';

export const ListingSyndication = list({
  access: {
    operation: { query: permissions.canManageListings, create: permissions.canManageListings, update: permissions.canManageListings, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords, update: rules.canManagePropertyChildren },
    item: { create: canCreateForManagedProperty, update: canMoveToActiveBrokerage },
  },
  hooks: createTenantOwnedHooks({
    listKey: 'ListingSyndication',
    parents: { property: 'Property' },
    required: ['property'],
    protectDelete: true,
  }),
  ui: {
    hideDelete: true,
    hideCreate: args => !permissions.canManageListings(args), listView: { initialColumns: ['property', 'channel', 'status', 'externalListingId'] } },
  fields: {
    brokerage: relationship({ ref: 'Brokerage.listingSyndications' }),
    channel: select({ type: 'enum', options: [{ label: 'MLS', value: 'mls' }, { label: 'Zillow', value: 'zillow' }, { label: 'Realtor', value: 'realtor' }, { label: 'Website', value: 'website' }, { label: 'Social', value: 'social' }], defaultValue: 'website' }),
    property: relationship({ ref: 'Property' }),
    status: select({ type: 'enum', options: [{ label: 'Draft', value: 'draft' }, { label: 'Reported published (unverified)', value: 'published' }, { label: 'Provider error reported (unverified)', value: 'error' }, { label: 'Reported removed (unverified)', value: 'removed' }], defaultValue: 'draft', access: { create: () => false, update: () => false } }),
    externalListingId: text(),
    listingUrl: text(),
    publishedAt: timestamp({ access: { create: () => false, update: () => false } }),
    lastSyncedAt: timestamp({ access: { create: () => false, update: () => false } }),
    errorMessage: text({ ui: { displayMode: 'textarea' } }),
    metadata: json(),
    ...trackingFields,
  },
});
