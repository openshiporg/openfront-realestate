import { list, graphql } from "@keystone-6/core";
import { relationship, select, text, timestamp, virtual } from "@keystone-6/core/fields";

import { canCreateInActiveBrokerage, canMoveToActiveBrokerage, permissions, rules } from "../access";
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks'
import { money } from '../lib/money'
import { trackingFields } from "./trackingFields";

export const Lead = list({
  access: {
    operation: {
      query: permissions.canReadLeads,
      create: permissions.canManageBrokerageTasks,
      update: permissions.canManageLeads,
      delete: () => false,
    },
    filter: {
      query: rules.canReadLeads,
      update: rules.canManageAssignedLeads,
    },
    item: { create: canCreateInActiveBrokerage, update: canMoveToActiveBrokerage },
  },
  hooks: createTenantOwnedHooks({
    listKey: 'Lead',
    parents: { property: 'Property' },
    users: ['assignedAgent'],
    teams: ['assignedTeam'],
    protectDelete: true,
  }),
  ui: {
    hideDelete: true,
    hideCreate: args => !permissions.canManageBrokerageTasks(args),
    listView: {
      initialColumns: ["name", "status", "intent", "property", "assignedAgent", "lastContactedAt"],
    },
  },
  fields: {
    brokerage: relationship({ ref: 'Brokerage.leads', access: { update: () => false } }),
    name: text({ validation: { isRequired: true } }),
    identityKey: text({
      isIndexed: true,
      access: {
        create: () => false,
        update: () => false,
      },
      ui: { itemView: { fieldMode: 'read' } },
    }),
    email: text(),
    phone: text(),
    status: select({
      type: "enum",
      options: [
        { label: "New", value: "new" },
        { label: "Attempted Contact", value: "attempted_contact" },
        { label: "Qualified", value: "qualified" },
        { label: "Tour Scheduled", value: "tour_scheduled" },
        { label: "Offer", value: "offer" },
        { label: "Closed", value: "closed" },
        { label: "Lost", value: "lost" },
      ],
      defaultValue: "new",
      validation: { isRequired: true },
      access: { create: () => false, update: () => false },
    }),
    intent: select({
      type: "enum",
      options: [
        { label: "Buy", value: "buy" },
        { label: "Rent", value: "rent" },
        { label: "Sell", value: "sell" },
        { label: "Invest", value: "invest" },
        { label: "Unknown", value: "unknown" },
      ],
      defaultValue: "unknown",
    }),
    source: select({
      type: "enum",
      options: [
        { label: "Website", value: "website" },
        { label: "Zillow", value: "zillow" },
        { label: "Referral", value: "referral" },
        { label: "Open House", value: "open_house" },
        { label: "Phone", value: "phone" },
        { label: "Import", value: "import" },
      ],
      defaultValue: "website",
    }),
    budgetMin: money({ precision: 12, legacyText: true }),
    budgetMax: money({ precision: 12, legacyText: true }),
    preferredLocation: text(),
    timeline: text(),
    message: text({ ui: { displayMode: "textarea" } }),
    lastContactedAt: timestamp({ access: { create: () => false, update: () => false } }),
    property: relationship({ ref: "Property.leads", access: { update: () => false } }),
    assignedAgent: relationship({ ref: "User.assignedLeads", access: { create: permissions.canManagePeople, update: permissions.canManagePeople } }),
    assignedTeam: relationship({ ref: 'AgentTeam.leads', access: { create: permissions.canManagePeople, update: permissions.canManagePeople } }),
    showings: relationship({ ref: "Showing.lead", many: true, access: { create: () => false, update: () => false } }),
    activities: relationship({ ref: "LeadActivity.lead", many: true, access: { create: () => false, update: () => false } }),
    representationAuthorities: relationship({ ref: 'RepresentationAuthority.lead', many: true, access: { create: () => false, update: () => false } }),
    displayLabel: virtual({
      field: graphql.field({
        type: graphql.String,
        resolve(item: any) {
          return `${item.name || "Lead"}${item.intent ? ` · ${item.intent}` : ""}`;
        },
      }),
    }),
    ...trackingFields,
  },
});
