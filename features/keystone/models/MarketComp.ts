import { list } from "@keystone-6/core";
import { decimal, integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { canCreateForManagedSubjectProperty, permissions, rules } from "../access";
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks';
import { money } from '../lib/money'
import { trackingFields } from "./trackingFields";

export const MarketComp = list({
  access: {
    operation: {
      query: permissions.canViewMarketIntelligence,
      create: permissions.canManageListings,
      update: permissions.canManageListings,
      delete: () => false,
    },
    filter: { query: rules.canReadSubjectPropertyChildren, update: rules.canManageSubjectPropertyChildren },
    item: { create: canCreateForManagedSubjectProperty },
  },
  hooks: createTenantOwnedHooks({ listKey: 'MarketComp', parents: { subjectProperty: 'Property' }, required: ['subjectProperty'], deriveOnly: true, protectDelete: true }),
  ui: {
    hideDelete: true, listView: { initialColumns: ["addressLine1", "status", "salePrice", "soldAt", "subjectProperty"] } },
  fields: {
    addressLine1: text({ validation: { isRequired: true } }),
    city: text(),
    state: text(),
    postalCode: text(),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Pending", value: "pending" },
        { label: "Sold", value: "sold" },
        { label: "Expired", value: "expired" },
      ],
      defaultValue: "sold",
    }),
    listPrice: money({ precision: 12, scale: 2 }),
    salePrice: money({ precision: 12, scale: 2 }),
    soldAt: timestamp(),
    bedrooms: integer(),
    bathrooms: decimal({ precision: 4, scale: 1 }),
    squareFeet: integer(),
    distanceMiles: decimal({ precision: 6, scale: 2 }),
    sourceUrl: text(),
    notes: text({ ui: { displayMode: "textarea" } }),
    subjectProperty: relationship({ ref: "Property", access: { update: () => false } }),
    neighborhood: relationship({ ref: "Neighborhood.marketComps" }),
    ...trackingFields,
  },
});
