import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { canCreateInActiveBrokerage, canMoveToActiveBrokerage, permissions, rules } from "../access";
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks';
import { trackingFields } from "./trackingFields";

export const AgentTask = list({
  access: {
    operation: {
      query: permissions.canReadLeads,
      create: permissions.canManageBrokerageTasks,
      update: permissions.canManageLeads,
      delete: () => false,
    },
    filter: { query: rules.canReadAgentTasks, update: rules.canReadAgentTasks },
    item: { create: canCreateInActiveBrokerage, update: canMoveToActiveBrokerage },
  },
  hooks: createTenantOwnedHooks({ listKey: 'AgentTask', parents: { property: 'Property', lead: 'Lead', deal: 'Deal' }, users: ['assignedAgent'], protectDelete: true }),
  ui: {
    hideDelete: true, listView: { initialColumns: ["title", "status", "priority", "dueAt", "assignedAgent"] } },
  fields: {
    brokerage: relationship({ ref: 'Brokerage', access: { update: () => false } }),
    title: text({ validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Open", value: "open" },
        { label: "In Progress", value: "in_progress" },
        { label: "Blocked", value: "blocked" },
        { label: "Done", value: "done" },
      ],
      defaultValue: "open",
      access: { create: () => false, update: () => false },
    }),
    priority: select({
      type: "enum",
      options: [
        { label: "Low", value: "low" },
        { label: "Normal", value: "normal" },
        { label: "High", value: "high" },
        { label: "Urgent", value: "urgent" },
      ],
      defaultValue: "normal",
    }),
    dueAt: timestamp(),
    completedAt: timestamp({ access: { create: () => false, update: () => false } }),
    notes: text({ ui: { displayMode: "textarea" } }),
    assignedAgent: relationship({ ref: "User", access: { create: permissions.canManagePeople, update: permissions.canManagePeople } }),
    property: relationship({ ref: "Property", access: { update: () => false } }),
    lead: relationship({ ref: "Lead", access: { update: () => false } }),
    deal: relationship({ ref: "Deal", access: { update: () => false } }),
    ...trackingFields,
  },
});
