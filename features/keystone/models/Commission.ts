import { list } from "@keystone-6/core";
import { decimal, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { canCreateForActiveDeal, permissions, rules } from "../access";
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks'
import { money } from '../lib/money'
import { trackingFields } from "./trackingFields";

export const Commission = list({
  access: {
    operation: {
      query: permissions.canReadSensitiveDeals,
      create: permissions.canManageBrokerageDeals,
      // Amounts feed the commission ledger; later changes go through ledger commands.
      update: () => false,
      delete: () => false,
    },
    filter: { query: rules.canReadDeals },
    item: { create: canCreateForActiveDeal },
  },
  hooks: createTenantOwnedHooks({
    listKey: 'Commission',
    parents: { deal: 'Deal', property: 'Property' },
    users: ['agent'],
    required: ['deal', 'property', 'agent'],
    coherentWith: { field: 'deal', listKey: 'Deal', matches: { property: 'property' } },
    protectDelete: true,
  }),
  ui: {
    hideDelete: true,
    hideCreate: args => !permissions.canManageBrokerageDeals(args), listView: { initialColumns: ["title", "status", "grossCommission", "netCommission", "agent", "deal"] } },
  fields: {
    brokerage: relationship({ ref: 'Brokerage.commissions' }),
    title: text({ validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Projected", value: "projected" },
        { label: "Approved", value: "approved" },
        { label: "Paid", value: "paid" },
        { label: "Clawed Back", value: "clawed_back" },
      ],
      defaultValue: "projected",
      access: { create: () => false, update: () => false },
    }),
    side: select({
      type: "enum",
      options: [
        { label: "Listing", value: "listing" },
        { label: "Buyer", value: "buyer" },
        { label: "Referral", value: "referral" },
      ],
      defaultValue: "listing",
    }),
    grossCommission: money({ precision: 12, scale: 2, defaultValue: "0.00" }),
    brokerageSplitPercent: decimal({ precision: 5, scale: 2, defaultValue: "0.00" }),
    agentSplitPercent: decimal({ precision: 5, scale: 2, defaultValue: "0.00" }),
    netCommission: money({ precision: 12, scale: 2, defaultValue: "0.00" }),
    paidAt: timestamp({ access: { create: () => false, update: () => false } }),
    notes: text({ ui: { displayMode: "textarea" } }),
    deal: relationship({ ref: "Deal" }),
    property: relationship({ ref: "Property" }),
    agent: relationship({ ref: "User" }),
    ledgerEntries: relationship({ ref: 'CommissionLedgerEntry.commission', many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields,
  },
});
