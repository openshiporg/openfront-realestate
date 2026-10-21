import { list, graphql } from "@keystone-6/core";
import { json, relationship, select, text, timestamp, virtual } from "@keystone-6/core/fields";

import { canCreateInActiveBrokerage, canMoveToActiveBrokerage, permissions, rules } from "../access";
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks'
import { money } from '../lib/money'
import { trackingFields } from "./trackingFields";

export const Deal = list({
  access: {
    operation: {
      query: permissions.canReadDeals,
      create: permissions.canManageBrokerageDeals,
      update: permissions.canManageDeals,
      delete: () => false,
    },
    filter: {
      query: rules.canReadDeals,
      update: rules.canManageAssignedDeals,
    },
    item: { create: canCreateInActiveBrokerage, update: canMoveToActiveBrokerage },
  },
  hooks: createTenantOwnedHooks({
    listKey: 'Deal',
    parents: { property: 'Property', lead: 'Lead' },
    users: ['assignedAgent'],
    teams: ['assignedTeam'],
    required: ['property', 'lead'],
    protectDelete: true,
  }),
  ui: {
    hideDelete: true,
    listView: {
      initialColumns: ["title", "stage", "property", "lead", "assignedAgent", "expectedCloseDate"],
    },
  },
  fields: {
    brokerage: relationship({ ref: 'Brokerage.deals', access: { update: () => false } }),
    title: text({ validation: { isRequired: true } }),
    stage: select({
      type: "enum",
      options: [
        { label: "Prospecting", value: "prospecting" },
        { label: "Active Search", value: "active_search" },
        { label: "Offer Drafted", value: "offer_drafted" },
        { label: "Under Contract", value: "under_contract" },
        { label: "Inspection", value: "inspection" },
        { label: "Financing", value: "financing" },
        { label: "Closed Won", value: "closed_won" },
        { label: "Closed Lost", value: "closed_lost" },
      ],
      defaultValue: "prospecting",
      validation: { isRequired: true },
      access: { create: () => false, update: () => false },
    }),
    transactionType: select({
      type: "enum",
      options: [
        { label: "Buyer", value: "buyer" },
        { label: "Seller", value: "seller" },
        { label: "Tenant", value: "tenant" },
        { label: "Landlord", value: "landlord" },
      ],
      defaultValue: "buyer",
    }),
    offerAmount: money({ precision: 12, scale: 2, access: { create: () => false, update: () => false } }),
    commissionAmount: money({ precision: 12, scale: 2, access: { create: () => false, update: () => false } }),
    expectedCloseDate: timestamp(),
    closedAt: timestamp({ access: { create: () => false, update: () => false } }),
    closedSnapshot: json({
      access: { create: () => false, update: () => false },
      ui: { itemView: { fieldMode: 'read' }, createView: { fieldMode: 'hidden' } },
    }),
    nextStep: text({ access: { update: () => false } }),
    notes: text({ ui: { displayMode: "textarea" } }),
    property: relationship({ ref: "Property", access: { update: () => false } }),
    lead: relationship({ ref: "Lead", access: { update: () => false } }),
    assignedAgent: relationship({ ref: "User.assignedDeals", access: { create: permissions.canManagePeople, update: permissions.canManagePeople } }),
    assignedTeam: relationship({ ref: 'AgentTeam.deals', access: { create: permissions.canManagePeople, update: permissions.canManagePeople } }),
    representationAuthorities: relationship({ ref: 'RepresentationAuthority.deal', many: true, access: { create: () => false, update: () => false } }),
    documentEvidenceEvents: relationship({ ref: 'DocumentEvidenceEvent.deal', many: true, access: { create: () => false, update: () => false } }),
    commissionLedgerEntries: relationship({ ref: 'CommissionLedgerEntry.deal', many: true, access: { create: () => false, update: () => false } }),
    transactionFileEvents: relationship({ ref: 'TransactionFileEvent.deal', many: true, access: { create: () => false, update: () => false } }),
    displayLabel: virtual({
      field: graphql.field({
        type: graphql.String,
        resolve(item: any) {
          return `${item.title || "Deal"} · ${item.stage || "prospecting"}`;
        },
      }),
    }),
    ...trackingFields,
  },
});
