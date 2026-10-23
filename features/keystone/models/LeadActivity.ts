import { list, graphql } from "@keystone-6/core";
import { relationship, select, text, timestamp, virtual } from "@keystone-6/core/fields";

import { permissions, rules } from "../access";
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks'
import { trackingFields } from "./trackingFields";

export const LeadActivity = list({
  access: {
    operation: {
      query: permissions.canReadLeadActivities,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: {
      query: rules.canReadLeadActivities,
    },
  },
  hooks: createTenantOwnedHooks({
    listKey: 'LeadActivity',
    parents: { lead: 'Lead', property: 'Property', showing: 'Showing' },
    users: ['agent'],
    required: ['lead'],
    protectDelete: true,
  }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: {
      initialColumns: ["lead", "activityType", "direction", "channel", "occurredAt", "agent"],
    },
  },
  fields: {
    brokerage: relationship({ ref: 'Brokerage.leadActivities' }),
    activityType: select({
      type: "enum",
      options: [
        { label: "Inquiry", value: "inquiry" },
        { label: "Call", value: "call" },
        { label: "Email", value: "email" },
        { label: "Text", value: "text" },
        { label: "Note", value: "note" },
        { label: "Status Change", value: "status_change" },
        { label: "Showing Requested", value: "showing_requested" },
        { label: "Showing Scheduled", value: "showing_scheduled" },
        { label: "Showing Feedback", value: "showing_feedback" },
        { label: "System", value: "system" },
      ],
      defaultValue: "note",
      validation: { isRequired: true },
    }),
    direction: select({
      type: "enum",
      options: [
        { label: "Inbound", value: "inbound" },
        { label: "Outbound", value: "outbound" },
        { label: "Internal", value: "internal" },
      ],
      defaultValue: "internal",
    }),
    channel: select({
      type: "enum",
      options: [
        { label: "Website", value: "website" },
        { label: "Phone", value: "phone" },
        { label: "Email", value: "email" },
        { label: "SMS", value: "sms" },
        { label: "In Person", value: "in_person" },
        { label: "CRM", value: "crm" },
      ],
      defaultValue: "crm",
    }),
    subject: text(),
    body: text({ ui: { displayMode: "textarea" } }),
    occurredAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    lead: relationship({ ref: "Lead.activities" }),
    property: relationship({ ref: "Property" }),
    showing: relationship({ ref: "Showing" }),
    agent: relationship({ ref: "User" }),
    // The signed-in storefront account that sent this inquiry; set by the server only.
    customer: relationship({ ref: "User.customerInquiries", access: { create: () => false, update: () => false } }),
    displayLabel: virtual({
      field: graphql.field({
        type: graphql.String,
        resolve(item: any) {
          return `${item.activityType || "activity"}${item.subject ? ` · ${item.subject}` : ""}`;
        },
      }),
    }),
    ...trackingFields,
  },
});
