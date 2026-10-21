import { list } from "@keystone-6/core";
import { checkbox, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { canCreateInActiveBrokerage, canMoveToActiveBrokerage, permissions, rules } from "../access";
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks';
import { trackingFields } from "./trackingFields";

export const DealDocument = list({
  access: {
    operation: {
      query: permissions.canReadSensitiveDeals,
      create: permissions.canManageBrokerageDeals,
      update: () => false,
      delete: () => false,
    },
    filter: { query: rules.canReadDealChildren },
    item: { create: canCreateInActiveBrokerage, update: canMoveToActiveBrokerage },
  },
  hooks: createTenantOwnedHooks({ listKey: 'DealDocument', parents: { deal: 'Deal', property: 'Property' }, users: ['uploadedBy'], required: ['deal'], coherentWith: { field: 'deal', listKey: 'Deal', matches: { property: 'property' } }, protectDelete: true }),
  ui: {
    hideDelete: true, listView: { initialColumns: ["title", "documentType", "status", "deal", "requiresSignature"] } },
  fields: {
    brokerage: relationship({ ref: 'Brokerage', access: { update: () => false } }),
    title: text({ validation: { isRequired: true } }),
    documentType: select({
      type: "enum",
      options: [
        { label: "Listing Agreement", value: "listing_agreement" },
        { label: "Offer", value: "offer" },
        { label: "Disclosure", value: "disclosure" },
        { label: "Inspection Report", value: "inspection_report" },
        { label: "Closing Statement", value: "closing_statement" },
        { label: "Other", value: "other" },
      ],
      defaultValue: "other",
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Sent", value: "sent" },
        { label: "Signed", value: "signed" },
        { label: "Archived", value: "archived" },
      ],
      defaultValue: "draft",
      access: { create: () => false, update: () => false },
    }),
    fileUrl: text({ validation: { isRequired: true } }),
    requiresSignature: checkbox({ defaultValue: false }),
    sentAt: timestamp(),
    signedAt: timestamp(),
    expiresAt: timestamp(),
    notes: text({ ui: { displayMode: "textarea" } }),
    deal: relationship({ ref: "Deal", access: { update: () => false } }),
    property: relationship({ ref: "Property", access: { update: () => false } }),
    uploadedBy: relationship({ ref: "User", access: { update: () => false } }),
    evidenceEvents: relationship({ ref: 'DocumentEvidenceEvent.document', many: true, access: { create: () => false, update: () => false } }),
    transactionFileEvents: relationship({ ref: 'TransactionFileEvent.document', many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields,
  },
});
