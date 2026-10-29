import { list } from "@keystone-6/core";
import { integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { permissions, rules } from "../access";
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks'
import { trackingFields } from "./trackingFields";

/**
 * Money the brokerage actually takes: rental application fees, holding deposits, rent and agent fees.
 * Earnest money is paid to escrow/title and is only ever recorded on Escrow.
 * Rows are written by controlled commands (server-side amounts), never by generic GraphQL writes.
 */
export const Payment = list({
  access: {
    operation: {
      query: permissions.canReadPayments,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: { query: rules.canAccessBrokerageRecords },
  },
  hooks: createTenantOwnedHooks({
    listKey: 'Payment',
    parents: { paymentProvider: 'PaymentProvider', property: 'Property', lead: 'Lead', deal: 'Deal' },
    required: ['paymentProvider'],
    protectDelete: true,
  }),
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ['purpose', 'status', 'amountMinor', 'currency', 'property', 'lead'] } },
  fields: {
    brokerage: relationship({ ref: 'Brokerage.payments' }),
    purpose: select({
      type: 'enum',
      options: [
        { label: 'Application fee', value: 'application_fee' },
        { label: 'Holding deposit', value: 'holding_deposit' },
        { label: 'Rent', value: 'rent' },
        { label: 'Agent fee', value: 'agent_fee' },
      ],
      validation: { isRequired: true },
    }),
    status: select({
      type: 'enum',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Authorized', value: 'authorized' },
        { label: 'Captured', value: 'captured' },
        { label: 'Refunded', value: 'refunded' },
        { label: 'Failed', value: 'failed' },
        { label: 'Unknown', value: 'unknown' },
      ],
      defaultValue: 'pending',
      validation: { isRequired: true },
    }),
    amountMinor: integer({ validation: { isRequired: true, min: 1 } }),
    currency: text({ validation: { isRequired: true, length: { min: 3, max: 3 } }, defaultValue: 'USD' }),
    providerPaymentId: text({ isIndexed: 'unique' }),
    providerPaymentIntentId: text(),
    idempotencyKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    // Opaque capability the payer carries in the return URL; never listed to other users.
    accessToken: text({ isIndexed: 'unique', validation: { isRequired: true }, access: { read: () => false } }),
    payerName: text(),
    payerEmail: text(),
    checkoutUrl: text(),
    paidAt: timestamp(),
    refundedMinor: integer({ defaultValue: 0 }),
    lastCheckedAt: timestamp(),
    paymentProvider: relationship({ ref: 'PaymentProvider.payments' }),
    property: relationship({ ref: 'Property.payments' }),
    lead: relationship({ ref: 'Lead.payments' }),
    deal: relationship({ ref: 'Deal.payments' }),
    ...trackingFields,
  },
});

/** Durable webhook dedupe: one row per (provider, event id). Internal only. */
export const PaymentWebhookReceipt = list({
  access: { operation: { query: () => false, create: () => false, update: () => false, delete: () => false } },
  ui: { isHidden: true },
  fields: {
    eventKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    eventType: text(),
    outcome: text(),
    ...trackingFields,
  },
});
