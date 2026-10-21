import { list } from '@keystone-6/core';
import { checkbox, decimal, integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { permissions, rules } from '../access';
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks';
import { trackingFields } from './trackingFields';

export const TransactionMilestone = list({
  access: {
    operation: { query: permissions.canReadDeals, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canReadDealChildren },
  },
  hooks: createTenantOwnedHooks({ listKey: 'TransactionMilestone', parents: { deal: 'Deal' }, users: ['assignedTo'], required: ['deal'], protectDelete: true }),
  ui: {
    hideDelete: true,
    hideCreate: true, listView: { initialColumns: ['name', 'deal', 'status', 'dueAt'] } },
  fields: {
    brokerage: relationship({ ref: 'Brokerage' }),
    name: text({ validation: { isRequired: true } }),
    deal: relationship({ ref: 'Deal' }),
    status: select({
      type: 'enum',
      options: [{ label: 'Not Started', value: 'not_started' }, { label: 'In Progress', value: 'in_progress' }, { label: 'Complete', value: 'complete' }, { label: 'Blocked', value: 'blocked' }],
      defaultValue: 'not_started',
      access: { create: () => false, update: () => false },
    }),
    dueAt: timestamp(),
    completedAt: timestamp({ access: { create: () => false, update: () => false } }),
    assignedTo: relationship({ ref: 'User' }),
    sortOrder: integer({ defaultValue: 0 }),
    notes: text({ ui: { displayMode: 'textarea' } }),
    metadata: json(),
    ...trackingFields,
  },
});
