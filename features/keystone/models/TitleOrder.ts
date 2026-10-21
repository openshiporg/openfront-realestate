import { list } from '@keystone-6/core';
import { checkbox, decimal, integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { canCreateForActiveDeal, permissions, rules } from '../access';
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks';
import { trackingFields } from './trackingFields';

export const TitleOrder = list({
  access: {
    operation: { query: permissions.canReadSensitiveDeals, create: permissions.canManageBrokerageDeals, update: permissions.canManageBrokerageDeals, delete: () => false },
    filter: { query: rules.canReadDealChildren, update: rules.canReadDealChildren },
    item: { create: canCreateForActiveDeal },
  },
  hooks: createTenantOwnedHooks({ listKey: 'TitleOrder', parents: { deal: 'Deal', property: 'Property' }, required: ['deal', 'property'], coherentWith: { field: 'deal', listKey: 'Deal', matches: { property: 'property' } }, deriveOnly: true, protectDelete: true }),
  ui: {
    hideDelete: true,
    hideCreate: args => !permissions.canManageBrokerageDeals(args), listView: { initialColumns: ['orderNumber', 'deal', 'titleCompany', 'status'] } },
  fields: {
    orderNumber: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    deal: relationship({ ref: 'Deal' }),
    property: relationship({ ref: 'Property' }),
    titleCompany: text(),
    status: select({ type: 'enum', options: [{ label: 'Ordered', value: 'ordered' }, { label: 'In Review', value: 'in_review' }, { label: 'Clear', value: 'clear' }, { label: 'Exception', value: 'exception' }], defaultValue: 'ordered' }),
    orderedAt: timestamp(),
    clearedAt: timestamp(),
    exceptions: text({ ui: { displayMode: 'textarea' } }),
    metadata: json(),
    ...trackingFields,
  },
});
