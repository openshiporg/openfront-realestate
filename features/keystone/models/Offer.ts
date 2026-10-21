import { list, graphql } from "@keystone-6/core";
import { integer, json, relationship, select, text, timestamp, virtual } from "@keystone-6/core/fields";

import { permissions, rules } from "../access";
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks'
import { money } from '../lib/money'
import { trackingFields } from "./trackingFields";

export const Offer = list({
  access: {
    operation: {
      query: permissions.canReadSensitiveDeals,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: { query: rules.canReadDeals },
  },
  hooks: createTenantOwnedHooks({
    listKey: 'Offer',
    parents: { deal: 'Deal', property: 'Property', lead: 'Lead', parentOffer: 'Offer' },
    users: ['assignedAgent'],
    required: ['deal', 'property', 'lead'],
    coherentWith: { field: 'deal', listKey: 'Deal', matches: { property: 'property', lead: 'lead' } },
    protectDelete: true,
  }),
  ui: {
    hideDelete: true,
    hideCreate: true, listView: { initialColumns: ["offerNumber", "status", "amount", "property", "deal", "submittedAt"] } },
  fields: {
    brokerage: relationship({ ref: 'Brokerage.offers' }),
    offerNumber: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    version: integer({ defaultValue: 1, validation: { isRequired: true, min: 1 }, access: { create: () => false, update: () => false } }),
    parentOffer: relationship({ ref: 'Offer.counterOffers' }),
    counterOffers: relationship({ ref: 'Offer.parentOffer', many: true, access: { create: () => false, update: () => false } }),
    status: select({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Submitted", value: "submitted" },
        { label: "Countered", value: "countered" },
        { label: "Accepted", value: "accepted" },
        { label: "Rejected", value: "rejected" },
        { label: "Withdrawn", value: "withdrawn" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
      access: { create: () => false, update: () => false },
    }),
    amount: money({ precision: 12, scale: 2, validation: { isRequired: true }, defaultValue: "0.00" }),
    earnestMoney: money({ precision: 12, scale: 2 }),
    financingType: select({
      type: "enum",
      options: [
        { label: "Cash", value: "cash" },
        { label: "Conventional", value: "conventional" },
        { label: "FHA", value: "fha" },
        { label: "VA", value: "va" },
        { label: "Other", value: "other" },
      ],
      defaultValue: "conventional",
    }),
    contingencies: text({ ui: { displayMode: "textarea" } }),
    submittedAt: timestamp(),
    responseDueAt: timestamp(),
    acceptedAt: timestamp({ access: { create: () => false, update: () => false } }),
    acceptedSnapshot: json({
      access: { create: () => false, update: () => false },
      ui: { itemView: { fieldMode: 'read' }, createView: { fieldMode: 'hidden' } },
    }),
    property: relationship({ ref: "Property" }),
    deal: relationship({ ref: "Deal" }),
    lead: relationship({ ref: "Lead" }),
    assignedAgent: relationship({ ref: "User" }),
    documentEvidenceEvents: relationship({ ref: 'DocumentEvidenceEvent.offer', many: true, access: { create: () => false, update: () => false } }),
    displayLabel: virtual({ field: graphql.field({ type: graphql.String, resolve: (item: any) => `${item.offerNumber || "Offer"} · ${item.status || "draft"}` }) }),
    ...trackingFields,
  },
});
