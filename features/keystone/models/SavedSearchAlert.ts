import { list } from '@keystone-6/core';
import { checkbox, decimal, integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { canCreateForActiveSavedSearch, canMoveToActiveBrokerage, permissions, rules } from '../access';
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks';
import { trackingFields } from './trackingFields';

export const SavedSearchAlert = list({
  access: {
    operation: { query: permissions.canReadLeads, create: permissions.canManageLeads, update: permissions.canManageLeads, delete: () => false },
    filter: { query: rules.canReadSavedSearchAlerts, update: rules.canReadSavedSearchAlerts },
    item: { create: canCreateForActiveSavedSearch, update: canMoveToActiveBrokerage },
  },
  hooks: createTenantOwnedHooks({ listKey: 'SavedSearchAlert', parents: { savedSearch: 'SavedSearch' }, users: ['user'], required: ['savedSearch', 'user'], protectDelete: true }),
  ui: {
    hideDelete: true,
    hideCreate: args => !permissions.canManageLeads(args), listView: { initialColumns: ['savedSearch', 'user', 'status', 'cadence'] } },
  fields: {
    brokerage: relationship({ ref: 'Brokerage' }),
    savedSearch: relationship({ ref: 'SavedSearch' }),
    user: relationship({ ref: 'User' }),
    status: select({ type: 'enum', options: [{ label: 'Active', value: 'active' }, { label: 'Paused', value: 'paused' }, { label: 'Unsubscribed', value: 'unsubscribed' }], defaultValue: 'active' }),
    cadence: select({ type: 'enum', options: [{ label: 'Instant', value: 'instant' }, { label: 'Daily', value: 'daily' }, { label: 'Weekly', value: 'weekly' }], defaultValue: 'daily' }),
    lastSentAt: timestamp(),
    sentCount: integer({ defaultValue: 0, validation: { min: 0 } }),
    metadata: json(),
    ...trackingFields,
  },
});
