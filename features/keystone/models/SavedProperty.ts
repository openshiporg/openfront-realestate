import { list } from "@keystone-6/core";
import { relationship, select, text } from "@keystone-6/core/fields";

import { isSignedIn, rules } from "../access";
import { trackingFields } from "./trackingFields";

export const SavedProperty = list({
  // One row per pair; the generated index name matches migration 20261107120000.
  db: { extendPrismaSchema: schema => schema.replace(/\n\}\s*$/, `\n  @@unique([userId, propertyId])\n}`) },
  access: {
    operation: {
      query: isSignedIn,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: {
      query: rules.canReadSavedProperties,
    },
  },
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: {
      initialColumns: ["property", "user", "status", "notes"],
    },
  },
  fields: {
    status: select({
      type: "enum",
      options: [
        { label: "Saved", value: "saved" },
        { label: "Interested", value: "interested" },
        { label: "Hidden", value: "hidden" },
      ],
      defaultValue: "saved",
    }),
    notes: text({ ui: { displayMode: "textarea" } }),
    property: relationship({ ref: "Property.savedBy" }),
    user: relationship({ ref: "User.savedProperties" }),
    ...trackingFields,
  },
});
