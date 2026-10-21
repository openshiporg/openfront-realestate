import { list } from '@keystone-6/core';
import { checkbox, integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { canCreateForManagedProperty, permissions, rules } from '../access';
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks';
import { money } from '../lib/money'
import { trackingFields } from './trackingFields';

export const PropertyValuation = list({
  access: {
    operation: { query: permissions.canViewMarketIntelligence, create: permissions.canManageListings, update: permissions.canManageListings, delete: () => false },
    filter: { query: rules.canReadPropertyChildren, update: rules.canManagePropertyChildren },
    item: { create: canCreateForManagedProperty },
  },
  hooks: createTenantOwnedHooks({ listKey: 'PropertyValuation', parents: { property: 'Property' }, users: ['performedBy'], required: ['property'], deriveOnly: true, protectDelete: true }),
  ui: {
    hideDelete: true, listView: { initialColumns: ['valuationNumber', 'property', 'valuationType', 'estimatedValue'] } },
  fields: {
    valuationNumber: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    property: relationship({ ref: 'Property', access: { update: () => false } }),
    valuationType: select({ type: 'enum', options: [{ label: 'CMA', value: 'cma' }, { label: 'Appraisal', value: 'appraisal' }, { label: 'AVM', value: 'avm' }], defaultValue: 'cma' }),
    lowValue: money({ precision: 12, scale: 2 }),
    estimatedValue: money({ precision: 12, scale: 2 }),
    highValue: money({ precision: 12, scale: 2 }),
    performedBy: relationship({ ref: 'User', access: { update: () => false } }),
    valuedAt: timestamp(),
    notes: text({ ui: { displayMode: 'textarea' } }),
    metadata: json(),
    ...trackingFields,
  },
});
