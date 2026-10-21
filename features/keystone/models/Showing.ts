import { list, graphql } from "@keystone-6/core";
import { json, relationship, select, text, timestamp, virtual } from "@keystone-6/core/fields";

import { canCreateInActiveBrokerage, canMoveToActiveBrokerage, permissions, rules } from "../access";
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks'
import { trackingFields } from "./trackingFields";

export const Showing = list({
  access: {
    operation: {
      query: permissions.canReadShowings,
      create: permissions.canManageBrokerageShowings,
      update: permissions.canManageShowings,
      delete: () => false,
    },
    filter: {
      query: rules.canReadShowings,
      update: rules.canManageAssignedShowings,
    },
    item: { create: canCreateInActiveBrokerage, update: canMoveToActiveBrokerage },
  },
  hooks: createTenantOwnedHooks({
    listKey: 'Showing',
    parents: { property: 'Property', lead: 'Lead' },
    users: ['assignedAgent'],
    required: ['property', 'lead'],
    protectDelete: true,
  }),
  ui: {
    hideDelete: true,
    hideCreate: args => !permissions.canManageBrokerageShowings(args),
    listView: {
      initialColumns: ["property", "lead", "status", "scheduledStart", "assignedAgent"],
    },
  },
  fields: {
    brokerage: relationship({ ref: 'Brokerage.showings', access: { update: () => false } }),
    status: select({
      type: "enum",
      options: [
        { label: "Requested", value: "requested" },
        { label: "Scheduled", value: "scheduled" },
        { label: "Completed", value: "completed" },
        { label: "No Show", value: "no_show" },
        { label: "Cancelled", value: "cancelled" },
      ],
      defaultValue: "requested",
      validation: { isRequired: true },
      access: { create: () => false, update: () => false },
    }),
    customer: relationship({ ref: 'User.customerShowings', access: { create: () => false, update: () => false } }),
    requestSnapshot: json({ access: { create: () => false, update: () => false } }),
    showingType: select({
      type: "enum",
      options: [
        { label: "In Person", value: "in_person" },
        { label: "Virtual", value: "virtual" },
        { label: "Open House", value: "open_house" },
      ],
      defaultValue: "in_person",
    }),
    // Schedule changes must use a controlled command with authority and slot validation.
    scheduledStart: timestamp({ validation: { isRequired: true }, access: { update: () => false } }),
    scheduledEnd: timestamp({ access: { update: () => false } }),
    notes: text({ ui: { displayMode: "textarea" } }),
    feedback: text({ ui: { displayMode: "textarea" } }),
    property: relationship({ ref: "Property.showings", access: { update: () => false } }),
    lead: relationship({ ref: "Lead.showings", access: { update: () => false } }),
    assignedAgent: relationship({ ref: "User.assignedShowings", access: { create: permissions.canManagePeople, update: () => false } }),
    displayLabel: virtual({
      field: graphql.field({
        type: graphql.String,
        resolve(item: any) {
          return `${item.showingType || "showing"} · ${item.status || "requested"}`;
        },
      }),
    }),
    ...trackingFields,
  },
});
