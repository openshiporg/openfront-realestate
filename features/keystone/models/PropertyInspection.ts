import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { canCreateForActiveDeal, permissions, rules } from "../access";
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks';
import { money } from '../lib/money'
import { trackingFields } from "./trackingFields";

export const PropertyInspection = list({
  access: {
    operation: {
      query: permissions.canReadDeals,
      create: permissions.canManageBrokerageDeals,
      update: permissions.canManageDeals,
      delete: () => false,
    },
    filter: { query: rules.canReadDealChildren, update: rules.canReadDealChildren },
    item: { create: canCreateForActiveDeal },
  },
  hooks: createTenantOwnedHooks({ listKey: 'PropertyInspection', parents: { deal: 'Deal', property: 'Property' }, required: ['deal', 'property'], coherentWith: { field: 'deal', listKey: 'Deal', matches: { property: 'property' } }, deriveOnly: true, protectDelete: true }),
  ui: {
    hideDelete: true, listView: { initialColumns: ["title", "inspectionType", "status", "property", "scheduledAt"] } },
  fields: {
    title: text({ validation: { isRequired: true } }),
    inspectionType: select({
      type: "enum",
      options: [
        { label: "General", value: "general" },
        { label: "Pest", value: "pest" },
        { label: "Roof", value: "roof" },
        { label: "Appraisal", value: "appraisal" },
        { label: "Final Walkthrough", value: "walkthrough" },
      ],
      defaultValue: "general",
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Scheduled", value: "scheduled" },
        { label: "Completed", value: "completed" },
        { label: "Needs Follow-up", value: "needs_follow_up" },
        { label: "Waived", value: "waived" },
      ],
      defaultValue: "scheduled",
      access: { create: () => false, update: () => false },
    }),
    scheduledAt: timestamp(),
    completedAt: timestamp({ access: { create: () => false, update: () => false } }),
    inspectorName: text(),
    inspectorEmail: text(),
    estimatedCost: money({ precision: 10, scale: 2 }),
    summary: text({ ui: { displayMode: "textarea" } }),
    findings: text({ ui: { displayMode: "textarea" } }),
    property: relationship({ ref: "Property", access: { update: () => false } }),
    deal: relationship({ ref: "Deal", access: { update: () => false } }),
    ...trackingFields,
  },
});
