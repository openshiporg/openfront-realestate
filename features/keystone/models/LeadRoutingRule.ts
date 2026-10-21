import { list, graphql } from "@keystone-6/core";
import { checkbox, integer, relationship, select, text, virtual } from "@keystone-6/core/fields";

import { canCreateInActiveBrokerage, canMoveToActiveBrokerage, permissions, rules } from "../access";
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks'
import { trackingFields } from "./trackingFields";

export const LeadRoutingRule = list({
  access: {
    operation: {
      query: permissions.canReadLeads,
      create: permissions.canManageBrokerageTasks,
      update: permissions.canManageBrokerageTasks,
      delete: permissions.canManageBrokerageTasks,
    },
    filter: {
      query: rules.canAccessBrokerageRecords,
      update: rules.canAccessBrokerageRecords,
      delete: rules.canAccessBrokerageRecords,
    },
    item: { create: canCreateInActiveBrokerage, update: canMoveToActiveBrokerage },
  },
  hooks: createTenantOwnedHooks({
    listKey: 'LeadRoutingRule',
    users: ['assignedAgent'],
    teams: ['assignedTeam'],
    requiredAny: ['assignedAgent', 'assignedTeam'],
  }),
  ui: {
    listView: {
      initialColumns: ["name", "status", "priority", "intent", "city", "assignedAgent"],
    },
  },
  fields: {
    brokerage: relationship({ ref: 'Brokerage.leadRoutingRules' }),
    name: text({ validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Paused", value: "paused" },
      ],
      defaultValue: "active",
    }),
    priority: integer({ defaultValue: 100, validation: { min: 1, max: 999 } }),
    intent: select({
      type: "enum",
      options: [
        { label: "Any", value: "any" },
        { label: "Buy", value: "buy" },
        { label: "Rent", value: "rent" },
        { label: "Sell", value: "sell" },
        { label: "Invest", value: "invest" },
      ],
      defaultValue: "any",
    }),
    source: select({
      type: "enum",
      options: [
        { label: "Any", value: "any" },
        { label: "Website", value: "website" },
        { label: "Zillow", value: "zillow" },
        { label: "Referral", value: "referral" },
        { label: "Open House", value: "open_house" },
        { label: "Phone", value: "phone" },
        { label: "Import", value: "import" },
      ],
      defaultValue: "any",
    }),
    city: text({ ui: { description: "Optional city match. Leave blank for any city." } }),
    state: text({ ui: { description: "Optional state match. Leave blank for any state." } }),
    postalCode: text({ ui: { description: "Optional ZIP/postal match. Leave blank for any ZIP." } }),
    isFallback: checkbox({ defaultValue: false }),
    assignedAgent: relationship({ ref: "User.leadRoutingRules" }),
    assignedTeam: relationship({ ref: 'AgentTeam.leadRoutingRules' }),
    displayLabel: virtual({
      field: graphql.field({
        type: graphql.String,
        resolve(item: any) {
          return `${item.name || "Routing rule"} · ${item.status || "active"}`;
        },
      }),
    }),
    ...trackingFields,
  },
});
