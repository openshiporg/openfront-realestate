import { list } from '@keystone-6/core';
import { checkbox, decimal, integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { canCreateInActiveBrokerage, canMoveToActiveBrokerage, permissions, rules } from '../access';
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks';
import { trackingFields } from './trackingFields';

export const SourceFeed = list({
  access: {
    operation: { query: permissions.canManageListings, create: permissions.canManageBrokerageListings, update: permissions.canManageBrokerageListings, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords, update: rules.canAccessBrokerageRecords },
    item: { create: canCreateInActiveBrokerage, update: canMoveToActiveBrokerage },
  },
  hooks: createTenantOwnedHooks({ listKey: 'SourceFeed', protectDelete: true }),
  ui: {
    hideDelete: true,
    hideCreate: args => !permissions.canManageBrokerageListings(args), listView: { initialColumns: ['name', 'provider', 'feedType', 'status'] } },
  fields: {
    brokerage: relationship({ ref: 'Brokerage' }),
    name: text({ validation: { isRequired: true } }),
    provider: text(),
    feedType: select({ type: 'enum', options: [{ label: 'MLS RETS', value: 'rets' }, { label: 'RESO Web API', value: 'reso' }, { label: 'CSV', value: 'csv' }, { label: 'Manual', value: 'manual' }], defaultValue: 'manual' }),
    status: select({ type: 'enum', options: [{ label: 'Active', value: 'active' }, { label: 'Paused', value: 'paused' }, { label: 'Error', value: 'error' }], defaultValue: 'active', access: { create: () => false, update: () => false } }),
    lastImportedAt: timestamp(),
    recordsImported: integer({ defaultValue: 0, validation: { min: 0 } }),
    credentials: json({
      access: { read: () => false, create: () => false, update: () => false },
      ui: {
        itemView: { fieldMode: 'hidden' },
        createView: { fieldMode: 'hidden' },
      },
    }),
    metadata: json(),
    ...trackingFields,
  },
});
