import { list } from "@keystone-6/core";
import { checkbox, json, relationship, text } from "@keystone-6/core/fields";

import { canCreateInActiveBrokerage, canMoveToActiveBrokerage, permissions, rules } from "../access";
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks'
import { trackingFields } from "./trackingFields";

const adapterField = (description: string) => text({
  validation: { isRequired: true },
  ui: { description },
});

/** One record per payment provider for a brokerage; every adapter function is dispatched by the key stored here. */
export const PaymentProvider = list({
  access: {
    operation: {
      query: permissions.canReadPayments,
      create: permissions.canManageBrokerageSettings,
      update: permissions.canManageBrokerageSettings,
      delete: () => false,
    },
    filter: {
      query: rules.canAccessBrokerageRecords,
      update: rules.canAccessBrokerageRecords,
    },
    item: { create: canCreateInActiveBrokerage, update: canMoveToActiveBrokerage },
  },
  hooks: createTenantOwnedHooks({ listKey: 'PaymentProvider', protectDelete: true }),
  ui: { hideDelete: true, listView: { initialColumns: ['name', 'code', 'isInstalled'] } },
  fields: {
    brokerage: relationship({ ref: 'Brokerage.paymentProviders', access: { update: () => false } }),
    name: text({ validation: { isRequired: true } }),
    code: text({
      isIndexed: "unique",
      validation: {
        isRequired: true,
        match: {
          regex: /^pp_[a-zA-Z0-9-_]+$/,
          explanation: 'Payment provider code must start with "pp_" followed by alphanumeric characters, hyphens or underscores',
        },
      },
    }),
    isInstalled: checkbox({ defaultValue: true }),
    // Secrets are write-only through the API: staff can set them, nothing can read them back.
    credentials: json({ defaultValue: {}, access: { read: () => false } }),
    metadata: json({ defaultValue: {} }),
    createPaymentFunction: adapterField("Adapter key (stripe, paypal, manual) or an https:// URL that creates payments"),
    capturePaymentFunction: adapterField("Adapter key or https:// URL that captures payments"),
    refundPaymentFunction: adapterField("Adapter key or https:// URL that refunds payments"),
    getPaymentStatusFunction: adapterField("Adapter key or https:// URL that checks payment status"),
    generatePaymentLinkFunction: adapterField("Adapter key or https:// URL that returns a provider dashboard link"),
    handleWebhookFunction: adapterField("Adapter key or https:// URL that verifies provider webhooks"),
    payments: relationship({ ref: 'Payment.paymentProvider', many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields,
  },
});
