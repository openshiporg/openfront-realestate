import { list } from '@keystone-6/core';
import { checkbox, decimal, integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { canCreateForActiveProperty, permissions, rules } from '../access';
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks';
import { trackingFields } from './trackingFields';

export const OpenHouse = list({
  access: {
    operation: { query: permissions.canReadShowings, create: permissions.canManageBrokerageShowings, update: permissions.canManageBrokerageShowings, delete: () => false },
    filter: { query: rules.canReadPropertyChildren, update: rules.canReadPropertyChildren },
    item: { create: canCreateForActiveProperty },
  },
  hooks: createTenantOwnedHooks({ listKey: 'OpenHouse', parents: { property: 'Property' }, users: ['hostAgent'], required: ['property'], deriveOnly: true, protectDelete: true }),
  ui: {
    hideDelete: true, listView: { initialColumns: ['title', 'property', 'status', 'startsAt'] } },
  fields: {
    title: text({ validation: { isRequired: true } }),
    property: relationship({ ref: 'Property', access: { update: () => false } }),
    hostAgent: relationship({ ref: 'User' }),
    status: select({ type: 'enum', options: [{ label: 'Scheduled', value: 'scheduled' }, { label: 'Completed', value: 'completed' }, { label: 'Cancelled', value: 'cancelled' }], defaultValue: 'scheduled', access: { create: () => false, update: () => false } }),
    startsAt: timestamp({ validation: { isRequired: true } }),
    endsAt: timestamp({ validation: { isRequired: true } }),
    attendeeCount: integer({ defaultValue: 0, validation: { min: 0 } }),
    notes: text({ ui: { displayMode: 'textarea' } }),
    metadata: json(),
    ...trackingFields,
  },
});
