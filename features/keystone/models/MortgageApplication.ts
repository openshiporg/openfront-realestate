import { list } from '@keystone-6/core';
import { checkbox, decimal, integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { canCreateForActiveDeal, permissions, rules } from '../access';
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks';
import { money } from '../lib/money'
import { trackingFields } from './trackingFields';

export const MortgageApplication = list({
  access: {
    operation: { query: permissions.canReadSensitiveDeals, create: permissions.canManageBrokerageDeals, update: permissions.canManageBrokerageDeals, delete: () => false },
    filter: { query: rules.canReadDealChildren, update: rules.canReadDealChildren },
    item: { create: canCreateForActiveDeal },
  },
  hooks: createTenantOwnedHooks({ listKey: 'MortgageApplication', parents: { deal: 'Deal', lead: 'Lead' }, required: ['deal', 'lead'], coherentWith: { field: 'deal', listKey: 'Deal', matches: { lead: 'lead' } }, deriveOnly: true, protectDelete: true }),
  ui: {
    hideDelete: true,
    hideCreate: args => !permissions.canManageBrokerageDeals(args), listView: { initialColumns: ['applicationNumber', 'deal', 'lenderName', 'status'] } },
  fields: {
    applicationNumber: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    deal: relationship({ ref: 'Deal' }),
    lead: relationship({ ref: 'Lead' }),
    lenderName: text(),
    status: select({ type: 'enum', options: [{ label: 'Started', value: 'started' }, { label: 'Preapproved', value: 'preapproved' }, { label: 'Underwriting', value: 'underwriting' }, { label: 'Approved', value: 'approved' }, { label: 'Denied', value: 'denied' }], defaultValue: 'started' }),
    loanAmount: money({ precision: 12, scale: 2 }),
    interestRate: decimal({ precision: 6, scale: 3 }),
    submittedAt: timestamp(),
    decisionAt: timestamp(),
    metadata: json(),
    ...trackingFields,
  },
});
