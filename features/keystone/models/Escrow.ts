import { list } from '@keystone-6/core';
import { checkbox, integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { canCreateForActiveDeal, permissions, rules } from '../access';
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks';
import { money } from '../lib/money'
import { trackingFields } from './trackingFields';

export const Escrow = list({
  access: {
    operation: { query: permissions.canReadSensitiveDeals, create: permissions.canManageBrokerageDeals, update: permissions.canManageBrokerageDeals, delete: () => false },
    filter: { query: rules.canReadDealChildren, update: rules.canReadDealChildren },
    item: { create: canCreateForActiveDeal },
  },
  hooks: createTenantOwnedHooks({ listKey: 'Escrow', parents: { deal: 'Deal', property: 'Property' }, required: ['deal', 'property'], coherentWith: { field: 'deal', listKey: 'Deal', matches: { property: 'property' } }, deriveOnly: true, protectDelete: true }),
  ui: {
    hideDelete: true,
    hideCreate: args => !permissions.canManageBrokerageDeals(args), listView: { initialColumns: ['escrowNumber', 'deal', 'status', 'scheduledCloseAt'] } },
  fields: {
    escrowNumber: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    deal: relationship({ ref: 'Deal' }),
    property: relationship({ ref: 'Property' }),
    status: select({ type: 'enum', options: [{ label: 'Opened', value: 'opened' }, { label: 'Pending', value: 'pending' }, { label: 'Closed', value: 'closed' }, { label: 'Cancelled', value: 'cancelled' }], defaultValue: 'opened' }),
    escrowCompany: text(),
    officerName: text(),
    officerEmail: text(),
    openedAt: timestamp(),
    scheduledCloseAt: timestamp(),
    closedAt: timestamp(),
    depositAmount: money({ precision: 12, scale: 2 }),
    metadata: json(),
    ...trackingFields,
  },
});
