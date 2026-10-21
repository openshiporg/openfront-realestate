import { list } from '@keystone-6/core';
import { checkbox, integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { canCreateForActiveShowing, permissions, rules } from '../access';
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks';
import { money } from '../lib/money'
import { trackingFields } from './trackingFields';

export const ShowingFeedback = list({
  access: {
    operation: { query: permissions.canReadShowings, create: permissions.canManageBrokerageShowings, update: permissions.canManageBrokerageShowings, delete: () => false },
    filter: { query: rules.canReadShowingChildren, update: rules.canReadShowingChildren },
    item: { create: canCreateForActiveShowing },
  },
  hooks: createTenantOwnedHooks({ listKey: 'ShowingFeedback', parents: { showing: 'Showing', lead: 'Lead', property: 'Property' }, required: ['showing', 'lead', 'property'], coherentWith: { field: 'showing', listKey: 'Showing', matches: { lead: 'lead', property: 'property' } }, deriveOnly: true, protectDelete: true }),
  ui: {
    hideDelete: true, listView: { initialColumns: ['showing', 'lead', 'rating', 'interestLevel'] } },
  fields: {
    showing: relationship({ ref: 'Showing', access: { update: () => false } }),
    lead: relationship({ ref: 'Lead', access: { update: () => false } }),
    property: relationship({ ref: 'Property', access: { update: () => false } }),
    rating: integer({ validation: { min: 1, max: 5 } }),
    interestLevel: select({ type: 'enum', options: [{ label: 'Low', value: 'low' }, { label: 'Medium', value: 'medium' }, { label: 'High', value: 'high' }, { label: 'Offer Likely', value: 'offer_likely' }], defaultValue: 'medium' }),
    comments: text({ ui: { displayMode: 'textarea' } }),
    priceOpinion: money({ precision: 12, scale: 2 }),
    followUpRequired: checkbox({ defaultValue: false }),
    metadata: json(),
    ...trackingFields,
  },
});
