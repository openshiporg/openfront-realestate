import { list } from '@keystone-6/core';
import { checkbox, decimal, integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { canCreateForActiveDeal, permissions, rules } from '../access';
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks';
import { trackingFields } from './trackingFields';

export const Disclosure = list({
  access: {
    operation: { query: permissions.canReadDeals, create: permissions.canManageBrokerageDeals, update: () => false, delete: () => false },
    filter: { query: rules.canReadDealChildren },
    item: { create: canCreateForActiveDeal },
  },
  hooks: createTenantOwnedHooks({ listKey: 'Disclosure', parents: { deal: 'Deal', property: 'Property' }, required: ['deal', 'property'], coherentWith: { field: 'deal', listKey: 'Deal', matches: { property: 'property' } }, deriveOnly: true, protectDelete: true }),
  ui: {
    hideDelete: true, listView: { initialColumns: ['title', 'property', 'disclosureType', 'status'] } },
  fields: {
    title: text({ validation: { isRequired: true } }),
    property: relationship({ ref: 'Property' }),
    deal: relationship({ ref: 'Deal' }),
    disclosureType: select({ type: 'enum', options: [{ label: 'Seller Property', value: 'seller_property' }, { label: 'Lead Paint', value: 'lead_paint' }, { label: 'HOA', value: 'hoa' }, { label: 'Natural Hazard', value: 'natural_hazard' }, { label: 'Other', value: 'other' }], defaultValue: 'other' }),
    status: select({
      type: 'enum',
      options: [{ label: 'Draft', value: 'draft' }, { label: 'Sent', value: 'sent' }, { label: 'Acknowledged', value: 'acknowledged' }, { label: 'Expired', value: 'expired' }],
      defaultValue: 'draft',
      access: { create: () => false, update: () => false },
    }),
    documentUrl: text(),
    sentAt: timestamp({ access: { create: () => false, update: () => false } }),
    acknowledgedAt: timestamp({ access: { create: () => false, update: () => false } }),
    metadata: json(),
    ...trackingFields,
  },
});
