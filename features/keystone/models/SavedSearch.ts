import { list } from "@keystone-6/core";
import { checkbox, decimal, integer, relationship, text, timestamp } from "@keystone-6/core/fields";

import { isSignedIn, rules } from "../access";
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks';
import { money } from '../lib/money'
import { trackingFields } from "./trackingFields";

export const SavedSearch = list({
  access: {
    operation: {
      query: isSignedIn,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: { query: rules.canReadSavedSearches },
  },
  hooks: createTenantOwnedHooks({ listKey: 'SavedSearch', users: ['user'], required: ['user'] }),
  ui: {
    hideDelete: true,
    hideCreate: true, listView: { initialColumns: ["name", "user", "city", "minPrice", "maxPrice", "alertsEnabled"] } },
  fields: {
    brokerage: relationship({ ref: 'Brokerage' }),
    name: text({ validation: { isRequired: true } }),
    city: text(),
    state: text(),
    propertyType: text(),
    minPrice: money({ precision: 12, scale: 2 }),
    maxPrice: money({ precision: 12, scale: 2 }),
    minBedrooms: integer(),
    minBathrooms: decimal({ precision: 4, scale: 1 }),
    minSquareFeet: integer(),
    keywords: text(),
    alertsEnabled: checkbox({ defaultValue: true }),
    lastNotifiedAt: timestamp(),
    user: relationship({ ref: "User" }),
    ...trackingFields,
  },
});
