import { list } from "@keystone-6/core";
import { checkbox, integer, relationship, select, text } from "@keystone-6/core/fields";

import { canCreateForManagedProperty, permissions, rules } from "../access";
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks';
import { trackingFields } from "./trackingFields";

export const PropertyMedia = list({
  access: {
    operation: {
      query: permissions.canManageListings,
      create: permissions.canManageListings,
      update: permissions.canManageListings,
      delete: permissions.canManageListings,
    },
    filter: { query: rules.canReadPropertyChildren, update: rules.canManagePropertyChildren, delete: rules.canManagePropertyChildren },
    item: { create: canCreateForManagedProperty },
  },
  hooks: createTenantOwnedHooks({ listKey: 'PropertyMedia', parents: { property: 'Property' }, required: ['property'], deriveOnly: true }),
  ui: { listView: { initialColumns: ["title", "mediaType", "property", "sortOrder", "isHero"] } },
  fields: {
    title: text({ validation: { isRequired: true } }),
    mediaType: select({
      type: "enum",
      options: [
        { label: "Photo", value: "photo" },
        { label: "Floor Plan", value: "floor_plan" },
        { label: "Virtual Tour", value: "virtual_tour" },
        { label: "Video", value: "video" },
        { label: "Document", value: "document" },
      ],
      defaultValue: "photo",
      validation: { isRequired: true },
    }),
    url: text({ validation: { isRequired: true } }),
    altText: text(),
    caption: text({ ui: { displayMode: "textarea" } }),
    sortOrder: integer({ defaultValue: 0 }),
    isHero: checkbox({ defaultValue: false }),
    property: relationship({ ref: "Property", access: { update: () => false } }),
    ...trackingFields,
  },
});
