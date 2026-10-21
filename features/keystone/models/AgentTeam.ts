import { list } from "@keystone-6/core";
import { relationship, select, text } from "@keystone-6/core/fields";

import {
  canCreateInActiveBrokerage,
  canMoveToActiveBrokerage,
  permissions,
  rules,
  validateRequiredToOneRelationship,
} from "../access";
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks'
import { trackingFields } from "./trackingFields";

const teamHooks = createTenantOwnedHooks({ listKey: 'AgentTeam', users: ['leadAgent'], manyUsers: ['members'], protectDelete: true })

export const AgentTeam = list({
  access: {
    operation: {
      query: permissions.canManagePeople,
      create: permissions.canManagePeople,
      update: permissions.canManagePeople,
      delete: () => false,
    },
    filter: {
      query: rules.canAccessBrokerageRecords,
      update: rules.canAccessBrokerageRecords,
    },
    item: {
      create: canCreateInActiveBrokerage,
      update: canMoveToActiveBrokerage,
    },
  },
  hooks: {
    resolveInput: teamHooks.resolveInput,
    validateInput: async (args) => {
      await teamHooks.validateInput(args)
      validateRequiredToOneRelationship({
        operation: args.operation,
        inputData: args.inputData,
        field: 'brokerage',
        addValidationError: args.addValidationError,
      })
    },
    beforeOperation: teamHooks.beforeOperation,
    afterOperation: teamHooks.afterOperation,
  },
  ui: {
    hideDelete: true, listView: { initialColumns: ["name", "teamType", "status", "leadAgent"] } },
  fields: {
    brokerage: relationship({ ref: 'Brokerage.teams', access: { update: () => false } }),
    name: text({ validation: { isRequired: true } }),
    slug: text({ isIndexed: "unique", validation: { isRequired: true } }),
    teamType: select({
      type: "enum",
      options: [
        { label: "Listing", value: "listing" },
        { label: "Buyer", value: "buyer" },
        { label: "Rental", value: "rental" },
        { label: "Operations", value: "operations" },
      ],
      defaultValue: "listing",
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Paused", value: "paused" },
        { label: "Archived", value: "archived" },
      ],
      defaultValue: "active",
    }),
    description: text({ ui: { displayMode: "textarea" } }),
    leadAgent: relationship({ ref: "User" }),
    members: relationship({ ref: "User", many: true }),
    leads: relationship({ ref: 'Lead.assignedTeam', many: true, access: { create: () => false, update: () => false } }),
    leadRoutingRules: relationship({ ref: 'LeadRoutingRule.assignedTeam', many: true, access: { create: () => false, update: () => false } }),
    deals: relationship({ ref: 'Deal.assignedTeam', many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields,
  },
});
