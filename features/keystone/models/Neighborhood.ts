import { list } from "@keystone-6/core";
import { integer, relationship, text } from "@keystone-6/core/fields";

import { permissions } from "../access";
import { money } from '../lib/money'
import { trackingFields } from "./trackingFields";

export const Neighborhood = list({
  access: {
    operation: {
      // Neighborhoods are shared market reference data (no brokerage owner).
      query: permissions.canViewMarketIntelligence,
      create: permissions.canManageBrokerageListings,
      update: permissions.canManageBrokerageListings,
      delete: () => false,
    },
  },
  ui: {
    hideDelete: true,
    hideCreate: args => !permissions.canManageBrokerageListings(args), listView: { initialColumns: ["name", "city", "state", "medianSalePrice", "activeListings"] } },
  fields: {
    name: text({ validation: { isRequired: true } }),
    slug: text({ isIndexed: "unique", validation: { isRequired: true } }),
    city: text({ validation: { isRequired: true } }),
    state: text({ validation: { isRequired: true } }),
    overview: text({ ui: { displayMode: "textarea" } }),
    schoolDistrict: text(),
    walkScore: integer(),
    transitScore: integer(),
    medianSalePrice: money({ precision: 12, scale: 2 }),
    medianRent: money({ precision: 12, scale: 2 }),
    activeListings: integer({ defaultValue: 0 }),
    averageDaysOnMarket: integer(),
    marketComps: relationship({ ref: "MarketComp.neighborhood", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields,
  },
});
