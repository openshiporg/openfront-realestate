"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// features/integrations/payment/stripe.ts
var stripe_exports = {};
__export(stripe_exports, {
  cancelPaymentFunction: () => cancelPaymentFunction,
  capturePaymentFunction: () => capturePaymentFunction,
  createPaymentFunction: () => createPaymentFunction,
  generatePaymentLinkFunction: () => generatePaymentLinkFunction,
  getPaymentStatusFunction: () => getPaymentStatusFunction,
  handleWebhookFunction: () => handleWebhookFunction,
  refundPaymentFunction: () => refundPaymentFunction
});
function secretKey(provider) {
  const key = provider?.credentials?.secretKey || process.env.STRIPE_SECRET_KEY;
  if (!key || !/^(sk|rk)_(test|live)_/.test(key)) throw new Error("Stripe secret key not configured");
  return key;
}
function formEncode(params) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== void 0 && value !== null) body.append(key, String(value));
  return body;
}
async function stripeRequest(provider, path2, method = "GET", params, idempotencyKey) {
  const response = await fetch(`https://api.stripe.com/v1/${path2}`, {
    method,
    redirect: "error",
    signal: AbortSignal.timeout(3e4),
    headers: {
      Authorization: `Bearer ${secretKey(provider)}`,
      ...idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
      ...params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}
    },
    body: params ? formEncode(params) : void 0
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`Stripe request failed: ${result?.error?.type || response.status}`);
  return result;
}
async function createPaymentFunction({ provider, payment, amount, currency: currency2, idempotencyKey }) {
  if (!Number.isSafeInteger(amount) || amount < 1) throw new Error("Invalid payment amount");
  if (!payment?.id || !payment.successUrl || !payment.cancelUrl) throw new Error("Payment context is incomplete");
  const method = payment.purpose === "rent" ? "us_bank_account" : "card";
  const session = await stripeRequest(provider, "checkout/sessions", "POST", {
    mode: "payment",
    success_url: payment.successUrl,
    cancel_url: payment.cancelUrl,
    client_reference_id: payment.id,
    customer_email: payment.customerEmail || void 0,
    "payment_method_types[0]": method,
    "line_items[0][quantity]": 1,
    "line_items[0][price_data][currency]": currency2.toLowerCase(),
    "line_items[0][price_data][unit_amount]": amount,
    "line_items[0][price_data][product_data][name]": payment.description || PURPOSE_LABEL[payment.purpose] || "Payment",
    "metadata[paymentId]": payment.id,
    "metadata[purpose]": payment.purpose || "",
    "payment_intent_data[metadata][paymentId]": payment.id
  }, idempotencyKey);
  return {
    id: session.id,
    url: session.url,
    status: session.payment_status,
    amount: session.amount_total,
    currency: String(session.currency).toUpperCase(),
    expiresAt: session.expires_at ? new Date(session.expires_at * 1e3).toISOString() : null
  };
}
async function capturePaymentFunction({ provider, paymentId, amount, idempotencyKey }) {
  const intent = await stripeRequest(provider, `payment_intents/${encodeURIComponent(paymentId)}/capture`, "POST", amount == null ? {} : { amount_to_capture: amount }, idempotencyKey);
  return { id: intent.id, status: intent.status, amount: intent.amount_received, currency: String(intent.currency).toUpperCase() };
}
async function refundPaymentFunction({ provider, paymentId, amount, idempotencyKey, refundId }) {
  const refund = refundId ? await stripeRequest(provider, `refunds/${encodeURIComponent(refundId)}`) : await stripeRequest(provider, "refunds", "POST", { payment_intent: paymentId, amount }, idempotencyKey);
  return { id: refund.id, refundId: refund.id, status: refund.status, amount: refund.amount, currency: String(refund.currency).toUpperCase() };
}
async function getPaymentStatusFunction({ provider, paymentId }) {
  if (paymentId.startsWith("cs_")) {
    const session = await stripeRequest(provider, `checkout/sessions/${encodeURIComponent(paymentId)}?expand[]=payment_intent.latest_charge`);
    const intent2 = session.payment_intent && typeof session.payment_intent === "object" ? session.payment_intent : null;
    const charge2 = intent2?.latest_charge && typeof intent2.latest_charge === "object" ? intent2.latest_charge : null;
    let status;
    if (session.payment_status === "paid" && intent2?.status === "succeeded") status = "succeeded";
    else if (session.status === "expired") status = "canceled";
    else status = intent2?.status || "requires_payment_method";
    return {
      id: session.id,
      paymentIntentId: intent2?.id ?? (typeof session.payment_intent === "string" ? session.payment_intent : null),
      url: session.status === "open" ? session.url : null,
      status,
      amount: status === "succeeded" && intent2 ? intent2.amount_received || intent2.amount : session.amount_total,
      currency: String(session.currency).toUpperCase(),
      refundedAmount: charge2?.amount_refunded ?? 0
    };
  }
  const intent = await stripeRequest(provider, `payment_intents/${encodeURIComponent(paymentId)}?expand[]=latest_charge`);
  const charge = intent.latest_charge && typeof intent.latest_charge === "object" ? intent.latest_charge : null;
  return {
    id: intent.id,
    paymentIntentId: intent.id,
    url: null,
    status: intent.status,
    amount: intent.status === "succeeded" ? intent.amount_received : intent.amount,
    currency: String(intent.currency).toUpperCase(),
    refundedAmount: charge?.amount_refunded ?? 0
  };
}
async function generatePaymentLinkFunction({ provider, paymentId }) {
  const mode = secretKey(provider).includes("_test_") ? "test/" : "";
  return `https://dashboard.stripe.com/${mode}payments/${encodeURIComponent(paymentId)}`;
}
async function cancelPaymentFunction({ provider, paymentId, idempotencyKey }) {
  if (paymentId.startsWith("cs_")) {
    const current = await getPaymentStatusFunction({ provider, paymentId });
    if (current.status === "succeeded") return { status: "succeeded" };
    if (current.status === "canceled") return { status: "canceled" };
    await stripeRequest(provider, `checkout/sessions/${encodeURIComponent(paymentId)}/expire`, "POST", {}, idempotencyKey);
    return { status: "canceled" };
  }
  const intent = await stripeRequest(provider, `payment_intents/${encodeURIComponent(paymentId)}/cancel`, "POST", {}, idempotencyKey);
  return { status: intent.status === "canceled" ? "canceled" : intent.status };
}
async function handleWebhookFunction({ provider, headers, rawBody }) {
  const secret = provider?.credentials?.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("Stripe webhook secret is not configured");
  if (!rawBody) throw new Error("Stripe webhook raw body is required");
  const header = headers["stripe-signature"];
  if (!header) throw new Error("Stripe signature is required");
  let timestamp38 = "";
  const signatures = [];
  for (const part of header.split(",")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key === "t") timestamp38 = value;
    if (key === "v1") signatures.push(value);
  }
  const age = Math.abs(Date.now() / 1e3 - Number(timestamp38));
  if (!timestamp38 || !Number.isFinite(age) || age > WEBHOOK_TOLERANCE_SECONDS) throw new Error("Stripe signature timestamp outside tolerance");
  const expected = Buffer.from((0, import_node_crypto12.createHmac)("sha256", secret).update(`${timestamp38}.${rawBody}`).digest("hex"));
  const valid = signatures.some((signature) => {
    const actual = Buffer.from(signature);
    return actual.length === expected.length && (0, import_node_crypto12.timingSafeEqual)(actual, expected);
  });
  if (!valid) throw new Error("Invalid Stripe signature");
  const event = JSON.parse(rawBody);
  return { isValid: true, event, type: event.type, resource: event.data?.object };
}
var import_node_crypto12, WEBHOOK_TOLERANCE_SECONDS, PURPOSE_LABEL;
var init_stripe = __esm({
  "features/integrations/payment/stripe.ts"() {
    "use strict";
    import_node_crypto12 = require("node:crypto");
    WEBHOOK_TOLERANCE_SECONDS = 300;
    PURPOSE_LABEL = {
      application_fee: "Rental application fee",
      holding_deposit: "Holding deposit",
      rent: "Rent payment",
      agent_fee: "Agent desk fee"
    };
  }
});

// features/lib/currency-units.ts
function currencyMinorUnitDigits(currencyCode = "USD") {
  const code = currencyCode.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new Error(`Invalid currency code: ${currencyCode}`);
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    throw new Error(`Unsupported currency code: ${currencyCode}`);
  }
}
function currencyMinorUnitScale(currencyCode = "USD") {
  return 10 ** currencyMinorUnitDigits(currencyCode);
}
function majorToMinorUnits(value, currencyCode = "USD") {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * currencyMinorUnitScale(currencyCode));
}
function minorToMajorUnits(value, currencyCode = "USD") {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  if (!Number.isFinite(parsed)) return 0;
  return parsed / currencyMinorUnitScale(currencyCode);
}
var init_currency_units = __esm({
  "features/lib/currency-units.ts"() {
    "use strict";
  }
});

// features/integrations/payment/paypal.ts
var paypal_exports = {};
__export(paypal_exports, {
  cancelPaymentFunction: () => cancelPaymentFunction2,
  capturePaymentFunction: () => capturePaymentFunction2,
  createPaymentFunction: () => createPaymentFunction2,
  formatPayPalAmount: () => formatPayPalAmount,
  generatePaymentLinkFunction: () => generatePaymentLinkFunction2,
  getPaymentStatusFunction: () => getPaymentStatusFunction2,
  handleWebhookFunction: () => handleWebhookFunction2,
  normalizePayPalStatus: () => normalizePayPalStatus,
  parsePayPalAmount: () => parsePayPalAmount,
  refundPaymentFunction: () => refundPaymentFunction2
});
async function handleWebhookFunction2({ event, headers }) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    throw new Error("PayPal webhook ID is not configured");
  }
  const accessToken = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();
  const response = await fetch(
    `${baseUrl}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        auth_algo: headers["paypal-auth-algo"],
        cert_url: headers["paypal-cert-url"],
        transmission_id: headers["paypal-transmission-id"],
        transmission_sig: headers["paypal-transmission-sig"],
        transmission_time: headers["paypal-transmission-time"],
        webhook_id: webhookId,
        webhook_event: event
      })
    }
  );
  const verification = await response.json();
  const isValid = verification.verification_status === "SUCCESS";
  if (!isValid) {
    throw new Error("Invalid webhook signature");
  }
  return {
    isValid: true,
    event,
    type: event.event_type,
    resource: event.resource
  };
}
async function createPaymentFunction2({ payment, amount, currency: currency2, idempotencyKey }) {
  const accessToken = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();
  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(3e4),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...idempotencyKey ? { "PayPal-Request-Id": idempotencyKey } : {}
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency2.toUpperCase(),
            value: formatPayPalAmount(amount, currency2)
          },
          custom_id: payment?.id
        }
      ],
      payment_source: { paypal: { experience_context: { return_url: payment?.successUrl, cancel_url: payment?.cancelUrl, user_action: "PAY_NOW" } } }
    })
  });
  const orderResult = await response.json();
  if (!response.ok || orderResult.error || !orderResult.id) {
    throw new Error(`PayPal order creation failed: ${orderResult?.error?.message || orderResult?.message || response.status}`);
  }
  const approval = (orderResult.links || []).find((link) => ["payer-action", "approve"].includes(link.rel));
  return {
    id: orderResult.id,
    orderId: orderResult.id,
    url: approval?.href ?? null,
    status: orderResult.status,
    amount,
    currency: currency2.toUpperCase()
  };
}
async function capturePaymentFunction2({ paymentId, idempotencyKey }) {
  const accessToken = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();
  const response = await fetch(
    `${baseUrl}/v2/checkout/orders/${paymentId}/capture`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "PayPal-Request-Id": idempotencyKey || `capture:${paymentId}`
      }
    }
  );
  const capture = await response.json();
  if (capture.error) {
    throw new Error(`PayPal capture failed: ${capture.error.message}`);
  }
  const capturedAmount = capture.purchase_units[0].payments.captures[0].amount;
  return {
    status: normalizePayPalStatus(capture.status),
    amount: parsePayPalAmount(capturedAmount.value, capturedAmount.currency_code),
    currencyCode: capturedAmount.currency_code.toUpperCase(),
    data: capture
  };
}
async function refundPaymentFunction2({ paymentId, amount, currency: currency2 = "USD", idempotencyKey, refundId }) {
  const accessToken = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();
  const response = await fetch(
    refundId ? `${baseUrl}/v2/payments/refunds/${refundId}` : `${baseUrl}/v2/payments/captures/${paymentId}/refund`,
    {
      method: refundId ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...idempotencyKey ? { "PayPal-Request-Id": idempotencyKey } : {}
      },
      body: refundId ? void 0 : JSON.stringify({
        amount: {
          value: formatPayPalAmount(amount, currency2),
          currency_code: currency2.toUpperCase()
        }
      })
    }
  );
  const refund = await response.json();
  if (refund.error) {
    throw new Error(`PayPal refund failed: ${refund.error.message}`);
  }
  return {
    id: refund.id,
    refundId: refund.id,
    status: refund.status,
    amount: parsePayPalAmount(refund.amount.value, refund.amount.currency_code),
    data: refund
  };
}
async function getPaymentStatusFunction2({ paymentId }) {
  const accessToken = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();
  const response = await fetch(`${baseUrl}/v2/checkout/orders/${paymentId}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    }
  });
  const orderResult = await response.json();
  if (orderResult.error) {
    throw new Error(`PayPal status check failed: ${orderResult.error.message}`);
  }
  const purchaseUnits = orderResult.purchase_units || [];
  const orderAmount = purchaseUnits[0]?.amount;
  if (!orderAmount?.currency_code || orderAmount.value == null) throw new Error("PayPal order is missing its quoted amount or currency");
  const captures = purchaseUnits.flatMap((unit) => unit.payments?.captures || []);
  const currencies = [orderAmount.currency_code, ...captures.map((capture) => capture.amount?.currency_code)].filter(Boolean).map((currency2) => currency2.toUpperCase());
  if (new Set(currencies).size !== 1) throw new Error("PayPal order and capture currencies do not match");
  const status = normalizePayPalStatus(orderResult.status);
  const capturedAmount = captures.reduce((sum, capture) => {
    if (capture.amount?.value == null) throw new Error("PayPal capture is missing its amount");
    return sum + parsePayPalAmount(capture.amount.value, capture.amount.currency_code);
  }, 0);
  const refundsComplete = status === "requires_capture" ? captures.length === 0 : status === "succeeded" && captures.length > 0 && captures.every((capture) => capture.status === "COMPLETED");
  return {
    status,
    amount: status === "succeeded" ? capturedAmount : parsePayPalAmount(orderAmount.value, orderAmount.currency_code),
    currencyCode: currencies[0],
    refunds: [],
    refundsComplete,
    data: orderResult
  };
}
async function generatePaymentLinkFunction2({ paymentId }) {
  return `https://www.paypal.com/activity/payment/${paymentId}`;
}
async function cancelPaymentFunction2({ paymentId }) {
  const current = await getPaymentStatusFunction2({ paymentId });
  if (["CREATED", "PAYER_ACTION_REQUIRED"].includes(current.data?.status)) return { status: "abandoned" };
  return { status: current.status };
}
var getPayPalBaseUrl, formatPayPalAmount, parsePayPalAmount, normalizePayPalStatus, getPayPalAccessToken;
var init_paypal = __esm({
  "features/integrations/payment/paypal.ts"() {
    "use strict";
    init_currency_units();
    getPayPalBaseUrl = () => {
      const isSandbox = process.env.NEXT_PUBLIC_PAYPAL_SANDBOX !== "false";
      return isSandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
    };
    formatPayPalAmount = (amount, currency2) => {
      const digits = currencyMinorUnitDigits(currency2);
      return minorToMajorUnits(amount, currency2).toFixed(digits);
    };
    parsePayPalAmount = (value, currency2) => {
      const normalized = String(value).trim();
      if (!/^\d+(?:\.\d+)?$/.test(normalized)) throw new Error("PayPal returned an invalid decimal amount");
      const digits = currencyMinorUnitDigits(currency2);
      const fraction = normalized.split(".")[1] || "";
      if (fraction.length > digits && /[1-9]/.test(fraction.slice(digits))) {
        throw new Error("PayPal amount precision exceeds the currency minor unit");
      }
      const amount = majorToMinorUnits(normalized, currency2);
      if (!Number.isSafeInteger(amount)) throw new Error("PayPal amount exceeds the supported safe range");
      return amount;
    };
    normalizePayPalStatus = (status) => {
      switch ((status || "").toUpperCase()) {
        case "COMPLETED":
          return "succeeded";
        case "APPROVED":
          return "requires_capture";
        case "VOIDED":
          return "canceled";
        default:
          return "pending";
      }
    };
    getPayPalAccessToken = async () => {
      const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID;
      const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        throw new Error("PayPal credentials not configured");
      }
      const baseUrl = getPayPalBaseUrl();
      const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Language": "en_US",
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`
        },
        body: "grant_type=client_credentials"
      });
      const { access_token } = await response.json();
      if (!access_token) {
        throw new Error("Failed to get PayPal access token");
      }
      return access_token;
    };
  }
});

// features/integrations/payment/manual.ts
var manual_exports = {};
__export(manual_exports, {
  cancelPaymentFunction: () => cancelPaymentFunction3,
  capturePaymentFunction: () => capturePaymentFunction3,
  createPaymentFunction: () => createPaymentFunction3,
  generatePaymentLinkFunction: () => generatePaymentLinkFunction3,
  getPaymentStatusFunction: () => getPaymentStatusFunction3,
  handleWebhookFunction: () => handleWebhookFunction3,
  refundPaymentFunction: () => refundPaymentFunction3
});
async function createPaymentFunction3({ payment, amount, currency: currency2 }) {
  return {
    id: `manual_${payment?.id || "payment"}`,
    status: "pending",
    url: null,
    amount,
    currency: currency2.toUpperCase()
  };
}
async function capturePaymentFunction3({ paymentId, amount }) {
  return { id: paymentId, status: "succeeded", amount, currency: void 0 };
}
async function refundPaymentFunction3({ paymentId, amount }) {
  return { id: `refund_${paymentId}`, status: "succeeded", amount };
}
async function getPaymentStatusFunction3({ paymentId }) {
  return { id: paymentId, status: "pending", amount: void 0, currency: void 0 };
}
async function generatePaymentLinkFunction3() {
  return null;
}
async function handleWebhookFunction3() {
  throw new Error("Manual payments do not receive webhooks");
}
async function cancelPaymentFunction3() {
  return { status: "canceled" };
}
var init_manual = __esm({
  "features/integrations/payment/manual.ts"() {
    "use strict";
  }
});

// keystone.ts
var keystone_exports = {};
__export(keystone_exports, {
  default: () => keystone_default2
});
module.exports = __toCommonJS(keystone_exports);

// features/keystone/index.ts
var import_auth = require("@keystone-6/auth");
var import_core46 = require("@keystone-6/core");
var import_config = require("dotenv/config");

// features/keystone/lib/staticFieldUi.ts
function deniesStatically(rule) {
  return rule === false || typeof rule === "function" && rule.length === 0 && rule() === false;
}
function staticFieldUi(field) {
  return (meta) => {
    const config3 = field(meta);
    const access = config3.access;
    const createLocked = deniesStatically(typeof access === "function" ? access : access?.create);
    const updateLocked = deniesStatically(typeof access === "function" ? access : access?.update);
    if (!createLocked && !updateLocked) return config3;
    return { ...config3, ui: {
      ...config3.ui,
      ...createLocked ? { createView: { ...config3.ui?.createView, fieldMode: "hidden" } } : {},
      ...updateLocked ? { itemView: { ...config3.ui?.itemView, fieldMode: "read" } } : {}
    } };
  };
}

// features/keystone/models/DomainAuditEvent.ts
var import_core = require("@keystone-6/core");
var import_access = require("@keystone-6/core/access");
var import_fields2 = require("@keystone-6/core/fields");

// features/keystone/access.ts
function hasActiveBrokerageSession({ session }) {
  return Boolean(session?.itemId && activeBrokerageIds(session).length);
}
function isSignedIn({ session }) {
  return Boolean(session?.itemId);
}
function isOperator(args) {
  return hasActiveBrokerageSession(args);
}
var hasRoleFlag = (session, flag) => Boolean(session?.data.role?.[flag]);
function activeBrokerageIds(session) {
  const memberships = session?.data.brokerageMemberships || [];
  const liveMemberships = memberships.filter((membership) => membership.status === "active" && membership.brokerage?.status === "active");
  const selected = session?.data.activeBrokerage || (liveMemberships.length === 1 ? liveMemberships[0].brokerage : null);
  if (!selected || selected.status !== "active") return [];
  const selectedMemberships = memberships.filter(
    (membership) => membership.status === "active" && membership.brokerage?.status === "active" && membership.brokerage.id === selected.id
  );
  return selectedMemberships.length === 1 ? [selected.id] : [];
}
function relationshipInput(inputData, field) {
  const value = inputData?.[field];
  return value && typeof value === "object" ? value : void 0;
}
function canCreateInActiveBrokerage({ session, inputData }) {
  const brokerageId = relationshipInput(inputData, "brokerage")?.connect?.id;
  return Boolean(brokerageId && activeBrokerageIds(session).includes(brokerageId));
}
async function canCreateForActiveParent({ session, inputData, context }, field, listKey) {
  const parentId = relationshipInput(inputData, field)?.connect?.id;
  if (!parentId || !context) return false;
  const parent = await context.sudo().query[listKey].findOne({ where: { id: parentId }, query: "id brokerage { id status }" });
  return Boolean(parent?.brokerage?.status === "active" && activeBrokerageIds(session).includes(parent.brokerage.id));
}
var canCreateForActiveDeal = (args) => canCreateForActiveParent(args, "deal", "Deal");
var canCreateForActiveProperty = (args) => canCreateForActiveParent(args, "property", "Property");
var canCreateForActiveShowing = (args) => canCreateForActiveParent(args, "showing", "Showing");
var canCreateForActiveSavedSearch = (args) => canCreateForActiveParent(args, "savedSearch", "SavedSearch");
async function canCreateForAssignedParent({ session, inputData, context }, field, listKey, permission) {
  const parentId = relationshipInput(inputData, field)?.connect?.id;
  if (!parentId || !context || !session?.data.role?.[permission]) return false;
  const parent = await context.sudo().query[listKey].findOne({ where: { id: parentId }, query: "id brokerage { id status } assignedAgent { id }" });
  if (!parent?.brokerage?.id || parent.brokerage.status !== "active" || !activeBrokerageIds(session).includes(parent.brokerage.id)) return false;
  return Boolean(session.data.role.canManagePeople || parent.assignedAgent?.id === session.itemId);
}
var canCreateForManagedProperty = (args) => canCreateForAssignedParent(args, "property", "Property", "canManageListings");
var canCreateForManagedSubjectProperty = (args) => canCreateForAssignedParent(args, "subjectProperty", "Property", "canManageListings");
function canMoveToActiveBrokerage({ session, inputData }) {
  if (!inputData || !Object.prototype.hasOwnProperty.call(inputData, "brokerage")) return true;
  const relationship46 = relationshipInput(inputData, "brokerage");
  if (relationship46?.disconnect) return false;
  const brokerageId = relationship46?.connect?.id;
  return Boolean(brokerageId && activeBrokerageIds(session).includes(brokerageId));
}
function validateRequiredToOneRelationship({
  operation,
  inputData,
  field,
  addValidationError
}) {
  const relationship46 = relationshipInput(inputData, field);
  const label = field.charAt(0).toUpperCase() + field.slice(1);
  if (operation === "create" && !relationship46?.connect) {
    addValidationError(`${label} is required.`);
  }
  if (operation === "update" && relationship46?.disconnect) {
    addValidationError(`${label} cannot be disconnected.`);
  }
}
var permissions = {
  canAccessDashboard: ({ session }) => hasRoleFlag(session, "canAccessDashboard") && activeBrokerageIds(session).length > 0,
  canManagePeople: ({ session }) => hasRoleFlag(session, "canManagePeople"),
  canManageRoles: ({ session }) => hasRoleFlag(session, "canManageRoles"),
  canManageListings: ({ session }) => hasRoleFlag(session, "canManageListings"),
  canManageLeads: ({ session }) => hasRoleFlag(session, "canManageLeads"),
  canManageShowings: ({ session }) => hasRoleFlag(session, "canManageShowings"),
  canManageDeals: ({ session }) => hasRoleFlag(session, "canManageDeals"),
  canViewReports: ({ session }) => hasRoleFlag(session, "canViewReports"),
  canViewMarketIntelligence: ({ session }) => hasRoleFlag(session, "canManageListings") || hasRoleFlag(session, "canViewReports"),
  canReadSensitiveDeals: ({ session }) => hasRoleFlag(session, "canManageDeals") && hasRoleFlag(session, "canManagePeople"),
  canReadLeadActivities: ({ session }) => hasRoleFlag(session, "canManageLeads") && hasRoleFlag(session, "canManagePeople"),
  canManageOnboarding: ({ session }) => hasRoleFlag(session, "canManageOnboarding"),
  canManageBrokerageListings: ({ session }) => hasRoleFlag(session, "canManageListings") && hasRoleFlag(session, "canManagePeople"),
  canManageBrokerageDeals: ({ session }) => hasRoleFlag(session, "canManageDeals") && hasRoleFlag(session, "canManagePeople"),
  canManageBrokerageShowings: ({ session }) => hasRoleFlag(session, "canManageShowings") && hasRoleFlag(session, "canManagePeople"),
  canManageBrokerageTasks: ({ session }) => hasRoleFlag(session, "canManageLeads") && hasRoleFlag(session, "canManagePeople"),
  // Storefront/brokerage settings belong to brokerage administrators: people
  // managers with dashboard access. Onboarding is a separate, one-time grant.
  canManageBrokerageSettings: ({ session }) => hasRoleFlag(session, "canManagePeople") && hasRoleFlag(session, "canAccessDashboard") && activeBrokerageIds(session).length > 0,
  canReadLeads: ({ session }) => hasRoleFlag(session, "canManageLeads"),
  canReadPayments: ({ session }) => (hasRoleFlag(session, "canManageLeads") || hasRoleFlag(session, "canManageDeals") || hasRoleFlag(session, "canManagePeople")) && activeBrokerageIds(session).length > 0,
  canReadShowings: ({ session }) => hasRoleFlag(session, "canManageShowings"),
  canReadDeals: ({ session }) => hasRoleFlag(session, "canManageDeals")
};
function brokerageOwnedFilter(session) {
  const brokerageIds = activeBrokerageIds(session);
  return brokerageIds.length ? { brokerage: { id: { in: brokerageIds } } } : false;
}
function brokerageAndAssignment(session, assignment) {
  const brokerage = brokerageOwnedFilter(session);
  return brokerage === false ? false : { AND: [brokerage, assignment] };
}
var rules = {
  canReadBrokerages: ({ session }) => {
    const brokerageIds = activeBrokerageIds(session);
    return brokerageIds.length ? { id: { in: brokerageIds } } : false;
  },
  canReadBrokerageMemberships: ({ session }) => {
    const brokerageIds = activeBrokerageIds(session);
    return brokerageIds.length ? { brokerage: { id: { in: brokerageIds } } } : false;
  },
  canAccessBrokerageRecords: ({ session }) => brokerageOwnedFilter(session),
  canReadPeople: ({ session }) => {
    if (!session) return false;
    if (session.data.role?.canSeeOtherPeople) {
      const brokerageIds = activeBrokerageIds(session);
      if (!brokerageIds.length) return { id: { equals: session.itemId } };
      return {
        OR: [
          { id: { equals: session.itemId } },
          {
            brokerageMemberships: {
              some: {
                status: { equals: "active" },
                brokerage: { id: { in: brokerageIds } }
              }
            }
          }
        ]
      };
    }
    return { id: { equals: session.itemId } };
  },
  // Everyone may update themselves. People editors may also update members of
  // their active brokerage; credentials stay self-service (see User.password).
  canUpdatePeople: ({ session }) => {
    if (!session?.itemId) return false;
    const brokerageIds = activeBrokerageIds(session);
    if (!session.data.role?.canEditOtherPeople || !brokerageIds.length) return { id: { equals: session.itemId } };
    return {
      OR: [
        { id: { equals: session.itemId } },
        {
          brokerageMemberships: {
            some: {
              status: { equals: "active" },
              brokerage: { id: { in: brokerageIds } }
            }
          }
        }
      ]
    };
  },
  canReadLeads: ({ session }) => {
    if (!session?.data.role?.canManageLeads) return false;
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session);
    return brokerageAndAssignment(session, { assignedAgent: { id: { equals: session.itemId } } });
  },
  canManageAssignedLeads: ({ session }) => {
    if (!session?.data.role?.canManageLeads) return false;
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session);
    return brokerageAndAssignment(session, { assignedAgent: { id: { equals: session.itemId } } });
  },
  canReadLeadActivities: ({ session }) => {
    if (!session?.data.role?.canManageLeads) return false;
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session);
    return brokerageAndAssignment(session, { lead: { assignedAgent: { id: { equals: session.itemId } } } });
  },
  canManageAssignedLeadActivities: ({ session }) => {
    if (!session?.data.role?.canManageLeads) return false;
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session);
    return brokerageAndAssignment(session, { lead: { assignedAgent: { id: { equals: session.itemId } } } });
  },
  canReadShowings: ({ session }) => {
    if (!session?.data.role?.canManageShowings) return false;
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session);
    return brokerageAndAssignment(session, { assignedAgent: { id: { equals: session.itemId } } });
  },
  canManageAssignedShowings: ({ session }) => {
    if (!session?.data.role?.canManageShowings) return false;
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session);
    return brokerageAndAssignment(session, { assignedAgent: { id: { equals: session.itemId } } });
  },
  canReadDeals: ({ session }) => {
    if (!session?.data.role?.canManageDeals) return false;
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session);
    return brokerageAndAssignment(session, { assignedAgent: { id: { equals: session.itemId } } });
  },
  canManageAssignedDeals: ({ session }) => {
    if (!session?.data.role?.canManageDeals) return false;
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session);
    return brokerageAndAssignment(session, { assignedAgent: { id: { equals: session.itemId } } });
  },
  canReadPropertyChildren: ({ session }) => {
    const brokerageIds = activeBrokerageIds(session);
    return brokerageIds.length ? { property: { brokerage: { id: { in: brokerageIds } } } } : false;
  },
  canManageAssignedProperties: ({ session }) => {
    if (!session?.data.role?.canManageListings) return false;
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session);
    return brokerageAndAssignment(session, { assignedAgent: { id: { equals: session.itemId } } });
  },
  canManagePropertyChildren: ({ session }) => {
    if (!session?.data.role?.canManageListings) return false;
    const brokerageIds = activeBrokerageIds(session);
    if (!brokerageIds.length) return false;
    return session.data.role.canManagePeople ? { property: { brokerage: { id: { in: brokerageIds } } } } : { property: { AND: [{ brokerage: { id: { in: brokerageIds } } }, { assignedAgent: { id: { equals: session.itemId } } }] } };
  },
  canReadSubjectPropertyChildren: ({ session }) => {
    const brokerageIds = activeBrokerageIds(session);
    return brokerageIds.length ? { subjectProperty: { brokerage: { id: { in: brokerageIds } } } } : false;
  },
  canManageSubjectPropertyChildren: ({ session }) => {
    if (!session?.data.role?.canManageListings) return false;
    const brokerageIds = activeBrokerageIds(session);
    if (!brokerageIds.length) return false;
    return session.data.role.canManagePeople ? { subjectProperty: { brokerage: { id: { in: brokerageIds } } } } : { subjectProperty: { AND: [{ brokerage: { id: { in: brokerageIds } } }, { assignedAgent: { id: { equals: session.itemId } } }] } };
  },
  canReadShowingChildren: ({ session }) => {
    if (!session?.data.role?.canManageShowings) return false;
    const brokerageIds = activeBrokerageIds(session);
    if (!brokerageIds.length) return false;
    return session.data.role.canManagePeople ? { showing: { brokerage: { id: { in: brokerageIds } } } } : { showing: { AND: [{ brokerage: { id: { in: brokerageIds } } }, { assignedAgent: { id: { equals: session.itemId } } }] } };
  },
  canReadDealChildren: ({ session }) => {
    if (!session?.data.role?.canManageDeals) return false;
    const brokerageIds = activeBrokerageIds(session);
    if (!brokerageIds.length) return false;
    return session.data.role.canManagePeople ? { deal: { brokerage: { id: { in: brokerageIds } } } } : { deal: { AND: [{ brokerage: { id: { in: brokerageIds } } }, { assignedAgent: { id: { equals: session.itemId } } }] } };
  },
  canReadSavedProperties: ({ session }) => {
    if (!session?.itemId) return false;
    const brokerageIds = activeBrokerageIds(session);
    if (brokerageIds.length && session.data.role?.canManageLeads && session.data.role?.canManagePeople) {
      return { property: { brokerage: { id: { in: brokerageIds } } } };
    }
    return { user: { id: { equals: session.itemId } } };
  },
  canReadAgentTasks: ({ session }) => {
    if (!session?.data.role?.canManageLeads) return false;
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session);
    return brokerageAndAssignment(session, { assignedAgent: { id: { equals: session.itemId } } });
  },
  canReadSavedSearchAlerts: ({ session }) => {
    if (!session?.data.role?.canManageLeads) return false;
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session);
    return brokerageAndAssignment(session, { user: { id: { equals: session.itemId } } });
  },
  canReadSavedSearches: ({ session }) => {
    if (!session?.itemId) return false;
    const brokerageIds = activeBrokerageIds(session);
    if (brokerageIds.length && session.data.role?.canManageLeads && session.data.role?.canManagePeople) return brokerageOwnedFilter(session);
    return { user: { id: { equals: session.itemId } } };
  }
};

// features/keystone/models/trackingFields.ts
var import_fields = require("@keystone-6/core/fields");
var trackingFields = {
  createdAt: (0, import_fields.timestamp)({
    access: { read: () => true, create: () => false, update: () => false },
    validation: { isRequired: true },
    defaultValue: { kind: "now" },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "read" }
    }
  }),
  updatedAt: (0, import_fields.timestamp)({
    access: { read: () => true, create: () => false, update: () => false },
    db: { updatedAt: true },
    validation: { isRequired: true },
    defaultValue: { kind: "now" },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "read" }
    }
  })
};

// features/keystone/models/DomainAuditEvent.ts
var DomainAuditEvent = (0, import_core.list)({
  access: {
    operation: { query: permissions.canViewReports, create: import_access.denyAll, update: import_access.denyAll, delete: import_access.denyAll },
    filter: { query: rules.canAccessBrokerageRecords }
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: { initialColumns: ["occurredAt", "aggregateType", "aggregateId", "action", "actor"] }
  },
  fields: {
    eventKey: (0, import_fields2.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    brokerage: (0, import_fields2.relationship)({ ref: "Brokerage.auditEvents" }),
    aggregateType: (0, import_fields2.text)({ validation: { isRequired: true }, isIndexed: true }),
    aggregateId: (0, import_fields2.text)({ validation: { isRequired: true }, isIndexed: true }),
    action: (0, import_fields2.text)({ validation: { isRequired: true }, isIndexed: true }),
    actor: (0, import_fields2.relationship)({ ref: "User" }),
    beforeState: (0, import_fields2.json)({ access: { create: import_access.denyAll, update: import_access.denyAll } }),
    afterState: (0, import_fields2.json)({ access: { create: import_access.denyAll, update: import_access.denyAll } }),
    occurredAt: (0, import_fields2.timestamp)({ validation: { isRequired: true }, isIndexed: true }),
    ...trackingFields
  }
});

// features/keystone/models/CommandReceipt.ts
var import_core2 = require("@keystone-6/core");
var import_access3 = require("@keystone-6/core/access");
var import_fields3 = require("@keystone-6/core/fields");
var CommandReceipt = (0, import_core2.list)({
  access: {
    operation: { query: permissions.canViewReports, create: import_access3.denyAll, update: import_access3.denyAll, delete: import_access3.denyAll },
    filter: { query: rules.canAccessBrokerageRecords }
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: { initialColumns: ["occurredAt", "eventType", "aggregateType", "aggregateId"] }
  },
  fields: {
    eventKey: (0, import_fields3.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    eventType: (0, import_fields3.text)({ validation: { isRequired: true }, isIndexed: true }),
    brokerage: (0, import_fields3.relationship)({ ref: "Brokerage.commandReceipts" }),
    aggregateType: (0, import_fields3.text)({ validation: { isRequired: true }, isIndexed: true }),
    aggregateId: (0, import_fields3.text)({ validation: { isRequired: true }, isIndexed: true }),
    requestHash: (0, import_fields3.text)({ validation: { isRequired: true } }),
    payloadHash: (0, import_fields3.text)({ validation: { isRequired: true } }),
    payload: (0, import_fields3.json)({ access: { create: import_access3.denyAll, update: import_access3.denyAll } }),
    occurredAt: (0, import_fields3.timestamp)({ validation: { isRequired: true }, isIndexed: true }),
    ...trackingFields
  }
});

// features/keystone/models/Brokerage.ts
var import_core3 = require("@keystone-6/core");
var import_fields4 = require("@keystone-6/core/fields");
var Brokerage = (0, import_core3.list)({
  access: {
    operation: {
      query: isOperator,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: rules.canReadBrokerages }
  },
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["name", "slug", "status", "isPrimary"] }
  },
  fields: {
    name: (0, import_fields4.text)({ validation: { isRequired: true } }),
    slug: (0, import_fields4.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    status: (0, import_fields4.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Archived", value: "archived" }
      ],
      defaultValue: "active",
      validation: { isRequired: true }
    }),
    isPrimary: (0, import_fields4.checkbox)({ defaultValue: false }),
    settings: (0, import_fields4.relationship)({ ref: "BrokerageSettings.brokerage", many: true }),
    activeUsers: (0, import_fields4.relationship)({ ref: "User.activeBrokerage", many: true }),
    memberships: (0, import_fields4.relationship)({ ref: "BrokerageMembership.brokerage", many: true }),
    teams: (0, import_fields4.relationship)({ ref: "AgentTeam.brokerage", many: true }),
    properties: (0, import_fields4.relationship)({ ref: "Property.brokerage", many: true }),
    leads: (0, import_fields4.relationship)({ ref: "Lead.brokerage", many: true }),
    leadActivities: (0, import_fields4.relationship)({ ref: "LeadActivity.brokerage", many: true }),
    leadRoutingRules: (0, import_fields4.relationship)({ ref: "LeadRoutingRule.brokerage", many: true }),
    showings: (0, import_fields4.relationship)({ ref: "Showing.brokerage", many: true }),
    deals: (0, import_fields4.relationship)({ ref: "Deal.brokerage", many: true }),
    offers: (0, import_fields4.relationship)({ ref: "Offer.brokerage", many: true }),
    commissions: (0, import_fields4.relationship)({ ref: "Commission.brokerage", many: true }),
    listingSyndications: (0, import_fields4.relationship)({ ref: "ListingSyndication.brokerage", many: true }),
    listingEngagementAuthorities: (0, import_fields4.relationship)({ ref: "ListingEngagementAuthority.brokerage", many: true }),
    listingPublicationAuthorities: (0, import_fields4.relationship)({ ref: "ListingPublicationAuthority.brokerage", many: true }),
    practitionerLicenseAuthorities: (0, import_fields4.relationship)({ ref: "PractitionerLicenseAuthority.brokerage", many: true }),
    representationAuthorities: (0, import_fields4.relationship)({ ref: "RepresentationAuthority.brokerage", many: true }),
    documentEvidenceEvents: (0, import_fields4.relationship)({ ref: "DocumentEvidenceEvent.brokerage", many: true }),
    commissionLedgerEntries: (0, import_fields4.relationship)({ ref: "CommissionLedgerEntry.brokerage", many: true }),
    retentionPolicies: (0, import_fields4.relationship)({ ref: "RetentionPolicy.brokerage", many: true }),
    transactionFileEvents: (0, import_fields4.relationship)({ ref: "TransactionFileEvent.brokerage", many: true }),
    paymentProviders: (0, import_fields4.relationship)({ ref: "PaymentProvider.brokerage", many: true }),
    payments: (0, import_fields4.relationship)({ ref: "Payment.brokerage", many: true }),
    auditEvents: (0, import_fields4.relationship)({ ref: "DomainAuditEvent.brokerage", many: true }),
    commandReceipts: (0, import_fields4.relationship)({ ref: "CommandReceipt.brokerage", many: true }),
    ...trackingFields
  }
});

// features/keystone/models/BrokerageMembership.ts
var import_core4 = require("@keystone-6/core");
var import_fields5 = require("@keystone-6/core/fields");
var BrokerageMembership = (0, import_core4.list)({
  // One row per pair; the generated index name matches migration 20261107120000.
  db: { extendPrismaSchema: (schema) => schema.replace(/\n\}\s*$/, `
  @@unique([brokerageId, userId])
}`) },
  access: {
    operation: {
      query: isOperator,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: rules.canReadBrokerageMemberships }
  },
  hooks: {
    validate: ({ operation, inputData, addValidationError }) => {
      if (operation === "delete") return;
      validateRequiredToOneRelationship({ operation, inputData, field: "brokerage", addValidationError });
      validateRequiredToOneRelationship({ operation, inputData, field: "user", addValidationError });
    }
  },
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["brokerage", "user", "membershipRole", "status", "isPrimary"] }
  },
  fields: {
    membershipKey: (0, import_fields5.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    brokerage: (0, import_fields5.relationship)({ ref: "Brokerage.memberships" }),
    user: (0, import_fields5.relationship)({ ref: "User.brokerageMemberships" }),
    membershipRole: (0, import_fields5.select)({
      type: "enum",
      options: [
        { label: "Owner", value: "owner" },
        { label: "Administrator", value: "admin" },
        { label: "Team Lead", value: "team_lead" },
        { label: "Agent", value: "agent" },
        { label: "Coordinator", value: "coordinator" },
        { label: "Analyst", value: "analyst" }
      ],
      defaultValue: "agent",
      validation: { isRequired: true }
    }),
    status: (0, import_fields5.select)({
      type: "enum",
      options: [
        { label: "Invited", value: "invited" },
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" }
      ],
      defaultValue: "invited",
      validation: { isRequired: true }
    }),
    isPrimary: (0, import_fields5.checkbox)({ defaultValue: false }),
    joinedAt: (0, import_fields5.timestamp)(),
    ...trackingFields
  }
});

// features/keystone/models/BrokerageSettings.ts
var import_core5 = require("@keystone-6/core");
var import_fields7 = require("@keystone-6/core/fields");

// features/keystone/lib/domainEvents.ts
var import_node_crypto = __toESM(require("node:crypto"));
var sensitiveKey = /(?:credentials?|password|secret|token|api[_-]?key|private[_-]?key|client[_-]?secret)/i;
var decimalPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i;
function decimalValue(value) {
  const prototype = Object.getPrototypeOf(value);
  const constructorName = prototype?.constructor?.name;
  const tag = Object.prototype.toString.call(value);
  if (constructorName !== "Decimal" && tag !== "[object Decimal]") return null;
  const rendered = String(value.toString());
  if (!decimalPattern.test(rendered)) throw new Error("Domain JSON contains an invalid Decimal value");
  return rendered;
}
function normalizeJsonValue(value, options, ancestors, path2) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Domain JSON contains a non-finite number at ${path2}`);
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") {
    throw new Error(`Domain JSON contains unsupported ${typeof value} at ${path2}`);
  }
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new Error(`Domain JSON contains an invalid Date at ${path2}`);
    return value.toISOString();
  }
  const decimal14 = decimalValue(value);
  if (decimal14 !== null) return decimal14;
  if (ancestors.has(value)) throw new Error(`Domain JSON contains a cyclic reference at ${path2}`);
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new Error(`Domain JSON contains unsupported object ${prototype?.constructor?.name || "prototype"} at ${path2}`);
  }
  if (Object.getOwnPropertySymbols(value).length) throw new Error(`Domain JSON contains symbol keys at ${path2}`);
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return Array.from(value, (child, index) => normalizeJsonValue(child, options, ancestors, `${path2}[${index}]`));
    }
    const normalized = {};
    for (const key of Object.keys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor)) throw new Error(`Domain JSON contains an accessor at ${path2}.${key}`);
      if (options.redactSensitive && sensitiveKey.test(key)) {
        normalizeJsonValue(descriptor.value, { redactSensitive: false }, ancestors, `${path2}.${key}`);
        normalized[key] = "[REDACTED]";
      } else {
        normalized[key] = normalizeJsonValue(descriptor.value, options, ancestors, `${path2}.${key}`);
      }
    }
    return normalized;
  } finally {
    ancestors.delete(value);
  }
}
function normalizeDomainJson(value, options = {}) {
  return normalizeJsonValue(value, options, /* @__PURE__ */ new WeakSet(), "$");
}
function redactDomainSecrets(value) {
  return normalizeDomainJson(value, { redactSensitive: true });
}
function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, canonicalValue(child)])
    );
  }
  return value;
}
function canonicalDomainJson(value) {
  return JSON.stringify(canonicalValue(normalizeDomainJson(value)));
}
function domainPayloadHash(value) {
  return import_node_crypto.default.createHash("sha256").update(canonicalDomainJson(value)).digest("hex");
}
function normalizeDomainIdentifier(value, label = "Domain identifier") {
  if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 0)) {
    throw new Error(`${label} must be a non-negative safe integer or non-empty string`);
  }
  const normalized = String(value).trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}
function boundedDomainEvent(input) {
  const eventKey = String(input.eventKey || "").trim();
  if (!eventKey || eventKey.length > 240) throw new Error("A bounded domain event key is required");
  return {
    ...input,
    eventKey,
    brokerageId: normalizeDomainIdentifier(input.brokerageId, "Brokerage identifier"),
    aggregateId: normalizeDomainIdentifier(input.aggregateId, "Aggregate identifier"),
    actorId: input.actorId == null ? null : normalizeDomainIdentifier(input.actorId, "Actor identifier")
  };
}
async function enqueueDomainEvent(context, command2) {
  const input = boundedDomainEvent(command2);
  const { eventKey } = input;
  const sudo = context.sudo();
  const requestHash = domainPayloadHash(input.request);
  await sudo.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `domain-event:${eventKey}`);
  const existing = await sudo.query.CommandReceipt.findOne({
    where: { eventKey },
    query: "id eventKey requestHash payload"
  });
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new Error("Domain event idempotency key was reused with a different command");
    }
    return { eventId: existing.id, replayed: true, result: existing.payload?.result ?? null };
  }
  return writeDomainEvent(sudo, input, requestHash);
}
async function recordCrudDomainEvent(context, { operation, ...event }) {
  if (operation !== "create" && operation !== "update" && operation !== "delete") {
    throw new Error("CRUD domain events require a create, update or delete operation");
  }
  const input = boundedDomainEvent({
    ...event,
    eventKey: `hook:${event.aggregateType}:${event.aggregateId}:${operation}:${import_node_crypto.default.randomUUID()}`,
    eventType: `${event.aggregateType}.${operation}d`,
    action: operation
  });
  return writeDomainEvent(context.sudo(), input, domainPayloadHash(input.request));
}
async function writeDomainEvent(sudo, input, requestHash) {
  const { eventKey, brokerageId, aggregateId, actorId: actorId4 } = input;
  const occurredAt = input.occurredAt || (/* @__PURE__ */ new Date()).toISOString();
  const payload = redactDomainSecrets({
    schemaVersion: 1,
    eventKey,
    eventType: input.eventType,
    brokerageId,
    aggregate: { type: input.aggregateType, id: aggregateId },
    actorId: actorId4,
    occurredAt,
    request: input.request,
    before: input.before ?? null,
    after: input.after ?? null,
    result: input.after ?? null
  });
  const payloadHash = domainPayloadHash(payload);
  await sudo.query.DomainAuditEvent.createOne({
    data: {
      eventKey: `${eventKey}:audit`,
      brokerage: { connect: { id: brokerageId } },
      aggregateType: input.aggregateType,
      aggregateId,
      action: input.action,
      ...actorId4 ? { actor: { connect: { id: actorId4 } } } : {},
      beforeState: payload.before,
      afterState: payload.after,
      occurredAt
    },
    query: "id"
  });
  const event = await sudo.query.CommandReceipt.createOne({
    data: {
      eventKey,
      eventType: input.eventType,
      brokerage: { connect: { id: brokerageId } },
      aggregateType: input.aggregateType,
      aggregateId,
      requestHash,
      payloadHash,
      payload,
      occurredAt
    },
    query: "id eventKey"
  });
  return { eventId: event.id, replayed: false, result: payload.result ?? null };
}

// features/keystone/lib/money.ts
var import_fields6 = require("@keystone-6/core/fields");

// features/lib/money.ts
function moneyToMinor(value) {
  const text46 = String(value).trim();
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(text46)) throw new Error("Money must have at most two decimal places.");
  const negative = text46.startsWith("-");
  const [whole, fraction = ""] = text46.replace(/^-/, "").split(".");
  const cents2 = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  const result = negative ? -cents2 : cents2;
  if (result < -9223372036854775808n || result > 9223372036854775807n) throw new Error("Money exceeds supported storage range.");
  return result;
}
function minorToMoney(value) {
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}
function sumMoney(values) {
  return minorToMoney(values.reduce((sum, value) => sum + moneyToMinor(value ?? "0"), 0n));
}
var wholeDollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });

// features/keystone/lib/money.ts
function minorFilter(value) {
  if (value === null || value === void 0 || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(minorFilter);
  if (typeof value === "object" && value.constructor === Object) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, minorFilter(item)]));
  }
  return moneyToMinor(value);
}
function moneyLabel(fieldKey) {
  const words = fieldKey.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words[0].toUpperCase() + words.slice(1);
}
var legacyColumns = /* @__PURE__ */ new Map();
function normalizeMoneyRecord(listKey, record4) {
  if (!record4) return record4;
  const next = { ...record4 };
  for (const field of legacyColumns.get(listKey)?.keys() || []) {
    if (typeof next[field] === "bigint") next[field] = minorToMoney(next[field]);
  }
  return next;
}
function preserveLegacyMoneyColumns(schema) {
  let next = schema;
  for (const [list47, columns] of legacyColumns) {
    const pattern = new RegExp(`(model ${list47} \\{[\\s\\S]*?)(\\n\\})`);
    if (!pattern.test(next)) throw new Error(`Missing money model ${list47}`);
    next = next.replace(pattern, `$1
${[...columns.values()].join("\n")}$2`);
  }
  return next;
}
function money(config3 = {}) {
  return (meta) => {
    const base = (0, import_fields6.decimal)({ ...config3, scale: 2 })(meta);
    if (base.dbField.kind !== "scalar" || base.dbField.scalar !== "Decimal") throw new Error("Unsupported money storage metadata.");
    const legacyName = `legacy${meta.fieldKey[0].toUpperCase()}${meta.fieldKey.slice(1)}`;
    const legacyType = config3.legacyText ? 'String @default("")' : `Decimal${base.dbField.mode === "optional" ? "?" : ""}${config3.defaultValue === void 0 ? "" : ` @default("${config3.defaultValue}")`} @postgresql.Decimal(${config3.precision || 18}, 2)`;
    const columns = legacyColumns.get(meta.listKey) || /* @__PURE__ */ new Map();
    columns.set(meta.fieldKey, `  ${legacyName} ${legacyType} @map("${meta.fieldKey}") @ignore`);
    legacyColumns.set(meta.listKey, columns);
    const storage = (0, import_fields6.bigInt)({
      db: { ...config3.db, map: `${meta.fieldKey}Minor` },
      isIndexed: config3.isIndexed,
      validation: { isRequired: config3.validation?.isRequired },
      ...config3.defaultValue === void 0 ? {} : { defaultValue: moneyToMinor(config3.defaultValue) }
    })(meta);
    const convert = (value) => {
      const minor2 = moneyToMinor(value);
      const maximum = 10n ** BigInt(config3.precision || 18) - 1n;
      if (minor2 > maximum || minor2 < -maximum) throw new Error("Money exceeds the field precision.");
      return minor2;
    };
    const validate = base.hooks?.validate;
    const input = base.input;
    if (!input?.create?.resolve || !input.update || !base.output.resolve) throw new Error("Unsupported Keystone money field contract.");
    const create = input.create;
    const output = base.output.resolve;
    return {
      ...base,
      dbField: storage.dbField,
      hooks: {
        ...base.hooks,
        validate: typeof validate === "function" || !config3.allowNegative ? (args) => {
          if (args.operation === "delete") return typeof validate === "function" ? validate(args) : void 0;
          const value = args.resolvedData[meta.fieldKey];
          if (!config3.allowNegative && typeof value === "bigint" && value < 0n) args.addValidationError(`${moneyLabel(meta.fieldKey)} cannot be negative.`);
          if (typeof validate !== "function") return;
          return validate({ ...args, resolvedData: {
            ...args.resolvedData,
            [meta.fieldKey]: typeof value === "bigint" ? minorToMoney(value) : value
          } });
        } : validate
      },
      input: {
        ...input,
        create: { ...create, resolve: (value) => {
          const normalized = value === void 0 ? config3.defaultValue : value;
          return normalized == null ? normalized : convert(normalized);
        } },
        update: { ...input.update, resolve: (value) => value == null ? value : convert(value) },
        where: input.where ? { ...input.where, resolve: (value) => value == null ? null : minorFilter(value) } : void 0,
        uniqueWhere: input.uniqueWhere ? { ...input.uniqueWhere, resolve: (value) => moneyToMinor(value) } : void 0
      },
      output: { ...base.output, resolve: (source, args, context, info) => output({
        ...source,
        value: source.value == null ? source.value : minorToMoney(BigInt(String(source.value)))
      }, args, context, info) }
    };
  };
}

// features/keystone/lib/tenantOwnedHooks.ts
function relationshipId(data, field) {
  const value = data?.[field];
  if (typeof value === "string") return value;
  return value?.connect?.id || data?.[`${field}Id`] || null;
}
function relationshipIds(data, field) {
  const connect = data?.[field]?.connect;
  if (Array.isArray(connect)) return connect.map((item) => item?.id).filter(Boolean);
  return connect?.id ? [connect.id] : [];
}
async function relatedBrokerageIds(context, listKey, id, allowCustomers = false) {
  if (listKey === "User") {
    const user = await context.sudo().query.User.findOne({
      where: { id },
      query: "id activeBrokerage { id status } brokerageMemberships { status brokerage { id status } }"
    });
    const memberships = user?.brokerageMemberships || [];
    if (allowCustomers && !memberships.length && user?.activeBrokerage?.status === "active") return [user.activeBrokerage.id];
    return memberships.filter((membership) => membership.status === "active" && membership.brokerage?.status === "active").map((membership) => membership.brokerage.id);
  }
  const item = await context.sudo().query[listKey].findOne({
    where: { id },
    query: "id brokerage { id }"
  });
  return item?.brokerage?.id ? [item.brokerage.id] : [];
}
async function deriveBrokerage(context, inputData, config3) {
  for (const [field, listKey] of Object.entries(config3.parents || {})) {
    const id = relationshipId(inputData, field);
    if (!id) continue;
    const brokerageIds = await relatedBrokerageIds(context, listKey, id);
    if (brokerageIds.length === 1) return brokerageIds[0];
  }
  for (const field of config3.users || []) {
    const id = relationshipId(inputData, field);
    if (!id) continue;
    const brokerageIds = await relatedBrokerageIds(context, "User", id, config3.allowCustomers);
    if (brokerageIds.length === 1) return brokerageIds[0];
  }
  return null;
}
function auditableInput(inputData) {
  if (!inputData || typeof inputData !== "object" || Array.isArray(inputData)) return inputData;
  const input = inputData;
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    const upload = value && typeof value === "object" && !Array.isArray(value) ? value.upload : void 0;
    if (upload !== void 0) out[key] = { upload: "file" };
    else if (value !== void 0) out[key] = value;
  }
  return out;
}
function auditRequest(audited, id) {
  return audited && typeof audited === "object" && !Array.isArray(audited) ? audited : { id };
}
function createTenantOwnedHooks(config3) {
  return {
    async resolveInput({ operation, inputData, resolvedData, context }) {
      if (operation !== "create" || config3.deriveOnly || relationshipId(inputData, "brokerage")) return resolvedData;
      const brokerageId = await deriveBrokerage(context, inputData, config3);
      return brokerageId ? { ...resolvedData, brokerage: { connect: { id: brokerageId } } } : resolvedData;
    },
    async validateInput({ operation, inputData, resolvedData, item, context, addValidationError }) {
      const relationshipData = { ...item || {}, ...resolvedData || {}, ...inputData || {} };
      const brokerageId = relationshipId(relationshipData, "brokerage") || await deriveBrokerage(context, relationshipData, config3);
      if (operation === "create" && !brokerageId) {
        addValidationError(`${config3.listKey} requires a brokerage.`);
        return;
      }
      if (inputData?.brokerage?.disconnect) {
        addValidationError(`${config3.listKey} brokerage cannot be disconnected.`);
        return;
      }
      if (!brokerageId) return;
      if (operation === "create") {
        for (const field of config3.required || []) {
          if (!relationshipId(inputData, field)) addValidationError(`${config3.listKey} requires ${field}.`);
        }
        if (config3.requiredAny?.length && !config3.requiredAny.some((field) => relationshipId(inputData, field))) {
          addValidationError(`${config3.listKey} requires one of ${config3.requiredAny.join(", ")}.`);
        }
      }
      if (config3.coherentWith) {
        const rootId = relationshipId(relationshipData, config3.coherentWith.field);
        if (rootId) {
          const selection = Object.values(config3.coherentWith.matches).map((field) => `${field} { id }`).join(" ");
          const root = await context.sudo().query[config3.coherentWith.listKey].findOne({ where: { id: rootId }, query: `id ${selection}` });
          for (const [field, rootField] of Object.entries(config3.coherentWith.matches)) {
            const connectedId = relationshipId(relationshipData, field);
            if (connectedId && root?.[rootField]?.id !== connectedId) {
              addValidationError(`${config3.listKey} ${field} must match ${config3.coherentWith.field}.${rootField}.`);
            }
          }
        }
      }
      for (const [field, listKey] of Object.entries(config3.parents || {})) {
        const id = relationshipId(relationshipData, field);
        if (!id) continue;
        const brokerageIds = await relatedBrokerageIds(context, listKey, id);
        if (!brokerageIds.includes(brokerageId)) {
          addValidationError(`${config3.listKey} ${field} must belong to the same brokerage.`);
        }
      }
      for (const field of config3.users || []) {
        const id = relationshipId(relationshipData, field);
        if (!id) continue;
        const brokerageIds = await relatedBrokerageIds(context, "User", id, config3.allowCustomers);
        if (!brokerageIds.includes(brokerageId)) {
          addValidationError(`${config3.listKey} ${field} must have an active membership in the brokerage.`);
        }
      }
      for (const field of config3.manyUsers || []) {
        for (const id of relationshipIds(relationshipData, field)) {
          const brokerageIds = await relatedBrokerageIds(context, "User", id);
          if (!brokerageIds.includes(brokerageId)) {
            addValidationError(`${config3.listKey} ${field} must contain only active brokerage members.`);
          }
        }
      }
      for (const field of config3.teams || []) {
        const id = relationshipId(relationshipData, field);
        if (!id) continue;
        const brokerageIds = await relatedBrokerageIds(context, "AgentTeam", id);
        if (!brokerageIds.includes(brokerageId)) {
          addValidationError(`${config3.listKey} ${field} must belong to the same brokerage.`);
        }
      }
    },
    beforeOperation({ operation }) {
      if (operation === "delete" && config3.protectDelete) {
        throw new Error(`${config3.listKey} deletion requires a controlled domain operation.`);
      }
    },
    async afterOperation({ operation, item, originalItem, inputData, context }) {
      const actorId4 = context.session?.itemId;
      const record4 = item || originalItem;
      const brokerageId = record4?.brokerageId || record4?.brokerage || await deriveBrokerage(context, { ...record4 || {}, ...inputData || {} }, config3);
      if (!actorId4 || !record4?.id || !brokerageId) return;
      const aggregateType = config3.listKey.charAt(0).toLowerCase() + config3.listKey.slice(1);
      await recordCrudDomainEvent(context, {
        operation,
        brokerageId,
        aggregateType,
        aggregateId: record4.id,
        actorId: actorId4,
        request: auditRequest(auditableInput(inputData), record4.id),
        before: normalizeMoneyRecord(config3.listKey, originalItem || null),
        after: normalizeMoneyRecord(config3.listKey, item || null)
      });
    }
  };
}

// features/lib/storefront-theme.ts
var DEFAULT_STOREFRONT_BRAND_HUE = 151;
function normalizeStorefrontBrandHue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_STOREFRONT_BRAND_HUE;
  const integer22 = Math.round(numeric);
  return (integer22 % 360 + 360) % 360;
}

// features/keystone/utils/storeLogo.ts
var ALLOWED_ELEMENTS = /* @__PURE__ */ new Set([
  "svg",
  "g",
  "path",
  "defs",
  "lineargradient",
  "radialgradient",
  "stop",
  "clippath",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "title",
  "desc"
]);
var ALLOWED_ATTRIBUTES = /* @__PURE__ */ new Set([
  "xmlns",
  "fill",
  "fill-rule",
  "clip-rule",
  "height",
  "width",
  "viewbox",
  "d",
  "clip-path",
  "id",
  "x1",
  "x2",
  "y1",
  "y2",
  "gradientunits",
  "gradienttransform",
  "offset",
  "stop-color",
  "stop-opacity",
  "opacity",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "transform",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "points",
  "role",
  "aria-hidden",
  "aria-label",
  "preserveaspectratio"
]);
var ATTRIBUTE_PATTERN = /\s+([A-Za-z_:][\w:.-]*)\s*=\s*("[^"]*"|'[^']*')/g;
var TAG_PATTERN = /<\/?\s*([A-Za-z][\w:-]*)([^<>]*)>/g;
function sanitizeStoreLogoSvg(svg) {
  const source = svg.trim();
  if (!source.startsWith("<svg") || !source.endsWith("</svg>") || source.length > 1e5) {
    return "";
  }
  if (/<!|<\?|\b(?:javascript|data|vbscript):|\bon[a-z]+\s*=|\b(?:href|src|style)\s*=/i.test(source)) {
    return "";
  }
  let tagCount = 0;
  let match;
  TAG_PATTERN.lastIndex = 0;
  while (match = TAG_PATTERN.exec(source)) {
    tagCount += 1;
    const element = match[1].toLowerCase();
    if (!ALLOWED_ELEMENTS.has(element)) return "";
    if (match[0].startsWith("</")) continue;
    const attributes = match[2];
    let consumed = "";
    ATTRIBUTE_PATTERN.lastIndex = 0;
    let attributeMatch;
    while (attributeMatch = ATTRIBUTE_PATTERN.exec(attributes)) {
      consumed += attributeMatch[0];
      const attribute = attributeMatch[1].toLowerCase();
      const value = attributeMatch[2].slice(1, -1);
      if (!ALLOWED_ATTRIBUTES.has(attribute)) return "";
      if (attribute === "id" && !/^[A-Za-z_][\w:.-]*$/.test(value)) return "";
      if (/url\(/i.test(value) && !/^url\(#[A-Za-z_][\w:.-]*\)$/.test(value)) return "";
    }
    const remainder = attributes.replace(consumed, "").replace(/\//g, "").trim();
    if (remainder) return "";
  }
  TAG_PATTERN.lastIndex = 0;
  if (tagCount === 0 || source.replace(TAG_PATTERN, "").trim()) return "";
  return source;
}

// features/platform/store-settings/lib/icon-registry.ts
var LOGO_ICONS = [
  {
    id: "3portals",
    name: "3Portals",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g clip-rule="evenodd" fill-rule="evenodd"><path d="m34.5868 8.40061-9.6868-2.59556c-.6687-.17919-1.2108.23679-1.2108.92911v10.02854c0 .6923.5421 1.3988 1.2108 1.578l9.6868 2.5955c.6687.1792 1.2109-.2368 1.2109-.9291v-10.02848c0-.69232-.5422-1.39882-1.2109-1.57801zm-9.6868-6.35625c-2.6749-.71674-4.8434.94718-4.8434 3.71647v10.02847c0 2.7693 2.1685 5.5953 4.8434 6.312l9.6868 2.5956c2.6749.7168 4.8434-.9472 4.8434-3.7165v-10.0284c0-2.76934-2.1685-5.59533-4.8434-6.31207z" fill="#8098f9"/><path d="m26.9812 16.5707-12.1085-3.2444c-.6687-.1792-1.2109.2368-1.2109.9291v12.5356c0 .6923.5422 1.3988 1.2109 1.578l12.1085 3.2445c.6687.1792 1.2108-.2368 1.2108-.9291v-12.5356c0-.6924-.5421-1.3989-1.2108-1.5781zm-12.1085-7.0051c-2.6749-.71674-4.8434.9472-4.8434 3.7165v12.5356c0 2.7693 2.1685 5.5953 4.8434 6.312l12.1085 3.2445c2.6749.7167 4.8433-.9472 4.8433-3.7165v-12.5356c0-2.7693-2.1684-5.5953-4.8433-6.312z" fill="#6172f3"/><path d="m19.3736 24.7409-14.53021-3.8934c-.66873-.1792-1.21085.2368-1.21085.9291v15.0428c0 .6923.54212 1.3988 1.21085 1.578l14.53021 3.8933c.6687.1792 1.2108-.2368 1.2108-.9291v-15.0427c0-.6923-.5421-1.3988-1.2108-1.578zm-14.53021-7.6541c-2.67493-.7167-4.84339.9472-4.84339 3.7165v15.0427c0 2.7693 2.16846 5.5953 4.84339 6.3121l14.53021 3.8933c2.6749.7168 4.8433-.9472 4.8433-3.7164v-15.0428c0-2.7693-2.1684-5.5953-4.8433-6.312z" fill="#444ce7"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g clip-rule="evenodd" fill="#fff" fill-rule="evenodd"><path d="m34.5868 8.40061-9.6868-2.59556c-.6687-.17919-1.2108.23679-1.2108.92911v10.02854c0 .6923.5421 1.3988 1.2108 1.578l9.6868 2.5955c.6687.1792 1.2109-.2368 1.2109-.9291v-10.02848c0-.69232-.5422-1.39882-1.2109-1.57801zm-9.6868-6.35625c-2.6749-.71674-4.8434.94718-4.8434 3.71647v10.02847c0 2.7693 2.1685 5.5953 4.8434 6.312l9.6868 2.5956c2.6749.7168 4.8434-.9472 4.8434-3.7165v-10.0284c0-2.76934-2.1685-5.59533-4.8434-6.31207z" opacity=".5"/><path d="m26.9812 16.5707-12.1085-3.2444c-.6687-.1792-1.2109.2368-1.2109.9291v12.5356c0 .6923.5422 1.3988 1.2109 1.578l12.1085 3.2445c.6687.1792 1.2108-.2368 1.2108-.9291v-12.5356c0-.6924-.5421-1.3989-1.2108-1.5781zm-12.1085-7.0051c-2.6749-.71674-4.8434.9472-4.8434 3.7165v12.5356c0 2.7693 2.1685 5.5953 4.8434 6.312l12.1085 3.2445c2.6749.7167 4.8433-.9472 4.8433-3.7165v-12.5356c0-2.7693-2.1684-5.5953-4.8433-6.312z" opacity=".7"/><path d="m19.3736 24.7409-14.53021-3.8934c-.66873-.1792-1.21085.2368-1.21085.9291v15.0428c0 .6923.54212 1.3988 1.21085 1.578l14.53021 3.8933c.6687.1792 1.2108-.2368 1.2108-.9291v-15.0427c0-.6923-.5421-1.3988-1.2108-1.578zm-14.53021-7.6541c-2.67493-.7167-4.84339.9472-4.84339 3.7165v15.0427c0 2.7693 2.16846 5.5953 4.84339 6.3121l14.53021 3.8933c2.6749.7168 4.8433-.9472 4.8433-3.7164v-15.0428c0-2.7693-2.1684-5.5953-4.8433-6.312z"/></g></svg>`
  },
  {
    id: "45-degrees",
    name: "45 Degrees",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 24 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 15.8981h17.3455l-17.061314 17.0613 2.756374 2.7564 17.06134-17.0613v17.3455h.1104l3.7877-3.7877v-15.9638l-4.2485-4.2485h-15.96596l-3.78553995 3.7855z" fill="#155eef"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 24 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 15.8981h17.3455l-17.061314 17.0613 2.756374 2.7564 17.06134-17.0613v17.3455h.1104l3.7877-3.7877v-15.9638l-4.2485-4.2485h-15.96596l-3.78553995 3.7855z" fill="#155eef"/></svg>`
  },
  {
    id: "acme-corp",
    name: "Acme Corp",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 48 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m0 24c15.2548 0 24-8.7452 24-24 0 15.2548 8.7452 24 24 24-15.2548 0-24 8.7452-24 24 0-15.2548-8.7452-24-24-24z" fill="#155eef" fill-rule="evenodd"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 48 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m0 24c15.2548 0 24-8.7452 24-24 0 15.2548 8.7452 24 24 24-15.2548 0-24 8.7452-24 24 0-15.2548-8.7452-24-24-24z" fill="#155eef" fill-rule="evenodd"/></svg>`
  },
  {
    id: "alphawave",
    name: "AlphaWave",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 47 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m24.9706 7.03309c-3.1242-3.1242-8.1896-3.1242-11.3137 0l-11.31375 11.31371c-3.124199 3.1242-3.124199 8.1895 0 11.3137l11.31375 11.3137c3.1241 3.1242 8.1895 3.1242 11.3137 0l5.3982-5.3983c-4.4939-1.7337-7.682-6.0944-7.682-11.1997 0-5.3087 3.4472-9.8123 8.2254-11.3943-.0935-.0982-.1884-.1955-.2848-.292z" fill="#155eef"/><path d="m30.3691 35.5798c1.3398.5168 2.7955.8001 4.3174.8001 6.6274 0 12-5.3726 12-12s-5.3726-12-12-12c-1.3185 0-2.5873.2126-3.774.6055 5.9623 6.2681 5.8675 16.1836-.2846 22.3356z" fill="#155eef" opacity=".7"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 47 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m24.9706 7.03309c-3.1242-3.1242-8.1896-3.1242-11.3137 0l-11.31375 11.31371c-3.124199 3.1242-3.124199 8.1895 0 11.3137l11.31375 11.3137c3.1241 3.1242 8.1895 3.1242 11.3137 0l5.3982-5.3983c-4.4939-1.7337-7.682-6.0944-7.682-11.1997 0-5.3087 3.4472-9.8123 8.2254-11.3943-.0935-.0982-.1884-.1955-.2848-.292z" fill="#155eef"/><path d="m30.3691 35.5798c1.3398.5168 2.7955.8001 4.3174.8001 6.6274 0 12-5.3726 12-12s-5.3726-12-12-12c-1.3185 0-2.5873.2126-3.774.6055 5.9623 6.2681 5.8675 16.1836-.2846 22.3356z" fill="#155eef" opacity=".7"/></svg>`
  },
  {
    id: "alt-shift",
    name: "Alt+Shift",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m23.4538 34.7189c-3.1818-1.1818-6.4544-1.3636-9.4544-.5455-2.0909.5455-4.09082 1.6364-5.90897 3l-1.27273 1.0909-.36362.3636.81816.7273c.09091 0 .09092.0909.18183.1818.18181.1818.36364.2727.63636.4545l.54542.3636.54545-.4545c.09091-.0909.27273-.2727.45454-.3636 1.63636-1.3636 3.45446-2.2727 5.36356-2.7272 2.4545-.6364 5.0908-.5455 7.7271.4545 2.1818.8182 6.6363 1.8181 11.9998-.4545l.1818-.091.2728-.2727c0-.0909.0909-.0909.1818-.1818.4545-.5454.9091-1.0909 1.2727-1.7272l1.8181-2.8182-2.909 1.6363c-4.2727 2.3636-8.1817 2.8182-12.0907 1.3637z"/><path d="m10.9998 24.9011c2.4545-.6363 5.0908-.5454 7.7272.4546 2.909 1.0909 10.3634 2.6363 18.7269-4.909l1.8182-1.8182-.1819-.4545c-.0909-.3636-.2727-.8182-.4545-1.2727l-.4545-1.2727-.9091.909c-.0909.1819-.2727.2728-.4546.4546-3.9999 4.0908-10.1816 8.2726-17.2724 5.7272-3.1817-1.1818-6.4544-1.3637-9.4544-.5455-2.909.8182-5.45442 2.3636-7.81801 4.5454v-.0909l-1.363614 1.4545c0 .0909-.090891.0909-.181798.1818l-.27274.2727.090913.3637c.090908.4545.272717.909.363625 1.3636l.545454 1.4545.90907-1.1818c.09091-.1818.27272-.2727.36363-.4545 1.90905-1.7273 4.54538-4.1818 8.27257-5.1818z"/><path d="m2.1818 23.2646c2.09088-2.1818 4.45445-3.5454 6.99987-4.2727 2.45453-.6363 5.09083-.5454 7.72713.4546 8.1817 2.9999 15.2725-1.9091 18.3633-4.5454l1.1818-1.1818.4546-.3636-.3637-.5455c-.2727-.2727-.4545-.6363-.7272-1l-.5455-.7272-.6363.6363c-.0909.0909-.2727.2727-.3637.3637-3.8181 3.6363-9.7271 7.3635-16.4542 4.8181-3.1818-1.1818-6.4544-1.3637-9.4544-.5455-1.90906.5455-3.72721 1.4545-5.54536 2.6363l-1.909065 1.5455c-.181815.1818-.272722.2727-.454537.4545l-.181799.1818v.2727c-.090907.6364-.090918 1.2727-.1818259 1.8182l-.0909131 2.2727 1.54544-1.6364c.18181-.1818.36364-.4545.63636-.6363z"/><path d="m26.0908 40.9007c-.2727-.0909-.4545-.1819-.7272-.2728-3.1818-1.1818-6.4545-1.3636-9.4545-.5454-.6363.1818-1.2726.3636-1.909.6364l-2.1818.9999-.5454.2728 1.8181.6363c.5455.1818 1.0909.3637 1.6364.5455l.2727.0909.2727-.0909c.2727-.0909.5455-.2728.8182-.2728.1818 0 .3636-.0909.5454-.1818 2.1818-.5454 4.5454-.5454 7.0908.2727.2727.091.4546.1819.7273.2728l.4545.1818.2727-.0909c.6364-.1818 1.3636-.3636 1.9091-.6364l2.5454-.909-2.6363-.6364c-.2727-.0909-.6364-.1818-.9091-.2727z"/><path d="m40 22.0829-1.3636 1.3636c-.1818.1818-.3636.3636-.5454.5454-3.7272 3.5454-9.7271 7.3635-16.4543 4.8181-3.1818-1.1818-6.4544-1.3636-9.4544-.5454-2.81811.8182-5.36354 2.2727-7.63623 4.4545l-1.18179 1.2727-.36362.4545.36362.5454c.27273.3637.45455.6364.63637 1l.54542.8182.63636-.8182c.09091-.0909.27272-.2727.36363-.3636 2.18178-2.3636 4.54534-3.8181 7.27264-4.5454 2.4545-.6364 5.0908-.5454 7.7271.4545 2.2727.8182 4.6363 1.0909 6.9999.8182 4.1817-.4545 8.3635-2.8181 11.4543-5.4544.1819-.1818.3636-.2727.5455-.4546l.2727-.2727v-.2727c0-.5455.0909-1.1818.0909-1.7273z"/><path d="m5.45373 13.7196c.54545-.2728 1.18182-.4546 1.72726-.6364 2.45451-.6364 5.09081-.5455 7.72711.4545 1.7273.6364 3.4545.9091 5.3636.9091 3.8181 0 7.6362-1.3636 11.1816-3.9999l1.8181-1.45455-.8181-.63636c-.2727-.27273-.6364-.54544-1-.72725l-.5455-.36363-.4545.36363c-.1818.09091-.2727.27272-.4545.36362-4.8181 3.63634-9.6362 4.63634-14.1816 2.90904-3.2727-1.18178-6.54535-1.45451-9.81802-.4545-.27272.0909-.54544.1818-.90907.2727l-.1818.0909-.27274.2727c0 .0909-.09089.0909-.1818.1818-.36363.5455-.81818 1-1.18181 1.5455l-1.72724 2.6363 2.81814-1.4545c.45453 0 .81815-.1818 1.09087-.2727z"/><path d="m12.9089 7.53769.2727.09091c1.1818.45454 3 .90907 5.2726.90907 2.3636 0 4.6363-.54545 6.909-1.45452l2.8181-1.36361-1.909-.63634c-.5454-.18182-1.0909-.36363-1.7273-.45454h-.2727l-.2727.09089c-.2727.0909-.5455.27274-.8182.36365-2.7272.99998-5.4544 1.1818-8.0907.45454-.2728-.09091-.5455-.18183-.8182-.27274l-.2727-.09091-.2728.09091c-.5454.18181-1.0908.36364-1.6363.63636l-2.09087.90908 2.18177.63633c.1818-.0909.4546.00001.7273.09092z"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m23.4538 34.7189c-3.1818-1.1818-6.4544-1.3636-9.4544-.5455-2.0909.5455-4.09082 1.6364-5.90897 3l-1.27273 1.0909-.36362.3636.81816.7273c.09091 0 .09092.0909.18183.1818.18181.1818.36364.2727.63636.4545l.54542.3636.54545-.4545c.09091-.0909.27273-.2727.45454-.3636 1.63636-1.3636 3.45446-2.2727 5.36356-2.7272 2.4545-.6364 5.0908-.5455 7.7271.4545 2.1818.8182 6.6363 1.8181 11.9998-.4545l.1818-.091.2728-.2727c0-.0909.0909-.0909.1818-.1818.4545-.5454.9091-1.0909 1.2727-1.7272l1.8181-2.8182-2.909 1.6363c-4.2727 2.3636-8.1817 2.8182-12.0907 1.3637z"/><path d="m10.9998 24.9011c2.4545-.6363 5.0908-.5454 7.7272.4546 2.909 1.0909 10.3634 2.6363 18.7269-4.909l1.8182-1.8182-.1819-.4545c-.0909-.3636-.2727-.8182-.4545-1.2727l-.4545-1.2727-.9091.909c-.0909.1819-.2727.2728-.4546.4546-3.9999 4.0908-10.1816 8.2726-17.2724 5.7272-3.1817-1.1818-6.4544-1.3637-9.4544-.5455-2.909.8182-5.45442 2.3636-7.81801 4.5454v-.0909l-1.363614 1.4545c0 .0909-.090891.0909-.181798.1818l-.27274.2727.090913.3637c.090908.4545.272717.909.363625 1.3636l.545454 1.4545.90907-1.1818c.09091-.1818.27272-.2727.36363-.4545 1.90905-1.7273 4.54538-4.1818 8.27257-5.1818z"/><path d="m2.1818 23.2646c2.09088-2.1818 4.45445-3.5454 6.99987-4.2727 2.45453-.6363 5.09083-.5454 7.72713.4546 8.1817 2.9999 15.2725-1.9091 18.3633-4.5454l1.1818-1.1818.4546-.3636-.3637-.5455c-.2727-.2727-.4545-.6363-.7272-1l-.5455-.7272-.6363.6363c-.0909.0909-.2727.2727-.3637.3637-3.8181 3.6363-9.7271 7.3635-16.4542 4.8181-3.1818-1.1818-6.4544-1.3637-9.4544-.5455-1.90906.5455-3.72721 1.4545-5.54536 2.6363l-1.909065 1.5455c-.181815.1818-.272722.2727-.454537.4545l-.181799.1818v.2727c-.090907.6364-.090918 1.2727-.1818259 1.8182l-.0909131 2.2727 1.54544-1.6364c.18181-.1818.36364-.4545.63636-.6363z"/><path d="m26.0908 40.9007c-.2727-.0909-.4545-.1819-.7272-.2728-3.1818-1.1818-6.4545-1.3636-9.4545-.5454-.6363.1818-1.2726.3636-1.909.6364l-2.1818.9999-.5454.2728 1.8181.6363c.5455.1818 1.0909.3637 1.6364.5455l.2727.0909.2727-.0909c.2727-.0909.5455-.2728.8182-.2728.1818 0 .3636-.0909.5454-.1818 2.1818-.5454 4.5454-.5454 7.0908.2727.2727.091.4546.1819.7273.2728l.4545.1818.2727-.0909c.6364-.1818 1.3636-.3636 1.9091-.6364l2.5454-.909-2.6363-.6364c-.2727-.0909-.6364-.1818-.9091-.2727z"/><path d="m40 22.0829-1.3636 1.3636c-.1818.1818-.3636.3636-.5454.5454-3.7272 3.5454-9.7271 7.3635-16.4543 4.8181-3.1818-1.1818-6.4544-1.3636-9.4544-.5454-2.81811.8182-5.36354 2.2727-7.63623 4.4545l-1.18179 1.2727-.36362.4545.36362.5454c.27273.3637.45455.6364.63637 1l.54542.8182.63636-.8182c.09091-.0909.27272-.2727.36363-.3636 2.18178-2.3636 4.54534-3.8181 7.27264-4.5454 2.4545-.6364 5.0908-.5454 7.7271.4545 2.2727.8182 4.6363 1.0909 6.9999.8182 4.1817-.4545 8.3635-2.8181 11.4543-5.4544.1819-.1818.3636-.2727.5455-.4546l.2727-.2727v-.2727c0-.5455.0909-1.1818.0909-1.7273z"/><path d="m5.45373 13.7196c.54545-.2728 1.18182-.4546 1.72726-.6364 2.45451-.6364 5.09081-.5455 7.72711.4545 1.7273.6364 3.4545.9091 5.3636.9091 3.8181 0 7.6362-1.3636 11.1816-3.9999l1.8181-1.45455-.8181-.63636c-.2728-.27273-.6364-.54544-1-.72725l-.5455-.36363-.4545.36363c-.1818.09091-.2727.27272-.4545.36362-4.8181 3.63634-9.6362 4.63634-14.1816 2.90904-3.2727-1.18178-6.54535-1.45451-9.81802-.4545-.27272.0909-.54544.1818-.90907.2727l-.1818.0909-.27274.2727c0 .0909-.09089.0909-.1818.1818-.36363.5455-.81818 1-1.18181 1.5455l-1.72724 2.6363 2.81814-1.4545c.45453 0 .81815-.1818 1.09087-.2727z"/><path d="m12.9089 7.53769.2727.09091c1.1818.45454 3 .90907 5.2726.90907 2.3636 0 4.6363-.54545 6.909-1.45452l2.8181-1.36361-1.909-.63634c-.5454-.18182-1.0909-.36363-1.7273-.45454h-.2727l-.2727.09089c-.2727.0909-.5455.27274-.8182.36365-2.7272.99998-5.4544 1.1818-8.0907.45454-.2728-.09091-.5455-.18183-.8182-.27274l-.2727-.09091-.2728.09091c-.5454.18181-1.0908.36364-1.6363.63636l-2.09087.90908 2.18177.63633c.1818-.0909.4546.00001.7273.09092z"/></g></svg>`
  },
  {
    id: "biosynthesis",
    name: "Biosynthesis",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g clip-rule="evenodd" fill-rule="evenodd"><path d="m4.29111 28.6025c.90712.9019.9071 2.3641-.00003 3.266l-.04646.0462c-.90713.9019-2.37788.9018-3.284994-.0001-.9071177-.9019-.9071038-2.3641.000031-3.266l.046453-.0462c.90714-.9019 2.37788-.9018 3.285.0001z" fill="#a4bcfd"/><path d="m15.2112 29.298c.9055.9035.9028 2.3658-.006 3.266l-6.43424 6.3741c-.90876.9002-2.3795.8976-3.28499-.0059-.90548-.9035-.90282-2.3658.00594-3.266l6.43429-6.3741c.9088-.9002 2.3795-.8976 3.285.0059z" fill="#6172f3"/><path d="m23.9431 40.2706c.7116-1.0613 2.1538-1.348 3.2212-.6405l.1394.0923c1.0674.7075 1.3558 2.1414.6442 3.2026-.7116 1.0613-2.1538 1.3481-3.2212.6406l-.1394-.0924c-1.0674-.7075-1.3558-2.1414-.6442-3.2026z" fill="#a4bcfd"/><path d="m39.2728 28.4638c.9072.9019.9072 2.3641 0 3.266l-3.159 3.1408c-.9072.9019-2.3779.9019-3.285 0s-.9071-2.3641 0-3.266l3.1591-3.1408c.9071-.9019 2.3778-.9019 3.2849 0z" fill="#6172f3"/><g fill="#444ce7"><path d="m39.3197 16.8473c.9071.9019.9071 2.3642 0 3.266l-23.3446 23.2098c-.9071.9019-2.3779.9019-3.285 0s-.9071-2.3641 0-3.266l23.3446-23.2098c.9071-.9019 2.3778-.9019 3.285 0z"/><path d="m34.905 9.71133c.9072.90187.9072 2.36417 0 3.26607l-13.426 13.3485c-.9071.9019-2.3779.9019-3.285 0s-.9071-2.3642 0-3.2661l13.4261-13.34847c.9071-.90189 2.3778-.90189 3.2849 0z"/><path d="m27.8187 5.18362c.9077.90128.9087 2.36353.0022 3.26603l-17.2588 17.18215c-.90647.9025-2.37721.9035-3.28495.0022-.90773-.9013-.90872-2.3635-.00221-3.266l17.25876-17.18218c.9065-.9025 2.3772-.90348 3.285-.0022z"/></g><path d="m10.7276 10.6841c.9056.9035.9031 2.3657-.0056 3.266l-6.75949 6.6974c-.90869.9003-2.37943.8978-3.28499-.0056-.905563-.9035-.903032-2.3657.005654-3.2661l6.759476-6.6973c.90868-.90034 2.37942-.89783 3.28495.0056z" fill="#6172f3"/><path d="m14.8678 4.00024c1.2828 0 2.3228 1.03397 2.3228 2.30944v.23094c0 1.27546-1.04 2.30943-2.3228 2.30943-1.2829 0-2.3229-1.03397-2.3229-2.30943v-.23094c0-1.27547 1.04-2.30944 2.3229-2.30944z" fill="#a4bcfd"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g clip-rule="evenodd" fill="#fff" fill-rule="evenodd"><path d="m4.29111 28.6025c.90712.9019.9071 2.3641-.00003 3.266l-.04646.0462c-.90713.9019-2.37788.9018-3.284994-.0001-.9071177-.9019-.9071038-2.3641.000031-3.266l.046453-.0462c.90714-.9019 2.37788-.9018 3.285.0001z" opacity=".5"/><path d="m15.2112 29.298c.9055.9035.9028 2.3658-.006 3.266l-6.43424 6.3741c-.90876.9002-2.3795.8976-3.28499-.0059-.90548-.9035-.90282-2.3658.00594-3.266l6.43429-6.3741c.9088-.9002 2.3795-.8976 3.285.0059z" opacity=".7"/><path d="m23.9431 40.2706c.7116-1.0613 2.1538-1.348 3.2212-.6405l.1394.0923c1.0674.7075 1.3558 2.1414.6442 3.2026-.7116 1.0613-2.1538 1.3481-3.2212.6406l-.1394-.0924c-1.0674-.7075-1.3558-2.1414-.6442-3.2026z" opacity=".5"/><path d="m39.2728 28.4638c.9072.9019.9072 2.3641 0 3.266l-3.159 3.1408c-.9072.9019-2.3779.9019-3.285 0s-.9071-2.3641 0-3.266l3.1591-3.1408c.9071-.9019 2.3778-.9019 3.2849 0z" opacity=".7"/><path d="m39.3197 16.8473c.9071.9019.9071 2.3642 0 3.266l-23.3446 23.2098c-.9071.9019-2.3779.9019-3.285 0s-.9071-2.3641 0-3.266l23.3446-23.2098c.9071-.9019 2.3778-.9019 3.285 0z"/><path d="m34.905 9.71133c.9072.90187.9072 2.36417 0 3.26607l-13.426 13.3485c-.9071.9019-2.3779.9019-3.285 0s-.9071-2.3642 0-3.2661l13.4261-13.34847c.9071-.90189 2.3778-.90189 3.2849 0z"/><path d="m27.8187 5.18362c.9077.90128.9087 2.36353.0022 3.26603l-17.2588 17.18215c-.90647.9025-2.37721.9035-3.28495.0022-.90773-.9013-.90872-2.3635-.00221-3.266l17.25876-17.18218c.9065-.9025 2.3772-.90348 3.285-.0022z"/><path d="m10.7276 10.6841c.9056.9035.9031 2.3657-.0056 3.266l-6.75949 6.6974c-.90869.9003-2.37943.8978-3.28499-.0056-.905563-.9035-.903032-2.3657.005654-3.2661l6.759476-6.6973c.90868-.90034 2.37942-.89783 3.28495.0056z" opacity=".7"/><path d="m14.8678 4.00024c1.2828 0 2.3228 1.03397 2.3228 2.30944v.23094c0 1.27546-1.04 2.30943-2.3228 2.30943-1.2829 0-2.3229-1.03397-2.3229-2.30943v-.23094c0-1.27547 1.04-2.30944 2.3229-2.30944z" opacity=".5"/></g></svg>`
  },
  {
    id: "boltshift",
    name: "Boltshift",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m20 44c11.0457 0 20-8.9543 20-20s-8.9543-20-20-20c-11.04572 0-20 8.9543-20 20s8.95428 20 20 20zm6.2393-30.6832c.3037-1.0787-.7432-1.7167-1.6993-1.0355l-13.3469 9.5083c-1.0369.7387-.8738 2.2104.245 2.2104h3.5146v-.0272h6.8498l-5.5813 1.9693-2.4605 8.7411c-.3037 1.0788.7431 1.7167 1.6993 1.0355l13.3469-9.5082c1.0369-.7387.8737-2.2105-.245-2.2105h-5.3298z" fill="#155eef" fill-rule="evenodd"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m20 44c11.0457 0 20-8.9543 20-20s-8.9543-20-20-20c-11.04572 0-20 8.9543-20 20s8.95428 20 20 20zm6.2393-30.6832c.3037-1.0787-.7432-1.7167-1.6993-1.0355l-13.3469 9.5083c-1.0369.7387-.8738 2.2104.245 2.2104h3.5146v-.0272h6.8498l-5.5813 1.9693-2.4605 8.7411c-.3037 1.0788.7431 1.7167 1.6993 1.0355l13.3469-9.5082c1.0369-.7387.8737-2.2105-.245-2.2105h-5.3298z" fill="#fff" fill-rule="evenodd"/></svg>`
  },
  {
    id: "buildingblocks",
    name: "BuildingBlocks",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 37 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m12.8841 4.30945-6.8842 3.97574 6.8891 3.97661 6.8862-3.97575zm8.8919 7.44025-6.887 3.9762-.0007 7.9532 6.8877-3.9771zm2 11.4164-6.8879 3.9772 6.8889 3.9765 6.8871-3.9763zm8.8879 7.4416-6.8868 3.9761v7.9522l6.8868-3.9761zm-10.8868 11.9287v-7.9525l-6.8891-3.9766v7.9525zm-10.8888-18.8569-6.8883-3.9775v-7.9526l6.889 3.9765zm-.0003 4.6187-9.38814-5.4209c-.928127-.5359-1.49986-1.5262-1.49986-2.598v-11.99368c0-.71444.381106-1.37463.999789-1.73193l10.383811-5.996798c.9281-.5359626 2.0716-.5361538 2.9998-.000505l10.3922 5.996973c.619.3572 1.0004 1.01758 1.0004 1.73226v11.41638l9.888 5.7096c.6188.3573.9999 1.0175.9999 1.732v11.9937c0 1.0718-.5718 2.0621-1.5 2.598l-10.3868 5.9969c-.6187.3572-1.381.3572-1.9998.0001l-10.3891-5.9969c-.9283-.5358-1.5002-1.5263-1.5002-2.5982z" fill="#155eef" fill-rule="evenodd"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 37 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m12.8841 4.30945-6.8842 3.97574 6.8891 3.97661 6.8862-3.97575zm8.8919 7.44025-6.887 3.9762-.0007 7.9532 6.8877-3.9771zm2 11.4164-6.8879 3.9772 6.8889 3.9765 6.8871-3.9763zm8.8879 7.4416-6.8868 3.9761v7.9522l6.8868-3.9761zm-10.8868 11.9287v-7.9525l-6.8891-3.9766v7.9525zm-10.8888-18.8569-6.8883-3.9775v-7.9526l6.889 3.9765zm-.0003 4.6187-9.38814-5.4209c-.928127-.5359-1.49986-1.5262-1.49986-2.598v-11.99368c0-.71444.381106-1.37463.999789-1.73193l10.383811-5.996798c.9281-.5359626 2.0716-.5361538 2.9998-.000505l10.3922 5.996973c.619.3572 1.0004 1.01758 1.0004 1.73226v11.41638l9.888 5.7096c.6188.3573.9999 1.0175.9999 1.732v11.9937c0 1.0718-.5718 2.0621-1.5 2.598l-10.3868 5.9969c-.6187.3572-1.381.3572-1.9998.0001l-10.3891-5.9969c-.9283-.5358-1.5002-1.5263-1.5002-2.5982z" fill="#155eef" fill-rule="evenodd"/></svg>`
  },
  {
    id: "calescence",
    name: "Calescence",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 36 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g clip-rule="evenodd" fill="#1570ef" fill-rule="evenodd"><path d="m35.3721 14v8.0492h-9.9698v-2.2927z"/><path d="m35.3699 14.0001-9.9698 5.7565-7.3513-4.2436v-11.513z" opacity=".9"/><path d="m18.0512 4v11.513l-7.349 4.2436-9.969778-5.7565z" opacity=".8"/><path d="m10.7002 19.7565v8.4868l-9.969731 5.756v-19.9993z" opacity=".7"/><path d="m18.0492 32.4871v11.5129l-17.318731-10.0006 9.969731-5.756z" opacity=".6"/><path d="m35.3699 33.9994-17.3211 10.0006v-11.5129l7.3513-4.2437z" opacity=".5"/><path d="m35.3721 25.9507v8.0487l-9.9698-5.756v-2.2927z" opacity=".4"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 36 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g clip-rule="evenodd" fill="#fff" fill-rule="evenodd"><path d="m35.3721 14v8.0492h-9.9698v-2.2927z"/><path d="m35.3699 14.0001-9.9698 5.7565-7.3513-4.2436v-11.513z" opacity=".9"/><path d="m18.0512 4v11.513l-7.349 4.2436-9.969778-5.7565z" opacity=".8"/><path d="m10.7002 19.7565v8.4868l-9.969731 5.756v-19.9993z" opacity=".7"/><path d="m18.0492 32.4871v11.5129l-17.318731-10.0006 9.969731-5.756z" opacity=".6"/><path d="m35.3699 33.9994-17.3211 10.0006v-11.5129l7.3513-4.2437z" opacity=".5"/><path d="m35.3721 25.9507v8.0487l-9.9698-5.756v-2.2927z" opacity=".4"/></g></svg>`
  },
  {
    id: "capsule",
    name: "Capsule",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><circle cx="14" cy="18" fill="#1570ef" r="14"/><circle cx="26" cy="30" fill="#53b1fd" r="14"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><circle cx="14" cy="18" opacity=".7" r="14"/><circle cx="26" cy="30" opacity=".7" r="14"/></g></svg>`
  },
  {
    id: "constellation",
    name: "Constellation",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 44 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m16 8 5.0912 10.9088 10.9088 5.0912-10.9088 5.0912-5.0912 10.9088-5.0912-10.9088-10.9088-5.0912 10.9088-5.0912z"/><path d="m20.0469 31.3286 6.3539-1.0932 3.6 9.7646 3.6-9.7646 10.2565 1.7646-6.6564-8 6.6564-8-10.2565 1.7646-3.6-9.7646-3.6 9.7646-6.3539-1.0932 1.0442 2.2374 10.9088 5.0912-10.9088 5.0912z" opacity=".5"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 44 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m16 8 5.0912 10.9088 10.9088 5.0912-10.9088 5.0912-5.0912 10.9088-5.0912-10.9088-10.9088-5.0912 10.9088-5.0912z"/><path d="m20.0469 31.3286 6.3539-1.0932 3.6 9.7646 3.6-9.7646 10.2565 1.7646-6.6564-8 6.6564-8-10.2565 1.7646-3.6-9.7646-3.6 9.7646-6.3539-1.0932 1.0442 2.2374 10.9088 5.0912-10.9088 5.0912z" opacity=".5"/></g></svg>`
  },
  {
    id: "codecraft",
    name: "Codecraft",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 9c0-2.76142 2.23858-5 5-5h10c2.7614 0 5 2.23858 5 5v9.8192c.0002.06.0003.1203.0003.1808 0 2.7575 2.2322 4.9936 4.9881 5h.0116 10c2.7614 0 5 2.2386 5 5v10c0 2.7614-2.2386 5-5 5h-10c-2.7614 0-5-2.2386-5-5v-10c0-.0139.0001-.0277.0002-.0416-.0224-2.7422-2.2523-4.9584-4.9999-4.9584-.0129 0-.0258 0-.0387 0h-9.9616c-2.76142 0-5-2.2386-5-5z" fill="#155eef"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 9c0-2.76142 2.23858-5 5-5h10c2.7614 0 5 2.23858 5 5v9.8192c.0002.06.0003.1203.0003.1808 0 2.7575 2.2322 4.9936 4.9881 5h.0116 10c2.7614 0 5 2.2386 5 5v10c0 2.7614-2.2386 5-5 5h-10c-2.7614 0-5-2.2386-5-5v-10c0-.0139.0001-.0277.0002-.0416-.0224-2.7422-2.2523-4.9584-4.9999-4.9584-.0129 0-.0258 0-.0387 0h-9.9616c-2.76142 0-5-2.2386-5-5z" fill="#155eef"/></svg>`
  },
  {
    id: "command-r",
    name: "Command+R",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 32 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m18.6667 30.6667c7.3638 0 13.3333-5.9696 13.3333-13.3334 0-7.36376-5.9695-13.3333-13.3333-13.3333h-18.6667v26.6667z" fill="#155eef"/><path d="m0 4 32 40h-21.3333l-10.6667-13.3333z" fill="#2e90fa"/><path d="m21.1488 30.436c-.8042.1515-1.6339.2307-2.4821.2307h-18.6667v-26.6667z" fill="#53b1fd"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 32 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m18.6667 30.6667c7.3638 0 13.3333-5.9696 13.3333-13.3334 0-7.36376-5.9695-13.3333-13.3333-13.3333h-18.6667v26.6667z" opacity=".7"/><path d="m0 4 32 40h-21.3333l-10.6667-13.3333z" opacity=".7"/><path d="m21.1488 30.436c-.8042.1515-1.6339.2307-2.4821.2307h-18.6667v-26.6667z" opacity=".7"/></g></svg>`
  },
  {
    id: "contrast-ai",
    name: "ContrastAI",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m20 4c11.0457 0 20 8.9543 20 20s-8.9543 20-20 20-20-8.9543-20-20 8.9543-20 20-20zm15 20c0 8.2843-6.7157 15-15 15v-30c8.2843 0 15 6.7157 15 15z" fill="#155eef" fill-rule="evenodd"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m20 4c11.0457 0 20 8.9543 20 20s-8.9543 20-20 20-20-8.9543-20-20 8.9543-20 20-20zm15 20c0 8.2843-6.7157 15-15 15v-30c8.2843 0 15 6.7157 15 15z" fill="#fff" fill-rule="evenodd"/></svg>`
  },
  {
    id: "convergence",
    name: "Convergence",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 42 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m22.1017 20.8596 9.8995-9.8994-2.1213-2.12137-7.3389 7.33887v-13.1777h-3v13.1777l-7.3388-7.33887-2.1213 2.12137 9.8995 9.8994 1.0606 1.0607zm2.1207 2.1214 9.8995-9.8995 2.1213 2.1213-7.3388 7.3388h13.0956v3h-13.0956l7.3388 7.3389-2.1213 2.1213-9.8995-9.8995-1.0607-1.0607zm-16.26224 12.0208 9.89944-9.8995 1.0607-1.0607-1.0607-1.0606-9.89944-9.8995-2.12133 2.1213 7.33887 7.3388h-13.17574688v3h13.17574688l-7.33887 7.3389zm12.02024-7.7782-9.8995 9.8995 2.1213 2.1213 7.3388-7.3388v13.0944h3v-13.0944l7.3389 7.3388 2.1213-2.1213-9.8995-9.8995-1.0607-1.0607z" fill="#155eef" fill-rule="evenodd"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 42 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m22.1017 20.8596 9.8995-9.8994-2.1213-2.12137-7.3389 7.33887v-13.1777h-3v13.1777l-7.3388-7.33887-2.1213 2.12137 9.8995 9.8994 1.0606 1.0607zm2.1207 2.1214 9.8995-9.8995 2.1213 2.1213-7.3388 7.3388h13.0956v3h-13.0956l7.3388 7.3389-2.1213 2.1213-9.8995-9.8995-1.0607-1.0607zm-16.26224 12.0208 9.89944-9.8995 1.0607-1.0607-1.0607-1.0606-9.89944-9.8995-2.12133 2.1213 7.33887 7.3388h-13.17574688v3h13.17574688l-7.33887 7.3389zm12.02024-7.7782-9.8995 9.8995 2.1213 2.1213 7.3388-7.3388v13.0944h3v-13.0944l7.3389 7.3388 2.1213-2.1213-9.8995-9.8995-1.0607-1.0607z" fill="#155eef" fill-rule="evenodd"/></svg>`
  },
  {
    id: "core-os",
    name: "CoreOS",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 42 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m15.2286 4.99951c-3.2154 0-6.18655 1.71539-7.79425 4.5l-5.7735 9.99999c-1.6076941 2.7846-1.607697 6.2154 0 9l5.7735 10c1.6077 2.7846 4.57885 4.5 7.79425 4.5h11.547c3.2154 0 6.1865-1.7154 7.7942-4.5l5.7735-10c1.6077-2.7846 1.6077-6.2154 0-9l-5.7735-9.99999c-1.6077-2.78461-4.5788-4.5-7.7942-4.5zm11.547 5.99999h-7.2169c-1.1547 0-1.8762 1.2499-1.298 2.2494 1.784 3.0838 3.5722 6.1653 5.3536 9.2506.5359.9282.5359 2.0718 0 3-1.7814 3.0854-3.5696 6.1668-5.3536 9.2506-.5782.9995.1433 2.2494 1.298 2.2494h7.2169c1.0718 0 2.0622-.5718 2.5981-1.5l5.7735-10c.5359-.9282.5359-2.0718 0-3l-5.7735-10c-.5359-.9282-1.5263-1.5-2.5981-1.5z" fill="#155eef" fill-rule="evenodd"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 42 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m15.2286 4.99951c-3.2154 0-6.18655 1.71539-7.79425 4.5l-5.7735 9.99999c-1.6076941 2.7846-1.607697 6.2154 0 9l5.7735 10c1.6077 2.7846 4.57885 4.5 7.79425 4.5h11.547c3.2154 0 6.1865-1.7154 7.7942-4.5l5.7735-10c1.6077-2.7846 1.6077-6.2154 0-9l-5.7735-9.99999c-1.6077-2.78461-4.5788-4.5-7.7942-4.5zm11.547 5.99999h-7.2169c-1.1547 0-1.8762 1.2499-1.298 2.2494 1.784 3.0838 3.5722 6.1653 5.3536 9.2506.5359.9282.5359 2.0718 0 3-1.7814 3.0854-3.5696 6.1668-5.3536 9.2506-.5782.9995.1433 2.2494 1.298 2.2494h7.2169c1.0718 0 2.0622-.5718 2.5981-1.5l5.7735-10c.5359-.9282.5359-2.0718 0-3l-5.7735-10c-.5359-.9282-1.5263-1.5-2.5981-1.5z" fill="#155eef" fill-rule="evenodd"/></svg>`
  },
  {
    id: "cubekit",
    name: "Cubekit",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 14.5264v18.9473l17.8947-12.2437v-18.94741z" fill="#155eef" opacity=".5"/><path d="m0 33.4737v-18.9474l17.8947 12.2438v18.9474z" fill="#1570ef" opacity=".5"/><path d="m40 14.5263v18.9474l-17.8947-12.2438v-18.94737z" fill="#155eef" opacity=".5"/><path d="m40 33.4737v-18.9474l-17.8947 12.2438v18.9474z" fill="#1570ef" opacity=".5"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m0 14.5264v18.9473l17.8947-12.2437v-18.94741z" opacity=".5"/><path d="m0 33.4737v-18.9474l17.8947 12.2438v18.9474z" opacity=".5"/><path d="m40 14.5263v18.9474l-17.8947-12.2438v-18.94737z" opacity=".5"/><path d="m40 33.4737v-18.9474l-17.8947 12.2438v18.9474z" opacity=".5"/></g></svg>`
  },
  {
    id: "europa",
    name: "Europa",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m28.6446 39.168c-.6032 1.3404-1.353 2.6531-2.2519 3.7888 7.4581-2.5137 12.9483-9.3054 13.5527-17.4568h-2.6549c-3.2399 0-5.8424 2.5861-6.369 5.7829-.4855 2.9468-1.2621 5.6301-2.2769 7.8851z"/><path d="m22.7724 25.5c3.3921 0 6.167 2.8299 5.5439 6.1643-1.3533 7.2424-4.5667 12.3357-8.3155 12.3357-4.7435 0-8.6299-8.1549-8.975-18.5z"/><path d="m30.9904 17.1502c.4961 3.2267 3.1106 5.8498 6.3752 5.8498h2.6107c-.4123-8.3729-5.9735-15.39183-13.5836-17.95683.8989 1.13575 1.6487 2.44843 2.2519 3.78878 1.0643 2.36505 1.8666 5.20115 2.3458 8.31825z"/><path d="m28.4165 16.8957c.5674 3.3176-2.1954 6.1043-5.5612 6.1043h-11.8434c.2344-10.5811 4.1693-19 8.9889-19 3.8447 0 7.1263 5.35721 8.4157 12.8957z"/><path d="m8.51131 23c.11359-5.4083 1.14536-10.3894 2.84579-14.16805.6031-1.34035 1.3529-2.65303 2.2519-3.78878-7.61011 2.565-13.171316 9.58393-13.5836094 17.95683z"/><path d="m.0562286 25.5c.6043994 8.1514 6.0946514 14.9431 13.5527714 17.4568-.899-1.1357-1.6488-2.4484-2.2519-3.7888-1.6479-3.6619-2.66781-8.4531-2.83264-13.668z"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m28.6446 39.168c-.6032 1.3404-1.353 2.6531-2.2519 3.7888 7.4581-2.5137 12.9483-9.3054 13.5527-17.4568h-2.6549c-3.2399 0-5.8424 2.5861-6.369 5.7829-.4855 2.9468-1.2621 5.6301-2.2769 7.8851z"/><path d="m22.7724 25.5c3.3921 0 6.167 2.8299 5.5439 6.1643-1.3533 7.2424-4.5667 12.3357-8.3155 12.3357-4.7435 0-8.6299-8.1549-8.975-18.5z"/><path d="m30.9904 17.1502c.4961 3.2267 3.1106 5.8498 6.3752 5.8498h2.6107c-.4123-8.3729-5.9735-15.39183-13.5836-17.95683.8989 1.13575 1.6487 2.44843 2.2519 3.78878 1.0643 2.36505 1.8666 5.20115 2.3458 8.31825z"/><path d="m28.4165 16.8957c.5674 3.3176-2.1954 6.1043-5.5612 6.1043h-11.8434c.2344-10.5811 4.1693-19 8.9889-19 3.8447 0 7.1263 5.35721 8.4157 12.8957z"/><path d="m8.51131 23c.11359-5.4083 1.14536-10.3894 2.84579-14.16805.6031-1.34035 1.3529-2.65303 2.2519-3.78878-7.61011 2.565-13.171316 9.58393-13.5836094 17.95683z"/><path d="m.0562286 25.5c.6043994 8.1514 6.0946514 14.9431 13.5527714 17.4568-.899-1.1357-1.6488-2.4484-2.2519-3.7888-1.6479-3.6619-2.66781-8.4531-2.83264-13.668z"/></g></svg>`
  },
  {
    id: "feather-dev",
    name: "FeatherDev",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 44 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m36.3068 11.4224c-.4322-.4323-.8644-.8645-1.2967-1.2967-1.2966-1.38311-2.6797-2.76621-4.4086-3.63065-1.9882-1.03733-4.1493-.778-6.3104-.778-3.2849 0-11.4971 0-16.33798 0l3.28488 4.40865h19.6228c1.8153 0 3.3713.3458 4.8409 1.2967.2593.0864.5186.0864.6051 0z" fill="#53b1fd"/><path d="m39.9368 18.511c-.4322-.4322-.8645-.8645-1.2967-1.2967-1.2967-1.3831-2.6797-2.7662-4.4086-3.6306-1.9882-1.0374-4.1494-.778-6.3105-.778-2.8526 0-9.6817 0-14.5226 0l3.2849 4.4086h17.8939c1.8154 0 3.3714.3458 4.8409 1.2967.1729.0864.3458.0864.5187 0z" fill="#2e90fa"/><path d="m44 25.4263c-.4322-.4323-.8645-.8645-1.2967-1.2967-1.2966-1.3831-2.6797-2.7662-4.4086-3.6307-1.9882-1.0373-4.1493-.7779-6.3104-.7779-2.6798 0-8.558 0-13.3124 0l3.2848 4.4086h16.5973c1.8153 0 3.3713.3458 4.8409 1.2967.2593.0864.4322.1729.6051 0z" fill="#1570ef"/><path d="m7.60742 37.0961c.43222.4322.86444.8644 1.29666 1.2966 1.29662 1.3831 2.67972 2.7662 4.40862 3.6307 1.9882 1.0373 4.1493.778 6.3104.778h16.338l-3.2849-4.4087c-5.9646 0-15.3006 0-19.6228 0-1.8153 0-3.37132-.3457-4.84087-1.2966-.25933-.0865-.43222-.0865-.60511 0z" fill="#53b1fd"/><path d="m3.97656 30.0079c.43222.4323.86444.8645 1.29666 1.2967 1.29667 1.3831 2.67976 2.7662 4.40864 3.6307 1.98824 1.0373 4.14934.778 6.31044.778h14.5226l-3.2849-4.4087c-5.8782 0-13.9175 0-17.89391 0-1.81532 0-3.37132-.3458-4.84087-1.2967-.17289-.0864-.34577-.0864-.51866 0z" fill="#2e90fa"/><path d="m0 23.0058c.43222.4322.864441.8644 1.29666 1.2966 1.29666 1.3831 2.67977 2.7662 4.40866 3.6307 1.98821 1.0373 4.1493.778 6.31038.778h13.3124l-3.2849-4.4087c-5.7053 0-12.96657 0-16.59722 0-1.81533 0-3.37132-.3458-4.840874-1.2966-.259332-.0865-.432218-.0865-.605106 0z" fill="#1570ef"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 44 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m36.3068 11.4224c-.4322-.4323-.8644-.8645-1.2967-1.2967-1.2966-1.38311-2.6797-2.76621-4.4086-3.63065-1.9882-1.03733-4.1493-.778-6.3104-.778-3.2849 0-11.4971 0-16.33798 0l3.28488 4.40865h19.6228c1.8153 0 3.3713.3458 4.8409 1.2967.2593.0864.5186.0864.6051 0z" opacity=".5"/><path d="m39.9368 18.511c-.4322-.4322-.8645-.8645-1.2967-1.2967-1.2967-1.3831-2.6797-2.7662-4.4086-3.6306-1.9882-1.0374-4.1494-.778-6.3105-.778-2.8526 0-9.6817 0-14.5226 0l3.2849 4.4086h17.8939c1.8154 0 3.3714.3458 4.8409 1.2967.1729.0864.3458.0864.5187 0z" opacity=".7"/><path d="m44 25.4263c-.4322-.4323-.8645-.8645-1.2967-1.2967-1.2966-1.3831-2.6797-2.7662-4.4086-3.6307-1.9882-1.0373-4.1493-.7779-6.3104-.7779-2.6798 0-8.558 0-13.3124 0l3.2848 4.4086h16.5973c1.8153 0 3.3713.3458 4.8409 1.2967.2593.0864.4322.1729.6051 0z"/><path d="m7.60742 37.0961c.43222.4322.86444.8644 1.29666 1.2966 1.29662 1.3832 2.67972 2.7662 4.40862 3.6307 1.9882 1.0373 4.1493.778 6.3104.778h16.338l-3.2849-4.4087c-5.9646 0-15.3006 0-19.6228 0-1.8153 0-3.37132-.3457-4.84087-1.2966-.25933-.0865-.43222-.0865-.60511 0z" opacity=".5"/><path d="m3.97656 30.0079c.43222.4323.86444.8645 1.29666 1.2967 1.29667 1.3831 2.67976 2.7662 4.40864 3.6307 1.98824 1.0373 4.14934.778 6.31044.778h14.5226l-3.2849-4.4087c-5.8782 0-13.9175 0-17.89391 0-1.81532 0-3.37132-.3458-4.84087-1.2967-.17289-.0864-.34577-.0864-.51866 0z" opacity=".7"/><path d="m0 23.0058c.43222.4322.864441.8644 1.29666 1.2966 1.29666 1.3831 2.67977 2.7662 4.40866 3.6307 1.98821 1.0373 4.1493.778 6.31038.778h13.3124l-3.2849-4.4087c-5.7053 0-12.96657 0-16.59722 0-1.81533 0-3.37132-.3458-4.840874-1.2966-.259332-.0865-.432218-.0865-.605106 0z"/></g></svg>`
  },
  {
    id: "flora-fauna",
    name: "Flora&Fauna",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m13.7146 4c-2.2564 0-4.4203.89634-6.01579 2.49183l-7.69881 7.69877v3.524c0 2.4897 1.06944 4.7296 2.77401 6.2854-1.70457 1.5558-2.77401 3.7957-2.77401 6.2854v3.524l7.69881 7.6988c1.59549 1.5955 3.75939 2.4918 6.01579 2.4918 2.4897 0 4.7296-1.0694 6.2854-2.774 1.5558 1.7046 3.7957 2.774 6.2854 2.774 2.2564 0 4.4203-.8963 6.0158-2.4918l7.6988-7.6988v-3.524c0-2.4897-1.0694-4.7296-2.774-6.2854 1.7046-1.5558 2.774-3.7957 2.774-6.2854v-3.524l-7.6988-7.69877c-1.5955-1.59549-3.7594-2.49183-6.0158-2.49183-2.4897 0-4.7296 1.06944-6.2854 2.77401-1.5558-1.70457-3.7957-2.77401-6.2854-2.77401zm12.0442 20c-.0959-.0875-.19-.1774-.2822-.2696l-5.4766-5.4766-5.4766 5.4766c-.0922.0922-.1863.1821-.2822.2696.0959.0875.19.1774.2822.2696l5.4766 5.4766 5.4766-5.4766c.0922-.0922.1863-.1821.2822-.2696zm-3.5366 9.8094v1.683c0 2.244 1.8192 4.0632 4.0632 4.0632 1.0776 0 2.1111-.4281 2.8731-1.1901l6.3971-6.3971v-1.683c0-2.244-1.8192-4.0632-4.0632-4.0632-1.0776 0-2.1111.4281-2.8731 1.1901zm-4.4444 0-6.3971-6.3971c-.762-.762-1.79546-1.1901-2.87308-1.1901-2.24403 0-4.06318 1.8192-4.06318 4.0632v1.683l6.39706 6.3971c.762.762 1.7955 1.1901 2.8731 1.1901 2.244 0 4.0632-1.8192 4.0632-4.0632zm0-21.3018v1.683l-6.3971 6.3971c-.762.762-1.79546 1.1901-2.87308 1.1901-2.24403 0-4.06318-1.8192-4.06318-4.0632v-1.683l6.39706-6.39708c.762-.76199 1.7955-1.19007 2.8731-1.19007 2.244 0 4.0632 1.81915 4.0632 4.06315zm10.8415 8.0801-6.3971-6.3971v-1.683c0-2.244 1.8192-4.06315 4.0632-4.06315 1.0776 0 2.1111.42808 2.8731 1.19007l6.3971 6.39708v1.683c0 2.244-1.8192 4.0632-4.0632 4.0632-1.0776 0-2.1111-.4281-2.8731-1.1901z" fill="#155eef" fill-rule="evenodd"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m13.7146 4c-2.2564 0-4.4203.89634-6.01579 2.49183l-7.69881 7.69877v3.524c0 2.4897 1.06944 4.7296 2.77401 6.2854-1.70457 1.5558-2.77401 3.7957-2.77401 6.2854v3.524l7.69881 7.6988c1.59549 1.5955 3.75939 2.4918 6.01579 2.4918 2.4897 0 4.7296-1.0694 6.2854-2.774 1.5558 1.7046 3.7957 2.774 6.2854 2.774 2.2564 0 4.4203-.8963 6.0158-2.4918l7.6988-7.6988v-3.524c0-2.4897-1.0694-4.7296-2.774-6.2854 1.7046-1.5558 2.774-3.7957 2.774-6.2854v-3.524l-7.6988-7.69877c-1.5955-1.59549-3.7594-2.49183-6.0158-2.49183-2.4897 0-4.7296 1.06944-6.2854 2.77401-1.5558-1.70457-3.7957-2.77401-6.2854-2.77401zm12.0442 20c-.0959-.0875-.19-.1774-.2822-.2696l-5.4766-5.4766-5.4766 5.4766c-.0922.0922-.1863.1821-.2822.2696.0959.0875.19.1774.2822.2696l5.4766 5.4766 5.4766-5.4766c.0922-.0922.1863-.1821.2822-.2696zm-3.5366 9.8094v1.683c0 2.244 1.8192 4.0632 4.0632 4.0632 1.0776 0 2.1111-.4281 2.8731-1.1901l6.3971-6.3971v-1.683c0-2.244-1.8192-4.0632-4.0632-4.0632-1.0776 0-2.1111.4281-2.8731 1.1901zm-4.4444 0-6.3971-6.3971c-.762-.762-1.79546-1.1901-2.87308-1.1901-2.24403 0-4.06318 1.8192-4.06318 4.0632v1.683l6.39706 6.3971c.762.762 1.7955 1.1901 2.8731 1.1901 2.244 0 4.0632-1.8192 4.0632-4.0632zm0-21.3018v1.683l-6.3971 6.3971c-.762.762-1.79546 1.1901-2.87308 1.1901-2.24403 0-4.06318-1.8192-4.06318-4.0632v-1.683l6.39706-6.39708c.762-.76199 1.7955-1.19007 2.8731-1.19007 2.244 0 4.0632 1.81915 4.0632 4.06315zm10.8415 8.0801-6.3971-6.3971v-1.683c0-2.244 1.8192-4.06315 4.0632-4.06315 1.0776 0 2.1111.42808 2.8731 1.19007l6.3971 6.39708v1.683c0 2.244-1.8192 4.0632-4.0632 4.0632-1.0776 0-2.1111-.4281-2.8731-1.1901z" fill="#fff" fill-rule="evenodd"/></svg>`
  },
  {
    id: "focal-point",
    name: "FocalPoint",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m10.7788 6.1817 4.6901 17.5036v-19.24382c.3719-.08679.7478-.16322 1.1273-.22897v19.47459l5.2752-19.6871c.3801.03442.7572.07945 1.1309.13479l-5.3176 19.84571 10.5701-18.30794c.3443.15492.6835.31927 1.0172.49274l-10.6095 18.3763 15.1464-15.1465c.2731.25824.5389.52407.7971.7972l-15.1486 15.1487 18.3784-10.6108c.1734.3337.3377.6729.4926 1.0173l-18.3034 10.5675 19.8403-5.3162c.0553.3737.1003.7508.1347 1.1309l-19.6869 5.2751h19.4741c-.0658.3796-.1422.7554-.229 1.1273h-19.2481l17.507 4.691c-.1798.3443-.3693.6827-.5681 1.0149l-17.2257-4.6156 14.3874 8.3066c-.2723.2801-.5528.5522-.8411.8161l-14.1087-8.1457 10.6759 10.6758c-.3377.1973-.6817.385-1.0316.5628l-10.4426-10.4426 6.8421 11.8508c-.3746.1059-.7537.2012-1.1368.2855l-6.6825-11.5744 3.2219 12.0243c-.2872.0122-.5759.0184-.8661.0184-.0991 0-.198-.0007-.2967-.0022l-3.1483-11.7497v11.4569c-.3795-.0657-.7554-.1421-1.1273-.2289v-11.2261l-2.7759 10.36c-.3541-.1396-.7033-.289-1.0471-.4478l2.7337-10.2024-5.13175 8.8884c-.3177-.2034-.62928-.4156-.9344-.6361l5.09135-8.8186-7.1301 7.1302c-.2731-.2583-.53893-.5241-.79717-.7971l7.12787-7.1279-8.81599 5.0899c-.22059-.3051-.4328-.6167-.6363-.9344l8.89259-5.1341-10.20737 2.735c-.15888-.3438-.3083-.693-.44793-1.047l10.3599-2.776h-11.226124c-.086806-.3719-.163256-.7477-.22903-1.1273h11.452154l-11.74511583-3.1471c-.00145443-.0995-.00218417-.1991-.00218417-.2989 0-.2894.00613487-.5774.0182816-.8639l12.0258184 3.2224-11.57621-6.6836c.084291-.3832.179549-.7623.285427-1.1369l11.855683 6.8449-10.44698-10.447c.17774-.3499.36544-.6939.56273-1.0315l10.68025 10.6802-8.14896-14.1144c.26387-.2882.53605-.56863.81617-.84096l8.30809 14.38996-4.61634-17.22828c.33214-.1988.67064-.38826 1.01484-.56802z" fill="#155eef"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m10.7788 6.1817 4.6901 17.5036v-19.24382c.3719-.08679.7478-.16322 1.1273-.22897v19.47459l5.2752-19.6871c.3801.03442.7572.07945 1.1309.13479l-5.3176 19.84571 10.5701-18.30794c.3443.15492.6835.31927 1.0172.49274l-10.6095 18.3763 15.1464-15.1465c.2731.25824.5389.52407.7971.7972l-15.1486 15.1487 18.3784-10.6108c.1734.3337.3377.6729.4926 1.0173l-18.3034 10.5675 19.8403-5.3162c.0553.3737.1003.7508.1347 1.1309l-19.6869 5.2751h19.4741c-.0658.3796-.1422.7554-.229 1.1273h-19.2481l17.507 4.691c-.1798.3443-.3693.6827-.5681 1.0149l-17.2257-4.6156 14.3874 8.3066c-.2723.2801-.5528.5522-.8411.8161l-14.1087-8.1457 10.6759 10.6758c-.3377.1973-.6817.385-1.0316.5628l-10.4426-10.4426 6.8421 11.8508c-.3746.1059-.7537.2012-1.1368.2855l-6.6825-11.5744 3.2219 12.0243c-.2872.0122-.5759.0184-.8661.0184-.0991 0-.198-.0007-.2967-.0022l-3.1483-11.7497v11.4569c-.3795-.0657-.7554-.1421-1.1273-.2289v-11.2261l-2.7759 10.36c-.3541-.1396-.7033-.289-1.0471-.4478l2.7337-10.2024-5.13174 8.8884c-.31771-.2034-.62929-.4156-.93441-.6361l5.09135-8.8186-7.1301 7.1302c-.2731-.2583-.53893-.5241-.79717-.7971l7.12787-7.1279-8.81599 5.0899c-.22059-.3051-.4328-.6167-.6363-.9344l8.89259-5.1341-10.20737 2.735c-.15888-.3438-.3083-.693-.44793-1.047l10.3599-2.776h-11.226124c-.086806-.3719-.163256-.7477-.22903-1.1273h11.452154l-11.74511583-3.1471c-.00145443-.0995-.00218417-.1991-.00218417-.2989 0-.2894.00613486-.5774.0182816-.8639l12.0258184 3.2224-11.57621-6.6836c.084291-.3832.179549-.7623.285427-1.1369l11.855683 6.8449-10.44698-10.447c.17774-.3499.36544-.6939.56273-1.0315l10.68025 10.6802-8.14896-14.1144c.26387-.2882.53605-.56863.81617-.84096l8.30809 14.38996-4.61634-17.22828c.33214-.1988.67064-.38826 1.01484-.56802z" fill="#fff"/></svg>`
  },
  {
    id: "foresight",
    name: "Foresight",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 31 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#444ce7"><path d="m-.00195312 17.8433 30.90545312-17.8433-.8189 12.6994-26.32058 15.1961z"/><path d="m3.76367 27.8951 21.73573-12.5492-.8189 12.6994-17.15086 9.902z" opacity=".5"/><path d="m7.52734 37.9477 12.56596-7.255-.8189 12.6994-7.9811 4.6079z" opacity=".25"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 31 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m-.00195312 17.8433 30.90545312-17.8433-.8189 12.6994-26.32058 15.1961z"/><path d="m3.76367 27.8951 21.73573-12.5492-.8189 12.6994-17.15086 9.902z" opacity=".5"/><path d="m7.52734 37.9477 12.56596-7.255-.8189 12.6994-7.9811 4.6079z" opacity=".25"/></g></svg>`
  },
  {
    id: "galileo",
    name: "Galileo",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m29.5411 6.41772c2.6913 5.27688 4.209 11.25228 4.209 17.58218s-1.5177 12.3054-4.2091 17.5823c6.2304-3.3881 10.4593-9.9914 10.4593-17.5823s-4.2289-14.19404-10.4592-17.58218z" fill="#6172f3"/><path d="m20.5481 5.99826c-.9047-1.28153-2.4457-1.9717-3.9913-1.70349-9.40496 1.63214-16.5568 9.83343-16.5568 19.70503 0 9.8717 7.1518 18.0729 16.5567 19.7051 1.5456.2682 3.0867-.4219 3.9913-1.7035 3.5923-5.0889 5.7025-11.2988 5.7025-18.0016 0-6.7027-2.1101-12.9126-5.7024-18.00154z" fill="#444ce7"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m29.5411 6.41772c2.6913 5.27688 4.209 11.25228 4.209 17.58218s-1.5177 12.3054-4.2091 17.5823c6.2304-3.3881 10.4593-9.9914 10.4593-17.5823s-4.2289-14.19404-10.4592-17.58218z" opacity=".7"/><path d="m20.5481 5.99826c-.9047-1.28153-2.4457-1.9717-3.9913-1.70349-9.40496 1.63214-16.5568 9.83343-16.5568 19.70503 0 9.8717 7.1518 18.0729 16.5567 19.7051 1.5456.2682 3.0867-.4219 3.9913-1.7035 3.5923-5.0889 5.7025-11.2988 5.7025-18.0016 0-6.7027-2.1101-12.9126-5.7024-18.00154z"/></g></svg>`
  },
  {
    id: "global-bank",
    name: "GlobalBank",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m27.6627 4h-15.3253l-12.3374 12.3373v15.3253l12.3374 12.3374h15.3253l12.3373-12.3374v-15.3253zm-13.2049 27.8554-7.90357-7.9036 7.90357-7.9036c2.988-2.988 7.9037-2.988 10.8916 0l7.9036 7.9036-7.9036 7.9036c-2.9879 2.988-7.8072 2.988-10.8916 0z" fill="#444ce7"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m27.6627 4h-15.3253l-12.3374 12.3373v15.3253l12.3374 12.3374h15.3253l12.3373-12.3374v-15.3253zm-13.2049 27.8554-7.90357-7.9036 7.90357-7.9036c2.988-2.988 7.9037-2.988 10.8916 0l7.9036 7.9036-7.9036 7.9036c-2.9879 2.988-7.8072 2.988-10.8916 0z" fill="#fff"/></svg>`
  },
  {
    id: "hexsmith",
    name: "Hexsmith",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m9.72461 41.7983h18.49589c1.2717 0 2.4469-.6785 3.0827-1.7798l4.1102-7.1191h-20.5481z" opacity=".7"/><path d="m25.1445 15.1015h-20.55661l4.11021-7.11909c.63585-1.10133 1.811-1.77977 3.0827-1.77977h18.4959z" opacity=".4"/><path d="m39.5272 25.7801c.6358-1.1014.6358-2.4582 0-3.5596l-4.1102-7.1191-5.1378 8.8989h-20.55068l5.13718 8.8989h20.5481l.0016-.0027.0016.0027z" opacity=".4"/><path d="m14.8634 32.8992-5.13775-8.8988-5.13776 8.8988 5.13776 8.8989z"/><path d="m25.1445 15.1014h-20.55593l-4.108166 7.1192c-.635516 1.1013-.635318 2.458.000521 3.5591l4.111125 7.1195 5.13775-8.8989h20.55l.0013-.0021z" opacity=".7"/><path d="m35.4181 15.1015-5.1378-8.89886-5.1377 8.89886 5.1377 8.8989z"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m9.72461 41.7983h18.49589c1.2717 0 2.4469-.6785 3.0827-1.7798l4.1102-7.1191h-20.5481z" opacity=".7"/><path d="m25.1445 15.1015h-20.55661l4.11021-7.11909c.63585-1.10133 1.811-1.77977 3.0827-1.77977h18.4959z" opacity=".4"/><path d="m39.5272 25.7801c.6358-1.1013.6358-2.4582 0-3.5596l-4.1102-7.1191-5.1378 8.8989h-20.55068l5.13718 8.8989h20.5481l.0016-.0027.0016.0027z" opacity=".4"/><path d="m14.8634 32.8992-5.13775-8.8988-5.13776 8.8988 5.13776 8.8989z"/><path d="m25.1445 15.1014h-20.55593l-4.108166 7.1192c-.635516 1.1013-.635318 2.458.000521 3.5591l4.111125 7.1195 5.13775-8.8989h20.55l.0013-.0022z" opacity=".7"/><path d="m35.4181 15.1015-5.1378-8.89886-5.1377 8.89886 5.1377 8.8989z"/></g></svg>`
  },
  {
    id: "hourglass",
    name: "Hourglass",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 30 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 41.2222c0 1.5341 1.24365 2.7778 2.77778 2.7778h24.44442c1.5341 0 2.7778-1.2437 2.7778-2.7778v-7.2222c0-8.2843-6.7157-15-15-15-8.28427 0-15 6.7157-15 15z" fill="#1570ef"/><path d="m0 6.77778c0-1.53413 1.24365-2.77778 2.77778-2.77778h24.44442c1.5341 0 2.7778 1.24365 2.7778 2.77778v7.22222c0 8.2843-6.7157 15-15 15-8.28427 0-15-6.7157-15-15z" fill="#53b1fd" opacity=".5"/></svg>`,
    darkSvg: `<svg width="100%" height="100%" viewBox="0 0 30 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path opacity="0.7" d="M0 41.2222C0 42.7563 1.24365 44 2.77778 44H27.2222C28.7563 44 30 42.7563 30 41.2222V34C30 25.7157 23.2843 19 15 19C6.71573 19 0 25.7157 0 34V41.2222Z" fill="white"/><path opacity="0.7" d="M0 6.77778C0 5.24365 1.24365 4 2.77778 4H27.2222C28.7563 4 30 5.24365 30 6.77778V14C30 22.2843 23.2843 29 15 29C6.71573 29 0 22.2843 0 14V6.77778Z" fill="white"/></svg>`
  },
  {
    id: "kintsugi",
    name: "Kintsugi",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m20 4 4.2861 9.6525 9.856-3.79464-3.7946 9.85604 9.6525 4.2861-9.6525 4.2861 3.7946 9.856-9.856-3.7946-4.2861 9.6525-4.2861-9.6525-9.85604 3.7946 3.79469-9.856-9.65255-4.2861 9.65255-4.2861-3.79469-9.85604 9.85604 3.79464z" fill="#155eef"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m20 4 4.2861 9.6525 9.856-3.79464-3.7946 9.85604 9.6525 4.2861-9.6525 4.2861 3.7946 9.856-9.856-3.7946-4.2861 9.6525-4.2861-9.6525-9.85604 3.7946 3.79469-9.856-9.65255-4.2861 9.65255-4.2861-3.79469-9.85604 9.85604 3.79464z" fill="#155eef"/></svg>`
  },
  {
    id: "layers",
    name: "Layers",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m5.03741 15.4637c.7506-2.8008 3.62961-5.67985 6.43049-6.43044l17.4617-4.67957c2.8009-.7506 4.4629.91146 3.7123 3.71231l-4.6795 17.4617c-.7506 2.8009-3.6297 5.6799-6.4305 6.4305l-17.46175 4.6796c-2.80085.7505-4.462904-.9115-3.712306-3.7124z" opacity=".7"/><path d="m12.0355 22.4642c.7506-2.8008 3.6296-5.6799 6.4304-6.4305l17.4617-4.6795c2.8009-.7506 4.4629.9114 3.7123 3.7123l-4.6795 17.4617c-.7506 2.8009-3.6296 5.6799-6.4305 6.4305l-17.4617 4.6795c-2.80085.7506-4.46291-.9114-3.71231-3.7123z" opacity=".7"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m5.03741 15.4637c.7506-2.8008 3.62961-5.67985 6.43049-6.43044l17.4617-4.67957c2.8009-.7506 4.4629.91146 3.7123 3.71231l-4.6795 17.4617c-.7506 2.8009-3.6297 5.6799-6.4305 6.4305l-17.46175 4.6795c-2.80085.7506-4.462904-.9114-3.712306-3.7123z" opacity=".7"/><path d="m12.0355 22.4642c.7506-2.8008 3.6296-5.6799 6.4304-6.4305l17.4617-4.6795c2.8009-.7506 4.4629.9114 3.7123 3.7123l-4.6795 17.4617c-.7506 2.8009-3.6296 5.6799-6.4305 6.4305l-17.4617 4.6795c-2.80085.7506-4.46291-.9114-3.71231-3.7123z" opacity=".7"/></g></svg>`
  },
  {
    id: "lightspeed",
    name: "Lightspeed",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 48 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 24c0 6.6274 5.37258 12 12 12v-12c0 6.6274 5.3726 12 12 12v-12c0 6.6274 5.3726 12 12 12s12-5.3726 12-12-5.3726-12-12-12-12 5.3726-12 12v-12c-6.6274 0-12 5.3726-12 12v-12c-6.62742 0-12 5.3726-12 12z" fill="#155eef"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 48 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 24c0 6.6274 5.37258 12 12 12v-12c0 6.6274 5.3726 12 12 12v-12c0 6.6274 5.3726 12 12 12s12-5.3726 12-12-5.3726-12-12-12-12 5.3726-12 12v-12c-6.6274 0-12 5.3726-12 12v-12c-6.62742 0-12 5.3726-12 12z" fill="#155eef"/></svg>`
  },
  {
    id: "luminescence",
    name: "Luminescence",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m32.3008 36h-.1015c-.0261.0402-.0523.0804-.0787.1204-2.7604 1.8201-6.0668 2.8794-9.6206 2.8794-9.665 0-17.5-7.835-17.5-17.5 0-3.5538 1.05931-6.8602 2.87939-9.6206.04009-.0264.08029-.0527.12061-.0788v-.1017c-.04056.0599-.08077.1201-.12061.1805-4.7469 3.1299-7.87939 8.5094-7.87939 14.6206 0 9.665 7.83502 17.5 17.5 17.5 6.1112 0 11.4907-3.1325 14.6206-7.8794.0603-.0398.1204-.0799.1802-.1204z"/><g opacity=".5"><path d="m40.0003 21.5c0 6.1112-3.1325 11.4907-7.8794 14.6206 1.8201-2.7604 2.8794-6.0668 2.8794-9.6206 0-9.665-7.835-17.5-17.5-17.5-3.5538 0-6.8602 1.0593-9.6206 2.8794 3.1299-4.74691 8.5094-7.8794 14.6206-7.8794 9.665 0 17.5 7.835 17.5 17.5z"/><path d="m32.0003 36.1994c.0403-.0261.0805-.0524.1206-.0788-.0398.0604-.08.1206-.1206.1805z"/><path d="m7.80088 12c.02611-.0403.05238-.0805.07882-.1206-.06043.0398-.12059.08-.18048.1206z"/></g></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m32.3008 36h-.1015c-.0261.0402-.0523.0804-.0787.1204-2.7604 1.8201-6.0668 2.8794-9.6206 2.8794-9.665 0-17.5-7.835-17.5-17.5 0-3.5538 1.05931-6.8602 2.87939-9.6206.04009-.0264.08029-.0527.12061-.0788v-.1017c-.04056.0599-.08077.1201-.12061.1805-4.7469 3.1299-7.87939 8.5094-7.87939 14.6206 0 9.665 7.83502 17.5 17.5 17.5 6.1112 0 11.4907-3.1325 14.6206-7.8794.0603-.0398.1204-.0799.1802-.1204z"/><g opacity=".5"><path d="m40.0003 21.5c0 6.1112-3.1325 11.4907-7.8794 14.6206 1.8201-2.7604 2.8794-6.0668 2.8794-9.6206 0-9.665-7.835-17.5-17.5-17.5-3.5538 0-6.8602 1.0593-9.6206 2.8794 3.1299-4.74691 8.5094-7.8794 14.6206-7.8794 9.665 0 17.5 7.835 17.5 17.5z"/><path d="m32.0003 36.1994c.0403-.0261.0805-.0524.1206-.0788-.0398.0604-.08.1206-.1206.1805z"/><path d="m7.80088 12c.02611-.0403.05238-.0805.07882-.1206-.06043.0398-.12059.08-.18048.1206z"/></g></g></svg>`
  },
  {
    id: "luminous",
    name: "Luminous",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 42 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m14.1061 19.6565c5.499-2.6299 9.8025-7.0929 12.2731-12.67168-1.5939-1.67362-3.666-2.86907-5.8975-3.58634l-1.1954-.39848c-.0797.15939-.1594.39849-.1594.55788-1.9127 5.41936-5.8178 9.80262-11.07766 12.27322-3.66599 1.7533-6.37564 4.9412-7.650763 8.7666l-.398477 1.1955c.159391.0797.39848.1593.557871.1593 1.514209.5579 3.028419 1.2752 4.462939 2.1519 1.99238-3.5864 5.18019-6.6148 9.08529-8.4479z"/><path d="m37.2173 19.9753c-2.9487 4.463-7.0132 8.0494-12.034 10.4403-4.0645 1.9127-7.1726 5.499-8.6071 9.8026l-.3985 1.3549c1.5142 1.3548 3.3472 2.3909 5.3396 3.0284l1.1955.3985c.0796-.1594.1593-.3985.1593-.5579 1.9127-5.4193 5.8178-9.8026 11.0777-12.2732 3.666-1.7533 6.4553-4.9412 7.6507-8.7666l.3985-1.1954c-1.6736-.4782-3.2675-1.2752-4.7817-2.2316z" opacity=".6"/><path d="m12.9903 37.4284c1.9924-4.7818 5.6584-8.6869 10.3604-10.9184 4.3035-2.0721 7.8898-5.26 10.3604-9.1651-1.833-1.7533-3.3472-3.7458-4.463-6.1366-2.9487 5.4193-7.571 9.8026-13.2294 12.5123-3.2675 1.5142-5.8974 4.1442-7.49136 7.3321 1.75326 1.6736 3.18786 3.7457 4.30356 6.0569 0 0 .0797.1594.1594.3188z" opacity=".8"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 42 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m14.1061 19.6565c5.499-2.6299 9.8025-7.0929 12.2731-12.67168-1.5939-1.67362-3.666-2.86907-5.8975-3.58634l-1.1954-.39848c-.0797.15939-.1594.39849-.1594.55788-1.9127 5.41936-5.8178 9.80262-11.07766 12.27322-3.66599 1.7533-6.37564 4.9412-7.650763 8.7666l-.398477 1.1955c.159391.0797.39848.1593.557871.1593 1.514209.5579 3.028419 1.2752 4.462939 2.1519 1.99238-3.5864 5.18019-6.6148 9.08529-8.4479z"/><path d="m37.2173 19.9753c-2.9487 4.463-7.0132 8.0494-12.034 10.4403-4.0645 1.9127-7.1726 5.499-8.6071 9.8026l-.3985 1.3549c1.5142 1.3548 3.3472 2.3909 5.3396 3.0284l1.1955.3985c.0796-.1594.1593-.3985.1593-.5579 1.9127-5.4193 5.8178-9.8026 11.0777-12.2732 3.666-1.7533 6.4553-4.9412 7.6507-8.7666l.3985-1.1954c-1.6736-.4782-3.2675-1.2752-4.7817-2.2316z" opacity=".5"/><path d="m12.9903 37.4284c1.9924-4.7818 5.6584-8.6869 10.3604-10.9184 4.3035-2.0721 7.8898-5.26 10.3604-9.1651-1.833-1.7533-3.3472-3.7458-4.463-6.1366-2.9487 5.4193-7.571 9.8026-13.2294 12.5123-3.2675 1.5142-5.8974 4.1442-7.49136 7.3321 1.75326 1.6736 3.18786 3.7457 4.30356 6.0569 0 0 .0797.1594.1594.3188z" opacity=".7"/></g></svg>`
  },
  {
    id: "pollinate",
    name: "Pollinate",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 38 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m25.0008 24c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6 2.6863-6 6-6 6 2.6863 6 6z"/><path d="m25.0008 10c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6c0-3.31371 2.6863-6 6-6s6 2.68629 6 6z"/><path d="m37.125 31c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6 2.6863-6 6-6 6 2.6863 6 6z"/><path d="m37.127 17.0002c0 3.3137-2.6863 6-6 6-3.3138 0-6-2.6863-6-6s2.6862-6 6-6c3.3137 0 6 2.6863 6 6z"/><path d="m25.0008 38c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6 2.6863-6 6-6 6 2.6863 6 6z"/><path d="m12.877 17c0 3.3137-2.6863 6-6.00005 6-3.31371 0-5.999997-2.6863-5.999997-6s2.686287-6 5.999997-6c3.31375 0 6.00005 2.6863 6.00005 6z"/><path d="m12.875 30.9997c0 3.3137-2.6863 6-6 6-3.31371 0-6-2.6863-6-6s2.68629-6 6-6c3.3137 0 6 2.6863 6 6z"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 38 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m25.0008 24c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6 2.6863-6 6-6 6 2.6863 6 6z"/><path d="m25.0008 10c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6c0-3.31371 2.6863-6 6-6s6 2.68629 6 6z"/><path d="m37.125 31c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6 2.6863-6 6-6 6 2.6863 6 6z"/><path d="m37.127 17.0002c0 3.3137-2.6863 6-6 6-3.3138 0-6-2.6863-6-6s2.6862-6 6-6c3.3137 0 6 2.6863 6 6z"/><path d="m25.0008 38c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6 2.6863-6 6-6 6 2.6863 6 6z"/><path d="m12.877 17c0 3.3137-2.6863 6-6.00005 6-3.31371 0-5.999997-2.6863-5.999997-6s2.686287-6 5.999997-6c3.31375 0 6.00005 2.6863 6.00005 6z"/><path d="m12.875 30.9997c0 3.3137-2.6863 6-6 6-3.31371 0-6-2.6863-6-6s2.68629-6 6-6c3.3137 0 6 2.6863 6 6z"/></g></svg>`
  },
  {
    id: "polymath",
    name: "Polymath",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 38 48" width="100%" xmlns="http://www.w3.org/2000/svg"><circle cx="19" cy="24" r="16" stroke="#155eef" stroke-width="6"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 38 48" width="100%" xmlns="http://www.w3.org/2000/svg"><circle cx="19" cy="24" r="16" stroke="#fff" stroke-width="6"/></svg>`
  },
  {
    id: "prometheus",
    name: "Prometheus",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 44 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m10.4993 16.5h-7.29875c-1.76731 0-3.20055 1.4327-3.20055 3.2v2.8h11c2.7614 0 5-2.2386 5-5s2.2386-5 5-5h19c2.2091 0 4-1.7909 4-4v-3h-22.5c-3.0376 0-5.5 2.46243-5.5 5.5 0 3.0376-2.4631 5.5-5.5007 5.5z"/><path d="m10.4993 26.5h-7.29875c-1.76731 0-3.20055 1.4327-3.20055 3.2v2.8h11c2.7614 0 5-2.2386 5-5s2.2386-5 5-5h13c2.2091 0 4-1.7909 4-4v-3h-16.5c-3.0376 0-5.5 2.4624-5.5 5.5s-2.4631 5.5-5.5007 5.5z" opacity=".7"/><path d="m10.4993 36.5h-7.29875c-1.76731 0-3.20055 1.4327-3.20055 3.2v2.8h11c2.7614 0 5-2.2386 5-5s2.2386-5 5-5h7.8c1.7673 0 3.2-1.4327 3.2-3.2v-3.8h-10.5c-3.0376 0-5.5 2.4624-5.5 5.5s-2.4631 5.5-5.5007 5.5z" opacity=".5"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 44 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m10.4993 16.5h-7.29875c-1.76731 0-3.20055 1.4327-3.20055 3.2v2.8h11c2.7614 0 5-2.2386 5-5s2.2386-5 5-5h19c2.2091 0 4-1.7909 4-4v-3h-22.5c-3.0376 0-5.5 2.46243-5.5 5.5 0 3.0376-2.4631 5.5-5.5007 5.5z"/><path d="m10.4993 26.5h-7.29875c-1.76731 0-3.20055 1.4327-3.20055 3.2v2.8h11c2.7614 0 5-2.2386 5-5s2.2386-5 5-5h13c2.2091 0 4-1.7909 4-4v-3h-16.5c-3.0376 0-5.5 2.4624-5.5 5.5s-2.4631 5.5-5.5007 5.5z" opacity=".75"/><path d="m10.4993 36.5h-7.29875c-1.76731 0-3.20055 1.4327-3.20055 3.2v2.8h11c2.7614 0 5-2.2386 5-5s2.2386-5 5-5h7.8c1.7673 0 3.2-1.4327 3.2-3.2v-3.8h-10.5c-3.0376 0-5.5 2.4624-5.5 5.5s-2.4631 5.5-5.5007 5.5z" opacity=".5"/></g></svg>`
  },
  {
    id: "quantum",
    name: "Quantum",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 39 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m9 23c0-5.5228 4.4772-10 10-10 5.5229 0 10 4.4772 10 10h9c0-10.4934-8.5066-19-19-19-10.49341 0-18.99999908 8.5066-19 19s8.50659 19 19 19v-9c-5.5228 0-10-4.4771-10-10z"/><path d="m29 23c0 5.5228 4.4772 10 10 10v9c-10.4934 0-19-8.5066-19-19z" opacity=".5"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 39 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m9 23c0-5.5228 4.4772-10 10-10 5.5229 0 10 4.4772 10 10h9c0-10.4934-8.5066-19-19-19-10.49341 0-18.99999908 8.5066-19 19s8.50659 19 19 19v-9c-5.5228 0-10-4.4771-10-10z"/><path d="m29 23c0 5.5228 4.4772 10 10 10v9c-10.4934 0-19-8.5066-19-19z" opacity=".5"/></g></svg>`
  },
  {
    id: "quartz-ai",
    name: "QuartzAI",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 44 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m17.6264 6.5h14.8017l11.4661 18.6661-15.7786 15.9489-22.68835-4.0459-5.157719-19.2098zm.5273 4.9692-6.816 15.105 6.4504 5.3411 8.8246-3.7975zm12.3276 15.3 9.2139-2.7073-7.1983-11.7184zm-.6163-17.2692h-9.3468l7.3309 14.4284zm6.9795 18.5263-6.779 1.9919-.5448 5.4109zm-10.5005 9.008.5824-5.7856-6.0573 2.6067zm-6.8394-.5022-10.91261-1.9459 1.64741-5.0264 6.438 5.3308zm-11.69782-9.1824-2.7037-3.0571 1.66868 6.215zm-3.53432-8.5248 4.81433 5.4437 5.50351-12.1963z" fill="#155eef" fill-rule="evenodd"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 44 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m17.6264 6.5h14.8017l11.4661 18.6661-15.7786 15.9489-22.68835-4.0459-5.157719-19.2098zm.5273 4.9692-6.816 15.105 6.4504 5.3411 8.8246-3.7975zm12.3276 15.3 9.2139-2.7073-7.1983-11.7184zm-.6163-17.2692h-9.3468l7.3309 14.4284zm6.9795 18.5263-6.779 1.9919-.5448 5.4109zm-10.5005 9.008.5824-5.7856-6.0573 2.6067zm-6.8394-.5022-10.91261-1.9459 1.64741-5.0264 6.438 5.3308zm-11.69782-9.1824-2.7037-3.0571 1.66868 6.215zm-3.53432-8.5248 4.81433 5.4437 5.50351-12.1963z" fill="#fff" fill-rule="evenodd"/></svg>`
  },
  {
    id: "radius",
    name: "Radius",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g clip-rule="evenodd" fill="#155eef" fill-rule="evenodd"><path d="m18.5 19v-15h3v15z"/><path d="m18.5 44v-15h3v15z"/><path d="m22.4754 19.404 10.6066-10.60664 2.1214 2.12134-8.4853 8.4853z"/><path d="m4.79776 37.0816 10.60664-10.6066 2.1213 2.1214-10.60662 10.6066z"/><path d="m26.7178 28.5963 8.4853 8.4852-2.1213 2.1214-10.6066-10.6066z"/><path d="m6.91885 8.79727 10.60665 10.60663-2.1214 2.1213-10.60657-10.6066z"/><path d="m18.5 22.5h21.5v3h-21.5z"/><path d="m.00000026 22.5h14.99999974v3h-15z"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g clip-rule="evenodd" fill="#155eef" fill-rule="evenodd"><path d="m18.5 19v-15h3v15z"/><path d="m18.5 44v-15h3v15z"/><path d="m22.4754 19.404 10.6066-10.60664 2.1214 2.12134-8.4853 8.4853z"/><path d="m4.79776 37.0816 10.60664-10.6066 2.1213 2.1214-10.60662 10.6066z"/><path d="m26.7178 28.5963 8.4853 8.4852-2.1213 2.1214-10.6066-10.6066z"/><path d="m6.91885 8.79727 10.60665 10.60663-2.1214 2.1213-10.60657-10.6066z"/><path d="m18.5 22.5h21.5v3h-21.5z"/><path d="m.00000026 22.5h14.99999974v3h-15z"/></g></svg>`
  },
  {
    id: "railspeed",
    name: "Railspeed",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 36 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m0 7.5h28.8c2.5202 0 3.7804 0 4.743.49047.8467.43143 1.5351 1.11984 1.9665 1.96657.4905.96256.4905 2.22276.4905 4.74296v1.8h-28.8c-2.52024 0-3.78035 0-4.74296-.4905-.84673-.4314-1.535139-1.1198-1.966569-1.9665-.490471-.9626-.490471-2.2228-.490471-4.743z"/><path d="m0 28.5h28.8c2.5202 0 3.7804 0 4.743-.4905.8467-.4314 1.5351-1.1198 1.9665-1.9665.4905-.9626.4905-2.2228.4905-4.743v-1.8h-28.8c-2.52024 0-3.78035 0-4.74296.4905-.84673.4314-1.535139 1.1198-1.966569 1.9665-.490471.9626-.490471 2.2228-.490471 4.743z"/><path d="m14 31.5h14.8c2.5202 0 3.7804 0 4.743.4905.8467.4314 1.5351 1.1198 1.9665 1.9665.4905.9626.4905 2.2228.4905 4.743v1.8h-14.8c-2.5202 0-3.7804 0-4.743-.4905-.8467-.4314-1.5351-1.1198-1.9665-1.9665-.4905-.9626-.4905-2.2228-.4905-4.743z"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 36 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m0 7.5h28.8c2.5202 0 3.7804 0 4.743.49047.8467.43143 1.5351 1.11984 1.9665 1.96657.4905.96256.4905 2.22276.4905 4.74296v1.8h-28.8c-2.52024 0-3.78035 0-4.74296-.4905-.84673-.4314-1.535139-1.1198-1.966569-1.9665-.490471-.9626-.490471-2.2228-.490471-4.743z"/><path d="m0 28.5h28.8c2.5202 0 3.7804 0 4.743-.4905.8467-.4314 1.5351-1.1198 1.9665-1.9665.4905-.9626.4905-2.2228.4905-4.743v-1.8h-28.8c-2.52024 0-3.78035 0-4.74296.4905-.84673.4314-1.535139 1.1198-1.966569 1.9665-.490471.9626-.490471 2.2228-.490471 4.743z"/><path d="m14 31.5h14.8c2.5202 0 3.7804 0 4.743.4905.8467.4314 1.5351 1.1198 1.9665 1.9665.4905.9626.4905 2.2228.4905 4.743v1.8h-14.8c-2.5202 0-3.7804 0-4.743-.4905-.8467-.4314-1.5351-1.1198-1.9665-1.9665-.4905-.9626-.4905-2.2228-.4905-4.743z"/></g></svg>`
  },
  {
    id: "refractional",
    name: "Refractional",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 48 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m48 11h-17.0775c-1.2151 0-2.3644.5524-3.1235 1.5012l-1.598 1.9976c-.7591.9488-1.9084 1.5012-3.1235 1.5012h-15.0775l-4 5h17.0775c1.2151 0 2.3644-.5524 3.1235-1.5012l1.598-1.9976c.7591-.9488 1.9084-1.5012 3.1235-1.5012h15.0775z" fill="#444ce7"/><path d="m46 19h-17.0775c-1.2151 0-2.3644.5524-3.1235 1.5012l-1.598 1.9976c-.7591.9488-1.9084 1.5012-3.1235 1.5012h-15.0775l-4 5h17.0775c1.2151 0 2.3644-.5524 3.1235-1.5012l1.598-1.9976c.7591-.9488 1.9084-1.5012 3.1235-1.5012h15.0775z" fill="#155eef"/><path d="m44 27h-17.0775c-1.2151 0-2.3644.5524-3.1235 1.5012l-1.598 1.9976c-.7591.9488-1.9084 1.5012-3.1235 1.5012h-15.0775l-4 5h17.0775c1.2151 0 2.3644-.5524 3.1235-1.5012l1.598-1.9976c.7591-.9488 1.9084-1.5012 3.1235-1.5012h15.0775z" fill="#8098f9"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 48 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="m48 11h-17.0775c-1.2151 0-2.3644.5524-3.1235 1.5012l-1.598 1.9976c-.7591.9488-1.9084 1.5012-3.1235 1.5012h-15.0775l-4 5h17.0775c1.2151 0 2.3644-.5524 3.1235-1.5012l1.598-1.9976c.7591-.9488 1.9084-1.5012 3.1235-1.5012h15.0775z"/><path d="m46 19h-17.0775c-1.2151 0-2.3644.5524-3.1235 1.5012l-1.598 1.9976c-.7591.9488-1.9084 1.5012-3.1235 1.5012h-15.0775l-4 5h17.0775c1.2151 0 2.3644-.5524 3.1235-1.5012l1.598-1.9976c.7591-.9488 1.9084-1.5012 3.1235-1.5012h15.0775z"/><path d="m44 27h-17.0775c-1.2151 0-2.3644.5524-3.1235 1.5012l-1.598 1.9976c-.7591.9488-1.9084 1.5012-3.1235 1.5012h-15.0775l-4 5h17.0775c1.2151 0 2.3644-.5524 3.1235-1.5012l1.598-1.9976c.7591-.9488 1.9084-1.5012 3.1235-1.5012h15.0775z"/></g></svg>`
  },
  {
    id: "renaissance",
    name: "Renaissance",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 35 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m12.7018 5c1.841 0 3.4172 1.31967 3.7408 3.13199l.4648 2.60271c.3236 1.8123 1.8998 3.132 3.7408 3.132h3.1518c4.8969 0 8.8667 3.9697 8.8667 8.8666 0 2.9333-1.4244 5.5339-3.6191 7.1479.92.3126 1.6466.809 2.1799 1.461.549.7191.9411 1.7411 1.1764 3.028.0392.3406.0883.6718.1373 1.003s.098.6624.1372 1.003c.0408.3538.0709.6566.096.9083.0232.233.042.4223.0609.5679.0784 1.0598.1961 1.9303.3529 2.5738.1655.9048.4994 1.7867.9727 2.5738h-6.6982c-.3137-.6056-.5098-1.3248-.6666-2.1196-.1349-.6836-.2408-1.5352-.3676-2.5548-.0207-.1659-.0418-.3362-.0638-.5111l-.2353-1.7411c-.1961-1.3247-.4314-2.271-.6667-2.8766-.2745-.5677-.7058-.9841-1.2941-1.2112-.6274-.2271-1.5686-.3856-2.9019-.3856h-.3018c-1.841 0-3.4172-1.3197-3.7408-3.132l-.4648-2.6027c-.3236-1.8123-1.8998-3.132-3.7408-3.132h-5.68517v10.1334h-6.33333v-27.8667zm13.6315 17.7333c0 1.3992-1.1342 2.5334-2.5333 2.5334h-3.1518c-1.841 0-3.4172-1.3197-3.7408-3.132l-.4648-2.6027c-.3236-1.8123-1.8998-3.132-3.7408-3.132h-5.36847v-5.0667h5.68517c1.841 0 3.4172 1.3197 3.7408 3.132l.4647 2.6027c.3237 1.8123 1.8999 3.132 3.7409 3.132h2.8351c1.3991 0 2.5333 1.1342 2.5333 2.5333z" fill="#1849a9" fill-rule="evenodd"/></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 35 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m12.7018 5c1.841 0 3.4172 1.31967 3.7408 3.13199l.4648 2.60271c.3236 1.8123 1.8998 3.132 3.7408 3.132h3.1518c4.8969 0 8.8667 3.9697 8.8667 8.8666 0 2.9333-1.4244 5.5339-3.6191 7.1479.92.3126 1.6466.809 2.1799 1.461.549.7191.9411 1.7411 1.1764 3.028.0392.3406.0883.6718.1373 1.003s.098.6624.1372 1.003c.0408.3538.0709.6566.096.9083.0232.233.042.4223.0609.5679.0784 1.0598.1961 1.9303.3529 2.5738.1655.9048.4994 1.7867.9727 2.5738h-6.6982c-.3137-.6056-.5098-1.3247-.6666-2.1196-.1349-.6836-.2408-1.5352-.3676-2.5548-.0207-.1659-.0418-.3362-.0638-.5111l-.2353-1.7411c-.1961-1.3247-.4314-2.271-.6667-2.8766-.2745-.5677-.7058-.9841-1.2941-1.2112-.6274-.2271-1.5686-.3856-2.9019-.3856h-.3018c-1.841 0-3.4172-1.3197-3.7408-3.132l-.4648-2.6027c-.3236-1.8123-1.8998-3.132-3.7408-3.132h-5.68517v10.1334h-6.33333v-27.8667zm13.6315 17.7333c0 1.3992-1.1342 2.5334-2.5333 2.5334h-3.1518c-1.841 0-3.4172-1.3197-3.7408-3.132l-.4648-2.6027c-.3236-1.8123-1.8998-3.132-3.7408-3.132h-5.36847v-5.0667h5.68517c1.841 0 3.4172 1.3197 3.7408 3.132l.4647 2.6027c.3237 1.8123 1.8999 3.132 3.7409 3.132h2.8351c1.3991 0 2.5333 1.1342 2.5333 2.5333z" fill="#fff" fill-rule="evenodd"/></svg>`
  },
  {
    id: "sisyphus",
    name: "Sisyphus",
    lightSvg: `<svg fill="none" height="100%" viewBox="0 0 32 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m.599609 19.2002h9.59998v9.59999h-9.59998z"/><path d="m31.4004 28.7998h9.6v9.59999h-9.6z" transform="matrix(-1 0 -0 -1 62.8008 57.5996)"/><path d="m10.1992 19.2001 11.6-9.6v9.6l-11.6 9.6z" opacity=".2"/><path d="m21.7988 28.7999-11.6 9.6v-9.6l11.6-9.6z" opacity=".5"/><path d="m.599609 19.2 21.199991-19.2v9.59999l-11.6 9.60001z" opacity=".6"/><path d="m31.4004 28.8-21.2 19.2v-9.6l11.6-9.6z" opacity=".7"/></g></svg>`,
    darkSvg: `<svg fill="none" height="100%" viewBox="0 0 32 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m.599609 19.2002h9.59998v9.59999h-9.59998z"/><path d="m31.4004 28.7998h9.6v9.59999h-9.6z" transform="matrix(-1 0 -0 -1 62.8008 57.5996)"/><path d="m10.1992 19.2001 11.6-9.6v9.6l-11.6 9.6z" opacity=".2"/><path d="m21.7988 28.7999-11.6 9.6v-9.6l11.6-9.6z" opacity=".5"/><path d="m.599609 19.2 21.199991-19.2v9.59999l-11.6 9.60001z" opacity=".6"/><path d="m31.4004 28.8-21.2 19.2v-9.6l11.6-9.6z" opacity=".7"/></g></svg>`
  },
  {
    id: "solaris-energy",
    name: "Solaris Energy",
    lightSvg: `<svg width="100%" height="100%" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 4V16.3604C20 19.087 16.6569 20.3998 14.8016 18.4017L7 10M40 24H27.6396C24.913 24 23.6002 20.6569 25.5983 18.8016L34 11M20 44V31.6396C20 28.913 23.3431 27.6002 25.1984 29.5983L33 38M0 24L12.3604 24C15.087 24 16.3998 27.3431 14.4017 29.1984L6 37" stroke="#175CD3" stroke-width="4"/></svg>`,
    darkSvg: `<svg width="100%" height="100%" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 4V16.3604C20 19.087 16.6569 20.3998 14.8016 18.4017L7 10M40 24H27.6396C24.913 24 23.6002 20.6569 25.5983 18.8016L34 11M20 44V31.6396C20 28.913 23.3431 27.6002 25.1984 29.5983L33 38M0 24L12.3604 24C15.087 24 16.3998 27.3431 14.4017 29.1984L6 37" stroke="white" stroke-width="4"/></svg>`
  }
];

// features/lib/store-logo.ts
var DEFAULT_STORE_LOGO_ICON = LOGO_ICONS.find((icon) => icon.id === "cubekit").lightSvg;
var DEFAULT_STORE_LOGO_COLOR = "270";
function normalizeStoreLogoColor(value) {
  const numeric = Number.parseFloat(String(value ?? DEFAULT_STORE_LOGO_COLOR));
  if (!Number.isFinite(numeric)) return DEFAULT_STORE_LOGO_COLOR;
  return String((numeric % 360 + 360) % 360);
}

// features/keystone/models/BrokerageSettings.ts
var settingsHooks = createTenantOwnedHooks({ listKey: "BrokerageSettings", protectDelete: true });
var BrokerageSettings = (0, import_core5.list)({
  access: {
    operation: {
      query: permissions.canManageBrokerageSettings,
      create: permissions.canManageBrokerageSettings,
      update: permissions.canManageBrokerageSettings,
      delete: () => false
    },
    filter: {
      query: rules.canAccessBrokerageRecords,
      update: rules.canAccessBrokerageRecords
    },
    item: {
      create: canCreateInActiveBrokerage,
      update: canMoveToActiveBrokerage
    }
  },
  hooks: {
    resolveInput: settingsHooks.resolveInput,
    validateInput: async (args) => {
      await settingsHooks.validateInput(args);
      validateRequiredToOneRelationship({ operation: args.operation, inputData: args.inputData, field: "brokerage", addValidationError: args.addValidationError });
    },
    beforeOperation: settingsHooks.beforeOperation,
    afterOperation: settingsHooks.afterOperation
  },
  db: { idField: { kind: "autoincrement" } },
  graphql: {
    plural: "BrokerageSettingsItems"
  },
  ui: {
    hideDelete: true,
    listView: {
      initialColumns: ["businessName", "marketLabel", "city", "state"]
    }
  },
  fields: {
    brokerage: (0, import_fields7.relationship)({ ref: "Brokerage.settings", access: { update: () => false } }),
    key: (0, import_fields7.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    businessName: (0, import_fields7.text)({ validation: { isRequired: true } }),
    marketLabel: (0, import_fields7.text)({ validation: { isRequired: true } }),
    city: (0, import_fields7.text)({ validation: { isRequired: true } }),
    state: (0, import_fields7.text)({ validation: { isRequired: true } }),
    tagline: (0, import_fields7.text)({ validation: { isRequired: true } }),
    description: (0, import_fields7.text)({ ui: { displayMode: "textarea" } }),
    equalHousingNotice: (0, import_fields7.text)(),
    publicPhone: (0, import_fields7.text)(),
    publicEmail: (0, import_fields7.text)(),
    showingDurationMinutes: (0, import_fields7.integer)({ defaultValue: 60, validation: { min: 15, max: 240 } }),
    brandHue: (0, import_fields7.integer)({
      defaultValue: 151,
      validation: { min: 0, max: 359, isRequired: true },
      ui: { description: "Constrained storefront brand hue in degrees (0\u2013359)." },
      hooks: {
        resolveInput: ({ resolvedData, fieldKey }) => {
          const value = resolvedData[fieldKey];
          return value === void 0 ? value : normalizeStorefrontBrandHue(value);
        }
      }
    }),
    logoIcon: (0, import_fields7.text)({ hooks: { resolveInput: ({ resolvedData, fieldKey }) => {
      const value = resolvedData[fieldKey];
      if (value === void 0) return value;
      const safe = sanitizeStoreLogoSvg(String(value || ""));
      if (String(value || "").trim() && !safe) throw new Error("Logo SVG is not allowed.");
      return safe;
    } } }),
    logoColor: (0, import_fields7.text)({ defaultValue: "0", hooks: { resolveInput: ({ resolvedData, fieldKey }) => resolvedData[fieldKey] === void 0 ? void 0 : normalizeStoreLogoColor(resolvedData[fieldKey]) } }),
    ...trackingFields
  }
});

// features/keystone/models/SavedSearchAlert.ts
var import_core6 = require("@keystone-6/core");
var import_fields8 = require("@keystone-6/core/fields");
var SavedSearchAlert = (0, import_core6.list)({
  access: {
    operation: { query: permissions.canReadLeads, create: permissions.canManageLeads, update: permissions.canManageLeads, delete: () => false },
    filter: { query: rules.canReadSavedSearchAlerts, update: rules.canReadSavedSearchAlerts },
    item: { create: canCreateForActiveSavedSearch, update: canMoveToActiveBrokerage }
  },
  hooks: createTenantOwnedHooks({ listKey: "SavedSearchAlert", parents: { savedSearch: "SavedSearch" }, users: ["user"], required: ["savedSearch", "user"], protectDelete: true }),
  ui: {
    hideDelete: true,
    hideCreate: (args) => !permissions.canManageLeads(args),
    listView: { initialColumns: ["savedSearch", "user", "status", "cadence"] }
  },
  fields: {
    brokerage: (0, import_fields8.relationship)({ ref: "Brokerage" }),
    savedSearch: (0, import_fields8.relationship)({ ref: "SavedSearch" }),
    user: (0, import_fields8.relationship)({ ref: "User" }),
    status: (0, import_fields8.select)({ type: "enum", options: [{ label: "Active", value: "active" }, { label: "Paused", value: "paused" }, { label: "Unsubscribed", value: "unsubscribed" }], defaultValue: "active" }),
    cadence: (0, import_fields8.select)({ type: "enum", options: [{ label: "Instant", value: "instant" }, { label: "Daily", value: "daily" }, { label: "Weekly", value: "weekly" }], defaultValue: "daily" }),
    lastSentAt: (0, import_fields8.timestamp)(),
    sentCount: (0, import_fields8.integer)({ defaultValue: 0, validation: { min: 0 } }),
    metadata: (0, import_fields8.json)(),
    ...trackingFields
  }
});

// features/keystone/models/Disclosure.ts
var import_core7 = require("@keystone-6/core");
var import_fields9 = require("@keystone-6/core/fields");
var Disclosure = (0, import_core7.list)({
  access: {
    operation: { query: permissions.canReadDeals, create: permissions.canManageBrokerageDeals, update: () => false, delete: () => false },
    filter: { query: rules.canReadDealChildren },
    item: { create: canCreateForActiveDeal }
  },
  hooks: createTenantOwnedHooks({ listKey: "Disclosure", parents: { deal: "Deal", property: "Property" }, required: ["deal", "property"], coherentWith: { field: "deal", listKey: "Deal", matches: { property: "property" } }, deriveOnly: true, protectDelete: true }),
  ui: {
    hideDelete: true,
    listView: { initialColumns: ["title", "property", "disclosureType", "status"] }
  },
  fields: {
    title: (0, import_fields9.text)({ validation: { isRequired: true } }),
    property: (0, import_fields9.relationship)({ ref: "Property" }),
    deal: (0, import_fields9.relationship)({ ref: "Deal" }),
    disclosureType: (0, import_fields9.select)({ type: "enum", options: [{ label: "Seller Property", value: "seller_property" }, { label: "Lead Paint", value: "lead_paint" }, { label: "HOA", value: "hoa" }, { label: "Natural Hazard", value: "natural_hazard" }, { label: "Other", value: "other" }], defaultValue: "other" }),
    status: (0, import_fields9.select)({
      type: "enum",
      options: [{ label: "Draft", value: "draft" }, { label: "Sent", value: "sent" }, { label: "Acknowledged", value: "acknowledged" }, { label: "Expired", value: "expired" }],
      defaultValue: "draft",
      access: { create: () => false, update: () => false }
    }),
    documentUrl: (0, import_fields9.text)(),
    sentAt: (0, import_fields9.timestamp)({ access: { create: () => false, update: () => false } }),
    acknowledgedAt: (0, import_fields9.timestamp)({ access: { create: () => false, update: () => false } }),
    metadata: (0, import_fields9.json)(),
    ...trackingFields
  }
});

// features/keystone/models/PropertyValuation.ts
var import_core8 = require("@keystone-6/core");
var import_fields10 = require("@keystone-6/core/fields");

// features/keystone/lib/recordInvariants.ts
function after(item, resolvedData) {
  return { ...item || {}, ...resolvedData || {} };
}
function minor(value) {
  if (value === null || value === void 0 || value === "") return null;
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.round(value));
  return null;
}
function decimalNumber(value) {
  if (value === null || value === void 0 || value === "") return null;
  const number = Number(String(value));
  return Number.isFinite(number) ? number : null;
}
function time(value) {
  if (value === null || value === void 0 || value === "") return null;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}
function moneyOrder(low, high, message) {
  return (row) => {
    const a = minor(row[low]), b = minor(row[high]);
    return a !== null && b !== null && a > b ? message : null;
  };
}
function timeOrder(start, end, message) {
  return (row) => {
    const a = time(row[start]), b = time(row[end]);
    return a !== null && b !== null && b <= a ? message : null;
  };
}
var commissionSplit = (row) => {
  const brokerage = decimalNumber(row.brokerageSplitPercent), agent = decimalNumber(row.agentSplitPercent);
  for (const [label, value] of [["Brokerage split", brokerage], ["Agent split", agent]]) {
    if (value !== null && (value < 0 || value > 100)) return `${label} must be between 0 and 100 percent.`;
  }
  if ((brokerage ?? 0) + (agent ?? 0) > 100) return "Brokerage and agent splits cannot add up to more than 100 percent.";
  const gross = minor(row.grossCommission), net = minor(row.netCommission);
  if (gross !== null && net !== null && net > gross) return "Net commission cannot be more than the gross commission.";
  return null;
};
function agentNetMinor(grossMinor, agentSplitPercent) {
  const text46 = String(agentSplitPercent ?? "").trim();
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(text46);
  if (!match) return null;
  const basisPoints = BigInt(match[1]) * 100n + BigInt((match[2] || "").padEnd(2, "0") || "0");
  if (basisPoints > 10000n || grossMinor < 0n) return null;
  return (grossMinor * basisPoints + 5000n) / 10000n;
}
function withRecordInvariants(hooks, rules2) {
  const inner = hooks.validateInput;
  return {
    ...hooks,
    async validateInput(args) {
      if (inner) await inner.call(hooks, args);
      const { operation, resolvedData, item, addValidationError } = args;
      if (operation !== "create" && operation !== "update") return;
      const row = after(item, resolvedData);
      for (const rule of rules2) {
        const problem = rule(row, operation);
        if (problem) addValidationError(problem);
      }
    }
  };
}
function withDerivedCommissionNet(hooks) {
  const resolve = hooks.resolveInput;
  const validate = hooks.validateInput;
  return {
    ...hooks,
    async resolveInput(args) {
      const resolved = resolve ? await resolve.call(hooks, args) : args.resolvedData;
      if (args.operation !== "create" || args.inputData?.netCommission !== void 0) return resolved;
      const gross = minor(resolved?.grossCommission);
      const net = gross === null ? null : agentNetMinor(gross, resolved?.agentSplitPercent);
      return net === null ? resolved : { ...resolved, netCommission: net };
    },
    async validateInput(args) {
      if (validate) await validate.call(hooks, args);
      if (args.operation !== "create" || args.inputData?.netCommission === void 0) return;
      const row = after(args.item, args.resolvedData);
      const gross = minor(row.grossCommission), net = minor(row.netCommission);
      const expected = gross === null ? null : agentNetMinor(gross, row.agentSplitPercent);
      if (expected !== null && net !== null && expected > 0n && net !== expected) {
        args.addValidationError("Net commission must equal the gross commission times the agent split.");
      }
    }
  };
}
var OPEN_ESCROW = ["opened", "pending"];
function withSingleOpenEscrow(hooks) {
  const inner = hooks.validateInput;
  return {
    ...hooks,
    async validateInput(args) {
      if (inner) await inner.call(hooks, args);
      const { operation, resolvedData, item, inputData, context, addValidationError } = args;
      if (operation !== "create" && operation !== "update") return;
      const status = String(resolvedData?.status ?? item?.status ?? "opened");
      if (!OPEN_ESCROW.includes(status)) return;
      if (operation === "update" && resolvedData?.status === void 0) return;
      const dealId = item?.dealId || inputData?.deal?.connect?.id;
      if (!dealId) return;
      const open = await context.sudo().db.Escrow.count({
        where: { deal: { id: { equals: dealId } }, status: { in: OPEN_ESCROW }, ...item?.id ? { id: { not: { equals: item.id } } } : {} }
      });
      if (open) addValidationError("This deal already has an open escrow. Close or cancel it before opening another.");
    }
  };
}

// features/keystone/models/PropertyValuation.ts
var PropertyValuation = (0, import_core8.list)({
  access: {
    operation: { query: permissions.canViewMarketIntelligence, create: permissions.canManageListings, update: permissions.canManageListings, delete: () => false },
    filter: { query: rules.canReadPropertyChildren, update: rules.canManagePropertyChildren },
    item: { create: canCreateForManagedProperty }
  },
  hooks: withRecordInvariants(createTenantOwnedHooks({ listKey: "PropertyValuation", parents: { property: "Property" }, users: ["performedBy"], required: ["property"], deriveOnly: true, protectDelete: true }), [
    moneyOrder("lowValue", "estimatedValue", "The low value cannot be more than the estimated value."),
    moneyOrder("estimatedValue", "highValue", "The estimated value cannot be more than the high value."),
    moneyOrder("lowValue", "highValue", "The low value cannot be more than the high value.")
  ]),
  ui: {
    hideDelete: true,
    listView: { initialColumns: ["valuationNumber", "property", "valuationType", "estimatedValue"] }
  },
  fields: {
    valuationNumber: (0, import_fields10.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    property: (0, import_fields10.relationship)({ ref: "Property", access: { update: () => false } }),
    valuationType: (0, import_fields10.select)({ type: "enum", options: [{ label: "CMA", value: "cma" }, { label: "Appraisal", value: "appraisal" }, { label: "AVM", value: "avm" }], defaultValue: "cma" }),
    lowValue: money({ precision: 12, scale: 2 }),
    estimatedValue: money({ precision: 12, scale: 2 }),
    highValue: money({ precision: 12, scale: 2 }),
    performedBy: (0, import_fields10.relationship)({ ref: "User", access: { update: () => false } }),
    valuedAt: (0, import_fields10.timestamp)(),
    notes: (0, import_fields10.text)({ ui: { displayMode: "textarea" } }),
    metadata: (0, import_fields10.json)(),
    ...trackingFields
  }
});

// features/keystone/models/TransactionMilestone.ts
var import_core9 = require("@keystone-6/core");
var import_fields11 = require("@keystone-6/core/fields");
var TransactionMilestone = (0, import_core9.list)({
  access: {
    operation: { query: permissions.canReadDeals, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canReadDealChildren }
  },
  hooks: createTenantOwnedHooks({ listKey: "TransactionMilestone", parents: { deal: "Deal" }, users: ["assignedTo"], required: ["deal"], protectDelete: true }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["name", "deal", "status", "dueAt"] }
  },
  fields: {
    brokerage: (0, import_fields11.relationship)({ ref: "Brokerage" }),
    name: (0, import_fields11.text)({ validation: { isRequired: true } }),
    deal: (0, import_fields11.relationship)({ ref: "Deal" }),
    status: (0, import_fields11.select)({
      type: "enum",
      options: [{ label: "Not Started", value: "not_started" }, { label: "In Progress", value: "in_progress" }, { label: "Complete", value: "complete" }, { label: "Blocked", value: "blocked" }],
      defaultValue: "not_started",
      access: { create: () => false, update: () => false }
    }),
    dueAt: (0, import_fields11.timestamp)(),
    completedAt: (0, import_fields11.timestamp)({ access: { create: () => false, update: () => false } }),
    assignedTo: (0, import_fields11.relationship)({ ref: "User" }),
    sortOrder: (0, import_fields11.integer)({ defaultValue: 0 }),
    notes: (0, import_fields11.text)({ ui: { displayMode: "textarea" } }),
    metadata: (0, import_fields11.json)(),
    ...trackingFields
  }
});

// features/keystone/models/MortgageApplication.ts
var import_core10 = require("@keystone-6/core");
var import_fields12 = require("@keystone-6/core/fields");

// features/keystone/lib/closingRecordState.ts
var ESCROW_TRANSITIONS = {
  opened: ["pending", "closed", "cancelled"],
  pending: ["opened", "closed", "cancelled"],
  closed: [],
  cancelled: []
};
var TITLE_ORDER_TRANSITIONS = {
  ordered: ["in_review", "clear", "exception"],
  in_review: ["clear", "exception"],
  exception: ["in_review", "clear"],
  clear: []
};
var MORTGAGE_TRANSITIONS = {
  started: ["preapproved", "underwriting", "denied"],
  preapproved: ["underwriting", "denied"],
  underwriting: ["approved", "denied"],
  approved: [],
  denied: ["started"]
};
function canTransition(map, from, to) {
  return from === to || Boolean(map[from]?.includes(to));
}
function guardStatusField(hooks, map, label, stamps = {}, field = "status") {
  const inner = hooks.validateInput;
  const resolve = hooks.resolveInput;
  return {
    ...hooks,
    async resolveInput(args) {
      const resolved = resolve ? await resolve.call(hooks, args) : args.resolvedData;
      const to = resolved?.[field];
      const stampField = typeof to === "string" ? stamps[to] : void 0;
      if (!stampField) return resolved;
      const existing = args.item?.[stampField];
      return existing || resolved[stampField] !== void 0 ? resolved : { ...resolved, [stampField]: /* @__PURE__ */ new Date() };
    },
    async validateInput(args) {
      if (inner) await inner.call(hooks, args);
      const { operation, resolvedData, item, addValidationError } = args;
      if (operation !== "update" || !item || resolvedData?.[field] === void 0) return;
      const from = String(item[field] ?? "");
      const to = String(resolvedData[field]);
      if (!canTransition(map, from, to)) addValidationError(`Cannot change ${label} from ${from.replaceAll("_", " ")} to ${to.replaceAll("_", " ")}.`);
    }
  };
}

// features/keystone/models/MortgageApplication.ts
var MortgageApplication = (0, import_core10.list)({
  access: {
    operation: { query: permissions.canReadSensitiveDeals, create: permissions.canManageBrokerageDeals, update: permissions.canManageBrokerageDeals, delete: () => false },
    filter: { query: rules.canReadDealChildren, update: rules.canReadDealChildren },
    item: { create: canCreateForActiveDeal }
  },
  hooks: guardStatusField(createTenantOwnedHooks({ listKey: "MortgageApplication", parents: { deal: "Deal", lead: "Lead" }, required: ["deal", "lead"], coherentWith: { field: "deal", listKey: "Deal", matches: { lead: "lead" } }, deriveOnly: true, protectDelete: true }), MORTGAGE_TRANSITIONS, "financing application", { approved: "decisionAt", denied: "decisionAt" }),
  ui: {
    hideDelete: true,
    hideCreate: (args) => !permissions.canManageBrokerageDeals(args),
    listView: { initialColumns: ["applicationNumber", "deal", "lenderName", "status"] }
  },
  fields: {
    applicationNumber: (0, import_fields12.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    deal: (0, import_fields12.relationship)({ ref: "Deal" }),
    lead: (0, import_fields12.relationship)({ ref: "Lead" }),
    lenderName: (0, import_fields12.text)(),
    status: (0, import_fields12.select)({ type: "enum", options: [{ label: "Started", value: "started" }, { label: "Preapproved", value: "preapproved" }, { label: "Underwriting", value: "underwriting" }, { label: "Approved", value: "approved" }, { label: "Denied", value: "denied" }], defaultValue: "started" }),
    loanAmount: money({ precision: 12, scale: 2 }),
    interestRate: (0, import_fields12.decimal)({ precision: 6, scale: 3 }),
    submittedAt: (0, import_fields12.timestamp)(),
    decisionAt: (0, import_fields12.timestamp)(),
    metadata: (0, import_fields12.json)(),
    ...trackingFields
  }
});

// features/keystone/models/TitleOrder.ts
var import_core11 = require("@keystone-6/core");
var import_fields13 = require("@keystone-6/core/fields");
var TitleOrder = (0, import_core11.list)({
  access: {
    operation: { query: permissions.canReadSensitiveDeals, create: permissions.canManageBrokerageDeals, update: permissions.canManageBrokerageDeals, delete: () => false },
    filter: { query: rules.canReadDealChildren, update: rules.canReadDealChildren },
    item: { create: canCreateForActiveDeal }
  },
  hooks: guardStatusField(createTenantOwnedHooks({ listKey: "TitleOrder", parents: { deal: "Deal", property: "Property" }, required: ["deal", "property"], coherentWith: { field: "deal", listKey: "Deal", matches: { property: "property" } }, deriveOnly: true, protectDelete: true }), TITLE_ORDER_TRANSITIONS, "title order", { clear: "clearedAt" }),
  ui: {
    hideDelete: true,
    hideCreate: (args) => !permissions.canManageBrokerageDeals(args),
    listView: { initialColumns: ["orderNumber", "deal", "titleCompany", "status"] }
  },
  fields: {
    orderNumber: (0, import_fields13.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    deal: (0, import_fields13.relationship)({ ref: "Deal" }),
    property: (0, import_fields13.relationship)({ ref: "Property" }),
    titleCompany: (0, import_fields13.text)(),
    status: (0, import_fields13.select)({ type: "enum", options: [{ label: "Ordered", value: "ordered" }, { label: "In Review", value: "in_review" }, { label: "Clear", value: "clear" }, { label: "Exception", value: "exception" }], defaultValue: "ordered" }),
    orderedAt: (0, import_fields13.timestamp)(),
    clearedAt: (0, import_fields13.timestamp)(),
    exceptions: (0, import_fields13.text)({ ui: { displayMode: "textarea" } }),
    metadata: (0, import_fields13.json)(),
    ...trackingFields
  }
});

// features/keystone/models/Escrow.ts
var import_core12 = require("@keystone-6/core");
var import_fields14 = require("@keystone-6/core/fields");
var Escrow = (0, import_core12.list)({
  access: {
    operation: { query: permissions.canReadSensitiveDeals, create: permissions.canManageBrokerageDeals, update: permissions.canManageBrokerageDeals, delete: () => false },
    filter: { query: rules.canReadDealChildren, update: rules.canReadDealChildren },
    item: { create: canCreateForActiveDeal }
  },
  hooks: withSingleOpenEscrow(guardStatusField(createTenantOwnedHooks({ listKey: "Escrow", parents: { deal: "Deal", property: "Property" }, required: ["deal", "property"], coherentWith: { field: "deal", listKey: "Deal", matches: { property: "property" } }, deriveOnly: true, protectDelete: true }), ESCROW_TRANSITIONS, "escrow", { closed: "closedAt" })),
  ui: {
    hideDelete: true,
    hideCreate: (args) => !permissions.canManageBrokerageDeals(args),
    listView: { initialColumns: ["escrowNumber", "deal", "status", "scheduledCloseAt"] }
  },
  fields: {
    escrowNumber: (0, import_fields14.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    deal: (0, import_fields14.relationship)({ ref: "Deal" }),
    property: (0, import_fields14.relationship)({ ref: "Property" }),
    status: (0, import_fields14.select)({ type: "enum", options: [{ label: "Opened", value: "opened" }, { label: "Pending", value: "pending" }, { label: "Closed", value: "closed" }, { label: "Cancelled", value: "cancelled" }], defaultValue: "opened" }),
    escrowCompany: (0, import_fields14.text)(),
    officerName: (0, import_fields14.text)(),
    officerEmail: (0, import_fields14.text)(),
    openedAt: (0, import_fields14.timestamp)(),
    scheduledCloseAt: (0, import_fields14.timestamp)(),
    closedAt: (0, import_fields14.timestamp)(),
    depositAmount: money({ precision: 12, scale: 2 }),
    metadata: (0, import_fields14.json)(),
    ...trackingFields
  }
});

// features/keystone/models/ShowingFeedback.ts
var import_core13 = require("@keystone-6/core");
var import_fields15 = require("@keystone-6/core/fields");
var ShowingFeedback = (0, import_core13.list)({
  access: {
    operation: { query: permissions.canReadShowings, create: permissions.canManageBrokerageShowings, update: permissions.canManageBrokerageShowings, delete: () => false },
    filter: { query: rules.canReadShowingChildren, update: rules.canReadShowingChildren },
    item: { create: canCreateForActiveShowing }
  },
  hooks: createTenantOwnedHooks({ listKey: "ShowingFeedback", parents: { showing: "Showing", lead: "Lead", property: "Property" }, required: ["showing", "lead", "property"], coherentWith: { field: "showing", listKey: "Showing", matches: { lead: "lead", property: "property" } }, deriveOnly: true, protectDelete: true }),
  ui: {
    hideDelete: true,
    listView: { initialColumns: ["showing", "lead", "rating", "interestLevel"] }
  },
  fields: {
    showing: (0, import_fields15.relationship)({ ref: "Showing", access: { update: () => false } }),
    lead: (0, import_fields15.relationship)({ ref: "Lead", access: { update: () => false } }),
    property: (0, import_fields15.relationship)({ ref: "Property", access: { update: () => false } }),
    rating: (0, import_fields15.integer)({ validation: { min: 1, max: 5 } }),
    interestLevel: (0, import_fields15.select)({ type: "enum", options: [{ label: "Low", value: "low" }, { label: "Medium", value: "medium" }, { label: "High", value: "high" }, { label: "Offer Likely", value: "offer_likely" }], defaultValue: "medium" }),
    comments: (0, import_fields15.text)({ ui: { displayMode: "textarea" } }),
    priceOpinion: money({ precision: 12, scale: 2 }),
    followUpRequired: (0, import_fields15.checkbox)({ defaultValue: false }),
    metadata: (0, import_fields15.json)(),
    ...trackingFields
  }
});

// features/keystone/models/OpenHouse.ts
var import_core14 = require("@keystone-6/core");
var import_fields16 = require("@keystone-6/core/fields");
var OpenHouse = (0, import_core14.list)({
  access: {
    operation: { query: permissions.canReadShowings, create: permissions.canManageBrokerageShowings, update: permissions.canManageBrokerageShowings, delete: () => false },
    filter: { query: rules.canReadPropertyChildren, update: rules.canReadPropertyChildren },
    item: { create: canCreateForActiveProperty }
  },
  hooks: withRecordInvariants(createTenantOwnedHooks({ listKey: "OpenHouse", parents: { property: "Property" }, users: ["hostAgent"], required: ["property"], deriveOnly: true, protectDelete: true }), [timeOrder("startsAt", "endsAt", "The open house must end after it starts.")]),
  ui: {
    hideDelete: true,
    listView: { initialColumns: ["title", "property", "status", "startsAt"] }
  },
  fields: {
    title: (0, import_fields16.text)({ validation: { isRequired: true } }),
    property: (0, import_fields16.relationship)({ ref: "Property", access: { update: () => false } }),
    hostAgent: (0, import_fields16.relationship)({ ref: "User" }),
    status: (0, import_fields16.select)({ type: "enum", options: [{ label: "Scheduled", value: "scheduled" }, { label: "Completed", value: "completed" }, { label: "Cancelled", value: "cancelled" }], defaultValue: "scheduled", access: { create: () => false, update: () => false } }),
    startsAt: (0, import_fields16.timestamp)({ validation: { isRequired: true } }),
    endsAt: (0, import_fields16.timestamp)({ validation: { isRequired: true } }),
    attendeeCount: (0, import_fields16.integer)({ defaultValue: 0, validation: { min: 0 } }),
    notes: (0, import_fields16.text)({ ui: { displayMode: "textarea" } }),
    metadata: (0, import_fields16.json)(),
    ...trackingFields
  }
});

// features/keystone/models/SourceFeed.ts
var import_core15 = require("@keystone-6/core");
var import_fields17 = require("@keystone-6/core/fields");
var SourceFeed = (0, import_core15.list)({
  access: {
    operation: { query: permissions.canManageListings, create: permissions.canManageBrokerageListings, update: permissions.canManageBrokerageListings, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords, update: rules.canAccessBrokerageRecords },
    item: { create: canCreateInActiveBrokerage, update: canMoveToActiveBrokerage }
  },
  hooks: createTenantOwnedHooks({ listKey: "SourceFeed", protectDelete: true }),
  ui: {
    hideDelete: true,
    hideCreate: (args) => !permissions.canManageBrokerageListings(args),
    listView: { initialColumns: ["name", "provider", "feedType", "status"] }
  },
  fields: {
    brokerage: (0, import_fields17.relationship)({ ref: "Brokerage" }),
    name: (0, import_fields17.text)({ validation: { isRequired: true } }),
    provider: (0, import_fields17.text)(),
    feedType: (0, import_fields17.select)({ type: "enum", options: [{ label: "MLS RETS", value: "rets" }, { label: "RESO Web API", value: "reso" }, { label: "CSV", value: "csv" }, { label: "Manual", value: "manual" }], defaultValue: "manual" }),
    status: (0, import_fields17.select)({ type: "enum", options: [{ label: "Active", value: "active" }, { label: "Paused", value: "paused" }, { label: "Error", value: "error" }], defaultValue: "active", access: { create: () => false, update: () => false } }),
    lastImportedAt: (0, import_fields17.timestamp)(),
    recordsImported: (0, import_fields17.integer)({ defaultValue: 0, validation: { min: 0 } }),
    credentials: (0, import_fields17.json)({
      access: { read: () => false, create: () => false, update: () => false },
      ui: {
        itemView: { fieldMode: "hidden" },
        createView: { fieldMode: "hidden" }
      }
    }),
    metadata: (0, import_fields17.json)(),
    ...trackingFields
  }
});

// features/keystone/models/ListingSyndication.ts
var import_core16 = require("@keystone-6/core");
var import_fields18 = require("@keystone-6/core/fields");
var ListingSyndication = (0, import_core16.list)({
  access: {
    operation: { query: permissions.canManageListings, create: permissions.canManageListings, update: permissions.canManageListings, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords, update: rules.canManagePropertyChildren },
    item: { create: canCreateForManagedProperty, update: canMoveToActiveBrokerage }
  },
  hooks: createTenantOwnedHooks({
    listKey: "ListingSyndication",
    parents: { property: "Property" },
    required: ["property"],
    protectDelete: true
  }),
  ui: {
    hideDelete: true,
    hideCreate: (args) => !permissions.canManageListings(args),
    listView: { initialColumns: ["property", "channel", "status", "externalListingId"] }
  },
  fields: {
    brokerage: (0, import_fields18.relationship)({ ref: "Brokerage.listingSyndications" }),
    channel: (0, import_fields18.select)({ type: "enum", options: [{ label: "MLS", value: "mls" }, { label: "Zillow", value: "zillow" }, { label: "Realtor", value: "realtor" }, { label: "Website", value: "website" }, { label: "Social", value: "social" }], defaultValue: "website" }),
    property: (0, import_fields18.relationship)({ ref: "Property" }),
    status: (0, import_fields18.select)({ type: "enum", options: [{ label: "Draft", value: "draft" }, { label: "Reported published (unverified)", value: "published" }, { label: "Provider error reported (unverified)", value: "error" }, { label: "Reported removed (unverified)", value: "removed" }], defaultValue: "draft", access: { create: () => false, update: () => false } }),
    externalListingId: (0, import_fields18.text)(),
    listingUrl: (0, import_fields18.text)(),
    publishedAt: (0, import_fields18.timestamp)({ access: { create: () => false, update: () => false } }),
    lastSyncedAt: (0, import_fields18.timestamp)({ access: { create: () => false, update: () => false } }),
    errorMessage: (0, import_fields18.text)({ ui: { displayMode: "textarea" } }),
    metadata: (0, import_fields18.json)(),
    ...trackingFields
  }
});

// features/keystone/models/User.ts
var import_core17 = require("@keystone-6/core");
var import_access19 = require("@keystone-6/core/access");
var import_fields19 = require("@keystone-6/core/fields");
var User = (0, import_core17.list)({
  hooks: {
    validate: ({ operation, inputData, addValidationError }) => {
      if (operation === "delete") return;
      validateRequiredToOneRelationship({ operation, inputData, field: "activeBrokerage", addValidationError });
    }
  },
  access: {
    operation: {
      query: isSignedIn,
      update: isSignedIn,
      create: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadPeople,
      update: rules.canUpdatePeople
    }
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["name", "email", "role", "assignedLeads"]
    },
    itemView: {
      defaultFieldMode: ({ session, item }) => {
        if (session?.itemId === item?.id || session?.data?.role?.canEditOtherPeople) return "edit";
        return "read";
      }
    }
  },
  fields: {
    name: (0, import_fields19.text)({ validation: { isRequired: true } }),
    email: (0, import_fields19.text)({
      isFilterable: false,
      isOrderable: false,
      isIndexed: "unique",
      validation: { isRequired: true },
      // Self-service, or a people editor within the brokerage (list filter scopes the target).
      access: { update: ({ session, item }) => session?.itemId === item.id || Boolean(session?.data?.role?.canEditOtherPeople) }
    }),
    phone: (0, import_fields19.text)(),
    licenseNumber: (0, import_fields19.text)(),
    brokerageTitle: (0, import_fields19.text)(),
    bio: (0, import_fields19.text)({ ui: { displayMode: "textarea" } }),
    avatarUrl: (0, import_fields19.text)(),
    password: (0, import_fields19.password)({
      access: {
        read: import_access19.denyAll,
        update: ({ session, item }) => session?.itemId === item.id
      },
      validation: {
        length: { min: 10, max: 1e3 },
        isRequired: true,
        rejectCommon: true
      }
    }),
    role: (0, import_fields19.relationship)({
      ref: "Role.assignedTo",
      // Role managers who can edit people may re-role members of their active
      // brokerage (the list update filter scopes the target user).
      access: {
        create: import_access19.denyAll,
        update: ({ session, item }) => permissions.canManageRoles({ session }) && Boolean(session?.data?.role?.canEditOtherPeople) && session?.itemId !== item.id
      },
      ui: {
        itemView: {
          fieldMode: ({ session }) => permissions.canManageRoles({ session }) && session?.data?.role?.canEditOtherPeople ? "edit" : "read"
        }
      }
    }),
    // Inverse writes bypass the related list's update access and hooks in Keystone.
    // Assignments and immutable evidence may only be linked by controlled commands.
    assignedProperties: (0, import_fields19.relationship)({ ref: "Property.assignedAgent", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    assignedLeads: (0, import_fields19.relationship)({ ref: "Lead.assignedAgent", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    assignedShowings: (0, import_fields19.relationship)({ ref: "Showing.assignedAgent", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    assignedDeals: (0, import_fields19.relationship)({ ref: "Deal.assignedAgent", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    leadRoutingRules: (0, import_fields19.relationship)({ ref: "LeadRoutingRule.assignedAgent", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    customerShowings: (0, import_fields19.relationship)({ ref: "Showing.customer", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    customerInquiries: (0, import_fields19.relationship)({ ref: "LeadActivity.customer", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    savedProperties: (0, import_fields19.relationship)({ ref: "SavedProperty.user", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    practitionerLicenseAuthorities: (0, import_fields19.relationship)({ ref: "PractitionerLicenseAuthority.practitioner", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    verifiedPractitionerLicenses: (0, import_fields19.relationship)({ ref: "PractitionerLicenseAuthority.verifiedBy", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    listingEngagementAuthorities: (0, import_fields19.relationship)({ ref: "ListingEngagementAuthority.assignedPractitioner", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    recordedListingEngagementAuthorities: (0, import_fields19.relationship)({ ref: "ListingEngagementAuthority.recordedBy", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    recordedListingPublicationAuthorities: (0, import_fields19.relationship)({ ref: "ListingPublicationAuthority.recordedBy", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    representationAuthorities: (0, import_fields19.relationship)({ ref: "RepresentationAuthority.practitioner", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    recordedRepresentationAuthorities: (0, import_fields19.relationship)({ ref: "RepresentationAuthority.recordedBy", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    recordedDocumentEvidenceEvents: (0, import_fields19.relationship)({ ref: "DocumentEvidenceEvent.actor", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    commissionLedgerEntries: (0, import_fields19.relationship)({ ref: "CommissionLedgerEntry.payeeUser", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    preparedCommissionLedgerEntries: (0, import_fields19.relationship)({ ref: "CommissionLedgerEntry.preparedBy", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    approvedCommissionLedgerEntries: (0, import_fields19.relationship)({ ref: "CommissionLedgerEntry.approvedBy", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    approvedRetentionPolicies: (0, import_fields19.relationship)({ ref: "RetentionPolicy.approvedBy", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    recordedTransactionFileEvents: (0, import_fields19.relationship)({ ref: "TransactionFileEvent.actor", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    approvedTransactionFileEvents: (0, import_fields19.relationship)({ ref: "TransactionFileEvent.approvedBy", many: true, access: { create: import_access19.denyAll, update: import_access19.denyAll } }),
    activeBrokerage: (0, import_fields19.relationship)({
      ref: "Brokerage.activeUsers",
      access: { create: () => false, update: () => false },
      ui: { itemView: { fieldMode: "read" } }
    }),
    brokerageMemberships: (0, import_fields19.relationship)({
      ref: "BrokerageMembership.user",
      many: true,
      access: {
        create: () => false,
        update: () => false
      }
    }),
    onboardingStatus: (0, import_fields19.select)({
      type: "enum",
      options: [
        { label: "Not Started", value: "not_started" },
        { label: "In Progress", value: "in_progress" },
        { label: "Completed", value: "completed" },
        { label: "Dismissed", value: "dismissed" }
      ],
      defaultValue: "not_started",
      // Users may record their own setup progress; nobody else's.
      access: { create: () => false, update: ({ session, item }) => session?.itemId === item.id },
      ui: { description: "Brokerage onboarding progress." }
    }),
    ...trackingFields
  }
});

// features/keystone/models/Role.ts
var import_core18 = require("@keystone-6/core");
var import_fields20 = require("@keystone-6/core/fields");
var Role = (0, import_core18.list)({
  access: {
    operation: {
      query: isOperator,
      create: permissions.canManageRoles,
      update: permissions.canManageRoles,
      delete: permissions.canManageRoles
    }
  },
  ui: {
    hideCreate: (args) => !permissions.canManageRoles(args),
    hideDelete: (args) => !permissions.canManageRoles(args),
    isHidden: (args) => !permissions.canManageRoles(args),
    listView: {
      initialColumns: ["name", "canAccessDashboard", "canManageListings", "canManageLeads", "assignedTo"]
    }
  },
  fields: {
    name: (0, import_fields20.text)({ validation: { isRequired: true } }),
    canSeeOtherPeople: (0, import_fields20.checkbox)({ defaultValue: false }),
    canEditOtherPeople: (0, import_fields20.checkbox)({ defaultValue: false }),
    canManagePeople: (0, import_fields20.checkbox)({ defaultValue: false }),
    canManageRoles: (0, import_fields20.checkbox)({ defaultValue: false }),
    canAccessDashboard: (0, import_fields20.checkbox)({ defaultValue: false }),
    canManageListings: (0, import_fields20.checkbox)({ defaultValue: false }),
    canManageLeads: (0, import_fields20.checkbox)({ defaultValue: false }),
    canManageShowings: (0, import_fields20.checkbox)({ defaultValue: false }),
    canManageDeals: (0, import_fields20.checkbox)({ defaultValue: false }),
    canViewReports: (0, import_fields20.checkbox)({ defaultValue: false }),
    canManageOnboarding: (0, import_fields20.checkbox)({ defaultValue: false }),
    assignedTo: (0, import_fields20.relationship)({
      ref: "User.role",
      many: true,
      // Assign roles from the user record, where brokerage scoping applies.
      access: { create: () => false, update: () => false },
      ui: { itemView: { fieldMode: "read" }, createView: { fieldMode: "hidden" } }
    }),
    ...trackingFields
  }
});

// features/keystone/models/Property.ts
var import_core19 = require("@keystone-6/core");
var import_fields21 = require("@keystone-6/core/fields");

// features/lib/real-estate-images.ts
var PROPERTY_IMAGE_PATHS = {};
var AGENT_IMAGE_PATHS = {
  "maya.chen@example.realestate.local": "/images/real-estate/photos/agents/maya-chen.jpg",
  "omar.patel@example.realestate.local": "/images/real-estate/photos/agents/omar-patel.jpg",
  "evelyn.brooks@example.realestate.local": "/images/real-estate/photos/agents/evelyn-brooks.jpg"
};
var NEIGHBORHOOD_IMAGE_PATHS = {
  "rainey street historic district": "/images/real-estate/photos/neighborhoods/rainey-street.jpg",
  // No starter photo of the area itself; the tile renders plain rather than repeat a listing photo.
  "westlake hills": "",
  "east cesar chavez": "/images/real-estate/photos/neighborhoods/east-cesar-chavez.jpg",
  mueller: "/images/real-estate/photos/neighborhood-homes.jpg"
};
function getPropertyImagePath(listing) {
  if (listing.publicImagePack?.propertyImagePath) return listing.publicImagePack.propertyImagePath;
  if (listing.primaryImageUrl) return listing.primaryImageUrl;
  return listing.slug ? PROPERTY_IMAGE_PATHS[listing.slug] : void 0;
}
function getAgentImagePath(agent, publicImagePack) {
  if (publicImagePack?.agentImagePath) return publicImagePack.agentImagePath;
  if (!agent) return void 0;
  if (agent.avatarUrl) return agent.avatarUrl;
  return agent.email ? AGENT_IMAGE_PATHS[agent.email.toLowerCase()] : void 0;
}
function getNeighborhoodImagePath(neighborhood, publicImagePack) {
  if (publicImagePack?.neighborhoodImagePath) return publicImagePack.neighborhoodImagePath;
  if (!neighborhood) return void 0;
  return NEIGHBORHOOD_IMAGE_PATHS[neighborhood.trim().toLowerCase()];
}
var LEGACY_NEIGHBORHOOD_PHOTOS = {
  "rainey-street": "neighborhoods/rainey-street",
  "east-cesar-chavez": "neighborhoods/east-cesar-chavez",
  mueller: "neighborhood-homes"
};
function upgradeLegacyImagePath(path2) {
  const match = /^\/images\/real-estate\/(properties|agents|neighborhoods)\/([a-z0-9-]+)\.svg$/.exec(path2);
  if (!match) return path2;
  const [, kind, name] = match;
  if (kind === "properties") return `/images/real-estate/photos/${name}.jpg`;
  if (kind === "agents") return `/images/real-estate/photos/agents/${name}.jpg`;
  return LEGACY_NEIGHBORHOOD_PHOTOS[name] ? `/images/real-estate/photos/${LEGACY_NEIGHBORHOOD_PHOTOS[name]}.jpg` : path2;
}

// features/keystone/models/Property.ts
var Property = (0, import_core19.list)({
  access: {
    operation: {
      query: permissions.canManageListings,
      create: permissions.canManageBrokerageListings,
      update: permissions.canManageListings,
      delete: () => false
    },
    filter: {
      query: rules.canAccessBrokerageRecords,
      update: rules.canManageAssignedProperties
    },
    item: { create: canCreateInActiveBrokerage, update: canMoveToActiveBrokerage }
  },
  hooks: createTenantOwnedHooks({ listKey: "Property", users: ["assignedAgent"], protectDelete: true }),
  ui: {
    hideDelete: true,
    listView: {
      initialColumns: ["title", "status", "listingType", "city", "price", "assignedAgent"]
    }
  },
  fields: {
    brokerage: (0, import_fields21.relationship)({ ref: "Brokerage.properties", access: { update: () => false } }),
    title: (0, import_fields21.text)({ validation: { isRequired: true } }),
    slug: (0, import_fields21.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    status: (0, import_fields21.select)({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Coming Soon", value: "coming_soon" },
        { label: "Active", value: "active" },
        { label: "Pending", value: "pending" },
        { label: "Sold", value: "sold" },
        { label: "Rented", value: "rented" },
        { label: "Off Market", value: "off_market" }
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
      access: { create: () => false, update: () => false }
    }),
    listingType: (0, import_fields21.select)({
      type: "enum",
      options: [
        { label: "For Sale", value: "sale" },
        { label: "For Rent", value: "rent" }
      ],
      defaultValue: "sale",
      validation: { isRequired: true }
    }),
    propertyType: (0, import_fields21.select)({
      type: "enum",
      options: [
        { label: "House", value: "house" },
        { label: "Condo", value: "condo" },
        { label: "Townhome", value: "townhome" },
        { label: "Multi-Family", value: "multi_family" },
        { label: "Land", value: "land" },
        { label: "Commercial", value: "commercial" }
      ],
      defaultValue: "house"
    }),
    shortDescription: (0, import_fields21.text)({ ui: { displayMode: "textarea" } }),
    description: (0, import_fields21.text)({ ui: { displayMode: "textarea" } }),
    addressLine1: (0, import_fields21.text)({ validation: { isRequired: true } }),
    addressLine2: (0, import_fields21.text)(),
    city: (0, import_fields21.text)({ validation: { isRequired: true } }),
    state: (0, import_fields21.text)({ validation: { isRequired: true } }),
    postalCode: (0, import_fields21.text)(),
    neighborhood: (0, import_fields21.text)(),
    latitude: (0, import_fields21.decimal)({ precision: 10, scale: 7 }),
    longitude: (0, import_fields21.decimal)({ precision: 10, scale: 7 }),
    price: money({ precision: 12, scale: 2, validation: { isRequired: true }, defaultValue: "0.00" }),
    bedrooms: (0, import_fields21.integer)({ validation: { min: 0 }, defaultValue: 0 }),
    bathrooms: (0, import_fields21.decimal)({ precision: 4, scale: 1, defaultValue: "0.0" }),
    squareFeet: (0, import_fields21.integer)({ validation: { min: 0 } }),
    lotSizeSquareFeet: (0, import_fields21.integer)({ validation: { min: 0 } }),
    yearBuilt: (0, import_fields21.integer)(),
    hoaFee: money({ precision: 10, scale: 2 }),
    availableAt: (0, import_fields21.timestamp)(),
    isFeatured: (0, import_fields21.checkbox)({ defaultValue: false }),
    virtualTourUrl: (0, import_fields21.text)(),
    // Rental terms; shown on the storefront for listings with listingType "rent".
    leaseTerm: (0, import_fields21.text)({ ui: { description: "For rentals, e.g. 12 months" } }),
    securityDeposit: (0, import_fields21.integer)({ validation: { min: 0 }, ui: { description: "For rentals, in whole dollars" } }),
    petPolicy: (0, import_fields21.text)({ ui: { description: "For rentals, e.g. Cats and small dogs allowed" } }),
    // Set by the brokerage per rental listing (minor units, e.g. 5500 = $55.00). Empty means no fee is collected.
    applicationFeeMinor: (0, import_fields21.integer)({ validation: { min: 1, max: 1e5 }, ui: { description: "For rentals: application fee in cents. Leave empty for no fee. Check your state's screening-fee cap." } }),
    primaryImageUrl: (0, import_fields21.text)(),
    assignedAgent: (0, import_fields21.relationship)({ ref: "User.assignedProperties", access: { create: permissions.canManagePeople, update: permissions.canManagePeople } }),
    leads: (0, import_fields21.relationship)({ ref: "Lead.property", many: true, access: { create: () => false, update: () => false } }),
    showings: (0, import_fields21.relationship)({ ref: "Showing.property", many: true, access: { create: () => false, update: () => false } }),
    payments: (0, import_fields21.relationship)({ ref: "Payment.property", many: true, access: { create: () => false, update: () => false } }),
    savedBy: (0, import_fields21.relationship)({ ref: "SavedProperty.property", many: true, access: { create: () => false, update: () => false } }),
    listingEngagementAuthorities: (0, import_fields21.relationship)({ ref: "ListingEngagementAuthority.property", many: true, access: { create: () => false, update: () => false } }),
    listingPublicationAuthorities: (0, import_fields21.relationship)({ ref: "ListingPublicationAuthority.property", many: true, access: { create: () => false, update: () => false } }),
    representationAuthorities: (0, import_fields21.relationship)({ ref: "RepresentationAuthority.property", many: true, access: { create: () => false, update: () => false } }),
    addressLabel: (0, import_fields21.virtual)({
      field: import_core19.graphql.field({
        type: import_core19.graphql.String,
        resolve(item) {
          return [item.addressLine1, item.city, item.state].filter(Boolean).join(", ");
        }
      })
    }),
    publicImagePack: (0, import_fields21.virtual)({
      field: import_core19.graphql.field({
        type: import_core19.graphql.object()({
          name: "PropertyPublicImagePack",
          fields: {
            propertyImagePath: import_core19.graphql.field({ type: import_core19.graphql.String, resolve: (item) => item.propertyImagePath }),
            agentImagePath: import_core19.graphql.field({ type: import_core19.graphql.String, resolve: (item) => item.agentImagePath }),
            neighborhoodImagePath: import_core19.graphql.field({ type: import_core19.graphql.String, resolve: (item) => item.neighborhoodImagePath })
          }
        }),
        async resolve(item, _args, context) {
          const property = await context.sudo().query.Property.findOne({
            where: { id: item.id },
            query: "slug primaryImageUrl neighborhood assignedAgent { email avatarUrl }"
          });
          return {
            propertyImagePath: getPropertyImagePath(property || item),
            agentImagePath: getAgentImagePath(property?.assignedAgent),
            neighborhoodImagePath: getNeighborhoodImagePath(property?.neighborhood || item.neighborhood)
          };
        }
      }),
      ui: { query: "{ propertyImagePath agentImagePath neighborhoodImagePath }" }
    }),
    ...trackingFields
  }
});

// features/keystone/models/Lead.ts
var import_core20 = require("@keystone-6/core");
var import_fields22 = require("@keystone-6/core/fields");
var Lead = (0, import_core20.list)({
  access: {
    operation: {
      query: permissions.canReadLeads,
      create: permissions.canManageBrokerageTasks,
      update: permissions.canManageLeads,
      delete: () => false
    },
    filter: {
      query: rules.canReadLeads,
      update: rules.canManageAssignedLeads
    },
    item: { create: canCreateInActiveBrokerage, update: canMoveToActiveBrokerage }
  },
  hooks: withRecordInvariants(createTenantOwnedHooks({
    listKey: "Lead",
    parents: { property: "Property" },
    users: ["assignedAgent"],
    teams: ["assignedTeam"],
    protectDelete: true
  }), [moneyOrder("budgetMin", "budgetMax", "The minimum budget cannot be more than the maximum budget.")]),
  ui: {
    hideDelete: true,
    hideCreate: (args) => !permissions.canManageBrokerageTasks(args),
    listView: {
      initialColumns: ["name", "status", "intent", "property", "assignedAgent", "lastContactedAt"]
    }
  },
  fields: {
    brokerage: (0, import_fields22.relationship)({ ref: "Brokerage.leads", access: { update: () => false } }),
    name: (0, import_fields22.text)({ validation: { isRequired: true } }),
    identityKey: (0, import_fields22.text)({
      isIndexed: true,
      access: {
        create: () => false,
        update: () => false
      },
      ui: { itemView: { fieldMode: "read" } }
    }),
    email: (0, import_fields22.text)(),
    phone: (0, import_fields22.text)(),
    status: (0, import_fields22.select)({
      type: "enum",
      options: [
        { label: "New", value: "new" },
        { label: "Attempted Contact", value: "attempted_contact" },
        { label: "Qualified", value: "qualified" },
        { label: "Tour Scheduled", value: "tour_scheduled" },
        { label: "Offer", value: "offer" },
        { label: "Closed", value: "closed" },
        { label: "Lost", value: "lost" }
      ],
      defaultValue: "new",
      validation: { isRequired: true },
      access: { create: () => false, update: () => false }
    }),
    intent: (0, import_fields22.select)({
      type: "enum",
      options: [
        { label: "Buy", value: "buy" },
        { label: "Rent", value: "rent" },
        { label: "Sell", value: "sell" },
        { label: "Invest", value: "invest" },
        { label: "Unknown", value: "unknown" }
      ],
      defaultValue: "unknown"
    }),
    source: (0, import_fields22.select)({
      type: "enum",
      options: [
        { label: "Website", value: "website" },
        { label: "Zillow", value: "zillow" },
        { label: "Referral", value: "referral" },
        { label: "Open House", value: "open_house" },
        { label: "Phone", value: "phone" },
        { label: "Import", value: "import" }
      ],
      defaultValue: "website"
    }),
    budgetMin: money({ precision: 12, legacyText: true }),
    budgetMax: money({ precision: 12, legacyText: true }),
    preferredLocation: (0, import_fields22.text)(),
    timeline: (0, import_fields22.text)(),
    message: (0, import_fields22.text)({ ui: { displayMode: "textarea" } }),
    lastContactedAt: (0, import_fields22.timestamp)({ access: { create: () => false, update: () => false } }),
    property: (0, import_fields22.relationship)({ ref: "Property.leads", access: { update: () => false } }),
    assignedAgent: (0, import_fields22.relationship)({ ref: "User.assignedLeads", access: { create: permissions.canManagePeople, update: permissions.canManagePeople } }),
    assignedTeam: (0, import_fields22.relationship)({ ref: "AgentTeam.leads", access: { create: permissions.canManagePeople, update: permissions.canManagePeople } }),
    showings: (0, import_fields22.relationship)({ ref: "Showing.lead", many: true, access: { create: () => false, update: () => false } }),
    activities: (0, import_fields22.relationship)({ ref: "LeadActivity.lead", many: true, access: { create: () => false, update: () => false } }),
    payments: (0, import_fields22.relationship)({ ref: "Payment.lead", many: true, access: { create: () => false, update: () => false } }),
    representationAuthorities: (0, import_fields22.relationship)({ ref: "RepresentationAuthority.lead", many: true, access: { create: () => false, update: () => false } }),
    displayLabel: (0, import_fields22.virtual)({
      field: import_core20.graphql.field({
        type: import_core20.graphql.String,
        resolve(item) {
          return `${item.name || "Lead"}${item.intent ? ` \xB7 ${item.intent}` : ""}`;
        }
      })
    }),
    ...trackingFields
  }
});

// features/keystone/models/Showing.ts
var import_core21 = require("@keystone-6/core");
var import_fields23 = require("@keystone-6/core/fields");
var Showing = (0, import_core21.list)({
  access: {
    operation: {
      query: permissions.canReadShowings,
      create: permissions.canManageBrokerageShowings,
      update: permissions.canManageShowings,
      delete: () => false
    },
    filter: {
      query: rules.canReadShowings,
      update: rules.canManageAssignedShowings
    },
    item: { create: canCreateInActiveBrokerage, update: canMoveToActiveBrokerage }
  },
  hooks: withRecordInvariants(createTenantOwnedHooks({
    listKey: "Showing",
    parents: { property: "Property", lead: "Lead" },
    users: ["assignedAgent"],
    required: ["property", "lead"],
    protectDelete: true
  }), [timeOrder("scheduledStart", "scheduledEnd", "The showing must end after it starts.")]),
  ui: {
    hideDelete: true,
    hideCreate: (args) => !permissions.canManageBrokerageShowings(args),
    listView: {
      initialColumns: ["property", "lead", "status", "scheduledStart", "assignedAgent"]
    }
  },
  fields: {
    brokerage: (0, import_fields23.relationship)({ ref: "Brokerage.showings", access: { update: () => false } }),
    status: (0, import_fields23.select)({
      type: "enum",
      options: [
        { label: "Requested", value: "requested" },
        { label: "Scheduled", value: "scheduled" },
        { label: "Completed", value: "completed" },
        { label: "No Show", value: "no_show" },
        { label: "Cancelled", value: "cancelled" }
      ],
      defaultValue: "requested",
      validation: { isRequired: true },
      access: { create: () => false, update: () => false }
    }),
    customer: (0, import_fields23.relationship)({ ref: "User.customerShowings", access: { create: () => false, update: () => false } }),
    requestSnapshot: (0, import_fields23.json)({ access: { create: () => false, update: () => false } }),
    showingType: (0, import_fields23.select)({
      type: "enum",
      options: [
        { label: "In Person", value: "in_person" },
        { label: "Virtual", value: "virtual" },
        { label: "Open House", value: "open_house" }
      ],
      defaultValue: "in_person"
    }),
    // Schedule changes must use a controlled command with authority and slot validation.
    scheduledStart: (0, import_fields23.timestamp)({ validation: { isRequired: true }, access: { update: () => false } }),
    scheduledEnd: (0, import_fields23.timestamp)({ access: { update: () => false } }),
    notes: (0, import_fields23.text)({ ui: { displayMode: "textarea" } }),
    feedback: (0, import_fields23.text)({ ui: { displayMode: "textarea" } }),
    property: (0, import_fields23.relationship)({ ref: "Property.showings", access: { update: () => false } }),
    lead: (0, import_fields23.relationship)({ ref: "Lead.showings", access: { update: () => false } }),
    assignedAgent: (0, import_fields23.relationship)({ ref: "User.assignedShowings", access: { create: permissions.canManagePeople, update: () => false } }),
    displayLabel: (0, import_fields23.virtual)({
      field: import_core21.graphql.field({
        type: import_core21.graphql.String,
        resolve(item) {
          return `${item.showingType || "showing"} \xB7 ${item.status || "requested"}`;
        }
      })
    }),
    ...trackingFields
  }
});

// features/keystone/models/Deal.ts
var import_core22 = require("@keystone-6/core");
var import_fields24 = require("@keystone-6/core/fields");
var Deal = (0, import_core22.list)({
  access: {
    operation: {
      query: permissions.canReadDeals,
      create: permissions.canManageBrokerageDeals,
      update: permissions.canManageDeals,
      delete: () => false
    },
    filter: {
      query: rules.canReadDeals,
      update: rules.canManageAssignedDeals
    },
    item: { create: canCreateInActiveBrokerage, update: canMoveToActiveBrokerage }
  },
  hooks: createTenantOwnedHooks({
    listKey: "Deal",
    parents: { property: "Property", lead: "Lead" },
    users: ["assignedAgent"],
    teams: ["assignedTeam"],
    required: ["property", "lead"],
    protectDelete: true
  }),
  ui: {
    hideDelete: true,
    listView: {
      initialColumns: ["title", "stage", "property", "lead", "assignedAgent", "expectedCloseDate"]
    }
  },
  fields: {
    brokerage: (0, import_fields24.relationship)({ ref: "Brokerage.deals", access: { update: () => false } }),
    title: (0, import_fields24.text)({ validation: { isRequired: true } }),
    stage: (0, import_fields24.select)({
      type: "enum",
      options: [
        { label: "Prospecting", value: "prospecting" },
        { label: "Active Search", value: "active_search" },
        { label: "Offer Drafted", value: "offer_drafted" },
        { label: "Under Contract", value: "under_contract" },
        { label: "Inspection", value: "inspection" },
        { label: "Financing", value: "financing" },
        { label: "Closed Won", value: "closed_won" },
        { label: "Closed Lost", value: "closed_lost" }
      ],
      defaultValue: "prospecting",
      validation: { isRequired: true },
      access: { create: () => false, update: () => false }
    }),
    transactionType: (0, import_fields24.select)({
      type: "enum",
      options: [
        { label: "Buyer", value: "buyer" },
        { label: "Seller", value: "seller" },
        { label: "Tenant", value: "tenant" },
        { label: "Landlord", value: "landlord" }
      ],
      defaultValue: "buyer"
    }),
    offerAmount: money({ precision: 12, scale: 2, access: { create: () => false, update: () => false } }),
    commissionAmount: money({ precision: 12, scale: 2, access: { create: () => false, update: () => false } }),
    expectedCloseDate: (0, import_fields24.timestamp)(),
    closedAt: (0, import_fields24.timestamp)({ access: { create: () => false, update: () => false } }),
    closedSnapshot: (0, import_fields24.json)({
      access: { create: () => false, update: () => false },
      ui: { itemView: { fieldMode: "read" }, createView: { fieldMode: "hidden" } }
    }),
    nextStep: (0, import_fields24.text)({ access: { update: () => false } }),
    notes: (0, import_fields24.text)({ ui: { displayMode: "textarea" } }),
    property: (0, import_fields24.relationship)({ ref: "Property", access: { update: () => false } }),
    lead: (0, import_fields24.relationship)({ ref: "Lead", access: { update: () => false } }),
    assignedAgent: (0, import_fields24.relationship)({ ref: "User.assignedDeals", access: { create: permissions.canManagePeople, update: permissions.canManagePeople } }),
    assignedTeam: (0, import_fields24.relationship)({ ref: "AgentTeam.deals", access: { create: permissions.canManagePeople, update: permissions.canManagePeople } }),
    payments: (0, import_fields24.relationship)({ ref: "Payment.deal", many: true, access: { create: () => false, update: () => false } }),
    representationAuthorities: (0, import_fields24.relationship)({ ref: "RepresentationAuthority.deal", many: true, access: { create: () => false, update: () => false } }),
    documentEvidenceEvents: (0, import_fields24.relationship)({ ref: "DocumentEvidenceEvent.deal", many: true, access: { create: () => false, update: () => false } }),
    commissionLedgerEntries: (0, import_fields24.relationship)({ ref: "CommissionLedgerEntry.deal", many: true, access: { create: () => false, update: () => false } }),
    transactionFileEvents: (0, import_fields24.relationship)({ ref: "TransactionFileEvent.deal", many: true, access: { create: () => false, update: () => false } }),
    displayLabel: (0, import_fields24.virtual)({
      field: import_core22.graphql.field({
        type: import_core22.graphql.String,
        resolve(item) {
          return `${item.title || "Deal"} \xB7 ${item.stage || "prospecting"}`;
        }
      })
    }),
    ...trackingFields
  }
});

// features/keystone/models/SavedProperty.ts
var import_core23 = require("@keystone-6/core");
var import_fields25 = require("@keystone-6/core/fields");
var SavedProperty = (0, import_core23.list)({
  // One row per pair; the generated index name matches migration 20261107120000.
  db: { extendPrismaSchema: (schema) => schema.replace(/\n\}\s*$/, `
  @@unique([userId, propertyId])
}`) },
  access: {
    operation: {
      query: isSignedIn,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadSavedProperties
    }
  },
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: {
      initialColumns: ["property", "user", "status", "notes"]
    }
  },
  fields: {
    status: (0, import_fields25.select)({
      type: "enum",
      options: [
        { label: "Saved", value: "saved" },
        { label: "Interested", value: "interested" },
        { label: "Hidden", value: "hidden" }
      ],
      defaultValue: "saved"
    }),
    notes: (0, import_fields25.text)({ ui: { displayMode: "textarea" } }),
    property: (0, import_fields25.relationship)({ ref: "Property.savedBy" }),
    user: (0, import_fields25.relationship)({ ref: "User.savedProperties" }),
    ...trackingFields
  }
});

// features/keystone/models/LeadActivity.ts
var import_core24 = require("@keystone-6/core");
var import_fields26 = require("@keystone-6/core/fields");
var LeadActivity = (0, import_core24.list)({
  access: {
    operation: {
      query: permissions.canReadLeadActivities,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadLeadActivities
    }
  },
  hooks: createTenantOwnedHooks({
    listKey: "LeadActivity",
    parents: { lead: "Lead", property: "Property", showing: "Showing" },
    users: ["agent"],
    required: ["lead"],
    protectDelete: true
  }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: {
      initialColumns: ["lead", "activityType", "direction", "channel", "occurredAt", "agent"]
    }
  },
  fields: {
    brokerage: (0, import_fields26.relationship)({ ref: "Brokerage.leadActivities" }),
    activityType: (0, import_fields26.select)({
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
        { label: "System", value: "system" }
      ],
      defaultValue: "note",
      validation: { isRequired: true }
    }),
    direction: (0, import_fields26.select)({
      type: "enum",
      options: [
        { label: "Inbound", value: "inbound" },
        { label: "Outbound", value: "outbound" },
        { label: "Internal", value: "internal" }
      ],
      defaultValue: "internal"
    }),
    channel: (0, import_fields26.select)({
      type: "enum",
      options: [
        { label: "Website", value: "website" },
        { label: "Phone", value: "phone" },
        { label: "Email", value: "email" },
        { label: "SMS", value: "sms" },
        { label: "In Person", value: "in_person" },
        { label: "CRM", value: "crm" }
      ],
      defaultValue: "crm"
    }),
    subject: (0, import_fields26.text)(),
    body: (0, import_fields26.text)({ ui: { displayMode: "textarea" } }),
    occurredAt: (0, import_fields26.timestamp)({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    lead: (0, import_fields26.relationship)({ ref: "Lead.activities" }),
    property: (0, import_fields26.relationship)({ ref: "Property" }),
    showing: (0, import_fields26.relationship)({ ref: "Showing" }),
    agent: (0, import_fields26.relationship)({ ref: "User" }),
    // The signed-in storefront account that sent this inquiry; set by the server only.
    customer: (0, import_fields26.relationship)({ ref: "User.customerInquiries", access: { create: () => false, update: () => false } }),
    displayLabel: (0, import_fields26.virtual)({
      field: import_core24.graphql.field({
        type: import_core24.graphql.String,
        resolve(item) {
          return `${item.activityType || "activity"}${item.subject ? ` \xB7 ${item.subject}` : ""}`;
        }
      })
    }),
    ...trackingFields
  }
});

// features/keystone/models/LeadRoutingRule.ts
var import_core25 = require("@keystone-6/core");
var import_fields27 = require("@keystone-6/core/fields");
var LeadRoutingRule = (0, import_core25.list)({
  access: {
    operation: {
      query: permissions.canReadLeads,
      create: permissions.canManageBrokerageTasks,
      update: permissions.canManageBrokerageTasks,
      delete: permissions.canManageBrokerageTasks
    },
    filter: {
      query: rules.canAccessBrokerageRecords,
      update: rules.canAccessBrokerageRecords,
      delete: rules.canAccessBrokerageRecords
    },
    item: { create: canCreateInActiveBrokerage, update: canMoveToActiveBrokerage }
  },
  hooks: createTenantOwnedHooks({
    listKey: "LeadRoutingRule",
    users: ["assignedAgent"],
    teams: ["assignedTeam"],
    requiredAny: ["assignedAgent", "assignedTeam"]
  }),
  ui: {
    listView: {
      initialColumns: ["name", "status", "priority", "intent", "city", "assignedAgent"]
    }
  },
  fields: {
    brokerage: (0, import_fields27.relationship)({ ref: "Brokerage.leadRoutingRules" }),
    name: (0, import_fields27.text)({ validation: { isRequired: true } }),
    status: (0, import_fields27.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Paused", value: "paused" }
      ],
      defaultValue: "active"
    }),
    priority: (0, import_fields27.integer)({ defaultValue: 100, validation: { min: 1, max: 999 } }),
    intent: (0, import_fields27.select)({
      type: "enum",
      options: [
        { label: "Any", value: "any" },
        { label: "Buy", value: "buy" },
        { label: "Rent", value: "rent" },
        { label: "Sell", value: "sell" },
        { label: "Invest", value: "invest" }
      ],
      defaultValue: "any"
    }),
    source: (0, import_fields27.select)({
      type: "enum",
      options: [
        { label: "Any", value: "any" },
        { label: "Website", value: "website" },
        { label: "Zillow", value: "zillow" },
        { label: "Referral", value: "referral" },
        { label: "Open House", value: "open_house" },
        { label: "Phone", value: "phone" },
        { label: "Import", value: "import" }
      ],
      defaultValue: "any"
    }),
    city: (0, import_fields27.text)({ ui: { description: "Optional city match. Leave blank for any city." } }),
    state: (0, import_fields27.text)({ ui: { description: "Optional state match. Leave blank for any state." } }),
    postalCode: (0, import_fields27.text)({ ui: { description: "Optional ZIP/postal match. Leave blank for any ZIP." } }),
    isFallback: (0, import_fields27.checkbox)({ defaultValue: false }),
    assignedAgent: (0, import_fields27.relationship)({ ref: "User.leadRoutingRules" }),
    assignedTeam: (0, import_fields27.relationship)({ ref: "AgentTeam.leadRoutingRules" }),
    displayLabel: (0, import_fields27.virtual)({
      field: import_core25.graphql.field({
        type: import_core25.graphql.String,
        resolve(item) {
          return `${item.name || "Routing rule"} \xB7 ${item.status || "active"}`;
        }
      })
    }),
    ...trackingFields
  }
});

// features/keystone/models/PropertyMedia.ts
var import_core26 = require("@keystone-6/core");
var import_fields28 = require("@keystone-6/core/fields");

// features/keystone/lib/propertyMediaSource.ts
function mediaSourceProblem({ imageId, url }) {
  if (imageId) return null;
  if (url && url.trim()) return null;
  return "Upload a photo or enter a link.";
}
function storedImageUrl(item) {
  const url = item.image?.url?.trim() || "";
  return /^https:\/\//.test(url) ? url : "";
}
function publicMediaImagePath(item, legacyPath) {
  return storedImageUrl(item) || legacyPath(item.url);
}
function publicHeroImagePath(media, primaryImagePath) {
  const cover = media.find((item) => item.mediaType === "photo" && item.isHero && storedImageUrl(item));
  return cover && storedImageUrl(cover) || primaryImagePath;
}

// features/keystone/models/PropertyMedia.ts
function withMediaSource(hooks) {
  return {
    ...hooks,
    async validateInput(args) {
      const { resolvedData, item, addValidationError } = args;
      const problem = mediaSourceProblem({
        imageId: resolvedData?.image?.id !== void 0 ? resolvedData.image.id : item?.image_id,
        url: resolvedData?.url !== void 0 ? resolvedData.url : item?.url
      });
      if (problem) addValidationError(problem);
      await hooks.validateInput?.(args);
    }
  };
}
function withSingleHero(hooks) {
  return {
    ...hooks,
    async beforeOperation(args) {
      await hooks.beforeOperation?.(args);
      const { operation, resolvedData, item, inputData, context } = args;
      if (operation !== "create" && operation !== "update" || resolvedData?.isHero !== true) return;
      const propertyId = item?.propertyId || inputData?.property?.connect?.id;
      if (!propertyId) return;
      const sudo = context.sudo();
      const others = await sudo.db.PropertyMedia.findMany({
        where: { property: { id: { equals: propertyId } }, isHero: { equals: true }, ...item?.id ? { id: { not: { equals: item.id } } } : {} }
      });
      for (const other of others) await sudo.db.PropertyMedia.updateOne({ where: { id: String(other.id) }, data: { isHero: false } });
    }
  };
}
var PropertyMedia = (0, import_core26.list)({
  access: {
    operation: {
      query: permissions.canManageListings,
      create: permissions.canManageListings,
      update: permissions.canManageListings,
      delete: permissions.canManageListings
    },
    filter: { query: rules.canReadPropertyChildren, update: rules.canManagePropertyChildren, delete: rules.canManagePropertyChildren },
    item: { create: canCreateForManagedProperty }
  },
  hooks: withSingleHero(withMediaSource(createTenantOwnedHooks({ listKey: "PropertyMedia", parents: { property: "Property" }, required: ["property"], deriveOnly: true }))),
  ui: { listView: { initialColumns: ["image", "title", "mediaType", "property", "sortOrder", "isHero"] } },
  fields: {
    title: (0, import_fields28.text)({ validation: { isRequired: true } }),
    mediaType: (0, import_fields28.select)({
      type: "enum",
      options: [
        { label: "Photo", value: "photo" },
        { label: "Floor Plan", value: "floor_plan" },
        { label: "Virtual Tour", value: "virtual_tour" },
        { label: "Video", value: "video" },
        { label: "Document", value: "document" }
      ],
      defaultValue: "photo",
      validation: { isRequired: true }
    }),
    // An uploaded photo lives in S3; `url` remains for tours, videos, documents and older photos.
    image: (0, import_fields28.image)({ storage: "my_images" }),
    url: (0, import_fields28.text)(),
    altText: (0, import_fields28.text)(),
    caption: (0, import_fields28.text)({ ui: { displayMode: "textarea" } }),
    sortOrder: (0, import_fields28.integer)({ defaultValue: 0 }),
    isHero: (0, import_fields28.checkbox)({ defaultValue: false }),
    property: (0, import_fields28.relationship)({ ref: "Property", access: { update: () => false } }),
    ...trackingFields
  }
});

// features/keystone/models/PropertyInspection.ts
var import_core27 = require("@keystone-6/core");
var import_fields29 = require("@keystone-6/core/fields");
var PropertyInspection = (0, import_core27.list)({
  access: {
    operation: {
      query: permissions.canReadDeals,
      create: permissions.canManageBrokerageDeals,
      update: permissions.canManageDeals,
      delete: () => false
    },
    filter: { query: rules.canReadDealChildren, update: rules.canReadDealChildren },
    item: { create: canCreateForActiveDeal }
  },
  hooks: createTenantOwnedHooks({ listKey: "PropertyInspection", parents: { deal: "Deal", property: "Property" }, required: ["deal", "property"], coherentWith: { field: "deal", listKey: "Deal", matches: { property: "property" } }, deriveOnly: true, protectDelete: true }),
  ui: {
    hideDelete: true,
    listView: { initialColumns: ["title", "inspectionType", "status", "property", "scheduledAt"] }
  },
  fields: {
    title: (0, import_fields29.text)({ validation: { isRequired: true } }),
    inspectionType: (0, import_fields29.select)({
      type: "enum",
      options: [
        { label: "General", value: "general" },
        { label: "Pest", value: "pest" },
        { label: "Roof", value: "roof" },
        { label: "Appraisal", value: "appraisal" },
        { label: "Final Walkthrough", value: "walkthrough" }
      ],
      defaultValue: "general"
    }),
    status: (0, import_fields29.select)({
      type: "enum",
      options: [
        { label: "Scheduled", value: "scheduled" },
        { label: "Completed", value: "completed" },
        { label: "Needs Follow-up", value: "needs_follow_up" },
        { label: "Waived", value: "waived" }
      ],
      defaultValue: "scheduled",
      access: { create: () => false, update: () => false }
    }),
    scheduledAt: (0, import_fields29.timestamp)(),
    completedAt: (0, import_fields29.timestamp)({ access: { create: () => false, update: () => false } }),
    inspectorName: (0, import_fields29.text)(),
    inspectorEmail: (0, import_fields29.text)(),
    estimatedCost: money({ precision: 10, scale: 2 }),
    summary: (0, import_fields29.text)({ ui: { displayMode: "textarea" } }),
    findings: (0, import_fields29.text)({ ui: { displayMode: "textarea" } }),
    property: (0, import_fields29.relationship)({ ref: "Property", access: { update: () => false } }),
    deal: (0, import_fields29.relationship)({ ref: "Deal", access: { update: () => false } }),
    ...trackingFields
  }
});

// features/keystone/models/Offer.ts
var import_core28 = require("@keystone-6/core");
var import_fields30 = require("@keystone-6/core/fields");
var Offer = (0, import_core28.list)({
  access: {
    operation: {
      query: permissions.canReadSensitiveDeals,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: rules.canReadDeals }
  },
  hooks: withRecordInvariants(createTenantOwnedHooks({
    listKey: "Offer",
    parents: { deal: "Deal", property: "Property", lead: "Lead", parentOffer: "Offer" },
    users: ["assignedAgent"],
    required: ["deal", "property", "lead"],
    coherentWith: { field: "deal", listKey: "Deal", matches: { property: "property", lead: "lead" } },
    protectDelete: true
  }), [moneyOrder("earnestMoney", "amount", "Earnest money cannot be more than the offer amount.")]),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["offerNumber", "status", "amount", "property", "deal", "submittedAt"] }
  },
  fields: {
    brokerage: (0, import_fields30.relationship)({ ref: "Brokerage.offers" }),
    offerNumber: (0, import_fields30.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    version: (0, import_fields30.integer)({ defaultValue: 1, validation: { isRequired: true, min: 1 }, access: { create: () => false, update: () => false } }),
    parentOffer: (0, import_fields30.relationship)({ ref: "Offer.counterOffers" }),
    counterOffers: (0, import_fields30.relationship)({ ref: "Offer.parentOffer", many: true, access: { create: () => false, update: () => false } }),
    status: (0, import_fields30.select)({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Submitted", value: "submitted" },
        { label: "Countered", value: "countered" },
        { label: "Accepted", value: "accepted" },
        { label: "Rejected", value: "rejected" },
        { label: "Withdrawn", value: "withdrawn" }
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
      access: { create: () => false, update: () => false }
    }),
    amount: money({ precision: 12, scale: 2, validation: { isRequired: true }, defaultValue: "0.00" }),
    earnestMoney: money({ precision: 12, scale: 2 }),
    financingType: (0, import_fields30.select)({
      type: "enum",
      options: [
        { label: "Cash", value: "cash" },
        { label: "Conventional", value: "conventional" },
        { label: "FHA", value: "fha" },
        { label: "VA", value: "va" },
        { label: "Other", value: "other" }
      ],
      defaultValue: "conventional"
    }),
    contingencies: (0, import_fields30.text)({ ui: { displayMode: "textarea" } }),
    submittedAt: (0, import_fields30.timestamp)(),
    responseDueAt: (0, import_fields30.timestamp)(),
    acceptedAt: (0, import_fields30.timestamp)({ access: { create: () => false, update: () => false } }),
    acceptedSnapshot: (0, import_fields30.json)({
      access: { create: () => false, update: () => false },
      ui: { itemView: { fieldMode: "read" }, createView: { fieldMode: "hidden" } }
    }),
    property: (0, import_fields30.relationship)({ ref: "Property" }),
    deal: (0, import_fields30.relationship)({ ref: "Deal" }),
    lead: (0, import_fields30.relationship)({ ref: "Lead" }),
    assignedAgent: (0, import_fields30.relationship)({ ref: "User" }),
    documentEvidenceEvents: (0, import_fields30.relationship)({ ref: "DocumentEvidenceEvent.offer", many: true, access: { create: () => false, update: () => false } }),
    displayLabel: (0, import_fields30.virtual)({ field: import_core28.graphql.field({ type: import_core28.graphql.String, resolve: (item) => `${item.offerNumber || "Offer"} \xB7 ${item.status || "draft"}` }) }),
    ...trackingFields
  }
});

// features/keystone/models/DealDocument.ts
var import_core29 = require("@keystone-6/core");
var import_fields31 = require("@keystone-6/core/fields");
var DealDocument = (0, import_core29.list)({
  access: {
    operation: {
      query: permissions.canReadSensitiveDeals,
      create: permissions.canManageBrokerageDeals,
      update: () => false,
      delete: () => false
    },
    filter: { query: rules.canReadDealChildren },
    item: { create: canCreateInActiveBrokerage, update: canMoveToActiveBrokerage }
  },
  hooks: createTenantOwnedHooks({ listKey: "DealDocument", parents: { deal: "Deal", property: "Property" }, users: ["uploadedBy"], required: ["deal"], coherentWith: { field: "deal", listKey: "Deal", matches: { property: "property" } }, protectDelete: true }),
  ui: {
    hideDelete: true,
    listView: { initialColumns: ["title", "documentType", "status", "deal", "requiresSignature"] }
  },
  fields: {
    brokerage: (0, import_fields31.relationship)({ ref: "Brokerage", access: { update: () => false } }),
    title: (0, import_fields31.text)({ validation: { isRequired: true } }),
    documentType: (0, import_fields31.select)({
      type: "enum",
      options: [
        { label: "Listing Agreement", value: "listing_agreement" },
        { label: "Offer", value: "offer" },
        { label: "Disclosure", value: "disclosure" },
        { label: "Inspection Report", value: "inspection_report" },
        { label: "Closing Statement", value: "closing_statement" },
        { label: "Other", value: "other" }
      ],
      defaultValue: "other"
    }),
    status: (0, import_fields31.select)({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Sent", value: "sent" },
        { label: "Signed", value: "signed" },
        { label: "Archived", value: "archived" }
      ],
      defaultValue: "draft",
      access: { create: () => false, update: () => false }
    }),
    fileUrl: (0, import_fields31.text)({ validation: { isRequired: true } }),
    requiresSignature: (0, import_fields31.checkbox)({ defaultValue: false }),
    sentAt: (0, import_fields31.timestamp)(),
    signedAt: (0, import_fields31.timestamp)(),
    expiresAt: (0, import_fields31.timestamp)(),
    notes: (0, import_fields31.text)({ ui: { displayMode: "textarea" } }),
    deal: (0, import_fields31.relationship)({ ref: "Deal", access: { update: () => false } }),
    property: (0, import_fields31.relationship)({ ref: "Property", access: { update: () => false } }),
    uploadedBy: (0, import_fields31.relationship)({ ref: "User", access: { update: () => false } }),
    evidenceEvents: (0, import_fields31.relationship)({ ref: "DocumentEvidenceEvent.document", many: true, access: { create: () => false, update: () => false } }),
    transactionFileEvents: (0, import_fields31.relationship)({ ref: "TransactionFileEvent.document", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields
  }
});

// features/keystone/models/Commission.ts
var import_core30 = require("@keystone-6/core");
var import_fields32 = require("@keystone-6/core/fields");
var Commission = (0, import_core30.list)({
  access: {
    operation: {
      query: permissions.canReadSensitiveDeals,
      create: permissions.canManageBrokerageDeals,
      // Amounts feed the commission ledger; later changes go through ledger commands.
      update: () => false,
      delete: () => false
    },
    filter: { query: rules.canReadDeals },
    item: { create: canCreateForActiveDeal }
  },
  hooks: withDerivedCommissionNet(withRecordInvariants(createTenantOwnedHooks({
    listKey: "Commission",
    parents: { deal: "Deal", property: "Property" },
    users: ["agent"],
    required: ["deal", "property", "agent"],
    coherentWith: { field: "deal", listKey: "Deal", matches: { property: "property" } },
    protectDelete: true
  }), [commissionSplit])),
  ui: {
    hideDelete: true,
    hideCreate: (args) => !permissions.canManageBrokerageDeals(args),
    listView: { initialColumns: ["title", "status", "grossCommission", "netCommission", "agent", "deal"] }
  },
  fields: {
    brokerage: (0, import_fields32.relationship)({ ref: "Brokerage.commissions" }),
    title: (0, import_fields32.text)({ validation: { isRequired: true } }),
    status: (0, import_fields32.select)({
      type: "enum",
      options: [
        { label: "Projected", value: "projected" },
        { label: "Approved", value: "approved" },
        { label: "Paid", value: "paid" },
        { label: "Clawed Back", value: "clawed_back" }
      ],
      defaultValue: "projected",
      access: { create: () => false, update: () => false }
    }),
    side: (0, import_fields32.select)({
      type: "enum",
      options: [
        { label: "Listing", value: "listing" },
        { label: "Buyer", value: "buyer" },
        { label: "Referral", value: "referral" }
      ],
      defaultValue: "listing"
    }),
    grossCommission: money({ precision: 12, scale: 2, defaultValue: "0.00" }),
    brokerageSplitPercent: (0, import_fields32.decimal)({ precision: 5, scale: 2, defaultValue: "0.00" }),
    agentSplitPercent: (0, import_fields32.decimal)({ precision: 5, scale: 2, defaultValue: "0.00" }),
    netCommission: money({ precision: 12, scale: 2, defaultValue: "0.00" }),
    paidAt: (0, import_fields32.timestamp)({ access: { create: () => false, update: () => false } }),
    notes: (0, import_fields32.text)({ ui: { displayMode: "textarea" } }),
    deal: (0, import_fields32.relationship)({ ref: "Deal" }),
    property: (0, import_fields32.relationship)({ ref: "Property" }),
    agent: (0, import_fields32.relationship)({ ref: "User" }),
    ledgerEntries: (0, import_fields32.relationship)({ ref: "CommissionLedgerEntry.commission", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields
  }
});

// features/keystone/models/SavedSearch.ts
var import_core31 = require("@keystone-6/core");
var import_fields33 = require("@keystone-6/core/fields");
var SavedSearch = (0, import_core31.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: rules.canReadSavedSearches }
  },
  hooks: withRecordInvariants(createTenantOwnedHooks({ listKey: "SavedSearch", users: ["user"], required: ["user"], allowCustomers: true }), [moneyOrder("minPrice", "maxPrice", "The minimum price cannot be more than the maximum price.")]),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["name", "user", "city", "minPrice", "maxPrice", "alertsEnabled"] }
  },
  fields: {
    brokerage: (0, import_fields33.relationship)({ ref: "Brokerage" }),
    name: (0, import_fields33.text)({ validation: { isRequired: true } }),
    city: (0, import_fields33.text)(),
    state: (0, import_fields33.text)(),
    propertyType: (0, import_fields33.text)(),
    // "sale", "rent" or "" for both; validated by saveSearchForCurrentUser.
    listingType: (0, import_fields33.text)(),
    minPrice: money({ precision: 12, scale: 2 }),
    maxPrice: money({ precision: 12, scale: 2 }),
    minBedrooms: (0, import_fields33.integer)(),
    minBathrooms: (0, import_fields33.decimal)({ precision: 4, scale: 1 }),
    minSquareFeet: (0, import_fields33.integer)(),
    keywords: (0, import_fields33.text)(),
    alertsEnabled: (0, import_fields33.checkbox)({ defaultValue: true }),
    lastNotifiedAt: (0, import_fields33.timestamp)(),
    user: (0, import_fields33.relationship)({ ref: "User" }),
    ...trackingFields
  }
});

// features/keystone/models/MarketComp.ts
var import_core32 = require("@keystone-6/core");
var import_fields34 = require("@keystone-6/core/fields");
var MarketComp = (0, import_core32.list)({
  access: {
    operation: {
      query: permissions.canViewMarketIntelligence,
      create: permissions.canManageListings,
      update: permissions.canManageListings,
      delete: () => false
    },
    filter: { query: rules.canReadSubjectPropertyChildren, update: rules.canManageSubjectPropertyChildren },
    item: { create: canCreateForManagedSubjectProperty }
  },
  hooks: createTenantOwnedHooks({ listKey: "MarketComp", parents: { subjectProperty: "Property" }, required: ["subjectProperty"], deriveOnly: true, protectDelete: true }),
  ui: {
    hideDelete: true,
    listView: { initialColumns: ["addressLine1", "status", "salePrice", "soldAt", "subjectProperty"] }
  },
  fields: {
    addressLine1: (0, import_fields34.text)({ validation: { isRequired: true } }),
    city: (0, import_fields34.text)(),
    state: (0, import_fields34.text)(),
    postalCode: (0, import_fields34.text)(),
    status: (0, import_fields34.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Pending", value: "pending" },
        { label: "Sold", value: "sold" },
        { label: "Expired", value: "expired" }
      ],
      defaultValue: "sold"
    }),
    listPrice: money({ precision: 12, scale: 2 }),
    salePrice: money({ precision: 12, scale: 2 }),
    soldAt: (0, import_fields34.timestamp)(),
    bedrooms: (0, import_fields34.integer)(),
    bathrooms: (0, import_fields34.decimal)({ precision: 4, scale: 1 }),
    squareFeet: (0, import_fields34.integer)(),
    distanceMiles: (0, import_fields34.decimal)({ precision: 6, scale: 2 }),
    sourceUrl: (0, import_fields34.text)(),
    notes: (0, import_fields34.text)({ ui: { displayMode: "textarea" } }),
    subjectProperty: (0, import_fields34.relationship)({ ref: "Property", access: { update: () => false } }),
    neighborhood: (0, import_fields34.relationship)({ ref: "Neighborhood.marketComps" }),
    ...trackingFields
  }
});

// features/keystone/models/Neighborhood.ts
var import_core33 = require("@keystone-6/core");
var import_fields35 = require("@keystone-6/core/fields");
var Neighborhood = (0, import_core33.list)({
  access: {
    operation: {
      // Neighborhoods are shared market reference data (no brokerage owner).
      query: permissions.canViewMarketIntelligence,
      create: permissions.canManageBrokerageListings,
      update: permissions.canManageBrokerageListings,
      delete: () => false
    }
  },
  ui: {
    hideDelete: true,
    hideCreate: (args) => !permissions.canManageBrokerageListings(args),
    listView: { initialColumns: ["name", "city", "state", "medianSalePrice", "activeListings"] }
  },
  fields: {
    name: (0, import_fields35.text)({ validation: { isRequired: true } }),
    slug: (0, import_fields35.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    city: (0, import_fields35.text)({ validation: { isRequired: true } }),
    state: (0, import_fields35.text)({ validation: { isRequired: true } }),
    overview: (0, import_fields35.text)({ ui: { displayMode: "textarea" } }),
    schoolDistrict: (0, import_fields35.text)(),
    walkScore: (0, import_fields35.integer)(),
    transitScore: (0, import_fields35.integer)(),
    medianSalePrice: money({ precision: 12, scale: 2 }),
    medianRent: money({ precision: 12, scale: 2 }),
    activeListings: (0, import_fields35.integer)({ defaultValue: 0 }),
    averageDaysOnMarket: (0, import_fields35.integer)(),
    marketComps: (0, import_fields35.relationship)({ ref: "MarketComp.neighborhood", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields
  }
});

// features/keystone/models/AgentTeam.ts
var import_core34 = require("@keystone-6/core");
var import_fields36 = require("@keystone-6/core/fields");
var teamHooks = createTenantOwnedHooks({ listKey: "AgentTeam", users: ["leadAgent"], manyUsers: ["members"], protectDelete: true });
var AgentTeam = (0, import_core34.list)({
  access: {
    operation: {
      query: permissions.canManagePeople,
      create: permissions.canManagePeople,
      update: permissions.canManagePeople,
      delete: () => false
    },
    filter: {
      query: rules.canAccessBrokerageRecords,
      update: rules.canAccessBrokerageRecords
    },
    item: {
      create: canCreateInActiveBrokerage,
      update: canMoveToActiveBrokerage
    }
  },
  hooks: {
    resolveInput: teamHooks.resolveInput,
    validateInput: async (args) => {
      await teamHooks.validateInput(args);
      validateRequiredToOneRelationship({
        operation: args.operation,
        inputData: args.inputData,
        field: "brokerage",
        addValidationError: args.addValidationError
      });
    },
    beforeOperation: teamHooks.beforeOperation,
    afterOperation: teamHooks.afterOperation
  },
  ui: {
    hideDelete: true,
    listView: { initialColumns: ["name", "teamType", "status", "leadAgent"] }
  },
  fields: {
    brokerage: (0, import_fields36.relationship)({ ref: "Brokerage.teams", access: { update: () => false } }),
    name: (0, import_fields36.text)({ validation: { isRequired: true } }),
    slug: (0, import_fields36.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    teamType: (0, import_fields36.select)({
      type: "enum",
      options: [
        { label: "Listing", value: "listing" },
        { label: "Buyer", value: "buyer" },
        { label: "Rental", value: "rental" },
        { label: "Operations", value: "operations" }
      ],
      defaultValue: "listing"
    }),
    status: (0, import_fields36.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Paused", value: "paused" },
        { label: "Archived", value: "archived" }
      ],
      defaultValue: "active"
    }),
    description: (0, import_fields36.text)({ ui: { displayMode: "textarea" } }),
    leadAgent: (0, import_fields36.relationship)({ ref: "User" }),
    members: (0, import_fields36.relationship)({ ref: "User", many: true }),
    leads: (0, import_fields36.relationship)({ ref: "Lead.assignedTeam", many: true, access: { create: () => false, update: () => false } }),
    leadRoutingRules: (0, import_fields36.relationship)({ ref: "LeadRoutingRule.assignedTeam", many: true, access: { create: () => false, update: () => false } }),
    deals: (0, import_fields36.relationship)({ ref: "Deal.assignedTeam", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields
  }
});

// features/keystone/models/AgentTask.ts
var import_core35 = require("@keystone-6/core");
var import_fields37 = require("@keystone-6/core/fields");
var AgentTask = (0, import_core35.list)({
  access: {
    operation: {
      query: permissions.canReadLeads,
      create: permissions.canManageBrokerageTasks,
      update: permissions.canManageLeads,
      delete: () => false
    },
    filter: { query: rules.canReadAgentTasks, update: rules.canReadAgentTasks },
    item: { create: canCreateInActiveBrokerage, update: canMoveToActiveBrokerage }
  },
  hooks: createTenantOwnedHooks({ listKey: "AgentTask", parents: { property: "Property", lead: "Lead", deal: "Deal" }, users: ["assignedAgent"], protectDelete: true }),
  ui: {
    hideDelete: true,
    listView: { initialColumns: ["title", "status", "priority", "dueAt", "assignedAgent"] }
  },
  fields: {
    brokerage: (0, import_fields37.relationship)({ ref: "Brokerage", access: { update: () => false } }),
    title: (0, import_fields37.text)({ validation: { isRequired: true } }),
    status: (0, import_fields37.select)({
      type: "enum",
      options: [
        { label: "Open", value: "open" },
        { label: "In Progress", value: "in_progress" },
        { label: "Blocked", value: "blocked" },
        { label: "Done", value: "done" }
      ],
      defaultValue: "open",
      access: { create: () => false, update: () => false }
    }),
    priority: (0, import_fields37.select)({
      type: "enum",
      options: [
        { label: "Low", value: "low" },
        { label: "Normal", value: "normal" },
        { label: "High", value: "high" },
        { label: "Urgent", value: "urgent" }
      ],
      defaultValue: "normal"
    }),
    dueAt: (0, import_fields37.timestamp)(),
    completedAt: (0, import_fields37.timestamp)({ access: { create: () => false, update: () => false } }),
    notes: (0, import_fields37.text)({ ui: { displayMode: "textarea" } }),
    assignedAgent: (0, import_fields37.relationship)({ ref: "User", access: { create: permissions.canManagePeople, update: permissions.canManagePeople } }),
    property: (0, import_fields37.relationship)({ ref: "Property", access: { update: () => false } }),
    lead: (0, import_fields37.relationship)({ ref: "Lead", access: { update: () => false } }),
    deal: (0, import_fields37.relationship)({ ref: "Deal", access: { update: () => false } }),
    ...trackingFields
  }
});

// features/keystone/models/ListingEngagementAuthority.ts
var import_core36 = require("@keystone-6/core");
var import_fields38 = require("@keystone-6/core/fields");
var ListingEngagementAuthority = (0, import_core36.list)({
  access: {
    operation: { query: permissions.canManageListings, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords }
  },
  hooks: createTenantOwnedHooks({
    listKey: "ListingEngagementAuthority",
    parents: { property: "Property", supersedes: "ListingEngagementAuthority" },
    users: ["assignedPractitioner", "recordedBy"],
    required: ["property", "assignedPractitioner", "recordedBy"],
    protectDelete: true
  }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["authorityNumber", "property", "status", "effectiveFrom", "effectiveThrough"] }
  },
  fields: {
    brokerage: (0, import_fields38.relationship)({ ref: "Brokerage.listingEngagementAuthorities" }),
    authorityNumber: (0, import_fields38.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    property: (0, import_fields38.relationship)({ ref: "Property.listingEngagementAuthorities" }),
    assignedPractitioner: (0, import_fields38.relationship)({ ref: "User.listingEngagementAuthorities" }),
    status: (0, import_fields38.select)({
      type: "enum",
      options: [
        { label: "Executed", value: "executed" },
        { label: "Revoked", value: "revoked" },
        { label: "Expired", value: "expired" }
      ],
      validation: { isRequired: true }
    }),
    jurisdictionCode: (0, import_fields38.text)({ validation: { isRequired: true } }),
    effectiveFrom: (0, import_fields38.timestamp)({ validation: { isRequired: true } }),
    effectiveThrough: (0, import_fields38.timestamp)({ validation: { isRequired: true } }),
    exclusive: (0, import_fields38.checkbox)({ defaultValue: false }),
    marketingAuthorized: (0, import_fields38.checkbox)({ defaultValue: false }),
    showingAuthorized: (0, import_fields38.checkbox)({ defaultValue: false }),
    sellerPartySummary: (0, import_fields38.json)(),
    signatoryCapacity: (0, import_fields38.text)({ validation: { isRequired: true } }),
    documentSha256: (0, import_fields38.text)({ validation: { isRequired: true } }),
    documentProviderReference: (0, import_fields38.text)(),
    supersedes: (0, import_fields38.relationship)({ ref: "ListingEngagementAuthority.supersededBy" }),
    supersededBy: (0, import_fields38.relationship)({ ref: "ListingEngagementAuthority.supersedes", many: true }),
    reason: (0, import_fields38.text)({ validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    recordedBy: (0, import_fields38.relationship)({ ref: "User.recordedListingEngagementAuthorities" }),
    recordedAt: (0, import_fields38.timestamp)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});

// features/keystone/models/ListingPublicationAuthority.ts
var import_core37 = require("@keystone-6/core");
var import_fields39 = require("@keystone-6/core/fields");
var ListingPublicationAuthority = (0, import_core37.list)({
  access: {
    operation: { query: permissions.canManageListings, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords }
  },
  hooks: createTenantOwnedHooks({
    listKey: "ListingPublicationAuthority",
    parents: { property: "Property", engagement: "ListingEngagementAuthority", supersedes: "ListingPublicationAuthority" },
    users: ["recordedBy"],
    required: ["property", "engagement", "recordedBy"],
    coherentWith: { field: "engagement", listKey: "ListingEngagementAuthority", matches: { property: "property" } },
    protectDelete: true
  }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["authorityNumber", "property", "destination", "status", "effectiveFrom", "effectiveThrough"] }
  },
  fields: {
    brokerage: (0, import_fields39.relationship)({ ref: "Brokerage.listingPublicationAuthorities" }),
    authorityNumber: (0, import_fields39.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    property: (0, import_fields39.relationship)({ ref: "Property.listingPublicationAuthorities" }),
    engagement: (0, import_fields39.relationship)({ ref: "ListingEngagementAuthority" }),
    destination: (0, import_fields39.select)({
      type: "enum",
      options: [
        { label: "Public website", value: "public_site" },
        { label: "MLS submission", value: "mls" },
        { label: "IDX display", value: "idx" },
        { label: "Syndication", value: "syndication" }
      ],
      validation: { isRequired: true }
    }),
    status: (0, import_fields39.select)({
      type: "enum",
      options: [
        { label: "Authorized", value: "authorized" },
        { label: "Revoked", value: "revoked" },
        { label: "Expired", value: "expired" }
      ],
      validation: { isRequired: true }
    }),
    effectiveFrom: (0, import_fields39.timestamp)({ validation: { isRequired: true } }),
    effectiveThrough: (0, import_fields39.timestamp)({ validation: { isRequired: true } }),
    authorityBasis: (0, import_fields39.text)({ validation: { isRequired: true } }),
    localRuleReference: (0, import_fields39.text)(),
    dataUseGrantReference: (0, import_fields39.text)(),
    supersedes: (0, import_fields39.relationship)({ ref: "ListingPublicationAuthority.supersededBy" }),
    supersededBy: (0, import_fields39.relationship)({ ref: "ListingPublicationAuthority.supersedes", many: true }),
    reason: (0, import_fields39.text)({ validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    recordedBy: (0, import_fields39.relationship)({ ref: "User.recordedListingPublicationAuthorities" }),
    recordedAt: (0, import_fields39.timestamp)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});

// features/keystone/models/PractitionerLicenseAuthority.ts
var import_core38 = require("@keystone-6/core");
var import_fields40 = require("@keystone-6/core/fields");
var PractitionerLicenseAuthority = (0, import_core38.list)({
  access: {
    operation: { query: permissions.canManagePeople, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords }
  },
  hooks: createTenantOwnedHooks({
    listKey: "PractitionerLicenseAuthority",
    users: ["practitioner", "verifiedBy"],
    parents: { supersedes: "PractitionerLicenseAuthority" },
    required: ["practitioner", "verifiedBy"],
    protectDelete: true
  }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["licenseNumber", "practitioner", "jurisdictionCode", "status", "effectiveFrom", "effectiveThrough"] }
  },
  fields: {
    brokerage: (0, import_fields40.relationship)({ ref: "Brokerage.practitionerLicenseAuthorities" }),
    practitioner: (0, import_fields40.relationship)({ ref: "User.practitionerLicenseAuthorities" }),
    licenseNumber: (0, import_fields40.text)({ validation: { isRequired: true } }),
    licenseType: (0, import_fields40.select)({
      type: "enum",
      options: [
        { label: "Broker", value: "broker" },
        { label: "Associate broker", value: "associate_broker" },
        { label: "Sales agent", value: "sales_agent" }
      ],
      validation: { isRequired: true }
    }),
    jurisdictionCode: (0, import_fields40.text)({ validation: { isRequired: true } }),
    status: (0, import_fields40.select)({
      type: "enum",
      options: [
        { label: "Verified active", value: "verified_active" },
        { label: "Restricted", value: "restricted" },
        { label: "Inactive", value: "inactive" },
        { label: "Expired", value: "expired" },
        { label: "Suspended", value: "suspended" },
        { label: "Revoked", value: "revoked" }
      ],
      validation: { isRequired: true }
    }),
    effectiveFrom: (0, import_fields40.timestamp)({ validation: { isRequired: true } }),
    effectiveThrough: (0, import_fields40.timestamp)({ validation: { isRequired: true } }),
    verifiedAt: (0, import_fields40.timestamp)({ validation: { isRequired: true } }),
    verificationSource: (0, import_fields40.text)({ validation: { isRequired: true } }),
    restrictions: (0, import_fields40.text)({ ui: { displayMode: "textarea" } }),
    supersedes: (0, import_fields40.relationship)({ ref: "PractitionerLicenseAuthority.supersededBy" }),
    supersededBy: (0, import_fields40.relationship)({ ref: "PractitionerLicenseAuthority.supersedes", many: true }),
    reason: (0, import_fields40.text)({ validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    verifiedBy: (0, import_fields40.relationship)({ ref: "User.verifiedPractitionerLicenses" }),
    ...trackingFields
  }
});

// features/keystone/models/RepresentationAuthority.ts
var import_core39 = require("@keystone-6/core");
var import_fields41 = require("@keystone-6/core/fields");
var RepresentationAuthority = (0, import_core39.list)({
  access: {
    operation: { query: permissions.canReadSensitiveDeals, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords }
  },
  hooks: createTenantOwnedHooks({
    listKey: "RepresentationAuthority",
    parents: { lead: "Lead", property: "Property", deal: "Deal", supersedes: "RepresentationAuthority" },
    users: ["practitioner", "recordedBy"],
    required: ["lead", "practitioner", "recordedBy"],
    protectDelete: true
  }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["authorityNumber", "lead", "side", "relationshipType", "status", "effectiveThrough"] }
  },
  fields: {
    brokerage: (0, import_fields41.relationship)({ ref: "Brokerage.representationAuthorities" }),
    authorityNumber: (0, import_fields41.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    lead: (0, import_fields41.relationship)({ ref: "Lead.representationAuthorities" }),
    property: (0, import_fields41.relationship)({ ref: "Property.representationAuthorities" }),
    deal: (0, import_fields41.relationship)({ ref: "Deal.representationAuthorities" }),
    practitioner: (0, import_fields41.relationship)({ ref: "User.representationAuthorities" }),
    side: (0, import_fields41.select)({
      type: "enum",
      options: [
        { label: "Buyer", value: "buyer" },
        { label: "Seller", value: "seller" }
      ],
      validation: { isRequired: true }
    }),
    relationshipType: (0, import_fields41.select)({
      type: "enum",
      options: [
        { label: "Exclusive agency", value: "exclusive_agency" },
        { label: "Non-exclusive agency", value: "nonexclusive_agency" },
        { label: "Transaction brokerage/facilitation", value: "transaction_brokerage" },
        { label: "Customer assistance only", value: "customer_assistance" }
      ],
      validation: { isRequired: true }
    }),
    jurisdictionCode: (0, import_fields41.text)({ validation: { isRequired: true } }),
    status: (0, import_fields41.select)({
      type: "enum",
      options: [
        { label: "Executed", value: "executed" },
        { label: "Terminated", value: "terminated" },
        { label: "Expired", value: "expired" }
      ],
      validation: { isRequired: true }
    }),
    effectiveFrom: (0, import_fields41.timestamp)({ validation: { isRequired: true } }),
    effectiveThrough: (0, import_fields41.timestamp)({ validation: { isRequired: true } }),
    scopeSummary: (0, import_fields41.text)({ validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    documentSha256: (0, import_fields41.text)({ validation: { isRequired: true } }),
    disclosureVersion: (0, import_fields41.text)({ validation: { isRequired: true } }),
    consentRecordedAt: (0, import_fields41.timestamp)({ validation: { isRequired: true } }),
    supersedes: (0, import_fields41.relationship)({ ref: "RepresentationAuthority.supersededBy" }),
    supersededBy: (0, import_fields41.relationship)({ ref: "RepresentationAuthority.supersedes", many: true }),
    reason: (0, import_fields41.text)({ validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    recordedBy: (0, import_fields41.relationship)({ ref: "User.recordedRepresentationAuthorities" }),
    recordedAt: (0, import_fields41.timestamp)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});

// features/keystone/models/DocumentEvidenceEvent.ts
var import_core40 = require("@keystone-6/core");
var import_fields42 = require("@keystone-6/core/fields");
var DocumentEvidenceEvent = (0, import_core40.list)({
  access: {
    operation: { query: permissions.canReadSensitiveDeals, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords }
  },
  hooks: createTenantOwnedHooks({
    listKey: "DocumentEvidenceEvent",
    parents: { document: "DealDocument", deal: "Deal", offer: "Offer" },
    users: ["actor"],
    required: ["document", "deal", "actor"],
    coherentWith: { field: "document", listKey: "DealDocument", matches: { deal: "deal" } },
    protectDelete: true
  }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["eventKey", "document", "eventType", "occurredAt", "provider"] }
  },
  fields: {
    brokerage: (0, import_fields42.relationship)({ ref: "Brokerage.documentEvidenceEvents" }),
    eventKey: (0, import_fields42.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    document: (0, import_fields42.relationship)({ ref: "DealDocument.evidenceEvents" }),
    deal: (0, import_fields42.relationship)({ ref: "Deal.documentEvidenceEvents" }),
    offer: (0, import_fields42.relationship)({ ref: "Offer.documentEvidenceEvents" }),
    eventType: (0, import_fields42.select)({
      type: "enum",
      options: [
        { label: "Generated", value: "generated" },
        { label: "Signed", value: "signed" },
        { label: "Delivered", value: "delivered" },
        { label: "Received", value: "received" },
        { label: "Presented", value: "presented" },
        { label: "Acknowledged", value: "acknowledged" },
        { label: "Voided", value: "voided" }
      ],
      validation: { isRequired: true }
    }),
    documentSha256: (0, import_fields42.text)({ validation: { isRequired: true } }),
    templateSha256: (0, import_fields42.text)({ validation: { isRequired: true } }),
    certificateSha256: (0, import_fields42.text)(),
    recipients: (0, import_fields42.json)(),
    channel: (0, import_fields42.select)({
      type: "enum",
      options: [
        { label: "E-sign provider", value: "esign" },
        { label: "Email", value: "email" },
        { label: "Secure portal", value: "portal" },
        { label: "In person", value: "in_person" },
        { label: "Other approved channel", value: "other" }
      ],
      validation: { isRequired: true }
    }),
    provider: (0, import_fields42.text)({ validation: { isRequired: true } }),
    providerReference: (0, import_fields42.text)({ validation: { isRequired: true } }),
    occurredAt: (0, import_fields42.timestamp)({ validation: { isRequired: true } }),
    providerReportedAt: (0, import_fields42.timestamp)(),
    acknowledgedAt: (0, import_fields42.timestamp)(),
    acknowledgementReference: (0, import_fields42.text)(),
    reason: (0, import_fields42.text)({ validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    actor: (0, import_fields42.relationship)({ ref: "User.recordedDocumentEvidenceEvents" }),
    ...trackingFields
  }
});

// features/keystone/models/CommissionLedgerEntry.ts
var import_core41 = require("@keystone-6/core");
var import_fields43 = require("@keystone-6/core/fields");
var CommissionLedgerEntry = (0, import_core41.list)({
  access: {
    operation: { query: permissions.canReadSensitiveDeals, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords }
  },
  hooks: createTenantOwnedHooks({
    listKey: "CommissionLedgerEntry",
    parents: { commission: "Commission", deal: "Deal", reverses: "CommissionLedgerEntry" },
    users: ["payeeUser", "preparedBy", "approvedBy"],
    required: ["commission", "deal", "preparedBy"],
    coherentWith: { field: "commission", listKey: "Commission", matches: { deal: "deal" } },
    protectDelete: true
  }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["entryKey", "commission", "entryType", "amountCents", "currencyCode", "occurredAt"] }
  },
  fields: {
    brokerage: (0, import_fields43.relationship)({ ref: "Brokerage.commissionLedgerEntries" }),
    entryKey: (0, import_fields43.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    batchKey: (0, import_fields43.text)({ validation: { isRequired: true } }),
    commission: (0, import_fields43.relationship)({ ref: "Commission.ledgerEntries" }),
    deal: (0, import_fields43.relationship)({ ref: "Deal.commissionLedgerEntries" }),
    entryType: (0, import_fields43.select)({
      type: "enum",
      options: [
        { label: "Allocation", value: "allocation" },
        { label: "Allocation approval", value: "allocation_approval" },
        { label: "Receipt", value: "receipt" },
        { label: "Reversal", value: "reversal" },
        { label: "Reconciliation", value: "reconciliation" }
      ],
      validation: { isRequired: true }
    }),
    allocationType: (0, import_fields43.select)({
      type: "enum",
      options: [
        { label: "Brokerage", value: "brokerage" },
        { label: "Agent", value: "agent" },
        { label: "Team", value: "team" },
        { label: "Referral", value: "referral" },
        { label: "Fee/adjustment", value: "fee" },
        { label: "Unallocated", value: "unallocated" }
      ]
    }),
    amountCents: (0, import_fields43.bigInt)({ validation: { isRequired: true } }),
    currencyCode: (0, import_fields43.text)({ validation: { isRequired: true } }),
    payeeUser: (0, import_fields43.relationship)({ ref: "User.commissionLedgerEntries" }),
    payeeLabel: (0, import_fields43.text)(),
    externalReference: (0, import_fields43.text)(),
    sourceDocumentSha256: (0, import_fields43.text)(),
    ledgerStateHash: (0, import_fields43.text)({ ui: { description: "Digest of financial facts at reconciliation; legacy entries require new reconciliation." } }),
    reverses: (0, import_fields43.relationship)({ ref: "CommissionLedgerEntry.reversedBy" }),
    reversedBy: (0, import_fields43.relationship)({ ref: "CommissionLedgerEntry.reverses", many: true, access: { create: () => false, update: () => false } }),
    reason: (0, import_fields43.text)({ validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    preparedBy: (0, import_fields43.relationship)({ ref: "User.preparedCommissionLedgerEntries" }),
    approvedBy: (0, import_fields43.relationship)({ ref: "User.approvedCommissionLedgerEntries" }),
    occurredAt: (0, import_fields43.timestamp)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});

// features/keystone/models/RetentionPolicy.ts
var import_core42 = require("@keystone-6/core");
var import_fields44 = require("@keystone-6/core/fields");
var RetentionPolicy = (0, import_core42.list)({
  access: {
    operation: { query: permissions.canManageBrokerageSettings, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords }
  },
  hooks: createTenantOwnedHooks({
    listKey: "RetentionPolicy",
    parents: { supersedes: "RetentionPolicy" },
    users: ["approvedBy"],
    required: ["approvedBy"],
    protectDelete: true
  }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["policyKey", "retentionClass", "jurisdictionCode", "effectiveFrom", "retentionDays"] }
  },
  fields: {
    brokerage: (0, import_fields44.relationship)({ ref: "Brokerage.retentionPolicies" }),
    policyKey: (0, import_fields44.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    retentionClass: (0, import_fields44.select)({
      type: "enum",
      options: [
        { label: "Transaction file", value: "transaction_file" },
        { label: "Listing without close", value: "listing_no_close" },
        { label: "Consent/suppression proof", value: "consent_proof" },
        { label: "Security/access incident", value: "security_incident" }
      ],
      validation: { isRequired: true }
    }),
    jurisdictionCode: (0, import_fields44.text)({ validation: { isRequired: true } }),
    triggerType: (0, import_fields44.select)({
      type: "enum",
      options: [
        { label: "Deal closed", value: "deal_closed" },
        { label: "Listing ended", value: "listing_ended" },
        { label: "Document signed", value: "document_signed" },
        { label: "Manual verified trigger", value: "manual_verified" }
      ],
      validation: { isRequired: true }
    }),
    retentionDays: (0, import_fields44.integer)({ validation: { isRequired: true, min: 1, max: 36500 } }),
    disposition: (0, import_fields44.select)({
      type: "enum",
      options: [
        { label: "Tombstone and request object deletion", value: "tombstone_delete" },
        { label: "Archive", value: "archive" },
        { label: "Review required", value: "review" }
      ],
      validation: { isRequired: true }
    }),
    legalBasis: (0, import_fields44.text)({ validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    effectiveFrom: (0, import_fields44.timestamp)({ validation: { isRequired: true } }),
    effectiveThrough: (0, import_fields44.timestamp)(),
    supersedes: (0, import_fields44.relationship)({ ref: "RetentionPolicy.supersededBy" }),
    supersededBy: (0, import_fields44.relationship)({ ref: "RetentionPolicy.supersedes", many: true }),
    approvedBy: (0, import_fields44.relationship)({ ref: "User.approvedRetentionPolicies" }),
    approvedAt: (0, import_fields44.timestamp)({ validation: { isRequired: true } }),
    reason: (0, import_fields44.text)({ validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    ...trackingFields
  }
});

// features/keystone/models/TransactionFileEvent.ts
var import_core43 = require("@keystone-6/core");
var import_fields45 = require("@keystone-6/core/fields");
var TransactionFileEvent = (0, import_core43.list)({
  access: {
    operation: { query: permissions.canReadSensitiveDeals, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canAccessBrokerageRecords }
  },
  hooks: createTenantOwnedHooks({
    listKey: "TransactionFileEvent",
    parents: { deal: "Deal", document: "DealDocument", policy: "RetentionPolicy", reverses: "TransactionFileEvent" },
    users: ["actor", "approvedBy"],
    required: ["deal", "actor"],
    coherentWith: { field: "document", listKey: "DealDocument", matches: { deal: "deal" } },
    protectDelete: true
  }),
  ui: {
    hideDelete: true,
    hideCreate: true,
    listView: { initialColumns: ["eventKey", "deal", "document", "eventType", "occurredAt"] }
  },
  fields: {
    brokerage: (0, import_fields45.relationship)({ ref: "Brokerage.transactionFileEvents" }),
    eventKey: (0, import_fields45.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    deal: (0, import_fields45.relationship)({ ref: "Deal.transactionFileEvents" }),
    document: (0, import_fields45.relationship)({ ref: "DealDocument.transactionFileEvents" }),
    policy: (0, import_fields45.relationship)({ ref: "RetentionPolicy" }),
    eventType: (0, import_fields45.select)({
      type: "enum",
      options: [
        { label: "Retention assigned", value: "retention_assigned" },
        { label: "Legal hold placed", value: "hold_placed" },
        { label: "Legal hold released", value: "hold_released" },
        { label: "Export manifested", value: "export_manifested" },
        { label: "Disposition requested", value: "disposition_requested" },
        { label: "Tombstoned", value: "tombstoned" }
      ],
      validation: { isRequired: true }
    }),
    triggerAt: (0, import_fields45.timestamp)(),
    disposeAfter: (0, import_fields45.timestamp)(),
    holdKey: (0, import_fields45.text)(),
    manifestKey: (0, import_fields45.text)(),
    manifestSha256: (0, import_fields45.text)(),
    manifestItems: (0, import_fields45.json)(),
    documentSha256: (0, import_fields45.text)(),
    externalDeletionReference: (0, import_fields45.text)(),
    reverses: (0, import_fields45.relationship)({ ref: "TransactionFileEvent.reversedBy" }),
    reversedBy: (0, import_fields45.relationship)({ ref: "TransactionFileEvent.reverses", many: true }),
    reason: (0, import_fields45.text)({ validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    actor: (0, import_fields45.relationship)({ ref: "User.recordedTransactionFileEvents" }),
    approvedBy: (0, import_fields45.relationship)({ ref: "User.approvedTransactionFileEvents" }),
    occurredAt: (0, import_fields45.timestamp)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});

// features/keystone/models/PaymentProvider.ts
var import_core44 = require("@keystone-6/core");
var import_fields46 = require("@keystone-6/core/fields");
var adapterField = (description) => (0, import_fields46.text)({
  validation: { isRequired: true },
  ui: { description }
});
var PaymentProvider = (0, import_core44.list)({
  access: {
    operation: {
      query: permissions.canReadPayments,
      create: permissions.canManageBrokerageSettings,
      update: permissions.canManageBrokerageSettings,
      delete: () => false
    },
    filter: {
      query: rules.canAccessBrokerageRecords,
      update: rules.canAccessBrokerageRecords
    },
    item: { create: canCreateInActiveBrokerage, update: canMoveToActiveBrokerage }
  },
  hooks: createTenantOwnedHooks({ listKey: "PaymentProvider", protectDelete: true }),
  ui: { hideDelete: true, listView: { initialColumns: ["name", "code", "isInstalled"] } },
  fields: {
    brokerage: (0, import_fields46.relationship)({ ref: "Brokerage.paymentProviders", access: { update: () => false } }),
    name: (0, import_fields46.text)({ validation: { isRequired: true } }),
    code: (0, import_fields46.text)({
      isIndexed: "unique",
      validation: {
        isRequired: true,
        match: {
          regex: /^pp_[a-zA-Z0-9-_]+$/,
          explanation: 'Payment provider code must start with "pp_" followed by alphanumeric characters, hyphens or underscores'
        }
      }
    }),
    isInstalled: (0, import_fields46.checkbox)({ defaultValue: true }),
    // Secrets are write-only through the API: staff can set them, nothing can read them back.
    credentials: (0, import_fields46.json)({ defaultValue: {}, access: { read: () => false } }),
    metadata: (0, import_fields46.json)({ defaultValue: {} }),
    createPaymentFunction: adapterField("Adapter key (stripe, paypal, manual) or an https:// URL that creates payments"),
    capturePaymentFunction: adapterField("Adapter key or https:// URL that captures payments"),
    refundPaymentFunction: adapterField("Adapter key or https:// URL that refunds payments"),
    getPaymentStatusFunction: adapterField("Adapter key or https:// URL that checks payment status"),
    generatePaymentLinkFunction: adapterField("Adapter key or https:// URL that returns a provider dashboard link"),
    handleWebhookFunction: adapterField("Adapter key or https:// URL that verifies provider webhooks"),
    payments: (0, import_fields46.relationship)({ ref: "Payment.paymentProvider", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields
  }
});

// features/keystone/models/Payment.ts
var import_core45 = require("@keystone-6/core");
var import_fields47 = require("@keystone-6/core/fields");
var Payment = (0, import_core45.list)({
  access: {
    operation: {
      query: permissions.canReadPayments,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: rules.canAccessBrokerageRecords }
  },
  hooks: createTenantOwnedHooks({
    listKey: "Payment",
    parents: { paymentProvider: "PaymentProvider", property: "Property", lead: "Lead", deal: "Deal" },
    required: ["paymentProvider"],
    protectDelete: true
  }),
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ["purpose", "status", "amountMinor", "currency", "property", "lead"] } },
  fields: {
    brokerage: (0, import_fields47.relationship)({ ref: "Brokerage.payments" }),
    purpose: (0, import_fields47.select)({
      type: "enum",
      options: [
        { label: "Application fee", value: "application_fee" },
        { label: "Holding deposit", value: "holding_deposit" },
        { label: "Rent", value: "rent" },
        { label: "Agent fee", value: "agent_fee" }
      ],
      validation: { isRequired: true }
    }),
    status: (0, import_fields47.select)({
      type: "enum",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Authorized", value: "authorized" },
        { label: "Captured", value: "captured" },
        { label: "Refunded", value: "refunded" },
        { label: "Failed", value: "failed" },
        { label: "Unknown", value: "unknown" }
      ],
      defaultValue: "pending",
      validation: { isRequired: true }
    }),
    amountMinor: (0, import_fields47.integer)({ validation: { isRequired: true, min: 1 } }),
    currency: (0, import_fields47.text)({ validation: { isRequired: true, length: { min: 3, max: 3 } }, defaultValue: "USD" }),
    // Nullable so that payments that have not reached the provider yet do not collide on the unique index.
    providerPaymentId: (0, import_fields47.text)({ isIndexed: "unique", db: { isNullable: true }, defaultValue: void 0 }),
    providerPaymentIntentId: (0, import_fields47.text)(),
    idempotencyKey: (0, import_fields47.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    // Opaque capability the payer carries in the return URL; never listed to other users.
    accessToken: (0, import_fields47.text)({ isIndexed: "unique", validation: { isRequired: true }, access: { read: () => false } }),
    payerName: (0, import_fields47.text)(),
    payerEmail: (0, import_fields47.text)(),
    checkoutUrl: (0, import_fields47.text)(),
    paidAt: (0, import_fields47.timestamp)(),
    refundedMinor: (0, import_fields47.integer)({ defaultValue: 0 }),
    lastCheckedAt: (0, import_fields47.timestamp)(),
    paymentProvider: (0, import_fields47.relationship)({ ref: "PaymentProvider.payments" }),
    property: (0, import_fields47.relationship)({ ref: "Property.payments" }),
    lead: (0, import_fields47.relationship)({ ref: "Lead.payments" }),
    deal: (0, import_fields47.relationship)({ ref: "Deal.payments" }),
    ...trackingFields
  }
});
var PaymentWebhookReceipt = (0, import_core45.list)({
  access: { operation: { query: () => false, create: () => false, update: () => false, delete: () => false } },
  ui: { isHidden: true },
  fields: {
    eventKey: (0, import_fields47.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    eventType: (0, import_fields47.text)(),
    outcome: (0, import_fields47.text)(),
    ...trackingFields
  }
});

// features/keystone/models/index.ts
var models = {
  DomainAuditEvent,
  CommandReceipt,
  Brokerage,
  BrokerageMembership,
  BrokerageSettings,
  User,
  Role,
  Property,
  Lead,
  Showing,
  Deal,
  SavedProperty,
  LeadActivity,
  LeadRoutingRule,
  PropertyMedia,
  PropertyInspection,
  Offer,
  DealDocument,
  Commission,
  SavedSearch,
  MarketComp,
  Neighborhood,
  AgentTeam,
  AgentTask,
  SavedSearchAlert,
  Disclosure,
  PropertyValuation,
  TransactionMilestone,
  MortgageApplication,
  TitleOrder,
  Escrow,
  ShowingFeedback,
  OpenHouse,
  SourceFeed,
  ListingSyndication,
  ListingEngagementAuthority,
  ListingPublicationAuthority,
  PractitionerLicenseAuthority,
  RepresentationAuthority,
  DocumentEvidenceEvent,
  CommissionLedgerEntry,
  RetentionPolicy,
  TransactionFileEvent,
  PaymentProvider,
  Payment,
  PaymentWebhookReceipt
};
for (const model of Object.values(models)) {
  const fields = model.fields;
  for (const key of Object.keys(fields)) fields[key] = staticFieldUi(fields[key]);
}

// features/keystone/index.ts
var import_session = require("@keystone-6/core/session");

// features/keystone/mutations/index.ts
var import_schema = require("@graphql-tools/schema");

// features/keystone/mutations/publicBrokerageIdentity.ts
async function resolvePublicBrokerage(context, brokerageSlug) {
  const slug = String(brokerageSlug || "").trim().toLowerCase();
  if (slug && (slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))) return null;
  const rows = await context.sudo().query.Brokerage.findMany({
    where: slug ? { slug: { equals: slug }, status: { equals: "active" } } : { isPrimary: { equals: true }, status: { equals: "active" } },
    orderBy: [{ id: "asc" }],
    take: 1,
    query: "id slug"
  });
  return rows[0] ? { id: String(rows[0].id), slug: String(rows[0].slug) } : null;
}
async function publicBrokerageIdentity(_root, { brokerageSlug }, context) {
  const brokerage = await resolvePublicBrokerage(context, brokerageSlug);
  if (!brokerage) return { status: "unconfigured", brokerageSlug: null, settings: null };
  const settings = await context.sudo().query.BrokerageSettings.findMany({
    where: { brokerage: { id: { equals: brokerage.id } } },
    orderBy: [{ id: "asc" }],
    take: 1,
    query: "businessName marketLabel city state tagline description equalHousingNotice publicPhone publicEmail brandHue logoIcon logoColor"
  });
  const identity = settings[0];
  if (!identity) return { status: "unconfigured", brokerageSlug: brokerage.slug, settings: null };
  const requiredIdentity = [identity.businessName, identity.marketLabel, identity.city, identity.state, identity.tagline];
  if (requiredIdentity.some((value) => !String(value || "").trim())) return { status: "unconfigured", brokerageSlug: brokerage.slug, settings: null };
  return {
    status: "ready",
    brokerageSlug: brokerage.slug,
    settings: {
      businessName: identity.businessName,
      marketLabel: identity.marketLabel,
      city: identity.city,
      state: identity.state,
      tagline: identity.tagline,
      description: identity.description || "",
      equalHousingNotice: identity.equalHousingNotice || "",
      publicPhone: identity.publicPhone || "",
      publicEmail: identity.publicEmail || "",
      brandHue: identity.brandHue,
      logoIcon: sanitizeStoreLogoSvg(identity.logoIcon || ""),
      logoColor: normalizeStoreLogoColor(identity.logoColor)
    }
  };
}

// features/keystone/lib/commandContext.ts
async function lockBrokerageCommand(context, brokerageId) {
  if (!brokerageId || brokerageId.length > 200) throw new Error("An active brokerage is required.");
  await context.prisma.$executeRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtext($1))",
    `brokerage-command:${brokerageId}`
  );
}
async function freshOperatorCommandContext(context) {
  const session = context.session;
  const brokerageId = activeBrokerageIds(session)[0];
  if (!session?.itemId || !brokerageId) throw new Error("An active brokerage membership is required.");
  await lockBrokerageCommand(context, brokerageId);
  await context.prisma.$executeRawUnsafe('SELECT "id" FROM "User" WHERE "id" = $1 FOR NO KEY UPDATE', session.itemId);
  const current = await context.sudo().query.User.findOne({
    where: { id: session.itemId },
    query: `id name email activeBrokerage { id slug status }
      brokerageMemberships(where: { brokerage: { id: { equals: ${JSON.stringify(brokerageId)} } } }, take: 100) { id status membershipRole isPrimary brokerage { id slug status } }
      role { id name canAccessDashboard canSeeOtherPeople canEditOtherPeople
        canManagePeople canManageRoles canManageListings canManageLeads
        canManageShowings canManageDeals canViewReports canManageOnboarding }`
  });
  const nextSession = { ...session, data: current };
  if (!current || current.id !== session.itemId || activeBrokerageIds(nextSession)[0] !== brokerageId) {
    throw new Error("An active brokerage membership is required.");
  }
  return context.withSession(nextSession);
}
async function decisionRows(list47, args) {
  const rows = [];
  const pageSize = 200;
  const maxRows = 1e4;
  for (let skip = 0; skip <= maxRows; skip += pageSize) {
    const page = await list47.findMany({
      ...args,
      orderBy: args.orderBy || [{ createdAt: "asc" }, { id: "asc" }],
      take: pageSize,
      skip
    });
    if (rows.length + page.length > maxRows) throw new Error("Evidence history requires offline review before this action.");
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
  throw new Error("Evidence history requires offline review before this action.");
}

// features/keystone/lib/authorityEvidence.ts
var SHA256 = /^[a-f0-9]{64}$/i;
var ListingAuthorityDeniedError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ListingAuthorityDeniedError";
  }
};
function isSha256(value) {
  return SHA256.test(String(value || "").trim());
}
function boundedReason(value) {
  const reason = String(value || "").trim();
  if (!reason || reason.length > 5e3) throw new Error("A bounded reason is required.");
  return reason;
}
function boundedIdempotencyKey(value) {
  const key = String(value || "").trim();
  if (!key || key.length > 120) throw new Error("A bounded idempotency key is required.");
  return key;
}
function authorityIsEffective(item, at2 = /* @__PURE__ */ new Date()) {
  const from = new Date(item?.effectiveFrom || 0);
  const through = new Date(item?.effectiveThrough || 0);
  return Number.isFinite(from.getTime()) && Number.isFinite(through.getTime()) && from <= at2 && through >= at2;
}
async function requirePractitionerLicense(context, input) {
  const rows = await context.sudo().query.PractitionerLicenseAuthority.findMany({
    where: {
      brokerage: { id: { equals: input.brokerageId } },
      practitioner: { id: { equals: input.practitionerId } },
      jurisdictionCode: { equals: input.jurisdictionCode.toUpperCase() }
    },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    take: 1,
    query: "id status effectiveFrom effectiveThrough verifiedAt verificationSource restrictions"
  });
  const latest = rows[0];
  const evaluatedAt = input.at || /* @__PURE__ */ new Date();
  if (!latest || latest.status !== "verified_active" || !authorityIsEffective(latest, evaluatedAt) || !latest.verifiedAt || new Date(latest.verifiedAt) > evaluatedAt || !latest.verificationSource) {
    throw new ListingAuthorityDeniedError("A current verified practitioner license is required for this jurisdictional action.");
  }
  return latest;
}
async function requireListingAuthority(context, input) {
  await requirePractitionerLicense(context, input);
  const engagements = await context.sudo().query.ListingEngagementAuthority.findMany({
    where: { brokerage: { id: { equals: input.brokerageId } }, property: { id: { equals: input.propertyId } } },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    take: 1,
    query: "id status effectiveFrom effectiveThrough marketingAuthorized showingAuthorized documentSha256 assignedPractitioner { id }"
  });
  const engagement = engagements[0];
  if (!engagement || engagement.status !== "executed" || !authorityIsEffective(engagement, input.at) || !engagement.marketingAuthorized || input.showingRequired && !engagement.showingAuthorized || !isSha256(engagement.documentSha256) || engagement.assignedPractitioner?.id !== input.practitionerId) {
    throw new ListingAuthorityDeniedError("An effective signed listing engagement with marketing authority is required.");
  }
  const publications = await context.sudo().query.ListingPublicationAuthority.findMany({
    where: {
      brokerage: { id: { equals: input.brokerageId } },
      property: { id: { equals: input.propertyId } },
      destination: { equals: input.destination }
    },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    take: 1,
    query: "id status effectiveFrom effectiveThrough authorityBasis engagement { id }"
  });
  const publication = publications[0];
  if (!publication || publication.status !== "authorized" || !authorityIsEffective(publication, input.at) || publication.engagement?.id !== engagement.id || !publication.authorityBasis) {
    throw new ListingAuthorityDeniedError(`Effective ${input.destination} publication authority is required.`);
  }
  return { engagement, publication };
}
async function requireRepresentationAuthority(context, input) {
  await requirePractitionerLicense(context, input);
  const rows = await context.sudo().query.RepresentationAuthority.findMany({
    where: {
      brokerage: { id: { equals: input.brokerageId } },
      lead: { id: { equals: input.leadId } },
      practitioner: { id: { equals: input.practitionerId } },
      jurisdictionCode: { equals: input.jurisdictionCode.toUpperCase() },
      side: { equals: input.side },
      ...input.propertyId ? { property: { id: { equals: input.propertyId } } } : {}
    },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    take: 1,
    query: "id status relationshipType effectiveFrom effectiveThrough documentSha256 consentRecordedAt property { id } deal { id }"
  });
  const authority = rows[0];
  const permittedRelationship = input.allowCustomerAssistance ? ["exclusive_agency", "nonexclusive_agency", "transaction_brokerage", "customer_assistance"].includes(authority?.relationshipType) : ["exclusive_agency", "nonexclusive_agency", "transaction_brokerage"].includes(authority?.relationshipType);
  if (!authority || authority.status !== "executed" || !authorityIsEffective(authority, input.at) || !permittedRelationship || !isSha256(authority.documentSha256) || !authority.consentRecordedAt || input.dealId && authority.deal?.id && authority.deal.id !== input.dealId) {
    throw new Error("An effective jurisdiction-specific representation authority is required for this action.");
  }
  return authority;
}
function evidenceComplete(events, required) {
  if (events.some((event) => event.eventType === "voided")) return false;
  if (!required.every((type) => events.some((event) => event.eventType === type))) return false;
  const hashes = new Set(events.map((event) => event.documentSha256));
  const templates = new Set(events.map((event) => event.templateSha256));
  return hashes.size === 1 && templates.size === 1 && [...hashes].every(isSha256) && [...templates].every(isSha256);
}
async function requireOfferEvidenceChain(context, input) {
  const documents = await decisionRows(context.sudo().query.DealDocument, {
    where: { deal: { id: { equals: input.dealId } }, documentType: { equals: "offer" } },
    orderBy: [{ id: "asc" }],
    query: "id status fileUrl sentAt signedAt createdAt"
  });
  const candidates = [];
  for (const document2 of documents) {
    const history = await decisionRows(context.sudo().query.DocumentEvidenceEvent, {
      where: { document: { id: { equals: document2.id } } },
      orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      query: "id eventType documentSha256 templateSha256 offer { id } recipients channel provider providerReference occurredAt acknowledgedAt acknowledgementReference"
    });
    const events2 = history.filter((event) => event.offer?.id === input.offerId);
    if (events2.length) candidates.push({ document: document2, history, events: events2 });
  }
  if (!candidates.length) throw new Error("Immutable signed, delivered, presented, and acknowledged offer evidence is required; legal effect remains subject to broker or counsel review.");
  if (candidates.length > 1) throw new Error("More than one current offer document was found. Archive the outdated version and try again.");
  const candidate = candidates[0];
  if (!candidate || candidate.document.status !== "signed" || !candidate.document.fileUrl || !candidate.document.sentAt || !candidate.document.signedAt || !Number.isFinite(new Date(candidate.document.createdAt).getTime()) || !Number.isFinite(new Date(candidate.document.signedAt).getTime()) || candidate.history.some((event) => event.eventType === "voided")) {
    throw new Error("Immutable signed, delivered, presented, and acknowledged offer evidence is required; legal effect remains subject to broker or counsel review.");
  }
  const { document, events } = candidate;
  const hasRecipients = events.filter((event) => ["delivered", "received", "presented", "acknowledged"].includes(event.eventType)).every((event) => Array.isArray(event.recipients) && event.recipients.length > 0);
  const acknowledged = events.some((event) => event.eventType === "acknowledged" && event.acknowledgedAt && event.acknowledgementReference);
  if (evidenceComplete(events, ["signed", "delivered", "presented", "acknowledged"]) && hasRecipients && acknowledged && events.every((event) => event.provider && event.providerReference)) return { document, events };
  throw new Error("Immutable signed, delivered, presented, and acknowledged offer evidence is required; legal effect remains subject to broker or counsel review.");
}
async function requireClosingEvidenceChain(context, dealId) {
  const documents = await decisionRows(context.sudo().query.DealDocument, {
    where: { deal: { id: { equals: dealId } }, documentType: { equals: "closing_statement" } },
    orderBy: [{ createdAt: "desc" }, { signedAt: "desc" }, { id: "desc" }],
    query: "id status fileUrl signedAt"
  });
  const document = documents[0];
  if (documents.length !== 1 || document?.status !== "signed" || !document.fileUrl || !document.signedAt || !Number.isFinite(new Date(document.signedAt).getTime())) {
    throw new Error("Immutable signed and acknowledged closing evidence is required; settlement and funds remain provider-authoritative.");
  }
  const events = await decisionRows(context.sudo().query.DocumentEvidenceEvent, {
    where: { document: { id: { equals: document.id } }, deal: { id: { equals: dealId } } },
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    query: "id eventType documentSha256 templateSha256 recipients channel provider providerReference occurredAt acknowledgedAt acknowledgementReference"
  });
  if (evidenceComplete(events, ["signed", "acknowledged"]) && events.some((event) => event.eventType === "acknowledged" && event.acknowledgedAt && event.acknowledgementReference)) return { document, events };
  throw new Error("Immutable signed and acknowledged closing evidence is required; settlement and funds remain provider-authoritative.");
}

// features/keystone/lib/publicListingPagination.ts
var import_graphql = require("graphql");
var PUBLIC_LISTING_CANDIDATE_BATCH_SIZE = 25;
var PUBLIC_LISTING_CANDIDATE_SCAN_LIMIT = 250;
var PUBLIC_LISTING_SCAN_OVERFLOW_MARKER = "PUBLIC_LISTING_SCAN_OVERFLOW";
var PublicListingScanOverflowError = class extends import_graphql.GraphQLError {
  constructor() {
    super(`${PUBLIC_LISTING_SCAN_OVERFLOW_MARKER}: Narrow the search to verify eligible inventory safely.`, {
      extensions: { code: PUBLIC_LISTING_SCAN_OVERFLOW_MARKER }
    });
    this.name = "PublicListingScanOverflowError";
  }
};
async function collectEligiblePage({
  take,
  skip,
  fetchCandidates,
  isEligible,
  candidateBatchSize = PUBLIC_LISTING_CANDIDATE_BATCH_SIZE,
  candidateScanLimit = PUBLIC_LISTING_CANDIDATE_SCAN_LIMIT
}) {
  if (!Number.isSafeInteger(take) || take < 1 || take > 100) throw new Error("Public listing page size is invalid.");
  if (!Number.isSafeInteger(skip) || skip < 0 || skip > 1e4) throw new Error("Public listing offset is invalid.");
  if (!Number.isSafeInteger(candidateBatchSize) || candidateBatchSize < 1) throw new Error("Public listing candidate batch is invalid.");
  if (!Number.isSafeInteger(candidateScanLimit) || candidateScanLimit < 1) throw new Error("Public listing candidate budget is invalid.");
  const items = [];
  let candidatesScanned = 0;
  let eligibleSkipped = 0;
  while (candidatesScanned < candidateScanLimit) {
    const batchLimit = Math.min(candidateBatchSize, candidateScanLimit - candidatesScanned);
    const candidates = await fetchCandidates(candidatesScanned, batchLimit);
    if (candidates.length > batchLimit) throw new Error("Public listing candidate reader exceeded its bound.");
    if (candidates.length === 0) {
      return { items, candidatesScanned };
    }
    for (const candidate of candidates) {
      candidatesScanned += 1;
      if (!await isEligible(candidate)) continue;
      if (eligibleSkipped < skip) {
        eligibleSkipped += 1;
        continue;
      }
      items.push(candidate);
      if (items.length === take) {
        return { items, candidatesScanned };
      }
    }
    if (candidates.length < batchLimit) {
      return { items, candidatesScanned };
    }
  }
  const overflowProbe = await fetchCandidates(candidatesScanned, 1);
  if (overflowProbe.length > 1) throw new Error("Public listing overflow probe exceeded its bound.");
  if (overflowProbe.length > 0) throw new PublicListingScanOverflowError();
  return { items, candidatesScanned };
}

// features/keystone/mutations/publicStorefront.ts
var PUBLIC_STATUSES = ["active", "coming_soon"];
var PUBLIC_LISTING_MEDIA_LIMIT = 20;
var PUBLIC_LISTING_QUERY = `
  id title slug status listingType propertyType shortDescription description
  addressLine1 addressLine2 city state postalCode neighborhood latitude longitude
  price bedrooms bathrooms squareFeet lotSizeSquareFeet yearBuilt hoaFee availableAt isFeatured virtualTourUrl
  leaseTerm securityDeposit applicationFeeMinor petPolicy
  primaryImageUrl
  brokerage { id }
  assignedAgent { id name email phone brokerageTitle licenseNumber avatarUrl brokerageMemberships(where: { status: { equals: active } }) { brokerage { id status } } }
`;
function boundedArea(filters) {
  const edges = [filters.west, filters.south, filters.east, filters.north];
  if (edges.every((edge) => edge == null)) return null;
  if (!edges.every((edge) => typeof edge === "number" && Number.isFinite(edge))) throw new Error("A map area needs west, south, east and north.");
  const [west, south, east, north] = edges;
  if (west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) throw new Error("The map area is not valid.");
  return { west, south, east, north };
}
var PUBLIC_LISTING_SORTS = {
  newest: [{ createdAt: "desc" }, { id: "asc" }],
  price_asc: [{ price: "asc" }, { createdAt: "desc" }, { id: "asc" }],
  price_desc: [{ price: "desc" }, { createdAt: "desc" }, { id: "asc" }]
};
function publicListingOrder(sort) {
  return PUBLIC_LISTING_SORTS[clean(sort)] || [{ isFeatured: "desc" }, { createdAt: "desc" }, { id: "asc" }];
}
function clean(value) {
  const trimmed = String(value || "").trim();
  return trimmed.length ? trimmed : "";
}
function boundedText(value, label, max = 120) {
  const text46 = clean(value);
  if (text46.length > max) throw new Error(`${label} is too long.`);
  return text46;
}
function boundedMoney(value) {
  const amount = clean(value);
  if (amount && !/^\d{1,10}(?:\.\d{1,2})?$/.test(amount)) throw new Error("Price filters must be positive decimal amounts.");
  return amount;
}
function validBrokerageSlug(value) {
  const slug = clean(value).toLowerCase();
  if (slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("A valid brokerage slug is required.");
  return slug;
}
function buildPublicListingWhere(brokerageSlug, filters = {}) {
  const q = boundedText(filters.q, "Search");
  const city = boundedText(filters.city, "City", 80);
  const propertyType = boundedText(filters.propertyType, "Property type", 40);
  const minPrice = boundedMoney(filters.minPrice);
  const maxPrice = boundedMoney(filters.maxPrice);
  const where = {
    status: { in: [...PUBLIC_STATUSES] },
    brokerage: { slug: { equals: validBrokerageSlug(brokerageSlug) }, status: { equals: "active" } }
  };
  const and = [];
  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { neighborhood: { contains: q, mode: "insensitive" } },
        { addressLine1: { contains: q, mode: "insensitive" } },
        { postalCode: { contains: q, mode: "insensitive" } }
      ]
    });
  }
  if (city) and.push({ city: { contains: city, mode: "insensitive" } });
  const area = boundedArea(filters);
  if (area) {
    and.push({ latitude: { gte: String(area.south), lte: String(area.north) } });
    and.push({ longitude: { gte: String(area.west), lte: String(area.east) } });
  }
  if (filters.listingType) where.listingType = { equals: filters.listingType };
  if (propertyType) where.propertyType = { equals: propertyType };
  if (filters.bedrooms != null) {
    if (!Number.isInteger(filters.bedrooms) || filters.bedrooms < 0 || filters.bedrooms > 20) throw new Error("Bedrooms must be an integer from 0 to 20.");
    where.bedrooms = { gte: filters.bedrooms };
  }
  if (filters.bathrooms != null) {
    if (!Number.isInteger(filters.bathrooms) || filters.bathrooms < 0 || filters.bathrooms > 20) throw new Error("Bathrooms must be an integer from 0 to 20.");
    where.bathrooms = { gte: String(filters.bathrooms) };
  }
  if (minPrice || maxPrice) {
    if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) throw new Error("Minimum price cannot exceed maximum price.");
    where.price = { ...minPrice ? { gte: minPrice } : {}, ...maxPrice ? { lte: maxPrice } : {} };
  }
  if (and.length) where.AND = and;
  return where;
}
function publicImagePath(value) {
  const path2 = clean(value);
  return path2.startsWith("/images/real-estate/") ? upgradeLegacyImagePath(path2) : "";
}
function toPublicAgent(agent, brokerageId) {
  if (!agent || !(agent.brokerageMemberships || []).some((membership) => membership.brokerage?.id === brokerageId && membership.brokerage?.status === "active")) return null;
  return {
    name: agent.name || "",
    email: agent.email || "",
    phone: agent.phone || "",
    brokerageTitle: agent.brokerageTitle || "",
    licenseNumber: agent.licenseNumber || "",
    imagePath: publicImagePath(agent.avatarUrl)
  };
}
function coordinate(value, limit) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit && number !== 0 ? number : null;
}
function toPublicListing(property, media, openHouses) {
  return {
    id: property.id,
    title: property.title,
    slug: property.slug,
    status: property.status,
    listingType: property.listingType,
    propertyType: property.propertyType || "",
    shortDescription: property.shortDescription || "",
    description: property.description || "",
    addressLine1: property.addressLine1,
    addressLine2: property.addressLine2 || "",
    city: property.city,
    state: property.state,
    postalCode: property.postalCode || "",
    neighborhood: property.neighborhood || "",
    latitude: coordinate(property.latitude, 90),
    longitude: coordinate(property.longitude, 180),
    price: String(property.price),
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms == null ? "" : String(property.bathrooms),
    squareFeet: property.squareFeet,
    lotSizeSquareFeet: property.lotSizeSquareFeet,
    yearBuilt: property.yearBuilt,
    hoaFee: property.hoaFee == null ? "" : String(property.hoaFee),
    availableAt: property.availableAt || "",
    isFeatured: Boolean(property.isFeatured),
    virtualTourUrl: property.virtualTourUrl || "",
    leaseTerm: property.leaseTerm || "",
    securityDeposit: property.securityDeposit ?? null,
    applicationFeeMinor: property.listingType === "rent" ? property.applicationFeeMinor ?? null : null,
    petPolicy: property.petPolicy || "",
    imagePath: publicHeroImagePath(media, publicImagePath(property.primaryImageUrl)),
    assignedAgent: toPublicAgent(property.assignedAgent, property.brokerage.id),
    openHouses: openHouses.map((item) => ({
      id: item.id,
      title: item.title,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      hostName: item.hostAgent?.name || ""
    })),
    media: media.map((item) => ({
      title: item.title,
      mediaType: item.mediaType,
      imagePath: publicMediaImagePath(item, publicImagePath),
      externalUrl: publicMediaImagePath(item, publicImagePath) ? "" : item.url || "",
      altText: item.altText || "",
      caption: item.caption || "",
      sortOrder: item.sortOrder || 0,
      isHero: Boolean(item.isHero)
    }))
  };
}
async function findPublicMedia(context, propertyId) {
  return context.sudo().query.PropertyMedia.findMany({
    where: { property: { id: { equals: propertyId } } },
    orderBy: [{ isHero: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    take: PUBLIC_LISTING_MEDIA_LIMIT,
    query: "title mediaType url image { url } altText caption sortOrder isHero"
  });
}
async function findPublicOpenHouses(context, propertyId, brokerageId) {
  return context.sudo().query.OpenHouse.findMany({
    where: {
      property: { id: { equals: propertyId } },
      status: { equals: "scheduled" },
      endsAt: { gte: (/* @__PURE__ */ new Date()).toISOString() }
    },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: 10,
    query: "id title startsAt endsAt hostAgent { name brokerageMemberships(where: { status: { equals: active } }) { brokerage { id status } } }"
  }).then((items) => items.map((item) => ({
    ...item,
    hostAgent: (item.hostAgent?.brokerageMemberships || []).some((membership) => membership.brokerage?.id === brokerageId && membership.brokerage?.status === "active") ? item.hostAgent : null
  })));
}
async function hasPublicListingAuthority(context, property) {
  try {
    await requireListingAuthority(context, {
      brokerageId: property.brokerage.id,
      propertyId: property.id,
      practitionerId: property.assignedAgent?.id || "",
      jurisdictionCode: property.state,
      destination: "public_site"
    });
    return true;
  } catch (error) {
    if (error instanceof ListingAuthorityDeniedError) return false;
    throw error;
  }
}
async function publicRealEstateListings(_root, { brokerageSlug, filters = {}, take = 24, skip = 0 }, context) {
  const boundedTake = Number.isInteger(take) ? Math.min(Math.max(take, 1), 100) : 24;
  const boundedSkip = Number.isInteger(skip) ? Math.min(Math.max(skip, 0), 1e4) : 0;
  const where = buildPublicListingWhere(brokerageSlug, filters);
  const page = await collectEligiblePage({
    take: boundedTake,
    skip: boundedSkip,
    candidateBatchSize: PUBLIC_LISTING_CANDIDATE_BATCH_SIZE,
    candidateScanLimit: PUBLIC_LISTING_CANDIDATE_SCAN_LIMIT,
    fetchCandidates: (candidateSkip, candidateTake) => context.sudo().query.Property.findMany({
      where,
      orderBy: publicListingOrder(filters?.sort),
      take: candidateTake,
      skip: candidateSkip,
      query: PUBLIC_LISTING_QUERY
    }),
    isEligible: (property) => hasPublicListingAuthority(context, property)
  });
  const listings = [];
  for (const property of page.items) {
    const [media, openHouses] = await Promise.all([
      findPublicMedia(context, property.id),
      findPublicOpenHouses(context, property.id, property.brokerage.id)
    ]);
    listings.push(toPublicListing(property, media, openHouses));
  }
  return listings;
}
async function publicRealEstateListing(_root, { brokerageSlug, slug }, context) {
  const properties = await context.sudo().query.Property.findMany({
    where: { ...buildPublicListingWhere(brokerageSlug), slug: { equals: clean(slug) } },
    take: 1,
    query: PUBLIC_LISTING_QUERY
  });
  const property = properties[0];
  if (!property) return null;
  if (!await hasPublicListingAuthority(context, property)) return null;
  const [media, openHouses] = await Promise.all([
    findPublicMedia(context, property.id),
    findPublicOpenHouses(context, property.id, property.brokerage.id)
  ]);
  return toPublicListing(property, media, openHouses);
}
var SAVED_HOME_STATUSES = ["saved", "interested"];
function savedHomesWhere(actor, brokerageSlug) {
  return {
    user: { id: { equals: actor } },
    status: { in: [...SAVED_HOME_STATUSES] },
    property: { brokerage: { slug: { equals: validBrokerageSlug(brokerageSlug) }, status: { equals: "active" } } }
  };
}
async function customerSavedProperties(_root, { brokerageSlug }, context) {
  const actor = context.session?.itemId;
  if (!actor) return [];
  const rows = await context.sudo().query.SavedProperty.findMany({
    where: savedHomesWhere(actor, brokerageSlug),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200,
    query: "id property { id }"
  });
  return rows.filter((row) => row.property?.id).map((row) => ({ id: row.id, propertyId: row.property.id }));
}
async function customerSavedHomes(_root, { brokerageSlug }, context) {
  const actor = context.session?.itemId;
  if (!actor) throw new Error("Sign in to view saved homes.");
  const listingWhere = buildPublicListingWhere(brokerageSlug);
  const rows = await context.sudo().query.SavedProperty.findMany({
    where: savedHomesWhere(actor, brokerageSlug),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
    query: "id property { id }"
  });
  const listings = [];
  for (const row of rows) {
    if (!row.property?.id) continue;
    const property = (await context.sudo().query.Property.findMany({
      where: { ...listingWhere, id: { equals: row.property.id } },
      take: 1,
      query: PUBLIC_LISTING_QUERY
    }))[0];
    if (!property || !await hasPublicListingAuthority(context, property)) continue;
    const [media, openHouses] = await Promise.all([
      findPublicMedia(context, property.id),
      findPublicOpenHouses(context, property.id, property.brokerage.id)
    ]);
    listings.push(toPublicListing(property, media, openHouses));
  }
  return listings;
}

// features/keystone/mutations/redirectToInit.ts
async function redirectToInit(root, args, context) {
  const userCount = await context.sudo().query.User.count({});
  if (userCount === 0) {
    return true;
  }
  return false;
}
var redirectToInit_default = redirectToInit;

// features/keystone/lib/propertyLock.ts
async function lockPropertyForDecision(context, id, brokerageId) {
  if (!id || !brokerageId) throw new Error("Property scope is required.");
  await context.prisma.$executeRawUnsafe('SELECT "id" FROM "Property" WHERE "id" = $1 AND "brokerage" = $2 FOR NO KEY UPDATE', id, brokerageId);
}
async function lockAndRefreshProperty(context, id, brokerageId) {
  await lockPropertyForDecision(context, id, brokerageId);
  const property = await context.sudo().query.Property.findOne({ where: { id }, query: "id state brokerage { id } assignedAgent { id }" });
  if (!property || property.brokerage?.id !== brokerageId) throw new Error("Property is unavailable in the current brokerage.");
  return property;
}

// features/lib/date-time.ts
function commandText(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : "";
  return String(value ?? "").trim();
}
function explicitDateTimeToIso(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return "";
  const time2 = Date.parse(value);
  return Number.isFinite(time2) ? new Date(time2).toISOString() : "";
}
var STATE_TIME_ZONES = {
  AL: "America/Chicago",
  AK: "America/Anchorage",
  AZ: "America/Phoenix",
  AR: "America/Chicago",
  CA: "America/Los_Angeles",
  CO: "America/Denver",
  CT: "America/New_York",
  DE: "America/New_York",
  DC: "America/New_York",
  FL: "America/New_York",
  GA: "America/New_York",
  HI: "Pacific/Honolulu",
  ID: "America/Boise",
  IL: "America/Chicago",
  IN: "America/Indiana/Indianapolis",
  IA: "America/Chicago",
  KS: "America/Chicago",
  KY: "America/New_York",
  LA: "America/Chicago",
  ME: "America/New_York",
  MD: "America/New_York",
  MA: "America/New_York",
  MI: "America/Detroit",
  MN: "America/Chicago",
  MS: "America/Chicago",
  MO: "America/Chicago",
  MT: "America/Denver",
  NE: "America/Chicago",
  NV: "America/Los_Angeles",
  NH: "America/New_York",
  NJ: "America/New_York",
  NM: "America/Denver",
  NY: "America/New_York",
  NC: "America/New_York",
  ND: "America/Chicago",
  OH: "America/New_York",
  OK: "America/Chicago",
  OR: "America/Los_Angeles",
  PA: "America/New_York",
  RI: "America/New_York",
  SC: "America/New_York",
  SD: "America/Chicago",
  TN: "America/Chicago",
  TX: "America/Chicago",
  UT: "America/Denver",
  VT: "America/New_York",
  VA: "America/New_York",
  WA: "America/Los_Angeles",
  WV: "America/New_York",
  WI: "America/Chicago",
  WY: "America/Denver",
  PR: "America/Puerto_Rico"
};
var SHOWING_HOURS = { first: 8, last: 20 };
function stateTimeZone(state) {
  return STATE_TIME_ZONES[String(state || "").trim().toUpperCase()] || null;
}
function zonedParts(time2, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(new Date(time2)).map((part) => [part.type, part.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute) };
}
function withinShowingHours(time2, timeZone) {
  const p2 = zonedParts(time2, timeZone);
  const minutes = p2.hour * 60 + p2.minute;
  return minutes >= SHOWING_HOURS.first * 60 && minutes <= SHOWING_HOURS.last * 60;
}
function timeZoneLabel(timeZone) {
  return new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longGeneric" }).formatToParts(/* @__PURE__ */ new Date()).find((part) => part.type === "timeZoneName")?.value || timeZone;
}

// features/keystone/lib/showingReviewRevision.ts
async function showingReviewRevision(context, item) {
  const auditCount = await context.sudo().query.DomainAuditEvent.count({ where: {
    brokerage: { id: { equals: item.brokerage.id } },
    aggregateType: { equals: "showing" },
    aggregateId: { equals: item.id }
  } });
  if (!Number.isSafeInteger(auditCount) || auditCount < 0) throw new Error("Showing revision evidence is unavailable.");
  return domainPayloadHash({
    version: 1,
    id: item.id,
    brokerageId: item.brokerage.id,
    auditCount,
    status: item.status,
    updatedAt: item.updatedAt || null,
    showingType: item.showingType || null,
    scheduledStart: item.scheduledStart || null,
    scheduledEnd: item.scheduledEnd || null,
    assignedAgentId: item.assignedAgent?.id || null,
    leadId: item.lead?.id || null,
    propertyId: item.property?.id || null,
    notes: item.notes || "",
    feedback: item.feedback || ""
  });
}

// features/keystone/lib/showingAssociations.ts
var SHOWING_IDENTITY_QUERY = `id brokerage { id status } assignedAgent { id }
  lead { id brokerage { id status } } property { id brokerage { id status } }`;
function record(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function identifier(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 200;
}
function tenantIdentity(value, brokerageId) {
  return record(value) && identifier(value.id) && record(value.brokerage) && value.brokerage.id === brokerageId && value.brokerage.status === "active";
}
function sameShowingIdentity(value, header) {
  return record(value) && value.id === header.id && tenantIdentity(value, header.brokerage.id) && tenantIdentity(value.lead, header.brokerage.id) && value.lead.id === header.lead.id && tenantIdentity(value.property, header.brokerage.id) && value.property.id === header.property.id && (value.assignedAgent === null ? header.assignedAgent === null : record(value.assignedAgent) && value.assignedAgent.id === header.assignedAgent?.id);
}
async function activeShowingAgent(context, agentId, brokerageId) {
  if (agentId === null) return true;
  if (!identifier(agentId)) return false;
  const user = await context.sudo().query.User.findOne({ where: { id: agentId }, query: `id
    brokerageMemberships(where: { status: { equals: active }, brokerage: { id: { equals: ${JSON.stringify(brokerageId)} }, status: { equals: active } } }, take: 1) { status brokerage { id status } }` });
  if (user?.id !== agentId || !Array.isArray(user.brokerageMemberships) || user.brokerageMemberships.length > 1) return false;
  return user.brokerageMemberships.some((membership) => record(membership) && membership.status === "active" && record(membership.brokerage) && membership.brokerage.id === brokerageId && membership.brokerage.status === "active");
}
async function scopedShowingIdentity(context, id, purpose = "showing") {
  const session = context.session;
  const brokerageId = activeBrokerageIds(session)[0];
  if (!identifier(id) || !session?.itemId || !brokerageId || !session.data.role?.canManageShowings) return null;
  const item = await context.sudo().query.Showing.findOne({ where: { id }, query: SHOWING_IDENTITY_QUERY });
  if (!record(item) || item.id !== id || !tenantIdentity(item, brokerageId) || !tenantIdentity(item.lead, brokerageId) || !tenantIdentity(item.property, brokerageId) || !(item.assignedAgent === null || record(item.assignedAgent) && identifier(item.assignedAgent.id))) return null;
  const header = item;
  if (purpose === "showing" && !session.data.role.canManagePeople && header.assignedAgent?.id !== session.itemId) return null;
  if (!await activeShowingAgent(context, header.assignedAgent?.id || null, brokerageId)) return null;
  return header;
}
async function scopedSchedulingIdentity(context, leadId, propertyId, requireCurrentInterest = true) {
  const session = context.session;
  const brokerageId = activeBrokerageIds(session)[0];
  if (!session?.itemId || !brokerageId || !session.data.role?.canManageShowings || !identifier(leadId) || !identifier(propertyId)) return null;
  const lead = await context.sudo().query.Lead.findOne({ where: { id: leadId }, query: "id brokerage { id status } assignedAgent { id } property { id }" });
  if (!record(lead) || lead.id !== leadId || !tenantIdentity(lead, brokerageId) || !(lead.assignedAgent === null || record(lead.assignedAgent) && identifier(lead.assignedAgent.id))) return null;
  if (!session.data.role.canManagePeople && record(lead.assignedAgent) && lead.assignedAgent.id !== session.itemId) return null;
  if (requireCurrentInterest && (!record(lead.property) || lead.property.id !== propertyId)) return null;
  const property = await context.sudo().query.Property.findOne({ where: { id: propertyId }, query: "id brokerage { id status }" });
  if (!tenantIdentity(property, brokerageId) || property.id !== propertyId) return null;
  return { lead, property, brokerageId };
}

// features/keystone/lib/showingEventScope.ts
function record2(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
var SHOWING_EVENT_HEADER_QUERY = "id eventKey eventType requestHash payloadHash aggregateType aggregateId brokerage { id }";
function showingEventPayloadMatches(header, event) {
  if (!record2(header) || !record2(event) || !record2(event.payload) || typeof header.payloadHash !== "string" || event.id !== header.id || event.requestHash !== header.requestHash || event.payloadHash !== header.payloadHash) return false;
  const payload = event.payload;
  if (!record2(header.brokerage) || !record2(event.brokerage) || !record2(payload.aggregate) || event.brokerage.id !== header.brokerage.id || payload.brokerageId !== header.brokerage.id || payload.eventKey !== header.eventKey || payload.eventType !== header.eventType || payload.aggregate.type !== header.aggregateType || payload.aggregate.id !== header.aggregateId) return false;
  try {
    return domainPayloadHash(payload) === header.payloadHash;
  } catch {
    return false;
  }
}
async function ownedShowingEventHeader(context, event, input) {
  const session = context.session;
  if (!session?.itemId || !record2(event) || event.eventKey !== input.eventKey || event.eventType !== input.eventType || typeof event.payloadHash !== "string" || !/^[a-f0-9]{64}$/.test(event.payloadHash) || event.aggregateType !== "showing" || typeof event.aggregateId !== "string" || !record2(event.brokerage)) return false;
  const header = await scopedShowingIdentity(context, event.aggregateId, input.purpose);
  if (!header || event.brokerage.id !== header.brokerage.id || input.leadId !== void 0 && header.lead.id !== input.leadId || input.propertyId !== void 0 && header.property.id !== input.propertyId) return false;
  const audit = await context.sudo().query.DomainAuditEvent.findOne({
    where: { eventKey: `${input.eventKey}:audit` },
    query: "id brokerage { id } actor { id } aggregateType aggregateId"
  });
  return Boolean(audit?.brokerage?.id === header.brokerage.id && audit.actor?.id === session.itemId && audit.aggregateType === "showing" && audit.aggregateId === header.id);
}

// features/keystone/mutations/showingJourney.ts
function showingScopeAllows(context, item) {
  const session = context.session;
  return Boolean(session?.itemId && session.data?.role?.canManageShowings && activeBrokerageIds(session).includes(item?.brokerage?.id) && (session.data.role.canManagePeople || item.assignedAgent?.id === session.itemId));
}
async function ownsShowingScheduleReceipt(scoped, event, leadId, propertyId) {
  const session = scoped.session;
  const payload = event?.payload;
  if (!session?.data?.role?.canManageShowings || payload?.actorId !== session?.itemId || event?.brokerage?.id !== activeBrokerageIds(session)[0] || payload?.brokerageId !== event.brokerage.id || payload?.eventType !== "showing.scheduled" || payload?.aggregate?.type !== "showing" || payload?.request?.leadId !== leadId || payload?.request?.propertyId !== propertyId || domainPayloadHash(payload.request) !== event.requestHash || payload?.result?.ok !== true || typeof payload.result.itemId !== "string" || !payload.result.itemId || payload.aggregate.id !== payload.result.itemId) return false;
  const identity = await scopedSchedulingIdentity(scoped, leadId, propertyId, false);
  if (!identity || identity.brokerageId !== event.brokerage.id) return false;
  const showing = await scopedShowingIdentity(scoped, payload.result.itemId, "owned_receipt");
  return Boolean(showing && showing.lead.id === leadId && showing.property.id === propertyId);
}
function showingSnapshot(property, input, capturedAt) {
  return {
    version: 1,
    capturedAt,
    ...input,
    propertyId: property.id,
    listingTitle: property.title || "",
    listingSlug: property.slug || "",
    addressLine1: property.addressLine1 || "",
    city: property.city || "",
    state: property.state || "",
    listingType: property.listingType || "",
    price: property.price == null ? null : String(property.price),
    propertyUpdatedAt: property.updatedAt || null
  };
}
async function scheduledShowingReceipt(_root, { data }, context) {
  const session = context.session;
  if (!session?.itemId || !session.data?.role?.canManageShowings || !activeBrokerageIds(session).length) return null;
  const leadId = String(data.leadId || "").trim(), propertyId = String(data.propertyId || "").trim();
  const key = String(data.idempotencyKey || "").trim();
  if (!leadId || leadId.length > 200 || !propertyId || propertyId.length > 200 || !key || key.length > 120) return null;
  const request = {
    leadId,
    propertyId,
    assignedAgentId: String(data.assignedAgentId || "").trim(),
    scheduledStart: String(data.scheduledStart || "").trim(),
    notes: String(data.notes || "").trim(),
    ...data.originalActorId == null && data.originalBrokerageId == null ? {} : {
      originalActorId: String(data.originalActorId || "").trim(),
      originalBrokerageId: String(data.originalBrokerageId || "").trim()
    }
  };
  if (request.assignedAgentId.length > 200 || request.scheduledStart.length > 100 || request.notes.length > 5e3) return null;
  return context.transaction(async (tx) => {
    const scoped = await freshOperatorCommandContext(tx.withSession(context.session));
    if (request.originalActorId !== void 0 && (request.originalActorId !== scoped.session?.itemId || request.originalBrokerageId !== activeBrokerageIds(scoped.session)[0])) return null;
    if (!await scopedSchedulingIdentity(scoped, leadId, propertyId, false)) return null;
    const eventKey = `command:lead:${leadId}:schedule-showing:${key}`;
    const eventHeader = await scoped.sudo().query.CommandReceipt.findOne({ where: { eventKey }, query: SHOWING_EVENT_HEADER_QUERY });
    if (!eventHeader || eventHeader.requestHash !== domainPayloadHash(request) || !await ownedShowingEventHeader(scoped, eventHeader, { eventKey, eventType: "showing.scheduled", purpose: "owned_receipt", leadId, propertyId })) return null;
    const event = await scoped.sudo().query.CommandReceipt.findOne({
      where: { eventKey: `command:lead:${leadId}:schedule-showing:${key}` },
      query: "id requestHash payloadHash payload brokerage { id }"
    });
    if (!showingEventPayloadMatches(eventHeader, event) || event.requestHash !== domainPayloadHash(request) || !await ownsShowingScheduleReceipt(scoped, event, leadId, propertyId)) return null;
    const receipt = event.payload?.result?.receipt || (event.payload?.result?.ok === true ? {
      version: 1,
      showingId: event.payload.result.itemId,
      leadId: event.payload?.request?.leadId,
      propertyId: event.payload?.request?.propertyId
    } : null);
    if (event.payload?.result?.ok !== true || typeof receipt?.showingId !== "string" || !receipt.showingId.trim() || receipt.showingId.length > 200 || event.payload?.aggregate?.type !== "showing" || receipt.version !== 1 || receipt.leadId !== leadId || receipt.propertyId !== propertyId || receipt.showingId !== event.payload?.result?.itemId || event.payload?.aggregate?.id !== receipt.showingId) return null;
    const showing = await scopedShowingIdentity(scoped, receipt.showingId, "owned_receipt");
    if (!showing || showing.brokerage.id !== event.brokerage.id || showing.lead.id !== leadId || showing.property.id !== propertyId) return null;
    return { version: 1, showingId: showing.id, leadId, propertyId };
  }, { timeout: 3e4 });
}
var DETAIL_QUERY = `id status showingType scheduledStart scheduledEnd notes feedback createdAt updatedAt
  brokerage { id status } assignedAgent { id }
  property { id brokerage { id status } title slug addressLine1 city state price listingType }
  lead { id brokerage { id status } name email phone status intent }`;
async function scopedShowingPresentation(context, id) {
  const current = context.session;
  const header = await scopedShowingIdentity(context, id);
  if (!header) return null;
  const sudo = context.sudo();
  const item = (await sudo.query.Showing.findMany({
    where: { AND: [
      { id: { equals: id } },
      { brokerage: { id: { in: activeBrokerageIds(current) } } },
      { lead: { id: { equals: header.lead.id }, brokerage: { id: { equals: header.brokerage.id }, status: { equals: "active" } } } },
      { property: { id: { equals: header.property.id }, brokerage: { id: { equals: header.brokerage.id }, status: { equals: "active" } } } },
      ...!current.data.role.canManagePeople ? [{ assignedAgent: { id: { equals: current.itemId } } }] : []
    ] },
    take: 1,
    query: DETAIL_QUERY
  }))[0];
  if (!item || !sameShowingIdentity(item, header) || !showingScopeAllows(context, item)) return null;
  const profile = header.assignedAgent ? await context.query.User.findOne({
    where: { id: header.assignedAgent.id },
    query: "id name email phone"
  }) : null;
  if (profile && profile.id !== header.assignedAgent?.id) return null;
  const showing = {
    id: item.id,
    status: item.status,
    showingType: item.showingType,
    scheduledStart: item.scheduledStart,
    scheduledEnd: item.scheduledEnd,
    notes: item.notes,
    feedback: item.feedback,
    createdAt: item.createdAt,
    lead: { id: item.lead.id, name: item.lead.name, email: item.lead.email, phone: item.lead.phone, status: item.lead.status, intent: item.lead.intent },
    property: {
      id: item.property.id,
      title: item.property.title,
      slug: item.property.slug,
      addressLine1: item.property.addressLine1,
      city: item.property.city,
      state: item.property.state,
      price: item.property.price,
      listingType: item.property.listingType
    },
    assignedAgent: header.assignedAgent ? { id: header.assignedAgent.id, name: profile?.name || "", email: profile?.email || null, phone: profile?.phone || null } : null
  };
  return { header, item, showing };
}
async function platformShowingDetail(_root, { id, before }, context) {
  const session = context.session;
  if (!session?.itemId || !session.data?.role?.canManageShowings || !activeBrokerageIds(session).length) return null;
  if (!id || id.length > 200 || before && before.length > 200) throw new Error("Invalid showing/history identity.");
  return context.transaction(async (tx) => {
    const scoped = await freshOperatorCommandContext(tx.withSession(context.session));
    const current = scoped.session;
    if (!current?.data?.role?.canManageShowings) return null;
    const view = await scopedShowingPresentation(scoped, id);
    if (!view) return null;
    const { item, showing } = view;
    const sudo = scoped.sudo();
    const where = { brokerage: { id: { equals: item.brokerage.id } }, aggregateType: { equals: "showing" }, aggregateId: { equals: id } };
    let anchor = null;
    if (before) {
      anchor = await sudo.query.DomainAuditEvent.findOne({ where: { id: before }, query: "id occurredAt brokerage { id } aggregateType aggregateId" });
      if (!anchor || anchor.brokerage?.id !== item.brokerage.id || anchor.aggregateType !== "showing" || anchor.aggregateId !== id) throw new Error("Invalid showing history cursor.");
    }
    const rows = await sudo.query.DomainAuditEvent.findMany({
      where: { AND: [where, ...anchor ? [{ OR: [
        { occurredAt: { lt: anchor.occurredAt } },
        { occurredAt: { equals: anchor.occurredAt }, id: { lt: anchor.id } }
      ] }] : []] },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: 51,
      query: "id action occurredAt beforeState afterState"
    });
    const origins = await sudo.query.DomainAuditEvent.findMany({
      where: { AND: [where, { action: { in: ["request", "schedule"] } }] },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
      take: 1,
      query: "afterState"
    });
    const snapshot = origins[0]?.afterState?.snapshot;
    const validSnapshot = snapshot?.version === 1 && snapshot.propertyId === item.property?.id && snapshot.leadId === item.lead?.id;
    return {
      showing,
      updatedAt: item.updatedAt,
      revision: await showingReviewRevision(scoped, item),
      snapshot: validSnapshot ? snapshot : null,
      history: rows.slice(0, 50).map((row) => ({
        id: row.id,
        action: row.action,
        occurredAt: row.occurredAt,
        fromStatus: row.beforeState?.status || null,
        toStatus: row.afterState?.status || null
      })),
      nextHistoryCursor: rows.length > 50 ? rows[49].id : null
    };
  }, { timeout: 3e4 });
}

// features/keystone/mutations/leadCapture.ts
function normalizeLeadEmail(value) {
  return String(value || "").trim().toLowerCase();
}
function normalizeLeadPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return national.length >= 7 ? national : "";
}
function leadIdentityKey(email, phone) {
  const normalizedEmail = normalizeLeadEmail(email);
  if (normalizedEmail) return `email:${normalizedEmail}`;
  const normalizedPhone = normalizeLeadPhone(phone);
  return normalizedPhone ? `phone:${normalizedPhone}` : null;
}
async function capturePublicLead(context, input) {
  const identityKey = leadIdentityKey(input.email, input.phone);
  if (!identityKey) throw new Error("A valid lead email or phone number is required.");
  const sudo = context.sudo();
  await sudo.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `public-lead:${input.propertyId}:${identityKey}`);
  const existing = await sudo.query.Lead.findMany({
    where: {
      identityKey: { equals: identityKey },
      property: { id: { equals: input.propertyId } },
      status: { notIn: ["closed", "lost"] }
    },
    orderBy: [{ createdAt: "asc" }],
    take: 1,
    query: "id status assignedAgent { id }"
  });
  if (existing[0]) return { lead: existing[0], reused: true, identityKey };
  const lead = await sudo.query.Lead.createOne({
    data: {
      identityKey,
      name: input.name,
      email: normalizeLeadEmail(input.email),
      phone: String(input.phone || "").trim(),
      intent: input.intent,
      source: input.source,
      status: input.status,
      message: input.message,
      property: { connect: { id: input.propertyId } },
      ...input.assignedAgentId ? { assignedAgent: { connect: { id: input.assignedAgentId } } } : {}
    },
    query: "id status assignedAgent { id }"
  });
  return { lead, reused: false, identityKey };
}
async function firstActiveBrokerageAgent(context, brokerageId, candidates) {
  const ids = [...new Set(candidates.filter((id) => Boolean(id)))];
  if (!ids.length) return null;
  const memberships = await context.sudo().query.BrokerageMembership.findMany({
    where: { user: { id: { in: ids } }, brokerage: { id: { equals: brokerageId }, status: { equals: "active" } }, status: { equals: "active" } },
    take: ids.length * 2,
    query: "user { id }"
  });
  const members = new Set(memberships.map((membership) => membership.user?.id).filter(Boolean));
  return ids.find((id) => members.has(id)) || null;
}

// features/keystone/mutations/requestPropertyShowing.ts
function clean2(value) {
  const trimmed = String(value || "").trim();
  return trimmed.length ? trimmed : "";
}
function validContact(email, phone) {
  const emailValid = !email || email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const phoneDigits = phone.replace(/\D/g, "");
  const phoneValid = !phone || phone.length <= 40 && phoneDigits.length >= 7 && phoneDigits.length <= 15;
  return emailValid && phoneValid && Boolean(email || phone);
}
function validDate(value) {
  const iso = explicitDateTimeToIso(value);
  return iso ? new Date(iso) : null;
}
async function findRoutingAgentId(context, property) {
  const rules2 = await context.sudo().query.LeadRoutingRule.findMany({
    where: { status: { equals: "active" }, brokerage: { id: { equals: property.brokerage.id } } },
    orderBy: [{ priority: "asc" }],
    take: 50,
    query: "intent source city state postalCode isFallback assignedAgent { id }"
  });
  const matching = rules2.find(
    (rule) => rule.assignedAgent?.id && (!rule.intent || rule.intent === "any" || rule.intent === (property.listingType === "rent" ? "rent" : "buy")) && (!rule.source || rule.source === "any" || rule.source === "website") && (!rule.city || rule.city.toLowerCase() === property.city.toLowerCase()) && (!rule.state || rule.state.toLowerCase() === property.state.toLowerCase()) && (!rule.postalCode || rule.postalCode === property.postalCode)
  );
  const fallback = rules2.find((rule) => rule.isFallback && rule.assignedAgent?.id);
  return firstActiveBrokerageAgent(context, property.brokerage.id, [matching?.assignedAgent?.id, property.assignedAgent?.id, fallback?.assignedAgent?.id]);
}
async function requestPropertyShowing(_root, { data }, context) {
  const brokerageSlug = clean2(data.brokerageSlug).toLowerCase();
  const propertyId = clean2(data.propertyId);
  const name = clean2(data.name);
  const email = clean2(data.email);
  const phone = clean2(data.phone);
  const requestedStart = validDate(clean2(data.requestedStart));
  const message = clean2(data.message);
  if (data.showingType && !["in_person", "virtual"].includes(data.showingType)) {
    return { ok: false, message: "Choose an in-person or virtual showing request.", leadId: null, showingId: null };
  }
  const showingType = data.showingType === "virtual" ? "virtual" : "in_person";
  const key = clean2(data.idempotencyKey);
  if (key && !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key)) {
    return { ok: false, message: "A valid showing request key is required.", leadId: null, showingId: null };
  }
  if (!propertyId || propertyId.length > 200 || brokerageSlug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(brokerageSlug) || !name || name.length > 120 || message.length > 5e3 || !validContact(email, phone) || !requestedStart) {
    return { ok: false, message: "Add a listing, valid requested time, name, and email or phone.", leadId: null, showingId: null };
  }
  const brokerages = await context.sudo().query.Brokerage.findMany({ where: { slug: { equals: brokerageSlug }, status: { equals: "active" } }, take: 1, query: "id" });
  if (!brokerages[0]) return { ok: false, message: "This listing is unavailable.", leadId: null, showingId: null };
  const outcome = await context.transaction(async (transactionContext) => {
    const context2 = transactionContext;
    await lockBrokerageCommand(context2, brokerages[0].id);
    await lockPropertyForDecision(context2, propertyId, brokerages[0].id);
    const customerId = context2.session?.itemId || null;
    if (customerId) {
      const customer = await context2.sudo().query.User.findOne({ where: { id: customerId }, query: "id activeBrokerage { id }" });
      if (customer?.activeBrokerage?.id !== brokerages[0].id) return { ok: false, message: "Sign in with an account for this brokerage.", leadId: null, showingId: null };
    }
    const request = { propertyId, name, email: email.toLowerCase(), phone, requestedStart: requestedStart.toISOString(), showingType, message, ...customerId ? { customerId } : {} };
    const eventKey = key ? `public-showing-intent:${brokerages[0].id}:${domainPayloadHash(key)}` : null;
    const requestReference = eventKey ? domainPayloadHash(eventKey) : null;
    if (eventKey) {
      const existing = await context2.sudo().query.CommandReceipt.findOne({ where: { eventKey }, query: "id requestHash brokerage { id }" });
      if (existing) {
        if (existing.brokerage?.id !== brokerages[0].id || existing.requestHash !== domainPayloadHash(request)) {
          return { ok: false, message: "This request key was already used with different details. Contact the brokerage about the original request.", leadId: null, showingId: null };
        }
        return { ok: true, message: "Showing request already received. The advisor must still confirm availability.", leadId: null, showingId: null, requestReference };
      }
    }
    if (requestedStart.getTime() <= Date.now() || requestedStart.getTime() > Date.now() + 365 * 24 * 60 * 6e4) {
      return { ok: false, message: "Choose a requested showing time in the future.", leadId: null, showingId: null };
    }
    const properties = await context2.sudo().query.Property.findMany({
      where: {
        id: { equals: propertyId },
        brokerage: { slug: { equals: brokerageSlug }, status: { equals: "active" } }
      },
      take: 1,
      query: "id title slug status listingType addressLine1 city state postalCode price updatedAt brokerage { id } assignedAgent { id }"
    });
    const property = properties[0];
    if (!property || !["active", "coming_soon"].includes(property.status)) {
      return { ok: false, message: "This listing is no longer accepting showing requests.", leadId: null, showingId: null };
    }
    const listingTimeZone = stateTimeZone(property.state);
    if (listingTimeZone && !withinShowingHours(requestedStart.getTime(), listingTimeZone)) {
      return { ok: false, message: `Choose a time between ${SHOWING_HOURS.first} AM and ${SHOWING_HOURS.last - 12} PM ${timeZoneLabel(listingTimeZone)}.`, leadId: null, showingId: null };
    }
    try {
      await requireListingAuthority(context2, { brokerageId: property.brokerage.id, propertyId, practitionerId: property.assignedAgent?.id || "", jurisdictionCode: property.state, destination: "public_site", showingRequired: true });
    } catch {
      return { ok: false, message: "This listing is not currently authorized for public showing requests.", leadId: null, showingId: null };
    }
    const settings = await context2.sudo().query.BrokerageSettings.findMany({
      where: { brokerage: { id: { equals: property.brokerage.id } } },
      orderBy: [{ createdAt: "asc" }],
      take: 1,
      query: "showingDurationMinutes"
    });
    const duration = Math.min(Math.max(settings[0]?.showingDurationMinutes || 60, 15), 240);
    const scheduledEnd = new Date(requestedStart.getTime() + duration * 6e4);
    const immutableContext = [
      `Public showing request for ${property.title} (${property.slug}).`,
      `Requested start: ${requestedStart.toISOString()}.`,
      message ? `Customer note: ${message}` : ""
    ].filter(Boolean).join("\n");
    const assignedAgentId = await findRoutingAgentId(transactionContext, property);
    const capture = await capturePublicLead(transactionContext, {
      name,
      email,
      phone,
      intent: property.listingType === "rent" ? "rent" : "buy",
      source: "website",
      status: "new",
      message: immutableContext,
      propertyId: property.id,
      assignedAgentId
    });
    const exact = await transactionContext.sudo().query.Showing.findMany({
      where: {
        lead: { id: { equals: capture.lead.id } },
        property: { id: { equals: property.id } },
        scheduledStart: { equals: requestedStart.toISOString() },
        status: { in: ["requested", "scheduled"] },
        // Never attach or disclose another account's/guest's request by email.
        ...customerId ? { customer: { id: { equals: customerId } } } : { customer: null }
      },
      take: 1,
      query: "id"
    });
    if (exact.length) {
      if (eventKey) await enqueueDomainEvent(transactionContext.sudo(), {
        eventKey,
        eventType: "showing.request_intent_received",
        brokerageId: property.brokerage.id,
        aggregateType: "showing",
        aggregateId: exact[0].id,
        action: "request_receipt",
        request,
        after: { requestReference, receiptState: "received", reusedShowing: true }
      });
      return { ok: true, message: "Showing request already received. The assigned agent will confirm availability.", leadId: null, showingId: null, ...eventKey ? { requestReference } : {} };
    }
    const recent = await transactionContext.sudo().query.Showing.findMany({
      where: { lead: { id: { equals: capture.lead.id } }, createdAt: { gte: new Date(Date.now() - 60 * 6e4).toISOString() } },
      take: 5,
      query: "id"
    });
    if (recent.length >= 5) return { ok: false, message: "Unable to accept this request. Please contact the brokerage directly.", leadId: null, showingId: null };
    if (capture.reused) {
      await transactionContext.sudo().query.Lead.updateOne({
        where: { id: capture.lead.id },
        data: {
          ...!capture.lead.assignedAgent?.id && assignedAgentId ? { assignedAgent: { connect: { id: assignedAgentId } } } : {}
        },
        query: "id"
      });
    }
    const showing = await transactionContext.sudo().query.Showing.createOne({
      data: {
        status: "requested",
        showingType,
        scheduledStart: requestedStart.toISOString(),
        scheduledEnd: scheduledEnd.toISOString(),
        notes: immutableContext,
        ...customerId ? { customer: { connect: { id: customerId } } } : {},
        requestSnapshot: showingSnapshot(property, { leadId: capture.lead.id, assignedAgentId, scheduledStart: requestedStart.toISOString(), scheduledEnd: scheduledEnd.toISOString(), showingType, notes: message }, (/* @__PURE__ */ new Date()).toISOString()),
        property: { connect: { id: property.id } },
        lead: { connect: { id: capture.lead.id } },
        ...assignedAgentId ? { assignedAgent: { connect: { id: assignedAgentId } } } : {}
      },
      query: "id"
    });
    const activity = await transactionContext.sudo().query.LeadActivity.createOne({
      data: {
        activityType: "showing_requested",
        direction: "inbound",
        channel: "website",
        subject: capture.reused ? "Repeat contact showing request received" : "Public showing request received",
        body: immutableContext,
        occurredAt: (/* @__PURE__ */ new Date()).toISOString(),
        lead: { connect: { id: capture.lead.id } },
        property: { connect: { id: property.id } },
        showing: { connect: { id: showing.id } },
        ...assignedAgentId ? { agent: { connect: { id: assignedAgentId } } } : {}
      },
      query: "id"
    });
    await enqueueDomainEvent(transactionContext.sudo(), {
      eventKey: `public-showing:${showing.id}`,
      eventType: "showing.requested",
      brokerageId: property.brokerage.id,
      aggregateType: "showing",
      aggregateId: showing.id,
      action: "request",
      request: { propertyId, requestedStart: requestedStart.toISOString(), showingType, identityKey: capture.identityKey },
      before: null,
      after: {
        leadId: capture.lead.id,
        showingId: showing.id,
        activityId: activity.id,
        reusedLead: capture.reused,
        status: "requested",
        snapshot: showingSnapshot(property, {
          leadId: capture.lead.id,
          assignedAgentId,
          scheduledStart: requestedStart.toISOString(),
          scheduledEnd: scheduledEnd.toISOString(),
          showingType,
          notes: message
        }, (/* @__PURE__ */ new Date()).toISOString())
      }
    });
    if (eventKey) await enqueueDomainEvent(transactionContext.sudo(), {
      eventKey,
      eventType: "showing.request_intent_received",
      brokerageId: property.brokerage.id,
      aggregateType: "showing",
      aggregateId: showing.id,
      action: "request_receipt",
      request,
      after: { requestReference, receiptState: "received" }
    });
    return {
      ok: true,
      ...eventKey ? { requestReference } : {},
      message: "Showing requested. The assigned agent will confirm the appointment.",
      leadId: null,
      showingId: null
    };
  }, { timeout: 3e4 });
  return outcome;
}

// features/keystone/lib/leadBoardCursor.ts
var INVALID_LEAD_CURSOR = "Invalid, stale, or mismatched Lead page cursor.";
function leadCursorBinding(scope2) {
  return domainPayloadHash(scope2);
}
function encodeLeadCursor(row, binding) {
  if (!row.id || row.id.length > 200 || !Number.isFinite(new Date(row.at).getTime())) throw new Error(INVALID_LEAD_CURSOR);
  return Buffer.from(JSON.stringify({ version: 1, ...row, binding }), "utf8").toString("base64url");
}
function decodeLeadCursor(value, binding) {
  try {
    if (typeof value !== "string" || !value || value.length > 2048) throw new Error();
    const bytes = Buffer.from(value, "base64url");
    if (bytes.toString("base64url") !== value) throw new Error();
    const parsed = JSON.parse(bytes.toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    const row = parsed;
    if (row.version !== 1 || row.binding !== binding || typeof row.id !== "string" || !row.id || row.id.length > 200 || typeof row.at !== "string" || new Date(row.at).toISOString() !== row.at) throw new Error();
    return { id: row.id, at: row.at };
  } catch {
    throw new Error(INVALID_LEAD_CURSOR);
  }
}

// features/keystone/mutations/leadJourney.ts
var HEADER = "id brokerage { id status } assignedAgent { id } property { id brokerage { id status } } createdAt status";
function record3(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function actorScope(context) {
  const session = context.session;
  const brokerageId = activeBrokerageIds(session)[0];
  if (!session?.itemId || !brokerageId || !session.data.role?.canManageLeads) throw new Error("Lead workspace unavailable.");
  return { session, brokerageId, actorId: session.itemId, managesAll: Boolean(session.data.role.canManagePeople) };
}
function leadWhere(context) {
  const scope2 = actorScope(context);
  return {
    brokerage: { id: { equals: scope2.brokerageId }, status: { equals: "active" } },
    ...!scope2.managesAll ? { assignedAgent: { id: { equals: scope2.actorId } } } : {}
  };
}
async function validHeader(context, value) {
  const scope2 = actorScope(context);
  if (!tenantIdentity(value, scope2.brokerageId) || !record3(value) || typeof value.createdAt !== "string" || !Number.isFinite(new Date(value.createdAt).getTime()) || typeof value.status !== "string" || !(value.property === null || tenantIdentity(value.property, scope2.brokerageId)) || !(value.assignedAgent === null || record3(value.assignedAgent) && typeof value.assignedAgent.id === "string" && value.assignedAgent.id)) return null;
  const header = value;
  if (!scope2.managesAll && header.assignedAgent?.id !== scope2.actorId) return null;
  if (header.assignedAgent) {
    const agent = await context.sudo().query.User.findOne({ where: { id: header.assignedAgent.id }, query: `id
      brokerageMemberships(where: { brokerage: { id: { equals: ${JSON.stringify(scope2.brokerageId)} } } }, take: 1) { brokerage { id status } }` });
    if (agent?.id !== header.assignedAgent.id || !Array.isArray(agent.brokerageMemberships) || agent.brokerageMemberships.length !== 1 || agent.brokerageMemberships[0]?.brokerage?.id !== scope2.brokerageId || agent.brokerageMemberships[0]?.brokerage?.status !== "active") return null;
  }
  return header;
}
async function scopedLeadHeader(context, id) {
  if (!id || id.length > 200) return null;
  const row = (await context.sudo().query.Lead.findMany({ where: { AND: [leadWhere(context), { id: { equals: id } }] }, take: 1, query: HEADER }))[0];
  if (row?.id !== id) return null;
  return validHeader(context, row);
}
async function privateLead(context, header) {
  const row = await context.query.Lead.findOne({ where: { id: header.id }, query: `id brokerage { id }
    name email phone status intent source message lastContactedAt createdAt updatedAt
    property { id title slug city state price listingType } assignedAgent { id name email } showingsCount` });
  if (!row || row.id !== header.id || row.brokerage?.id !== header.brokerage.id) throw new Error("Lead detail unavailable.");
  if (row.property && row.property.id !== header.property?.id) throw new Error("Lead detail unavailable.");
  if (row.assignedAgent && row.assignedAgent.id !== header.assignedAgent?.id) throw new Error("Lead detail unavailable.");
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    intent: row.intent,
    source: row.source,
    message: row.message,
    lastContactedAt: row.lastContactedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    property: row.property ? {
      id: row.property.id,
      title: row.property.title,
      slug: row.property.slug,
      city: row.property.city,
      state: row.property.state,
      price: row.property.price,
      listingType: row.property.listingType
    } : header.property ? { id: header.property.id, title: "", slug: null, city: null, state: null, price: null, listingType: null } : null,
    assignedAgent: row.assignedAgent ? { id: row.assignedAgent.id, name: row.assignedAgent.name, email: row.assignedAgent.email } : header.assignedAgent ? { id: header.assignedAgent.id, name: "", email: "" } : null,
    showingsCount: row.showingsCount,
    activities: [],
    activityAccess: actorScope(context).managesAll ? "available" : "restricted"
  };
}
var ACTIVITY_HEADER = "id occurredAt brokerage { id } lead { id } property { id brokerage { id status } } showing { id brokerage { id status } lead { id brokerage { id status } } property { id brokerage { id status } } } agent { id }";
function validActivityHeader(row, header, brokerageId) {
  return record3(row) && typeof row.id === "string" && Boolean(row.id) && typeof row.occurredAt === "string" && Number.isFinite(new Date(row.occurredAt).getTime()) && record3(row.brokerage) && row.brokerage.id === brokerageId && record3(row.lead) && row.lead.id === header.id && (row.property === null || tenantIdentity(row.property, brokerageId)) && (row.showing === null || tenantIdentity(row.showing, brokerageId) && record3(row.showing) && tenantIdentity(row.showing.lead, brokerageId) && row.showing.lead.id === header.id && tenantIdentity(row.showing.property, brokerageId) && (row.property === null || record3(row.property) && row.showing.property.id === row.property.id));
}
async function activities(context, header, take, before) {
  const scope2 = actorScope(context);
  if (!scope2.managesAll) return { items: [], nextCursor: null, access: "restricted" };
  const where = { brokerage: { id: { equals: scope2.brokerageId } }, lead: { id: { equals: header.id } } };
  const binding = leadCursorBinding({ purpose: "lead_activity", actor: scope2.actorId, brokerage: scope2.brokerageId, leadId: header.id, take });
  const cursor = before === void 0 ? null : decodeLeadCursor(before, binding);
  if (cursor) {
    const anchor = (await context.sudo().query.LeadActivity.findMany({ where: { AND: [where, { id: { equals: cursor.id }, occurredAt: { equals: cursor.at } }] }, take: 1, query: ACTIVITY_HEADER }))[0];
    if (anchor?.id !== cursor.id || !validActivityHeader(anchor, header, scope2.brokerageId)) throw new Error(INVALID_LEAD_CURSOR);
  }
  const rows = await context.sudo().query.LeadActivity.findMany({
    where: { AND: [where, ...cursor ? [{ OR: [
      { occurredAt: { lt: cursor.at } },
      { occurredAt: { equals: cursor.at }, id: { lt: cursor.id } }
    ] }] : []] },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: take + 1,
    query: ACTIVITY_HEADER
  });
  for (const row of rows) {
    if (!validActivityHeader(row, header, scope2.brokerageId)) throw new Error("Lead history unavailable.");
  }
  const items = [];
  for (const candidate of rows.slice(0, take)) {
    const row = await context.query.LeadActivity.findOne({ where: { id: candidate.id }, query: "id activityType direction channel subject body occurredAt brokerage { id } lead { id } agent { id name email }" });
    if (!row || row.id !== candidate.id || row.lead?.id !== header.id || row.brokerage?.id !== scope2.brokerageId || row.occurredAt !== candidate.occurredAt || row.agent && row.agent.id !== candidate.agent?.id) throw new Error("Lead history unavailable.");
    items.push({
      id: row.id,
      activityType: row.activityType,
      direction: row.direction,
      channel: row.channel,
      subject: row.subject,
      body: row.body,
      occurredAt: row.occurredAt,
      agent: row.agent ? { id: row.agent.id, name: row.agent.name, email: row.agent.email } : null
    });
  }
  const last = rows[Math.min(take, rows.length) - 1];
  return { items, nextCursor: rows.length > take && last ? encodeLeadCursor({ id: last.id, at: last.occurredAt }, binding) : null, access: "available" };
}
async function platformShowingRequestViewer(_root, _args, context) {
  return context.transaction(async (tx) => {
    const scoped = await freshOperatorCommandContext(tx.withSession(context.session));
    const session = scoped.session;
    const brokerageId = activeBrokerageIds(session)[0];
    return session?.itemId && brokerageId && session.data.role?.canManageShowings ? { actorId: session.itemId, brokerageId } : null;
  }, { timeout: 3e4 });
}
async function platformLeadDetail(_root, { id, before }, context) {
  return context.transaction(async (tx) => {
    const scoped = await freshOperatorCommandContext(tx.withSession(context.session));
    const scope2 = actorScope(scoped);
    const header = await scopedLeadHeader(scoped, id);
    if (!header) return null;
    const lead = await privateLead(scoped, header);
    const history = await activities(scoped, header, 50, before ?? void 0);
    return {
      lead: { ...lead, activities: history.items },
      activityAccess: history.access,
      nextActivityCursor: history.nextCursor,
      viewer: { actorId: scope2.actorId, brokerageId: scope2.brokerageId }
    };
  }, { timeout: 3e4 });
}
async function leadWorkspace(args, context) {
  return context.transaction(async (tx) => {
    const scoped = await freshOperatorCommandContext(tx.withSession(context.session));
    const scope2 = actorScope(scoped), status = (args.status || "all").trim(), term = (args.q || "").trim();
    if (!["all", "new", "attempted_contact", "qualified", "tour_scheduled", "offer", "closed", "lost"].includes(status)) throw new Error("Lead workspace unavailable.");
    const after2 = args.after ?? void 0, before = args.before ?? void 0;
    if (term.length > 120 || after2 !== void 0 && before !== void 0) throw new Error(INVALID_LEAD_CURSOR);
    const take = Math.min(Math.max(Number(args.take) || 50, 1), 100);
    const filters = [leadWhere(scoped)];
    if (status !== "all") filters.push({ status: { equals: status } });
    if (term) filters.push({ OR: [
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { phone: { contains: term, mode: "insensitive" } },
      { preferredLocation: { contains: term, mode: "insensitive" } }
    ] });
    const binding = leadCursorBinding({ purpose: "lead_board", actor: scope2.actorId, brokerage: scope2.brokerageId, managesAll: scope2.managesAll, status, term, take });
    const backward = before !== void 0;
    const encoded = after2 ?? before;
    const cursor = encoded === void 0 ? null : decodeLeadCursor(encoded, binding);
    if (cursor) {
      const anchor = (await scoped.sudo().query.Lead.findMany({ where: { AND: [...filters, { id: { equals: cursor.id }, createdAt: { equals: cursor.at } }] }, take: 1, query: HEADER }))[0];
      if (!anchor || !await validHeader(scoped, anchor)) throw new Error(INVALID_LEAD_CURSOR);
    }
    const boundary = cursor ? { OR: [
      { createdAt: { [backward ? "gt" : "lt"]: cursor.at } },
      { createdAt: { equals: cursor.at }, id: { [backward ? "gt" : "lt"]: cursor.id } }
    ] } : null;
    const rows = await scoped.sudo().query.Lead.findMany({
      where: { AND: [...filters, ...boundary ? [boundary] : []] },
      orderBy: [{ createdAt: backward ? "asc" : "desc" }, { id: backward ? "asc" : "desc" }],
      take: take + 1,
      query: HEADER
    });
    const selected = rows.slice(0, take);
    if (cursor && !selected.length) throw new Error(INVALID_LEAD_CURSOR);
    if (backward) selected.reverse();
    const items = [];
    for (const row of selected) {
      const header = await validHeader(scoped, row);
      if (!header) throw new Error("Lead workspace unavailable.");
      const lead = await privateLead(scoped, header);
      const history = await activities(scoped, header, 5);
      items.push({ ...lead, activities: history.items });
    }
    const sample = await scoped.query.Lead.findMany({ where: leadWhere(scoped), orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 500, query: "id status identityKey" });
    const buckets = /* @__PURE__ */ new Map();
    for (const row of sample) if (row.identityKey && !["lost", "closed"].includes(row.status)) buckets.set(row.identityKey, [...buckets.get(row.identityKey) || [], row.id]);
    const duplicateGroups = [];
    for (const [key, ids] of [...buckets].filter(([, ids2]) => ids2.length > 1).slice(0, 12)) {
      const candidates = [];
      for (const id of ids) {
        const header = await scopedLeadHeader(scoped, id);
        if (!header) throw new Error("Duplicate scan unavailable.");
        const lead = await privateLead(scoped, header);
        candidates.push({
          id: lead.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          status: lead.status,
          source: lead.source,
          createdAt: lead.createdAt,
          assignedAgent: lead.assignedAgent,
          property: lead.property
        });
      }
      duplicateGroups.push({ key: `identity:${key.slice(0, 12)}`, reason: "Matching normalized contact identity", candidates });
    }
    const count = (status2) => sample.filter((row) => row.status === status2).length;
    const first = selected[0], last = selected[selected.length - 1];
    const hasNextPage = backward ? selected.length > 0 : rows.length > take;
    const hasPreviousPage = backward ? rows.length > take : Boolean(cursor && selected.length);
    return {
      items,
      duplicateGroups,
      stats: { total: sample.length, new: count("new"), qualified: count("qualified"), tourScheduled: count("tour_scheduled"), offer: count("offer") },
      viewer: { actorId: scope2.actorId, brokerageId: scope2.brokerageId },
      pageInfo: {
        hasNextPage,
        hasPreviousPage,
        nextCursor: hasNextPage && last ? encodeLeadCursor({ id: last.id, at: last.createdAt }, binding) : null,
        previousCursor: hasPreviousPage && first ? encodeLeadCursor({ id: first.id, at: first.createdAt }, binding) : null
      }
    };
  }, { timeout: 3e4 });
}

// features/platform/onboarding/lib/seed.json
var seed_default = {
  version: 1,
  vertical: "openfront-real-estate",
  description: "Dependency-ordered starter data for a brokerage: agents, listings, lead routing, leads, showings, and deal pipeline.",
  templateModes: {
    minimal: "One agent, one active listing, one routing rule, one lead, one showing, and one deal.",
    full: "A complete brokerage across buyer, renter, seller, investor, showing, and pipeline workflows."
  },
  dependencyOrder: [
    "brokerages",
    "brokerageSettings",
    "roles",
    "agents",
    "brokerageMemberships",
    "properties",
    "routingRules",
    "leads",
    "leadActivities",
    "showings",
    "deals"
  ],
  sections: {
    brokerages: {
      listKey: "Brokerage",
      description: "Brokerage name applied to the signed-in owner's active brokerage.",
      items: [
        {
          key: "primary",
          label: "Juniper Realty",
          templates: [
            "minimal",
            "full"
          ],
          data: {
            name: "Juniper Realty"
          }
        }
      ]
    },
    brokerageSettings: {
      listKey: "BrokerageSettings",
      description: "Public and dashboard identity for the brokerage.",
      items: [
        {
          key: "primary",
          label: "Juniper Realty",
          templates: [
            "minimal",
            "full"
          ],
          data: {
            brokerage: {
              connect: {
                $ref: "brokerages:primary"
              }
            },
            key: "primary",
            businessName: "Juniper Realty",
            marketLabel: "Austin brokerage",
            city: "Austin",
            state: "TX",
            tagline: "Residences across Austin, chosen with care.",
            description: "Boutique representation for buyers, renters, and sellers across Austin.",
            equalHousingNotice: "Equal housing opportunity.",
            publicPhone: "+1 512 555 0100",
            publicEmail: "hello@juniperrealty.com",
            showingDurationMinutes: 60,
            logoIcon: '<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 14.5264v18.9473l17.8947-12.2437v-18.94741z" fill="#155eef" opacity=".5"/><path d="m0 33.4737v-18.9474l17.8947 12.2438v18.9474z" fill="#1570ef" opacity=".5"/><path d="m40 14.5263v18.9474l-17.8947-12.2438v-18.94737z" fill="#155eef" opacity=".5"/><path d="m40 33.4737v-18.9474l-17.8947 12.2438v18.9474z" fill="#1570ef" opacity=".5"/></svg>',
            logoColor: "270"
          }
        }
      ]
    },
    roles: {
      listKey: "Role",
      description: "Brokerage operator roles used by seeded agents.",
      items: [
        {
          key: "brokerage-admin",
          label: "Brokerage Admin",
          templates: [
            "minimal",
            "full"
          ],
          data: {
            name: "Brokerage Admin",
            canSeeOtherPeople: true,
            canEditOtherPeople: true,
            canManagePeople: true,
            canManageRoles: true,
            canAccessDashboard: true,
            canManageListings: true,
            canManageLeads: true,
            canManageShowings: true,
            canManageDeals: true,
            canViewReports: true,
            canManageOnboarding: true
          }
        },
        {
          key: "listing-agent",
          label: "Listing Agent",
          templates: [
            "full"
          ],
          data: {
            name: "Listing Agent",
            canSeeOtherPeople: true,
            canEditOtherPeople: false,
            canManagePeople: false,
            canManageRoles: false,
            canAccessDashboard: true,
            canManageListings: true,
            canManageLeads: true,
            canManageShowings: true,
            canManageDeals: true,
            canViewReports: false,
            canManageOnboarding: false
          }
        },
        {
          key: "brokerage-analyst",
          label: "Brokerage Analyst",
          templates: [
            "full"
          ],
          data: {
            name: "Brokerage Analyst",
            canSeeOtherPeople: true,
            canEditOtherPeople: false,
            canManagePeople: false,
            canManageRoles: false,
            canAccessDashboard: true,
            canManageListings: false,
            canManageLeads: false,
            canManageShowings: false,
            canManageDeals: false,
            canViewReports: true,
            canManageOnboarding: false
          }
        }
      ]
    },
    agents: {
      listKey: "User",
      description: "Brokerage agents. Sign-in passwords are generated at setup; agents reset them by email.",
      items: [
        {
          key: "maya-chen",
          label: "Maya Chen",
          templates: [
            "minimal",
            "full"
          ],
          data: {
            name: "Maya Chen",
            email: "maya.chen@juniperrealty.com",
            phone: "+1 512 555 0101",
            licenseNumber: "TX-0423118",
            brokerageTitle: "Managing Broker",
            bio: "Luxury listing specialist and speed-to-lead owner for web inquiries.",
            avatarUrl: "/images/real-estate/photos/agents/maya-chen.jpg",
            activeBrokerage: {
              connect: {
                $ref: "brokerages:primary"
              }
            },
            role: {
              connect: {
                $ref: "roles:brokerage-admin"
              }
            }
          }
        },
        {
          key: "omar-patel",
          label: "Omar Patel",
          templates: [
            "full"
          ],
          data: {
            name: "Omar Patel",
            email: "omar.patel@juniperrealty.com",
            phone: "+1 512 555 0102",
            licenseNumber: "TX-0687452",
            brokerageTitle: "Buyer & Rental Specialist",
            bio: "First-time buyer and rental conversion specialist for Austin neighborhoods.",
            avatarUrl: "/images/real-estate/photos/agents/omar-patel.jpg",
            activeBrokerage: {
              connect: {
                $ref: "brokerages:primary"
              }
            },
            role: {
              connect: {
                $ref: "roles:listing-agent"
              }
            }
          }
        },
        {
          key: "evelyn-brooks",
          label: "Evelyn Brooks",
          templates: [
            "full"
          ],
          data: {
            name: "Evelyn Brooks",
            email: "evelyn.brooks@juniperrealty.com",
            phone: "+1 512 555 0103",
            licenseNumber: "TX-0719306",
            brokerageTitle: "Listing Advisor",
            bio: "Seller intake, pricing strategy, and listing launch operations.",
            avatarUrl: "/images/real-estate/photos/agents/evelyn-brooks.jpg",
            activeBrokerage: {
              connect: {
                $ref: "brokerages:primary"
              }
            },
            role: {
              connect: {
                $ref: "roles:listing-agent"
              }
            }
          }
        }
      ]
    },
    brokerageMemberships: {
      listKey: "BrokerageMembership",
      description: "Active memberships in the brokerage.",
      items: [
        {
          key: "maya-admin",
          label: "Maya Chen administrator membership",
          templates: [
            "minimal",
            "full"
          ],
          data: {
            membershipKey: "maya.chen@juniperrealty.com",
            brokerage: {
              connect: {
                $ref: "brokerages:primary"
              }
            },
            user: {
              connect: {
                $ref: "agents:maya-chen"
              }
            },
            membershipRole: "admin",
            status: "active",
            isPrimary: true,
            joinedAt: "2026-01-01T00:00:00.000Z"
          }
        },
        {
          key: "omar-agent",
          label: "Omar Patel agent membership",
          templates: [
            "full"
          ],
          data: {
            membershipKey: "omar.patel@juniperrealty.com",
            brokerage: {
              connect: {
                $ref: "brokerages:primary"
              }
            },
            user: {
              connect: {
                $ref: "agents:omar-patel"
              }
            },
            membershipRole: "agent",
            status: "active",
            isPrimary: true,
            joinedAt: "2026-01-01T00:00:00.000Z"
          }
        },
        {
          key: "evelyn-agent",
          label: "Evelyn Brooks agent membership",
          templates: [
            "full"
          ],
          data: {
            membershipKey: "evelyn.brooks@juniperrealty.com",
            brokerage: {
              connect: {
                $ref: "brokerages:primary"
              }
            },
            user: {
              connect: {
                $ref: "agents:evelyn-brooks"
              }
            },
            membershipRole: "agent",
            status: "active",
            isPrimary: true,
            joinedAt: "2026-01-01T00:00:00.000Z"
          }
        }
      ]
    },
    properties: {
      listKey: "Property",
      description: "Listing inventory for storefront search, listing pages, showings, and the deal pipeline.",
      items: [
        {
          key: "riverfront-loft-austin",
          label: "Riverfront Loft",
          templates: [
            "minimal",
            "full"
          ],
          data: {
            title: "Riverfront Loft with Skyline Views",
            slug: "riverfront-loft-austin",
            status: "active",
            listingType: "sale",
            propertyType: "condo",
            shortDescription: "Turnkey downtown loft with river views, concierge access, and a walkable entertainment district.",
            description: "A bright two-bedroom residence with floor-to-ceiling glass, covered balcony, chef kitchen, secured parking, and an owner suite facing the river trail.",
            addressLine1: "1428 Water Street",
            addressLine2: "Unit 1704",
            city: "Austin",
            state: "TX",
            postalCode: "78701",
            neighborhood: "Rainey Street Historic District",
            latitude: "30.2568000",
            longitude: "-97.7383000",
            price: "825000.00",
            bedrooms: 2,
            bathrooms: "2.0",
            squareFeet: 1450,
            lotSizeSquareFeet: 0,
            yearBuilt: 2018,
            hoaFee: "684.00",
            availableAt: "2026-07-15T15:00:00.000Z",
            isFeatured: true,
            virtualTourUrl: "",
            assignedAgent: {
              connect: {
                $ref: "agents:maya-chen"
              }
            }
          }
        },
        {
          key: "hill-country-estate",
          label: "Hill Country Estate",
          templates: [
            "full"
          ],
          data: {
            title: "Hill Country Estate on Two Acres",
            slug: "hill-country-estate",
            status: "active",
            listingType: "sale",
            propertyType: "house",
            shortDescription: "Private hilltop home with guest casita, pool, and panoramic sunset views.",
            description: "Designed for indoor-outdoor entertaining with limestone terraces, a detached guest casita, three-car garage, office, media room, and resort-style pool.",
            addressLine1: "8801 Mesa Ridge Drive",
            city: "Austin",
            state: "TX",
            postalCode: "78733",
            neighborhood: "Westlake Hills",
            latitude: "30.3152000",
            longitude: "-97.8870000",
            price: "1450000.00",
            bedrooms: 5,
            bathrooms: "4.5",
            squareFeet: 4210,
            lotSizeSquareFeet: 87120,
            yearBuilt: 2015,
            hoaFee: "225.00",
            availableAt: "2026-08-01T15:00:00.000Z",
            isFeatured: true,
            virtualTourUrl: "",
            assignedAgent: {
              connect: {
                $ref: "agents:maya-chen"
              }
            }
          }
        },
        {
          key: "eastside-townhome-rental",
          label: "Eastside Townhome Rental",
          templates: [
            "full"
          ],
          data: {
            title: "Eastside Townhome Near Coffee Row",
            slug: "eastside-townhome-rental",
            status: "coming_soon",
            listingType: "rent",
            propertyType: "townhome",
            shortDescription: "Low-maintenance townhome minutes from transit, restaurants, and the lake trail.",
            description: "Three-level townhome with rooftop deck, attached garage, dedicated office nook, and pet-friendly lease terms.",
            addressLine1: "2409 East 6th Street",
            city: "Austin",
            state: "TX",
            postalCode: "78702",
            neighborhood: "East Cesar Chavez",
            latitude: "30.2601000",
            longitude: "-97.7170000",
            price: "3800.00",
            bedrooms: 3,
            bathrooms: "2.5",
            squareFeet: 1825,
            lotSizeSquareFeet: 1400,
            yearBuilt: 2021,
            availableAt: "2026-08-15T15:00:00.000Z",
            isFeatured: false,
            virtualTourUrl: "",
            leaseTerm: "12 months",
            securityDeposit: 3800,
            petPolicy: "Cats and dogs under 40 lb, $500 pet deposit",
            assignedAgent: {
              connect: {
                $ref: "agents:omar-patel"
              }
            }
          }
        },
        {
          key: "mueller-bungalow",
          label: "Mueller Bungalow",
          templates: [
            "full"
          ],
          data: {
            title: "Updated Bungalow Near Mueller Lake",
            slug: "mueller-bungalow",
            status: "pending",
            listingType: "sale",
            propertyType: "house",
            shortDescription: "Charming renovated bungalow with ADU potential and walkable parks.",
            description: "Restored 1940s bungalow with updated systems, screened porch, mature pecan trees, and a detached studio foundation ready for expansion.",
            addressLine1: "4112 Threadgill Avenue",
            city: "Austin",
            state: "TX",
            postalCode: "78723",
            neighborhood: "Mueller",
            latitude: "30.2986000",
            longitude: "-97.7052000",
            price: "645000.00",
            bedrooms: 3,
            bathrooms: "2.0",
            squareFeet: 1560,
            lotSizeSquareFeet: 6250,
            yearBuilt: 1948,
            availableAt: "2026-07-30T15:00:00.000Z",
            isFeatured: false,
            assignedAgent: {
              connect: {
                $ref: "agents:evelyn-brooks"
              }
            }
          }
        }
      ]
    },
    routingRules: {
      listKey: "LeadRoutingRule",
      description: "Lead assignment rules by intent, source, and geography.",
      items: [
        {
          key: "austin-buyer-web-leads",
          label: "Austin Buyer Web Leads",
          templates: [
            "minimal",
            "full"
          ],
          data: {
            name: "Austin buyer web leads",
            status: "active",
            priority: 10,
            intent: "buy",
            source: "website",
            city: "Austin",
            state: "TX",
            postalCode: "",
            isFallback: false,
            assignedAgent: {
              connect: {
                $ref: "agents:maya-chen"
              }
            }
          }
        },
        {
          key: "rental-leads",
          label: "Rental Leads",
          templates: [
            "full"
          ],
          data: {
            name: "Austin rental leads",
            status: "active",
            priority: 20,
            intent: "rent",
            source: "any",
            city: "Austin",
            state: "TX",
            postalCode: "",
            isFallback: false,
            assignedAgent: {
              connect: {
                $ref: "agents:omar-patel"
              }
            }
          }
        },
        {
          key: "seller-referrals",
          label: "Seller Referrals",
          templates: [
            "full"
          ],
          data: {
            name: "Seller referral intake",
            status: "active",
            priority: 30,
            intent: "sell",
            source: "referral",
            city: "",
            state: "TX",
            postalCode: "",
            isFallback: false,
            assignedAgent: {
              connect: {
                $ref: "agents:evelyn-brooks"
              }
            }
          }
        },
        {
          key: "brokerage-fallback",
          label: "Brokerage Fallback",
          templates: [
            "full"
          ],
          data: {
            name: "Brokerage fallback",
            status: "active",
            priority: 900,
            intent: "any",
            source: "any",
            city: "",
            state: "",
            postalCode: "",
            isFallback: true,
            assignedAgent: {
              connect: {
                $ref: "agents:maya-chen"
              }
            }
          }
        }
      ]
    },
    leads: {
      listKey: "Lead",
      description: "Buyer, renter, seller, and investor leads for CRM queues and reporting.",
      items: [
        {
          key: "sofia-ramirez",
          label: "Sofia Ramirez",
          templates: [
            "minimal",
            "full"
          ],
          data: {
            name: "Sofia Ramirez",
            email: "sofia.ramirez@gmail.com",
            phone: "+1 512 555 0201",
            status: "qualified",
            intent: "buy",
            source: "website",
            budgetMin: "750000",
            budgetMax: "900000",
            preferredLocation: "Downtown Austin, riverfront",
            timeline: "30-45 days",
            message: "Interested in the Riverfront Loft and comparable downtown condos with balcony views.",
            lastContactedAt: "2026-07-08T15:30:00.000Z",
            property: {
              connect: {
                $ref: "properties:riverfront-loft-austin"
              }
            },
            assignedAgent: {
              connect: {
                $ref: "agents:maya-chen"
              }
            }
          }
        },
        {
          key: "jordan-lee",
          label: "Jordan Lee",
          templates: [
            "full"
          ],
          data: {
            name: "Jordan Lee",
            email: "jordan.lee@gmail.com",
            phone: "+1 512 555 0202",
            status: "new",
            intent: "rent",
            source: "website",
            budgetMin: "3200",
            budgetMax: "4200",
            preferredLocation: "East Austin",
            timeline: "Move in by September",
            message: "Needs a pet-friendly rental with a garage and office space.",
            lastContactedAt: "2026-07-08T16:15:00.000Z",
            property: {
              connect: {
                $ref: "properties:eastside-townhome-rental"
              }
            },
            assignedAgent: {
              connect: {
                $ref: "agents:omar-patel"
              }
            }
          }
        },
        {
          key: "priya-shah",
          label: "Priya Shah",
          templates: [
            "full"
          ],
          data: {
            name: "Priya Shah",
            email: "priya.shah@gmail.com",
            phone: "+1 512 555 0203",
            status: "attempted_contact",
            intent: "sell",
            source: "referral",
            budgetMin: null,
            budgetMax: null,
            preferredLocation: "Mueller",
            timeline: "List in 60 days",
            message: "Referral from a past client; wants pricing strategy for a Mueller bungalow.",
            lastContactedAt: "2026-07-07T18:00:00.000Z",
            property: {
              connect: {
                $ref: "properties:mueller-bungalow"
              }
            },
            assignedAgent: {
              connect: {
                $ref: "agents:evelyn-brooks"
              }
            }
          }
        },
        {
          key: "marcus-green",
          label: "Marcus Green",
          templates: [
            "full"
          ],
          data: {
            name: "Marcus Green",
            email: "marcus.green@gmail.com",
            phone: "+1 512 555 0204",
            status: "tour_scheduled",
            intent: "invest",
            source: "zillow",
            budgetMin: "1200000",
            budgetMax: "1600000",
            preferredLocation: "West Austin",
            timeline: "This quarter",
            message: "Evaluating luxury rental yield and long-term appreciation near Westlake.",
            lastContactedAt: "2026-07-08T14:00:00.000Z",
            property: {
              connect: {
                $ref: "properties:hill-country-estate"
              }
            },
            assignedAgent: {
              connect: {
                $ref: "agents:maya-chen"
              }
            }
          }
        }
      ]
    },
    leadActivities: {
      listKey: "LeadActivity",
      description: "Timeline entries that make the lead command center useful immediately after seeding.",
      items: [
        {
          key: "sofia-inquiry",
          label: "Sofia inquiry captured",
          templates: [
            "minimal",
            "full"
          ],
          data: {
            activityType: "inquiry",
            direction: "inbound",
            channel: "website",
            subject: "Listing inquiry",
            body: "Sofia requested a showing for the Riverfront Loft from the public listing page.",
            occurredAt: "2026-07-08T14:55:00.000Z",
            lead: {
              connect: {
                $ref: "leads:sofia-ramirez"
              }
            },
            property: {
              connect: {
                $ref: "properties:riverfront-loft-austin"
              }
            },
            agent: {
              connect: {
                $ref: "agents:maya-chen"
              }
            }
          }
        },
        {
          key: "jordan-rental-note",
          label: "Jordan rental note",
          templates: [
            "full"
          ],
          data: {
            activityType: "note",
            direction: "internal",
            channel: "crm",
            subject: "Rental criteria logged",
            body: "Needs a three-bedroom rental, accepts rooftop stairs, and prefers East Austin restaurants nearby.",
            occurredAt: "2026-07-08T16:20:00.000Z",
            lead: {
              connect: {
                $ref: "leads:jordan-lee"
              }
            },
            property: {
              connect: {
                $ref: "properties:eastside-townhome-rental"
              }
            },
            agent: {
              connect: {
                $ref: "agents:omar-patel"
              }
            }
          }
        },
        {
          key: "marcus-showing-scheduled",
          label: "Marcus showing scheduled",
          templates: [
            "full"
          ],
          data: {
            activityType: "showing_scheduled",
            direction: "outbound",
            channel: "email",
            subject: "Estate tour confirmed",
            body: "Confirmed private tour for Saturday morning with investment analysis follow-up.",
            occurredAt: "2026-07-08T14:05:00.000Z",
            lead: {
              connect: {
                $ref: "leads:marcus-green"
              }
            },
            property: {
              connect: {
                $ref: "properties:hill-country-estate"
              }
            },
            agent: {
              connect: {
                $ref: "agents:maya-chen"
              }
            }
          }
        }
      ]
    },
    showings: {
      listKey: "Showing",
      description: "Tour schedule and feedback data for the showings board.",
      items: [
        {
          key: "sofia-riverfront-tour",
          label: "Sofia Riverfront Loft Tour",
          templates: [
            "minimal",
            "full"
          ],
          data: {
            status: "scheduled",
            showingType: "in_person",
            scheduledStart: "2026-07-10T20:00:00.000Z",
            scheduledEnd: "2026-07-10T20:45:00.000Z",
            notes: "Meet in lobby; client cares most about noise level and parking access.",
            feedback: "",
            property: {
              connect: {
                $ref: "properties:riverfront-loft-austin"
              }
            },
            lead: {
              connect: {
                $ref: "leads:sofia-ramirez"
              }
            },
            assignedAgent: {
              connect: {
                $ref: "agents:maya-chen"
              }
            }
          }
        },
        {
          key: "jordan-eastside-preview",
          label: "Jordan Eastside Rental Preview",
          templates: [
            "full"
          ],
          data: {
            status: "requested",
            showingType: "virtual",
            scheduledStart: "2026-07-11T17:30:00.000Z",
            scheduledEnd: "2026-07-11T18:00:00.000Z",
            notes: "Send FaceTime walkthrough link after owner approves pre-market showing.",
            feedback: "",
            property: {
              connect: {
                $ref: "properties:eastside-townhome-rental"
              }
            },
            lead: {
              connect: {
                $ref: "leads:jordan-lee"
              }
            },
            assignedAgent: {
              connect: {
                $ref: "agents:omar-patel"
              }
            }
          }
        },
        {
          key: "marcus-hill-country-tour",
          label: "Marcus Hill Country Tour",
          templates: [
            "full"
          ],
          data: {
            status: "completed",
            showingType: "in_person",
            scheduledStart: "2026-07-06T16:00:00.000Z",
            scheduledEnd: "2026-07-06T17:15:00.000Z",
            notes: "Private showing with rental pro-forma packet.",
            feedback: "Interested if seller will include furniture package and short-term-rental projections.",
            property: {
              connect: {
                $ref: "properties:hill-country-estate"
              }
            },
            lead: {
              connect: {
                $ref: "leads:marcus-green"
              }
            },
            assignedAgent: {
              connect: {
                $ref: "agents:maya-chen"
              }
            }
          }
        }
      ]
    },
    deals: {
      listKey: "Deal",
      description: "Pipeline cards for buyer, seller, and investor follow-through.",
      items: [
        {
          key: "sofia-riverfront-offer",
          label: "Sofia Riverfront Offer",
          templates: [
            "minimal",
            "full"
          ],
          data: {
            title: "Sofia Ramirez \xB7 Riverfront Loft",
            stage: "offer_drafted",
            transactionType: "buyer",
            offerAmount: "805000.00",
            commissionAmount: "24150.00",
            expectedCloseDate: "2026-08-18T15:00:00.000Z",
            nextStep: "Review HOA docs and submit strongest-and-best offer after tour.",
            notes: "Client is pre-approved and can close quickly if parking terms are acceptable.",
            property: {
              connect: {
                $ref: "properties:riverfront-loft-austin"
              }
            },
            lead: {
              connect: {
                $ref: "leads:sofia-ramirez"
              }
            },
            assignedAgent: {
              connect: {
                $ref: "agents:maya-chen"
              }
            }
          }
        },
        {
          key: "marcus-hill-country-investment",
          label: "Marcus Hill Country Investment",
          templates: [
            "full"
          ],
          data: {
            title: "Marcus Green \xB7 Hill Country Estate",
            stage: "active_search",
            transactionType: "buyer",
            offerAmount: "1375000.00",
            commissionAmount: "41250.00",
            expectedCloseDate: "2026-09-01T15:00:00.000Z",
            nextStep: "Send short-term-rental restrictions summary and furniture package estimate.",
            notes: "Investor wants cap-rate confidence before drafting offer.",
            property: {
              connect: {
                $ref: "properties:hill-country-estate"
              }
            },
            lead: {
              connect: {
                $ref: "leads:marcus-green"
              }
            },
            assignedAgent: {
              connect: {
                $ref: "agents:maya-chen"
              }
            }
          }
        },
        {
          key: "priya-mueller-listing",
          label: "Priya Mueller Listing Prep",
          templates: [
            "full"
          ],
          data: {
            title: "Priya Shah \xB7 Mueller Listing Prep",
            stage: "prospecting",
            transactionType: "seller",
            offerAmount: "645000.00",
            commissionAmount: "19350.00",
            expectedCloseDate: "2026-10-15T15:00:00.000Z",
            nextStep: "Schedule valuation consult and prepare pricing packet.",
            notes: "Potential seller; listing goes live once the listing agreement is signed.",
            property: {
              connect: {
                $ref: "properties:mueller-bungalow"
              }
            },
            lead: {
              connect: {
                $ref: "leads:priya-shah"
              }
            },
            assignedAgent: {
              connect: {
                $ref: "agents:evelyn-brooks"
              }
            }
          }
        }
      ]
    }
  },
  imagePack: {
    description: "Starter photos. Listing covers are uploaded to image storage during setup from public/images/real-estate/covers; agent and neighborhood images are public paths.",
    properties: [
      {
        key: "riverfront-loft-austin",
        photo: "riverfront-loft-austin.jpg",
        title: "River and skyline view",
        altText: "Lady Bird Lake and the downtown Austin skyline at sunset"
      },
      {
        key: "hill-country-estate",
        photo: "hill-country-estate.jpg",
        title: "Front exterior",
        altText: "Stone and stucco Hill Country estate with a polished concrete drive at sunset"
      },
      {
        key: "eastside-townhome-rental",
        photo: "eastside-townhome-rental.jpg",
        title: "Front exterior",
        altText: "Row of modern white stucco townhomes with cedar-slat balconies"
      },
      {
        key: "mueller-bungalow",
        photo: "mueller-bungalow.jpg",
        title: "Front exterior",
        altText: "Renovated bungalow with a deep front porch on a tree-lined Mueller street"
      }
    ],
    agents: [
      {
        key: "maya-chen",
        imagePath: "/images/real-estate/photos/agents/maya-chen.jpg"
      },
      {
        key: "omar-patel",
        imagePath: "/images/real-estate/photos/agents/omar-patel.jpg"
      },
      {
        key: "evelyn-brooks",
        imagePath: "/images/real-estate/photos/agents/evelyn-brooks.jpg"
      }
    ],
    neighborhoods: [
      {
        key: "rainey-street",
        name: "Rainey Street Historic District",
        imagePath: "/images/real-estate/photos/neighborhoods/rainey-street.jpg"
      },
      {
        key: "westlake-hills",
        name: "Westlake Hills",
        imagePath: ""
      },
      {
        key: "east-cesar-chavez",
        name: "East Cesar Chavez",
        imagePath: "/images/real-estate/photos/neighborhoods/east-cesar-chavez.jpg"
      },
      {
        key: "mueller",
        name: "Mueller",
        imagePath: "/images/real-estate/photos/neighborhood-homes.jpg"
      }
    ]
  }
};

// features/platform/onboarding/lib/expansion-seed.json
var expansion_seed_default = {
  version: 1,
  description: "Operations data layered onto the core brokerage setup.",
  anchors: {
    agentEmail: "maya.chen@juniperrealty.com",
    propertySlug: "riverfront-loft-austin",
    leadEmail: "sofia.ramirez@gmail.com",
    dealTitle: "Sofia Ramirez \xB7 Riverfront Loft",
    showingNotes: "Meet in lobby; client cares most about noise level and parking access."
  },
  records: [
    {
      listKey: "Neighborhood",
      id: "seed-neighborhood-downtown-harbor",
      data: {
        name: "Downtown Harbor",
        slug: "downtown-harbor",
        city: "Austin",
        state: "TX",
        overview: "Walkable waterfront district with mixed-use residences and strong buyer demand.",
        schoolDistrict: "Austin Independent School District",
        walkScore: 91,
        transitScore: 72,
        medianSalePrice: "925000.00",
        medianRent: "4200.00",
        activeListings: 18,
        averageDaysOnMarket: 21
      }
    },
    {
      listKey: "PropertyMedia",
      id: "seed-media-harbor-hero",
      lookup: {
        title: "Riverfront Loft Hero Photo"
      },
      data: {
        title: "Riverfront Loft Hero Photo",
        mediaType: "photo",
        url: "/images/real-estate/photos/interior-fireplace.jpg",
        altText: "Living room of the Riverfront Loft with floor-to-ceiling windows",
        caption: "Riverfront Loft living room and skyline view.",
        sortOrder: 1,
        isHero: false,
        property: {
          $anchor: "property"
        }
      }
    },
    {
      listKey: "PropertyInspection",
      id: "seed-inspection-harbor-general",
      lookup: {
        title: "General Inspection - Riverfront Loft"
      },
      data: {
        title: "General Inspection - Riverfront Loft",
        inspectionType: "general",
        status: "completed",
        scheduledAt: "2026-06-28T18:56:48.359Z",
        completedAt: "2026-06-29T18:56:48.359Z",
        inspectorName: "Marta Ruiz",
        inspectorEmail: "marta@centraltexasinspections.com",
        estimatedCost: "650.00",
        summary: "Overall good condition with a minor HVAC service recommendation.",
        findings: "HVAC filter overdue; balcony railing has cosmetic wear.",
        property: {
          $anchor: "property"
        },
        deal: {
          $anchor: "deal"
        }
      }
    },
    {
      listKey: "Offer",
      id: "seed-offer-harbor-001",
      data: {
        offerNumber: "OFFER-HARBOR-001",
        status: "accepted",
        amount: "910000.00",
        earnestMoney: "25000.00",
        financingType: "conventional",
        contingencies: "Inspection and financing contingencies with a 21-day close.",
        submittedAt: "2026-06-24T18:56:48.359Z",
        responseDueAt: "2026-06-26T18:56:48.359Z",
        acceptedAt: "2026-06-27T18:56:48.359Z",
        acceptedSnapshot: {
          version: 1,
          capturedAt: "2026-06-27T18:56:48.359Z",
          offerNumber: "OFFER-HARBOR-001",
          amount: "910000.00",
          earnestMoney: "25000.00",
          financingType: "conventional",
          contingencies: "Inspection and financing contingencies with a 21-day close.",
          submittedAt: "2026-06-24T18:56:48.359Z",
          responseDueAt: "2026-06-26T18:56:48.359Z",
          property: {
            title: "Riverfront Loft with Skyline Views",
            slug: "riverfront-loft-austin",
            addressLine1: "1428 Water Street",
            city: "Austin",
            state: "TX"
          },
          deal: {
            title: "Sofia Ramirez \xB7 Riverfront Loft"
          },
          lead: {
            name: "Sofia Ramirez",
            email: "sofia.ramirez@gmail.com"
          },
          assignedAgent: {
            name: "Maya Chen"
          }
        },
        property: {
          $anchor: "property"
        },
        deal: {
          $anchor: "deal"
        },
        lead: {
          $anchor: "lead"
        },
        assignedAgent: {
          $anchor: "agent"
        }
      }
    },
    {
      listKey: "DealDocument",
      id: "seed-doc-harbor-disclosure",
      lookup: {
        title: "Riverfront Loft Seller Disclosure"
      },
      data: {
        title: "Riverfront Loft Seller Disclosure",
        documentType: "disclosure",
        status: "signed",
        fileUrl: "/documents/real-estate/riverfront-loft-disclosure.pdf",
        requiresSignature: true,
        sentAt: "2026-06-25T18:56:48.359Z",
        signedAt: "2026-06-26T18:56:48.359Z",
        expiresAt: "2026-09-06T18:56:48.359Z",
        notes: "Signed seller disclosure package.",
        deal: {
          $anchor: "deal"
        },
        property: {
          $anchor: "property"
        },
        uploadedBy: {
          $anchor: "agent"
        }
      }
    },
    {
      listKey: "Commission",
      id: "seed-commission-harbor-buy-side",
      lookup: {
        title: "Riverfront Loft Buyer Side Commission"
      },
      data: {
        title: "Riverfront Loft Buyer Side Commission",
        status: "approved",
        side: "buyer",
        grossCommission: "27300.00",
        brokerageSplitPercent: "30.00",
        agentSplitPercent: "70.00",
        netCommission: "19110.00",
        notes: "Projected buyer-side commission split.",
        deal: {
          $anchor: "deal"
        },
        property: {
          $anchor: "property"
        },
        agent: {
          $anchor: "agent"
        }
      }
    },
    {
      listKey: "SavedSearch",
      id: "seed-saved-search-downtown-condos",
      lookup: {
        name: "Downtown Austin residences under 1M"
      },
      data: {
        name: "Downtown Austin residences under 1M",
        city: "Austin",
        state: "TX",
        propertyType: "Condo",
        minPrice: "650000.00",
        maxPrice: "1000000.00",
        minBedrooms: 2,
        minBathrooms: "2.0",
        minSquareFeet: 900,
        keywords: "waterfront, walkable, balcony",
        alertsEnabled: true,
        lastNotifiedAt: "2026-07-07T18:56:48.359Z",
        brokerage: {
          $anchor: "brokerage"
        },
        user: {
          $anchor: "agent"
        }
      }
    },
    {
      listKey: "SavedProperty",
      id: "seed-saved-property-riverfront",
      lookup: {
        property: {
          $anchor: "property"
        },
        user: {
          $anchor: "agent"
        }
      },
      data: {
        status: "interested",
        notes: "Shortlisted for Sofia Ramirez; compare against downtown comps.",
        property: {
          $anchor: "property"
        },
        user: {
          $anchor: "agent"
        }
      }
    },
    {
      listKey: "MarketComp",
      id: "seed-comp-waterfront-12b",
      lookup: {
        addressLine1: "1200 Waterfront Avenue #12B"
      },
      data: {
        addressLine1: "1200 Waterfront Avenue #12B",
        city: "Austin",
        state: "TX",
        postalCode: "78701",
        status: "sold",
        listPrice: "899000.00",
        salePrice: "912000.00",
        soldAt: "2026-05-24T18:56:48.359Z",
        bedrooms: 2,
        bathrooms: "2.0",
        squareFeet: 1120,
        distanceMiles: "0.40",
        sourceUrl: "/listings/riverfront-loft-austin",
        notes: "Closest recent sale in the same waterfront micro-market.",
        subjectProperty: {
          $anchor: "property"
        },
        neighborhood: {
          $record: "seed-neighborhood-downtown-harbor"
        }
      }
    },
    {
      listKey: "AgentTeam",
      id: "seed-agent-team-harbor",
      data: {
        brokerage: {
          $anchor: "brokerage"
        },
        name: "Waterfront Buyer Team",
        slug: "waterfront-buyer-team",
        teamType: "buyer",
        status: "active",
        description: "Buyer agents focused on downtown and waterfront residences.",
        leadAgent: {
          $anchor: "agent"
        }
      }
    },
    {
      listKey: "AgentTask",
      id: "seed-agent-task-title-followup",
      lookup: {
        title: "Confirm title exceptions cleared"
      },
      data: {
        title: "Confirm title exceptions cleared",
        status: "in_progress",
        priority: "high",
        dueAt: "2026-07-10T18:56:48.359Z",
        notes: "Call the title officer and update the closing checklist.",
        assignedAgent: {
          $anchor: "agent"
        },
        property: {
          $anchor: "property"
        },
        lead: {
          $anchor: "lead"
        },
        deal: {
          $anchor: "deal"
        }
      }
    },
    {
      listKey: "ListingSyndication",
      id: "seed-syndication-harbor-mls",
      lookup: {
        externalListingId: "MLS-HARBOR-001"
      },
      data: {
        channel: "mls",
        property: {
          $anchor: "property"
        },
        status: "published",
        externalListingId: "MLS-HARBOR-001",
        listingUrl: "/listings/riverfront-loft-austin",
        publishedAt: "2026-06-18T18:56:48.359Z",
        lastSyncedAt: "2026-07-08T17:56:48.359Z",
        errorMessage: "",
        metadata: {
          feed: "reso-web-api"
        }
      }
    },
    {
      listKey: "SourceFeed",
      id: "seed-sourcefeed-austin-reso",
      lookup: {
        name: "Austin RESO Feed"
      },
      data: {
        name: "Austin RESO Feed",
        provider: "Austin Board of REALTORS",
        feedType: "reso",
        status: "active",
        lastImportedAt: "2026-07-08T18:26:48.359Z",
        recordsImported: 128,
        credentials: {},
        metadata: {
          region: "Austin"
        },
        brokerage: {
          $anchor: "brokerage"
        }
      }
    },
    {
      listKey: "OpenHouse",
      id: "seed-openhouse-harbor-saturday",
      lookup: {
        title: "Saturday Riverfront Loft Open House"
      },
      data: {
        title: "Saturday Riverfront Loft Open House",
        property: {
          $anchor: "property"
        },
        hostAgent: {
          $anchor: "agent"
        },
        status: "completed",
        startsAt: "2026-07-02T18:56:48.359Z",
        endsAt: "2026-07-02T20:56:48.359Z",
        attendeeCount: 18,
        notes: "Strong traffic; two repeat visitors requested disclosures.",
        metadata: {
          weather: "sunny"
        }
      }
    },
    {
      listKey: "ShowingFeedback",
      id: "seed-feedback-harbor-showing",
      lookup: {
        showing: {
          $anchor: "showing"
        }
      },
      data: {
        showing: {
          $anchor: "showing"
        },
        lead: {
          $anchor: "lead"
        },
        property: {
          $anchor: "property"
        },
        rating: 5,
        interestLevel: "offer_likely",
        comments: "Loved the balcony and walkability; requested the HOA documents.",
        priceOpinion: "905000.00",
        followUpRequired: true,
        metadata: {
          source: "agent_app"
        }
      }
    },
    {
      listKey: "Escrow",
      id: "seed-escrow-harbor",
      data: {
        escrowNumber: "ESC-HARBOR-001",
        deal: {
          $anchor: "deal"
        },
        property: {
          $anchor: "property"
        },
        status: "pending",
        escrowCompany: "Lone Star Escrow",
        officerName: "Nina Patel",
        officerEmail: "nina.patel@lonestarescrow.com",
        openedAt: "2026-06-27T18:56:48.359Z",
        scheduledCloseAt: "2026-07-18T18:56:48.359Z",
        depositAmount: "25000.00",
        metadata: {
          branch: "downtown"
        }
      }
    },
    {
      listKey: "TitleOrder",
      id: "seed-title-harbor",
      data: {
        orderNumber: "TITLE-HARBOR-001",
        deal: {
          $anchor: "deal"
        },
        property: {
          $anchor: "property"
        },
        titleCompany: "Austin Title Company",
        status: "in_review",
        orderedAt: "2026-06-28T18:56:48.359Z",
        exceptions: "Pending HOA lien release confirmation.",
        metadata: {
          escrow: "seed-escrow-harbor"
        }
      }
    },
    {
      listKey: "MortgageApplication",
      id: "seed-mortgage-harbor",
      data: {
        applicationNumber: "MORT-HARBOR-001",
        deal: {
          $anchor: "deal"
        },
        lead: {
          $anchor: "lead"
        },
        lenderName: "Austin Community Credit Union",
        status: "underwriting",
        loanAmount: "728000.00",
        interestRate: "6.375",
        submittedAt: "2026-06-29T18:56:48.359Z",
        metadata: {
          loanType: "conventional"
        }
      }
    },
    {
      listKey: "TransactionMilestone",
      id: "seed-milestone-harbor-title",
      lookup: {
        name: "Title review complete"
      },
      data: {
        name: "Title review complete",
        deal: {
          $anchor: "deal"
        },
        status: "in_progress",
        dueAt: "2026-07-11T18:56:48.359Z",
        assignedTo: {
          $anchor: "agent"
        },
        sortOrder: 30,
        notes: "Waiting on HOA lien release confirmation.",
        metadata: {
          escrowId: "seed-escrow-harbor"
        }
      }
    },
    {
      listKey: "PropertyValuation",
      id: "seed-valuation-harbor-cma",
      data: {
        valuationNumber: "VAL-HARBOR-001",
        property: {
          $anchor: "property"
        },
        valuationType: "cma",
        lowValue: "885000.00",
        estimatedValue: "915000.00",
        highValue: "940000.00",
        performedBy: {
          $anchor: "agent"
        },
        valuedAt: "2026-06-20T18:56:48.359Z",
        notes: "CMA based on three waterfront residence comps.",
        metadata: {
          compCount: 3
        }
      }
    },
    {
      listKey: "Disclosure",
      id: "seed-disclosure-harbor-hoa",
      lookup: {
        title: "HOA Disclosure Packet"
      },
      data: {
        title: "HOA Disclosure Packet",
        property: {
          $anchor: "property"
        },
        deal: {
          $anchor: "deal"
        },
        disclosureType: "hoa",
        status: "acknowledged",
        documentUrl: "/documents/real-estate/riverfront-loft-hoa.pdf",
        sentAt: "2026-06-30T18:56:48.359Z",
        acknowledgedAt: "2026-07-01T18:56:48.359Z",
        metadata: {
          pages: 42
        }
      }
    },
    {
      listKey: "SavedSearchAlert",
      id: "seed-alert-downtown-condos",
      lookup: {
        savedSearch: {
          $record: "seed-saved-search-downtown-condos"
        }
      },
      data: {
        savedSearch: {
          $record: "seed-saved-search-downtown-condos"
        },
        user: {
          $anchor: "agent"
        },
        status: "active",
        cadence: "daily",
        lastSentAt: "2026-07-07T18:56:48.359Z",
        sentCount: 7,
        metadata: {
          lastMatch: "seed-media-harbor-hero"
        }
      }
    }
  ]
};

// features/platform/onboarding/lib/authority-seed.json
var authority_seed_default = {
  recorderEmail: "maya.chen@juniperrealty.com",
  jurisdictionCode: "TX",
  effectiveFrom: "2026-01-01T00:00:00.000Z",
  effectiveThrough: "2035-01-01T00:00:00.000Z",
  verifiedAt: "2026-01-01T00:00:00.000Z",
  practitioners: [
    {
      key: "maya-chen",
      email: "maya.chen@juniperrealty.com",
      licenseType: "broker",
      licenseNumber: "TX-0423118"
    },
    {
      key: "omar-patel",
      email: "omar.patel@juniperrealty.com",
      licenseType: "sales_agent",
      licenseNumber: "TX-0687452"
    },
    {
      key: "evelyn-brooks",
      email: "evelyn.brooks@juniperrealty.com",
      licenseType: "sales_agent",
      licenseNumber: "TX-0719306"
    }
  ],
  listings: [
    {
      key: "riverfront-loft-austin",
      propertySlug: "riverfront-loft-austin",
      practitionerKey: "maya-chen",
      engagementNumber: "LA-2026-0001",
      publicationNumber: "PUB-2026-0001"
    },
    {
      key: "hill-country-estate",
      propertySlug: "hill-country-estate",
      practitionerKey: "maya-chen",
      engagementNumber: "LA-2026-0002",
      publicationNumber: "PUB-2026-0002"
    },
    {
      key: "eastside-townhome-rental",
      propertySlug: "eastside-townhome-rental",
      practitionerKey: "omar-patel",
      engagementNumber: "LA-2026-0003",
      publicationNumber: "PUB-2026-0003"
    },
    {
      key: "mueller-bungalow",
      propertySlug: "mueller-bungalow",
      practitionerKey: "evelyn-brooks",
      engagementNumber: "LA-2026-0004",
      publicationNumber: "PUB-2026-0004"
    }
  ]
};

// features/keystone/onboarding/authority-runtime.ts
var import_node_crypto2 = __toESM(require("node:crypto"));
function list46(context, key) {
  const operations = context.query[key];
  if (!operations) throw new Error(`Brokerage setup requires the ${key} list.`);
  return operations;
}
async function one(context, key, where, query, label) {
  const rows = await list46(context, key).findMany({ where, take: 2, query });
  if (rows.length !== 1) throw new Error(`Brokerage setup could not find exactly one ${label}.`);
  return rows[0];
}
function sha256(value) {
  return import_node_crypto2.default.createHash("sha256").update(value).digest("hex");
}
function effective(item, status, evaluatedAt) {
  return item?.status === status && new Date(item.effectiveFrom) <= evaluatedAt && new Date(item.effectiveThrough) >= evaluatedAt;
}
async function applyAuthoritySeed(context, seed, target, log = () => void 0, evaluatedAt = /* @__PURE__ */ new Date()) {
  const from = new Date(seed.effectiveFrom), through = new Date(seed.effectiveThrough), verified = new Date(seed.verifiedAt);
  if (![from, through, verified, evaluatedAt].every((date) => Number.isFinite(date.getTime())) || from >= through || verified < from || verified > evaluatedAt) {
    throw new Error("License setup requires a valid effective and verification period.");
  }
  const brokerage = await one(context, "Brokerage", { id: { equals: target.id } }, "id slug status", "brokerage");
  const recorder = await one(context, "User", { email: { equals: seed.recorderEmail } }, "id email activeBrokerage { id } brokerageMemberships(where: { status: { equals: active } }) { brokerage { id status } }", "managing broker");
  const recorderAuthorized = recorder.activeBrokerage?.id === brokerage.id && recorder.brokerageMemberships?.some((membership) => membership.brokerage?.id === brokerage.id && membership.brokerage?.status === "active");
  if (brokerage.status !== "active" || !recorderAuthorized) {
    const total = seed.practitioners.length + seed.listings.length * 2;
    log("managing broker is inactive or moved; no authority recorded");
    return { created: 0, skipped: 0, blocked: total, total };
  }
  let created = 0, skipped = 0, blocked = 0;
  const practitioners = /* @__PURE__ */ new Map();
  for (const practitioner of seed.practitioners) {
    if (!["broker", "associate_broker", "sales_agent"].includes(practitioner.licenseType)) throw new Error(`Agent ${practitioner.key} has an invalid license type.`);
    const user = await one(context, "User", { email: { equals: practitioner.email } }, "id email activeBrokerage { id } brokerageMemberships(where: { status: { equals: active } }) { brokerage { id status } }", `agent ${practitioner.key}`);
    const member = user.activeBrokerage?.id === brokerage.id && user.brokerageMemberships?.some((membership) => membership.brokerage?.id === brokerage.id && membership.brokerage?.status === "active");
    if (!member) {
      blocked += 1;
      log(`agent ${practitioner.key} is suspended or moved; no license recorded`);
      continue;
    }
    const licenseNumber = practitioner.licenseNumber;
    const rows = await list46(context, "PractitionerLicenseAuthority").findMany({
      where: { brokerage: { id: { equals: brokerage.id } }, practitioner: { id: { equals: user.id } }, jurisdictionCode: { equals: seed.jurisdictionCode } },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      take: 50,
      query: "id licenseNumber status effectiveFrom effectiveThrough verificationSource"
    });
    let license = rows.find((row) => row.licenseNumber === licenseNumber);
    if (!license && rows.length) {
      blocked += 1;
      log(`keep existing license for ${practitioner.key}`);
      continue;
    }
    if (!license) {
      license = await list46(context, "PractitionerLicenseAuthority").createOne({ data: {
        brokerage: { connect: { id: brokerage.id } },
        practitioner: { connect: { id: user.id } },
        licenseNumber,
        licenseType: practitioner.licenseType,
        jurisdictionCode: seed.jurisdictionCode,
        status: "verified_active",
        effectiveFrom: seed.effectiveFrom,
        effectiveThrough: seed.effectiveThrough,
        verifiedAt: seed.verifiedAt,
        verificationSource: "Texas Real Estate Commission license search",
        restrictions: "",
        reason: "License recorded during brokerage setup.",
        verifiedBy: { connect: { id: recorder.id } }
      }, query: "id licenseNumber status effectiveFrom effectiveThrough verificationSource" });
      created += 1;
    } else {
      skipped += 1;
    }
    const latest = rows[0] || license;
    if (latest.id === license.id && effective(license, "verified_active", evaluatedAt)) {
      practitioners.set(practitioner.key, { user, license });
    } else {
      blocked += 1;
      log(`license for ${practitioner.key} is not current`);
    }
  }
  for (const listing of seed.listings) {
    const practitioner = practitioners.get(listing.practitionerKey);
    if (!practitioner) {
      blocked += 2;
      continue;
    }
    const property = await one(context, "Property", { slug: { equals: listing.propertySlug }, brokerage: { id: { equals: brokerage.id } } }, "id slug title state assignedAgent { id } brokerage { id }", `listing ${listing.key}`);
    if (property.brokerage?.id !== brokerage.id || property.assignedAgent?.id !== practitioner.user.id || property.state !== seed.jurisdictionCode) {
      blocked += 2;
      log(`listing ${listing.key} was reassigned or moved; no authority recorded`);
      continue;
    }
    const engagementNumber = listing.engagementNumber;
    const engagementRows = await list46(context, "ListingEngagementAuthority").findMany({
      where: { brokerage: { id: { equals: brokerage.id } }, property: { id: { equals: property.id } } },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      take: 50,
      query: "id authorityNumber status effectiveFrom effectiveThrough marketingAuthorized showingAuthorized assignedPractitioner { id }"
    });
    let engagement = engagementRows.find((row) => row.authorityNumber === engagementNumber);
    if (!engagement && engagementRows.length) {
      blocked += 2;
      log(`keep existing listing agreement for ${listing.key}`);
      continue;
    }
    if (!engagement) {
      const agreementSummary = `Owner authorizes the brokerage to market and show ${property.title} (${property.slug}) through ${through.toISOString().slice(0, 10)}.`;
      engagement = await list46(context, "ListingEngagementAuthority").createOne({ data: {
        brokerage: { connect: { id: brokerage.id } },
        authorityNumber: engagementNumber,
        property: { connect: { id: property.id } },
        assignedPractitioner: { connect: { id: practitioner.user.id } },
        status: "executed",
        jurisdictionCode: seed.jurisdictionCode,
        effectiveFrom: seed.effectiveFrom,
        effectiveThrough: seed.effectiveThrough,
        exclusive: false,
        marketingAuthorized: true,
        showingAuthorized: true,
        sellerPartySummary: { summary: agreementSummary },
        signatoryCapacity: "Property owner",
        documentSha256: sha256(agreementSummary),
        reason: "Listing agreement recorded during brokerage setup.",
        recordedBy: { connect: { id: recorder.id } },
        recordedAt: seed.verifiedAt
      }, query: "id authorityNumber status effectiveFrom effectiveThrough marketingAuthorized showingAuthorized assignedPractitioner { id }" });
      created += 1;
    } else {
      skipped += 1;
    }
    const latestEngagement = engagementRows[0] || engagement;
    if (latestEngagement.id !== engagement.id || !effective(engagement, "executed", evaluatedAt) || !engagement.marketingAuthorized || !engagement.showingAuthorized || engagement.assignedPractitioner?.id !== practitioner.user.id) {
      blocked += 1;
      log(`listing agreement for ${listing.key} is revoked, expired, or superseded`);
      continue;
    }
    const publicationNumber = listing.publicationNumber;
    const publicationRows = await list46(context, "ListingPublicationAuthority").findMany({
      where: { brokerage: { id: { equals: brokerage.id } }, property: { id: { equals: property.id } }, destination: { equals: "public_site" } },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      take: 50,
      query: "id authorityNumber status effectiveFrom effectiveThrough authorityBasis engagement { id }"
    });
    let publication = publicationRows.find((row) => row.authorityNumber === publicationNumber);
    if (!publication && publicationRows.length) {
      blocked += 1;
      log(`keep existing website publication for ${listing.key}`);
      continue;
    }
    if (!publication) {
      publication = await list46(context, "ListingPublicationAuthority").createOne({ data: {
        brokerage: { connect: { id: brokerage.id } },
        authorityNumber: publicationNumber,
        property: { connect: { id: property.id } },
        engagement: { connect: { id: engagement.id } },
        destination: "public_site",
        status: "authorized",
        effectiveFrom: seed.effectiveFrom,
        effectiveThrough: seed.effectiveThrough,
        authorityBasis: `Listing agreement ${engagementNumber}`,
        localRuleReference: "TREC advertising rules (22 TAC \xA7535.155)",
        dataUseGrantReference: "Brokerage-owned listing content",
        reason: "Publish the listing on the brokerage website and accept showing requests.",
        recordedBy: { connect: { id: recorder.id } },
        recordedAt: seed.verifiedAt
      }, query: "id authorityNumber status effectiveFrom effectiveThrough authorityBasis engagement { id }" });
      created += 1;
    } else {
      skipped += 1;
    }
    const latestPublication = publicationRows[0] || publication;
    if (latestPublication.id !== publication.id || !effective(publication, "authorized", evaluatedAt) || publication.engagement?.id !== engagement.id) {
      blocked += 1;
      log(`website publication for ${listing.key} is revoked, expired, or superseded`);
    }
  }
  return { created, skipped, blocked, total: seed.practitioners.length + seed.listings.length * 2 };
}

// features/keystone/onboarding/seed-covers.ts
var import_node_fs = require("node:fs");
var import_node_path = __toESM(require("node:path"));
var import_Upload = __toESM(require("graphql-upload/Upload.js"));
var COVER_PHOTO_DIR = import_node_path.default.join(process.cwd(), "public/images/real-estate/covers");
var MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
function fileUpload(filePath) {
  const upload = new import_Upload.default();
  const filename = import_node_path.default.basename(filePath);
  upload.resolve({
    filename,
    mimetype: MIME[import_node_path.default.extname(filename).toLowerCase()] || "application/octet-stream",
    encoding: "7bit",
    createReadStream: () => (0, import_node_fs.createReadStream)(
      /*turbopackIgnore: true*/
      filePath
    )
  });
  return upload;
}
async function applySeedCovers(context, covers, propertySlugs, target, { upload = fileUpload } = {}) {
  const properties = context.query.Property, media = context.query.PropertyMedia;
  if (!properties || !media) throw new Error("Cover photos need the Property and PropertyMedia lists.");
  const result = { created: 0, skipped: 0, total: 0, missing: [] };
  for (const cover of covers.filter((item) => propertySlugs.has(item.key))) {
    result.total += 1;
    const [property] = await properties.findMany({ where: { slug: { equals: cover.key }, brokerage: { id: { equals: target.id } } }, take: 1, query: "id" });
    if (!property?.id) {
      result.missing.push(cover.key);
      continue;
    }
    const existing = await media.findMany({ where: { property: { id: { equals: property.id } }, isHero: { equals: true } }, take: 1, query: "id" });
    if (existing[0]?.id) {
      result.skipped += 1;
      continue;
    }
    const file = import_node_path.default.join(COVER_PHOTO_DIR, import_node_path.default.basename(cover.photo));
    if (!(0, import_node_fs.existsSync)(file)) {
      result.missing.push(cover.key);
      continue;
    }
    try {
      await media.createOne({
        data: { property: { connect: { id: property.id } }, title: cover.title, altText: cover.altText, mediaType: "photo", isHero: true, sortOrder: 0, image: { upload: upload(file) } },
        query: "id"
      });
      result.created += 1;
    } catch {
      result.missing.push(cover.key);
    }
  }
  return result;
}

// features/keystone/onboarding/seed-runtime.ts
var import_node_crypto4 = require("node:crypto");

// features/keystone/lib/savedDiscoveryIdentity.ts
var import_node_crypto3 = require("node:crypto");
function savedDiscoveryLockName(kind, brokerageId, userId2, target) {
  const fingerprint = (0, import_node_crypto3.createHash)("sha256").update(JSON.stringify([kind, brokerageId, userId2, target])).digest("hex");
  return `saved-discovery:${kind}:${fingerprint}`;
}
async function lockSavedDiscoveryIdentity(prisma, kind, brokerageId, userId2, target) {
  await prisma.$executeRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtext($1))",
    savedDiscoveryLockName(kind, brokerageId, userId2, target)
  );
}

// features/keystone/onboarding/seed-runtime.ts
var UNIQUE_LOOKUP_FIELDS = {
  brokerages: ["slug"],
  brokerageSettings: ["brokerage"],
  roles: ["name"],
  agents: ["email"],
  brokerageMemberships: ["membershipKey"],
  properties: ["slug"],
  routingRules: ["name"],
  leads: ["email"],
  leadActivities: ["lead", "subject", "occurredAt"],
  showings: ["lead", "property", "scheduledStart"],
  deals: ["title"]
};
function scopeCoreSeed(seed, target) {
  const sections = Object.fromEntries(Object.entries(seed.sections).map(([name, section]) => [name, {
    ...section,
    items: section.items.map((item) => {
      const data = { ...item.data };
      if (name === "brokerageMemberships" && typeof data.membershipKey === "string") {
        data.membershipKey = `${target.slug}:${data.membershipKey}`;
      }
      if (name === "brokerageSettings") {
        data.key = `${target.slug}:primary`;
        if (data.logoIcon === void 0) data.logoIcon = DEFAULT_STORE_LOGO_ICON;
        if (data.logoColor === void 0) data.logoColor = DEFAULT_STORE_LOGO_COLOR;
      }
      return { ...item, data };
    })
  }]));
  return { ...seed, sections };
}
function getCoreRef(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const ref = value.connect?.$ref;
  return typeof ref === "string" ? ref : null;
}
function resolveCoreRefs(value, ids) {
  const ref = getCoreRef(value);
  if (ref) {
    const id = ids.get(ref);
    if (!id) throw new Error(`Cannot resolve core seed reference ${ref}`);
    return { connect: { id } };
  }
  if (Array.isArray(value)) return value.map((item) => resolveCoreRefs(item, ids));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, resolveCoreRefs(child, ids)]));
  }
  return value;
}
function equalsFilter(value) {
  if (value && typeof value === "object" && !Array.isArray(value) && "connect" in value) {
    const id = value.connect?.id;
    if (typeof id === "string") return { id: { equals: id } };
  }
  return { equals: value };
}
function requiredConnectId(data, field) {
  const value = data[field];
  const id = value?.connect?.id;
  if (typeof id !== "string" || !id) throw new Error(`Core seed ${field} requires an explicit resolved connection`);
  return id;
}
function buildCoreLookup(sectionName, data) {
  const fields = UNIQUE_LOOKUP_FIELDS[sectionName];
  if (!fields?.length) throw new Error(`No idempotent lookup configured for core seed section ${sectionName}`);
  return Object.fromEntries(fields.map((field) => {
    const value = data[field];
    if (value === void 0 || value === null || value === "") {
      throw new Error(`Cannot build core seed lookup for ${sectionName}: missing ${field}`);
    }
    return [field, equalsFilter(value)];
  }));
}
async function assertNoUnreviewedSeedMembershipLinks(context, seed, template) {
  const agents = seed.sections.agents;
  const memberships = seed.sections.brokerageMemberships;
  if (!agents || !memberships) return;
  const usersList = context.query.User;
  const membershipsList = context.query.BrokerageMembership;
  if (!usersList || !membershipsList) throw new Error("Core seed requires User and BrokerageMembership lists for membership review.");
  const agentsByKey = new Map(agents.items.filter((item) => item.templates?.includes(template) ?? true).map((item) => [item.key, item]));
  for (const item of memberships.items.filter((item2) => item2.templates?.includes(template) ?? true)) {
    const userConnection = item.data.user;
    const reference = userConnection?.connect?.$ref;
    if (typeof reference !== "string" || !reference.startsWith("agents:")) continue;
    const agent = agentsByKey.get(reference.slice("agents:".length));
    if (!agent) continue;
    const email = agent.data.email;
    const membershipKey = item.data.membershipKey;
    if (typeof email !== "string" || !email || typeof membershipKey !== "string" || !membershipKey) {
      throw new Error("Core seed membership requires an explicit agent email and unique key.");
    }
    const existingUsers = await usersList.findMany({ where: { email: { equals: email } }, take: 1, query: "id" });
    if (!existingUsers[0]?.id) continue;
    const existingMemberships = await membershipsList.findMany({
      where: { membershipKey: { equals: membershipKey } },
      take: 1,
      query: "id user { id }"
    });
    const existingMembership = existingMemberships[0];
    const linkedUserId = existingMembership?.user?.id || existingMembership?.user?.connect?.id;
    if (linkedUserId !== existingUsers[0].id) {
      throw new Error("An agent in the setup data already has an account that is not a member of this brokerage. Remove or rename that account and try again.");
    }
  }
}
async function applyCoreSeed(context, sourceSeed, target, template = "full", log = () => void 0) {
  const seed = scopeCoreSeed(sourceSeed, target);
  const ids = /* @__PURE__ */ new Map();
  const createdAgentIds = /* @__PURE__ */ new Set();
  await assertNoUnreviewedSeedMembershipLinks(context, seed, template);
  let created = 0;
  let skipped = 0;
  let total = 0;
  for (const sectionName of seed.dependencyOrder) {
    const section = seed.sections[sectionName];
    if (!section) throw new Error(`Core dependencyOrder references missing section ${sectionName}`);
    const list47 = context.query[section.listKey];
    if (!list47) throw new Error(`Keystone list ${section.listKey} is not available on context.query`);
    for (const item of section.items.filter((item2) => item2.templates?.includes(template) ?? true)) {
      total += 1;
      const refKey = `${sectionName}:${item.key}`;
      if (sectionName === "brokerages") {
        const name = typeof item.data.name === "string" ? item.data.name.trim() : "";
        if (name && list47.updateOne) await list47.updateOne({ where: { id: target.id }, data: { name }, query: "id" });
        ids.set(refKey, target.id);
        skipped += 1;
        log(`applied ${refKey} to brokerage ${target.slug}`);
        continue;
      }
      const data = resolveCoreRefs(item.data, ids);
      const existing = await list47.findMany({ where: buildCoreLookup(sectionName, data), take: 1, query: "id" });
      if (existing[0]?.id) {
        ids.set(refKey, existing[0].id);
        skipped += 1;
        log(`skip existing ${refKey}`);
        continue;
      }
      if (sectionName === "agents") {
        requiredConnectId(data, "activeBrokerage");
        data.password = (0, import_node_crypto4.randomBytes)(32).toString("base64url");
      }
      if (sectionName === "brokerageMemberships") {
        requiredConnectId(data, "brokerage");
        const userId2 = requiredConnectId(data, "user");
        if (!createdAgentIds.has(userId2)) {
          throw new Error("An agent in the setup data already has an account that is not a member of this brokerage. Remove or rename that account and try again.");
        }
      }
      const result = await list47.createOne({ data, query: "id" });
      ids.set(refKey, result.id);
      if (sectionName === "agents") createdAgentIds.add(result.id);
      created += 1;
      log(`created ${refKey} (${result.id})`);
    }
  }
  return { created, skipped, total };
}
async function findAnchor(context, listKey, where, label) {
  const list47 = context.query[listKey];
  if (!list47) throw new Error(`Keystone list ${listKey} is not available on context.query`);
  const rows = await list47.findMany({ where, take: 1, query: "id" });
  if (!rows[0]?.id) throw new Error(`Missing core seed anchor: ${label}`);
  return rows[0].id;
}
async function resolveAnchors(context, seed, target) {
  const anchors = /* @__PURE__ */ new Map();
  const inBrokerage = { brokerage: { id: { equals: target.id } } };
  anchors.set("brokerage", target.id);
  anchors.set("agent", await findAnchor(context, "User", { email: { equals: seed.anchors.agentEmail } }, seed.anchors.agentEmail));
  anchors.set("property", await findAnchor(context, "Property", { slug: { equals: seed.anchors.propertySlug }, ...inBrokerage }, seed.anchors.propertySlug));
  anchors.set("lead", await findAnchor(context, "Lead", { email: { equals: seed.anchors.leadEmail }, ...inBrokerage }, seed.anchors.leadEmail));
  anchors.set("deal", await findAnchor(context, "Deal", { title: { equals: seed.anchors.dealTitle }, ...inBrokerage }, seed.anchors.dealTitle));
  anchors.set("showing", await findAnchor(context, "Showing", { notes: { equals: seed.anchors.showingNotes }, ...inBrokerage }, seed.anchors.showingNotes));
  return anchors;
}
function resolveExpansionLinks(value, anchors, records) {
  if (Array.isArray(value)) return value.map((item) => resolveExpansionLinks(item, anchors, records));
  if (value && typeof value === "object") {
    const object = value;
    if (typeof object.$anchor === "string") {
      const id = anchors.get(object.$anchor);
      if (!id) throw new Error(`Unknown or unresolved expansion seed anchor ${object.$anchor}`);
      return { connect: { id } };
    }
    if (typeof object.$record === "string") {
      const id = records.get(object.$record);
      if (!id) throw new Error(`Unknown or unresolved expansion seed record ${object.$record}`);
      return { connect: { id } };
    }
    return Object.fromEntries(Object.entries(object).map(([key, child]) => [key, resolveExpansionLinks(child, anchors, records)]));
  }
  return value;
}
async function applyExpansionSeed(context, seed, target, log = () => void 0) {
  const anchors = await resolveAnchors(context, seed, target);
  const recordIds = /* @__PURE__ */ new Map();
  let created = 0;
  let skipped = 0;
  for (const record4 of seed.records) {
    const list47 = context.query[record4.listKey];
    if (!list47) throw new Error(`Keystone list ${record4.listKey} is not available on context.query`);
    const data = resolveExpansionLinks(record4.data, anchors, recordIds);
    let lookupWhere;
    let take = 1;
    if (record4.listKey === "SavedSearch") {
      const brokerageId = requiredConnectId(data, "brokerage");
      const userId2 = requiredConnectId(data, "user");
      const name = typeof data.name === "string" ? data.name.trim() : "";
      if (!name) throw new Error(`Expansion record ${record4.id} requires a saved-search name.`);
      if (!context.prisma) throw new Error("Saved-search seed requires a transaction-bound advisory lock client.");
      data.name = name;
      await lockSavedDiscoveryIdentity(context.prisma, "search", brokerageId, userId2, name);
      lookupWhere = {
        brokerage: { id: { equals: brokerageId } },
        user: { id: { equals: userId2 } },
        name: { equals: name }
      };
      take = 2;
    } else {
      const lookupData = resolveExpansionLinks(record4.lookup || record4.data, anchors, recordIds);
      lookupWhere = Object.fromEntries(
        Object.entries(lookupData).filter(([field]) => record4.lookup ? true : field === "slug" || field.endsWith("Number")).map(([field, value]) => [field, equalsFilter(value)])
      );
    }
    if (!Object.keys(lookupWhere).length) throw new Error(`Expansion record ${record4.id} has no idempotent lookup`);
    const existing = await list47.findMany({ where: lookupWhere, take, query: "id" });
    if (record4.listKey === "SavedSearch" && existing.length > 1) {
      throw new Error("A saved search with this name exists more than once. Remove the duplicate and try again.");
    }
    if (existing[0]?.id) {
      recordIds.set(record4.id, existing[0].id);
      skipped += 1;
      log(`skip existing ${record4.listKey}:${record4.id}`);
      continue;
    }
    if (record4.listKey === "Offer" && data.status === "accepted") {
      const dealId = requiredConnectId(data, "deal");
      const accepted = await list47.findMany({
        where: { deal: { id: { equals: dealId } }, status: { equals: "accepted" } },
        take: 2,
        query: "id offerNumber"
      });
      if (accepted.length) {
        throw new Error("This deal already has an accepted offer, so setup will not add another one.");
      }
    }
    const result = await list47.createOne({ data, query: "id" });
    recordIds.set(record4.id, result.id);
    created += 1;
    log(`created ${record4.listKey}:${record4.id} (${result.id})`);
  }
  return { created, skipped, total: seed.records.length };
}

// features/keystone/onboarding/run-onboarding.ts
async function runRealEstateOnboarding(context, target, template = "full") {
  const core = await applyCoreSeed(context, seed_default, target, template);
  const selectedAgents = new Set(seed_default.sections.agents.items.filter((item) => item.templates.includes(template)).map((item) => item.data.email));
  const selectedProperties = new Set(seed_default.sections.properties.items.filter((item) => item.templates.includes(template)).map((item) => item.data.slug));
  await applyAuthoritySeed(context, {
    ...authority_seed_default,
    practitioners: authority_seed_default.practitioners.filter((item) => selectedAgents.has(item.email)),
    listings: authority_seed_default.listings.filter((item) => selectedProperties.has(item.propertySlug))
  }, target);
  await applySeedCovers(context, seed_default.imagePack.properties, selectedProperties, target);
  const expansion = template === "full" ? await applyExpansionSeed(context, expansion_seed_default, target) : { created: 0, skipped: 0, total: 0 };
  return { core, expansion };
}

// features/keystone/mutations/runRealEstateOnboarding.ts
function onboardingScope(context) {
  const session = context.session;
  const brokerageId = activeBrokerageIds(session)[0];
  const membership = brokerageId ? session?.data?.brokerageMemberships?.find(
    (item) => item.status === "active" && item.brokerage?.status === "active" && item.brokerage?.id === brokerageId && ["owner", "admin"].includes(item.membershipRole)
  ) : null;
  if (!session?.itemId || !session.data?.role?.canManageOnboarding || !membership?.brokerage?.slug) {
    throw new Error("Only a brokerage owner or administrator can run brokerage setup.");
  }
  return { session, target: { id: brokerageId, slug: membership.brokerage.slug } };
}
async function runRealEstateOnboardingTransaction(context, seedRunner = void 0, template = "full") {
  const { session } = onboardingScope(context);
  return context.transaction(async (transactionContext) => {
    const sessionContext = await freshOperatorCommandContext(transactionContext.withSession(session));
    const { session: currentSession, target } = onboardingScope(sessionContext);
    const sudo = sessionContext.sudo();
    await sudo.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `onboarding:${target.id}`);
    await sudo.db.User.updateOne({
      where: { id: currentSession.itemId },
      data: { onboardingStatus: "in_progress" }
    });
    const result = await (seedRunner || ((seedContext, seedTarget) => runRealEstateOnboarding(seedContext, seedTarget, template)))(sudo, target);
    const emptyPrimaries = await sudo.query.Brokerage.findMany({
      where: {
        id: { not: { equals: target.id } },
        isPrimary: { equals: true },
        memberships: { none: {} },
        settings: { none: {} },
        properties: { none: {} }
      },
      query: "id"
    });
    for (const brokerage of emptyPrimaries) {
      await sudo.db.Brokerage.updateOne({ where: { id: String(brokerage.id) }, data: { isPrimary: false } });
    }
    await sudo.db.User.updateOne({
      where: { id: currentSession.itemId },
      data: { onboardingStatus: "completed" }
    });
    return { completed: true, status: "completed", ...result };
  }, { timeout: 12e4 });
}
async function runRealEstateOnboardingMutation(_root, { template = "full" }, context) {
  if (template !== "full" && template !== "minimal") throw new Error("Choose the basic or complete setup.");
  return runRealEstateOnboardingTransaction(context, void 0, template);
}
async function dismissRealEstateOnboarding(_root, _args, context) {
  const { session } = onboardingScope(context);
  await context.sudo().db.User.updateOne({
    where: { id: session.itemId },
    data: { onboardingStatus: "dismissed" }
  });
  return { completed: false, status: "dismissed", core: null, expansion: null };
}

// features/keystone/lib/aggregateLock.ts
var direct = /* @__PURE__ */ new Set(["Lead", "Property", "Showing", "Deal", "Offer", "Commission", "AgentTask", "DealDocument", "TransactionMilestone", "SavedSearchAlert", "SourceFeed", "ListingSyndication", "CommissionLedgerEntry", "BrokerageMembership"]);
var throughDeal = /* @__PURE__ */ new Set(["Disclosure", "PropertyInspection"]);
async function lockAggregate(context, list47, id, brokerageId) {
  if (!id || !brokerageId) throw new Error("A scoped aggregate identity is required.");
  if (direct.has(list47)) {
    await context.prisma.$executeRawUnsafe(`SELECT "id" FROM "${list47}" WHERE "id"=$1 AND "brokerage"=$2 FOR NO KEY UPDATE`, id, brokerageId);
  } else if (throughDeal.has(list47)) {
    await context.prisma.$executeRawUnsafe(`SELECT target."id" FROM "${list47}" target JOIN "Deal" parent ON target."deal"=parent."id" WHERE target."id"=$1 AND parent."brokerage"=$2 FOR NO KEY UPDATE OF target`, id, brokerageId);
  } else if (list47 === "OpenHouse") {
    await context.prisma.$executeRawUnsafe('SELECT target."id" FROM "OpenHouse" target JOIN "Property" parent ON target."property"=parent."id" WHERE target."id"=$1 AND parent."brokerage"=$2 FOR NO KEY UPDATE OF target', id, brokerageId);
  } else throw new Error("Unsupported controlled aggregate lock.");
}
var aggregateLists = {
  lead: "Lead",
  property: "Property",
  showing: "Showing",
  deal: "Deal",
  offer: "Offer",
  commission: "Commission",
  document: "DealDocument",
  "agent-task": "AgentTask",
  inspection: "PropertyInspection",
  "saved-search-alert": "SavedSearchAlert",
  "source-feed": "SourceFeed",
  "listing-syndication": "ListingSyndication"
};
async function lockCommandAggregate(context, lockKey, brokerageId) {
  const parts = lockKey.split(":");
  let list47, id;
  if (parts[0] === "aggregate" && parts.length === 3) {
    list47 = aggregateLists[parts[1]];
    id = parts[2];
  } else if (parts[0] === "ledger" && parts[1] === "commission" && parts.length === 3) {
    list47 = "Commission";
    id = parts[2];
  } else if (parts[0] === "ledger-entry" && parts.length === 2) {
    list47 = "CommissionLedgerEntry";
    id = parts[1];
  } else if (parts[0] === "evidence" && parts[1] === "document" && parts.length === 3) {
    list47 = "DealDocument";
    id = parts[2];
  } else if (parts[0] === "authority" && parts[1] === "listing" && parts.length === 3) {
    list47 = "Property";
    id = parts[2];
  } else if (parts[0] === "authority" && parts[1] === "representation" && parts.length === 3) {
    list47 = "Lead";
    id = parts[2];
  } else if (parts[0] === "membership" && parts.length === 2) {
    list47 = "BrokerageMembership";
    id = parts[1];
  }
  if (list47 && id) await lockAggregate(context, list47, id, brokerageId);
}

// features/keystone/lib/commissionState.ts
function decimalCommissionCents(value) {
  const match = String(value ?? "").trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error("Commission gross amount is invalid.");
  return BigInt(match[1]) * BigInt(100) + BigInt((match[2] || "").padEnd(2, "0"));
}
function commissionBatchState(entries, batchKey2, gross) {
  const financial = entries.filter((entry) => ["allocation", "allocation_approval", "receipt", "reversal"].includes(entry.entryType));
  const rows = financial.filter((entry) => entry.batchKey === batchKey2);
  const sources = new Map(rows.map((row) => [row.id, row]));
  const reversed = /* @__PURE__ */ new Set();
  let allocations = BigInt(0), receipts = BigInt(0), valid = true;
  const currencies = new Set(rows.map((row) => row.currencyCode));
  for (const row of rows) {
    const amount = BigInt(row.amountCents);
    if (row.entryType === "allocation") allocations += amount;
    if (row.entryType === "receipt") receipts += amount;
    if (row.entryType === "reversal") {
      const source = sources.get(row.reverses?.id);
      if (!source || !["allocation", "receipt"].includes(source.entryType) || reversed.has(source.id) || amount !== -BigInt(source.amountCents)) valid = false;
      else {
        reversed.add(source.id);
        if (source.entryType === "allocation") allocations += amount;
        else receipts += amount;
      }
    }
  }
  const separatelyApproved = rows.some((row) => row.entryType === "allocation_approval" && row.preparedBy?.id && row.approvedBy?.id && row.preparedBy.id !== row.approvedBy.id);
  const validAllocations = valid && separatelyApproved && currencies.size === 1 && allocations === gross;
  const ledgerStateHash = domainPayloadHash([...financial].sort((a, b) => a.id.localeCompare(b.id)).map((row) => ({
    id: row.id,
    batchKey: row.batchKey,
    entryType: row.entryType,
    amountCents: String(row.amountCents),
    currencyCode: row.currencyCode,
    reverses: row.reverses?.id || null,
    preparedBy: row.preparedBy?.id || null,
    approvedBy: row.approvedBy?.id || null,
    externalReference: row.externalReference || "",
    sourceDocumentSha256: row.sourceDocumentSha256 || ""
  })));
  return { validAllocations, validReceipts: validAllocations && receipts === gross, ledgerStateHash, currencyCode: rows[0]?.currencyCode || "", allocationNet: allocations, receiptNet: receipts };
}
function activeAllocationBatches(entries) {
  const allocations = entries.filter((row) => row.entryType === "allocation");
  const reversed = new Set(entries.filter((row) => row.entryType === "reversal" && allocations.some((source) => source.id === row.reverses?.id && BigInt(row.amountCents) === -BigInt(source.amountCents))).map((row) => row.reverses.id));
  return new Set(allocations.filter((row) => !reversed.has(row.id)).map((row) => row.batchKey));
}
async function commissionDecisionEntries(context, commissionId) {
  return decisionRows(context.sudo().query.CommissionLedgerEntry, {
    where: { commission: { id: { equals: commissionId } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    query: "id batchKey entryType amountCents currencyCode ledgerStateHash externalReference sourceDocumentSha256 reverses { id } preparedBy { id } approvedBy { id }"
  });
}
async function requireCurrentCommissionState(context, commissionId, grossValue, requireReconciled) {
  const entries = await commissionDecisionEntries(context, commissionId);
  const gross = decimalCommissionCents(grossValue);
  const activeBatches = activeAllocationBatches(entries);
  if (activeBatches.size !== 1) throw new Error("A single current allocation batch is required; reverse or review conflicting batches before approval or payment recording.");
  const candidates = entries.filter((row) => row.entryType === (requireReconciled ? "reconciliation" : "allocation_approval")).reverse();
  for (const candidate of candidates) {
    if (!activeBatches.has(candidate.batchKey)) continue;
    const state = commissionBatchState(entries, candidate.batchKey, gross);
    if (!state.validAllocations) continue;
    if (requireReconciled && (!state.validReceipts || !candidate.externalReference || candidate.ledgerStateHash !== state.ledgerStateHash)) continue;
    return { batchKey: candidate.batchKey, ...state };
  }
  throw new Error(requireReconciled ? "Current, separately approved and reconciled allocation/receipt evidence is required. Reconcile again after ledger changes." : "A current cent-conserving allocation batch approved by a different authority is required.");
}

// features/keystone/lib/reviewedVersion.ts
function reviewedIso(value) {
  const date = value instanceof Date ? value : typeof value === "string" && value.trim() ? new Date(value.trim()) : null;
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function sameReviewedVersion(current, reviewed) {
  const now = reviewedIso(current), seen = reviewedIso(reviewed);
  return now !== null && seen !== null && now === seen;
}

// features/keystone/lib/showingPolicy.ts
var showingTransitions = {
  requested: ["scheduled", "cancelled"],
  scheduled: ["completed", "no_show", "cancelled"],
  completed: [],
  no_show: ["scheduled"],
  cancelled: ["requested", "scheduled"]
};
function leadStatusAfterShowing(current, next) {
  if (next === "scheduled" && current === "qualified") return "tour_scheduled";
  return current;
}
async function reconcileLeadStatusAfterShowing(context, input) {
  const { currentLeadStatus, nextShowingStatus, brokerageId, leadId, showingId } = input;
  const scheduledStatus = leadStatusAfterShowing(currentLeadStatus, nextShowingStatus);
  if (scheduledStatus !== currentLeadStatus) return scheduledStatus;
  if (currentLeadStatus !== "tour_scheduled" || !["completed", "cancelled", "no_show"].includes(nextShowingStatus)) return currentLeadStatus;
  if (!brokerageId || !leadId || !showingId) throw new Error("Showing-to-lead reconciliation requires scoped showing relationships.");
  const otherScheduledShowings = await context.sudo().query.Showing.findMany({
    where: { AND: [
      { brokerage: { id: { equals: brokerageId } } },
      { lead: { id: { equals: leadId } } },
      { status: { equals: "scheduled" } },
      { id: { not: { equals: showingId } } }
    ] },
    take: 1,
    query: "id"
  });
  return otherScheduledShowings.length ? "tour_scheduled" : "qualified";
}
function showingInterval(startValue, durationMinutes, now = Date.now()) {
  const start = new Date(String(startValue || ""));
  if (!Number.isFinite(start.getTime()) || start.getTime() <= now || start.getTime() > now + 365 * 864e5) {
    throw new Error("Choose a showing time in the future, within one year.");
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 240) {
    throw new Error("Showing duration must be between 15 and 240 minutes.");
  }
  return { scheduledStart: start.toISOString(), scheduledEnd: new Date(start.getTime() + durationMinutes * 6e4).toISOString() };
}
async function requireAvailableShowingSlot(context, input) {
  const start = new Date(input.scheduledStart), end = new Date(input.scheduledEnd);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end.getTime() - start.getTime() > 240 * 6e4) {
    throw new Error("A valid showing start and end are required.");
  }
  const conflicts = await context.sudo().query.Showing.findMany({
    where: { AND: [
      { brokerage: { id: { equals: input.brokerageId } }, status: { equals: "scheduled" } },
      { OR: [{ property: { id: { equals: input.propertyId } } }, { assignedAgent: { id: { equals: input.agentId } } }] },
      { scheduledStart: { lt: input.scheduledEnd } },
      { OR: [
        { scheduledEnd: { gt: input.scheduledStart } },
        // Legacy records with no end conservatively reserve the maximum duration.
        { scheduledEnd: { equals: null }, scheduledStart: { gt: new Date(start.getTime() - 240 * 6e4).toISOString() } }
      ] },
      ...input.excludeId ? [{ id: { not: { equals: input.excludeId } } }] : []
    ] },
    take: 1,
    query: "id"
  });
  if (conflicts.length) throw new Error("The property or advisor already has a confirmed showing during this time. Choose another time.");
}

// features/keystone/mutations/operatorLifecycle.ts
var transitions = {
  lead: { new: ["attempted_contact", "qualified", "lost"], attempted_contact: ["qualified", "lost"], qualified: ["offer", "lost"], tour_scheduled: ["qualified", "offer", "lost"], offer: ["closed", "lost"], closed: [], lost: ["qualified"] },
  property: { draft: ["coming_soon", "active", "off_market"], coming_soon: ["active", "off_market"], active: ["pending", "sold", "rented", "off_market"], pending: ["active", "sold", "rented", "off_market"], sold: ["off_market"], rented: ["off_market"], off_market: ["draft", "coming_soon", "active"] },
  showing: showingTransitions,
  openHouse: { scheduled: ["completed", "cancelled"], completed: [], cancelled: [] },
  deal: { prospecting: ["active_search", "closed_lost"], active_search: ["offer_drafted", "closed_lost"], offer_drafted: ["active_search", "under_contract", "closed_lost"], under_contract: ["inspection", "financing", "closed_won", "closed_lost"], inspection: ["under_contract", "financing", "closed_won", "closed_lost"], financing: ["under_contract", "inspection", "closed_won", "closed_lost"], closed_won: [], closed_lost: [] },
  offer: { draft: ["submitted", "withdrawn"], submitted: ["countered", "accepted", "rejected", "withdrawn"], countered: ["submitted", "accepted", "rejected", "withdrawn"], accepted: [], rejected: [], withdrawn: [] },
  commission: { projected: ["approved"], approved: ["paid", "clawed_back"], paid: ["clawed_back"], clawed_back: [] },
  disclosure: { draft: ["sent", "expired"], sent: ["acknowledged", "expired"], acknowledged: [], expired: ["draft", "sent"] },
  milestone: { not_started: ["in_progress", "blocked", "complete"], in_progress: ["blocked", "complete"], blocked: ["in_progress", "complete"], complete: ["in_progress"] }
};
var config = {
  lead: { list: "Lead", field: "status", read: "id status brokerage { id } assignedAgent { id }" },
  property: { list: "Property", field: "status", read: "id status state brokerage { id } assignedAgent { id }" },
  showing: { list: "Showing", field: "status", read: "id status updatedAt showingType notes feedback scheduledStart scheduledEnd brokerage { id status } assignedAgent { id } lead { id status brokerage { id status } } property { id state brokerage { id status } }" },
  openHouse: { list: "OpenHouse", field: "status", read: "id status property { id brokerage { id } assignedAgent { id } } hostAgent { id }" },
  deal: { list: "Deal", field: "stage", read: "id title stage transactionType offerAmount commissionAmount expectedCloseDate closedAt closedSnapshot nextStep notes brokerage { id } assignedAgent { id name } lead { id name email } property { id title slug addressLine1 city state }" },
  offer: { list: "Offer", field: "status", read: "id offerNumber version parentOffer { id offerNumber version } status amount earnestMoney financingType contingencies submittedAt responseDueAt acceptedAt acceptedSnapshot brokerage { id } assignedAgent { id name } lead { id name email } property { id title slug addressLine1 city state } deal { id title transactionType }" },
  commission: { list: "Commission", field: "status", read: "id status grossCommission brokerage { id } agent { id } deal { id stage transactionType brokerage { id } lead { id } } property { id state brokerage { id } }" },
  disclosure: { list: "Disclosure", field: "status", read: "id status deal { brokerage { id } assignedAgent { id } } property { brokerage { id } assignedAgent { id } }" },
  milestone: { list: "TransactionMilestone", field: "status", read: "id status assignedTo { id } deal { brokerage { id } assignedAgent { id } }" }
};
function role(context) {
  return context.session?.data?.role || {};
}
function sessionId(context) {
  return context.session?.itemId;
}
function hasDomainPermission(context, domain) {
  const currentRole = role(context);
  return domain === "lead" ? Boolean(currentRole.canManageLeads) : domain === "property" ? Boolean(currentRole.canManageListings) : domain === "showing" ? Boolean(currentRole.canManageShowings) : domain === "openHouse" ? Boolean(currentRole.canManageShowings) : Boolean(currentRole.canManageDeals);
}
function itemBrokerageId(item) {
  return item.brokerage?.id || item.deal?.brokerage?.id || item.property?.brokerage?.id || null;
}
function representationSide(transactionType) {
  return ["seller", "landlord"].includes(String(transactionType || "")) ? "seller" : "buyer";
}
function permitted(context, domain, item) {
  const currentRole = role(context);
  const userId2 = sessionId(context);
  if (!userId2 || !hasDomainPermission(context, domain)) return false;
  const brokerageId = itemBrokerageId(item);
  if (brokerageId && !activeBrokerageIds(context.session).includes(brokerageId)) return false;
  if (currentRole.canManagePeople) return true;
  const ownerId = item.assignedAgent?.id || item.agent?.id || item.assignedTo?.id || item.deal?.assignedAgent?.id || item.property?.assignedAgent?.id;
  return ownerId === userId2;
}
function safeString(value) {
  return String(value || "").trim();
}
function transitionUpdate(domain, next, item, now, evidenceVersion = null) {
  const definition = config[domain];
  const update = { [definition.field]: next };
  if (domain === "lead") update.lastContactedAt = now;
  if (domain === "deal" && ["closed_won", "closed_lost"].includes(next)) {
    update.closedAt = now;
    if (!item.closedSnapshot) {
      update.closedSnapshot = normalizeDomainJson({
        version: 1,
        capturedAt: now,
        outcome: next,
        title: item.title,
        transactionType: item.transactionType,
        offerAmount: item.offerAmount,
        commissionAmount: item.commissionAmount,
        expectedCloseDate: item.expectedCloseDate,
        nextStep: item.nextStep,
        notes: item.notes,
        property: item.property || null,
        lead: item.lead || null,
        assignedAgent: item.assignedAgent || null,
        evidenceVersion
      });
    }
  }
  if (domain === "offer") {
    if (next === "submitted") update.submittedAt = now;
    if (next === "accepted") {
      update.acceptedAt = now;
      if (!item.acceptedSnapshot) {
        update.acceptedSnapshot = normalizeDomainJson({
          version: item.version || 1,
          parentOffer: item.parentOffer || null,
          capturedAt: now,
          offerNumber: item.offerNumber,
          amount: item.amount,
          earnestMoney: item.earnestMoney,
          financingType: item.financingType,
          contingencies: item.contingencies,
          submittedAt: item.submittedAt,
          responseDueAt: item.responseDueAt,
          property: item.property || null,
          deal: item.deal || null,
          lead: item.lead || null,
          assignedAgent: item.assignedAgent || null,
          evidenceVersion
        });
      }
    }
  }
  if (domain === "commission") update.paidAt = next === "paid" ? now : null;
  if (domain === "disclosure") {
    if (next === "sent") update.sentAt = now;
    if (next === "acknowledged") update.acknowledgedAt = now;
  }
  if (domain === "milestone") update.completedAt = next === "complete" ? now : null;
  return update;
}
async function transitionInContext(context, domain, data) {
  const id = safeString(data.id);
  const next = safeString(data.status);
  const commandKey = safeString(data.idempotencyKey);
  const definition = config[domain];
  const request = {
    domain,
    id,
    status: next,
    note: safeString(data.note),
    ...data.expectedStatus != null ? { expectedStatus: data.expectedStatus } : {},
    ...data.expectedUpdatedAt != null ? { expectedUpdatedAt: reviewedIso(data.expectedUpdatedAt) ?? String(data.expectedUpdatedAt) } : {},
    ...data.expectedRevision != null ? { expectedRevision: data.expectedRevision } : {}
  };
  const eventKey = `command:${domain}:${id}:${commandKey}`;
  const sudo = context.sudo();
  const supportsEvents = typeof sudo.prisma?.$executeRawUnsafe === "function" && typeof sudo.query?.CommandReceipt?.findOne === "function" && typeof sudo.query?.CommandReceipt?.createOne === "function" && typeof sudo.query?.DomainAuditEvent?.createOne === "function";
  if (!supportsEvents) return { ok: false, message: "Transitions are temporarily unavailable.", itemId: null, status: null, replayed: false };
  let showingReplay = null;
  const showingHeader = domain === "showing" ? await scopedShowingIdentity(context, id) : null;
  if (domain === "showing" && !showingHeader) return { ok: false, message: "Showing not found or access denied.", itemId: null, status: null, replayed: false };
  if (supportsEvents) {
    await sudo.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `aggregate:${domain}:${id}`);
    const candidate = await sudo.query.CommandReceipt.findOne({ where: { eventKey }, query: domain === "showing" ? SHOWING_EVENT_HEADER_QUERY : "id requestHash payload brokerage { id }" });
    if (candidate && domain === "showing" && !await ownedShowingEventHeader(context, candidate, { eventKey, eventType: "showing.status_changed", purpose: "showing" })) return { ok: false, message: "Showing not found or access denied.", itemId: null, status: null, replayed: false };
    if (candidate && domain === "showing" && candidate.requestHash !== domainPayloadHash(request)) return { ok: false, message: "This idempotency key was already used with different transition input.", itemId: null, status: null, replayed: false };
    const existing = candidate && domain === "showing" ? await sudo.query.CommandReceipt.findOne({ where: { eventKey }, query: "id requestHash payloadHash payload brokerage { id }" }) : candidate;
    if (candidate && (!existing || existing.id !== candidate.id || existing.requestHash !== candidate.requestHash || domain === "showing" && !showingEventPayloadMatches(candidate, existing))) return { ok: false, message: "Showing not found or access denied.", itemId: null, status: null, replayed: false };
    if (existing) {
      if (!activeBrokerageIds(context.session).includes(existing.brokerage?.id)) {
        return { ok: false, message: "You are not authorized to transition this record.", itemId: null, status: null, replayed: false };
      }
      if (existing.requestHash !== domainPayloadHash(request)) {
        throw new Error("Domain command idempotency key was reused with different input");
      }
      if (domain === "showing") showingReplay = existing;
      else return { ...existing.payload?.result || {}, replayed: true };
    }
  }
  await lockAggregate(context, definition.list, id, activeBrokerageIds(context.session)[0]);
  if (domain === "property") await lockPropertyForDecision(context, id, activeBrokerageIds(context.session)[0]);
  let item = await sudo.query[definition.list].findOne({ where: { id }, query: definition.read });
  if (!item || showingHeader && !sameShowingIdentity(item, showingHeader)) return { ok: false, message: "The requested record was not found.", itemId: null, status: null, replayed: false };
  if (!permitted(context, domain, item)) return { ok: false, message: "You are not authorized to transition this record.", itemId: null, status: null, replayed: false };
  if (domain !== "property" && item.property?.id) {
    await lockPropertyForDecision(context, item.property.id, itemBrokerageId(item));
    item = await sudo.query[definition.list].findOne({ where: { id }, query: definition.read });
    if (!item || !permitted(context, domain, item) || showingHeader && !sameShowingIdentity(item, showingHeader)) return { ok: false, message: "The requested record changed or is unavailable.", itemId: null, status: null, replayed: false };
  }
  if (showingReplay) {
    if (showingReplay.payload?.actorId !== sessionId(context) || showingReplay.payload?.aggregate?.type !== "showing" || showingReplay.payload.aggregate.id !== id || showingReplay.payload?.request?.id !== id || showingReplay.payload?.request?.domain !== "showing" || showingReplay.payload?.result?.itemId !== id || showingReplay.payload?.result?.ok !== true || showingReplay.payload?.result?.status !== next || showingReplay.payload?.before?.lead?.id !== showingHeader?.lead.id || showingReplay.payload?.before?.property?.id !== showingHeader?.property.id) return { ok: false, message: "You are not authorized to replay this command.", itemId: null, status: null, replayed: false };
    return { ...showingReplay.payload?.result || {}, replayed: true };
  }
  if (domain === "showing" && (data.expectedStatus != null && item.status !== data.expectedStatus || data.expectedUpdatedAt != null && !sameReviewedVersion(item.updatedAt, data.expectedUpdatedAt) || data.expectedRevision != null && await showingReviewRevision(context, item) !== data.expectedRevision)) {
    return { ok: false, message: "The showing changed after review. Refresh before submitting a new decision.", itemId: id, status: item.status, replayed: false };
  }
  let evidenceVersion = null;
  const bindEvidence = (chain) => ({ documentId: chain.document.id, documentSha256: chain.events[0]?.documentSha256, templateSha256: chain.events[0]?.templateSha256, eventIds: chain.events.map((event) => event.id) });
  const brokerageId = itemBrokerageId(item);
  const practitionerId = item.assignedAgent?.id || item.agent?.id || item.deal?.assignedAgent?.id || item.property?.assignedAgent?.id;
  if (domain === "property" && ["coming_soon", "active"].includes(next)) {
    if (!brokerageId || !practitionerId || !item.state) return { ok: false, message: "Listing publication requires assigned practitioner and jurisdiction authority.", itemId: id, status: item.status, replayed: false };
    try {
      await requireListingAuthority(context, { brokerageId, propertyId: id, practitionerId, jurisdictionCode: item.state, destination: "public_site" });
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Listing publication authority is required.", itemId: id, status: item.status, replayed: false };
    }
  }
  if (domain === "showing" && next === "scheduled" && ["closed", "lost"].includes(item.lead?.status)) {
    return { ok: false, message: "Closed or lost leads cannot be scheduled. Reopen a lost lead before scheduling.", itemId: id, status: item.status, replayed: false };
  }
  if (domain === "showing" && ["scheduled", "completed"].includes(next)) {
    if (!brokerageId || !practitionerId || !item.lead?.id || !item.property?.id || !item.property?.state) return { ok: false, message: "Showing confirmation requires practitioner, jurisdiction, and relationship authority.", itemId: id, status: item.status, replayed: false };
    try {
      await requireRepresentationAuthority(context, { brokerageId, leadId: item.lead.id, propertyId: item.property.id, practitionerId, jurisdictionCode: item.property.state, side: "buyer", allowCustomerAssistance: true });
      if (next === "scheduled") {
        const duration = item.scheduledEnd ? (new Date(item.scheduledEnd).getTime() - new Date(item.scheduledStart).getTime()) / 6e4 : 60;
        const interval = showingInterval(item.scheduledStart, duration);
        await requireAvailableShowingSlot(context, { brokerageId, propertyId: item.property.id, agentId: practitionerId, ...interval, excludeId: id });
        item.scheduledEnd = interval.scheduledEnd;
      }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Showing authority is required.", itemId: id, status: item.status, replayed: false };
    }
  }
  if (domain === "offer" && ["submitted", "accepted"].includes(next)) {
    if (!brokerageId || !practitionerId || !item.lead?.id || !item.property?.id || !item.property?.state) return { ok: false, message: "Offer transition requires practitioner, jurisdiction, and representation authority.", itemId: id, status: item.status, replayed: false };
    try {
      await requireRepresentationAuthority(context, { brokerageId, leadId: item.lead.id, propertyId: item.property.id, dealId: item.deal?.id, practitionerId, jurisdictionCode: item.property.state, side: representationSide(item.deal?.transactionType) });
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Offer authority is required.", itemId: id, status: item.status, replayed: false };
    }
  }
  if (domain === "deal" && ["under_contract", "inspection", "financing", "closed_won"].includes(next)) {
    if (!brokerageId || !practitionerId || !item.lead?.id || !item.property?.id || !item.property?.state) return { ok: false, message: "Deal transition requires practitioner, jurisdiction, and representation authority.", itemId: id, status: item.stage, replayed: false };
    try {
      await requireRepresentationAuthority(context, { brokerageId, leadId: item.lead.id, propertyId: item.property.id, dealId: id, practitionerId, jurisdictionCode: item.property.state, side: representationSide(item.transactionType) });
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Deal authority is required.", itemId: id, status: item.stage, replayed: false };
    }
  }
  if (domain === "commission" && ["approved", "paid"].includes(next)) {
    if (!brokerageId || !practitionerId || !item.property?.state) return { ok: false, message: "Commission transition requires current practitioner authority.", itemId: id, status: item.status, replayed: false };
    try {
      await requirePractitionerLicense(context, { brokerageId, practitionerId, jurisdictionCode: item.property.state });
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Commission authority is required.", itemId: id, status: item.status, replayed: false };
    }
  }
  if (supportsEvents && domain === "offer" && item.deal?.id) {
    await sudo.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `aggregate:deal:${item.deal.id}`);
  }
  if (domain === "offer" && next === "accepted" && item.deal?.id) {
    const accepted = await sudo.query.Offer.findMany({ where: { AND: [{ deal: { id: { equals: item.deal.id } } }, { status: { equals: "accepted" } }, { id: { not: { equals: id } } }] }, take: 1, query: "id offerNumber" });
    if (accepted.length) return { ok: false, message: `Deal already has accepted offer ${accepted[0].offerNumber}.`, itemId: id, status: item.status, replayed: false };
    try {
      evidenceVersion = bindEvidence(await requireOfferEvidenceChain(context, { dealId: item.deal.id, offerId: id }));
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Complete offer evidence is required.", itemId: id, status: item.status, replayed: false };
    }
  }
  if (domain === "deal" && next === "closed_won") {
    const acceptedOffers = await sudo.query.Offer.findMany({ where: { deal: { id: { equals: id } }, status: { equals: "accepted" } }, take: 1, query: "id offerNumber" });
    if (!acceptedOffers.length) return { ok: false, message: "A closed-won deal requires an accepted offer.", itemId: id, status: item.stage, replayed: false };
    try {
      await requireOfferEvidenceChain(context, { dealId: id, offerId: acceptedOffers[0].id });
      evidenceVersion = bindEvidence(await requireClosingEvidenceChain(context, id));
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Complete closing evidence is required.", itemId: id, status: item.stage, replayed: false };
    }
  }
  if (domain === "property" && next === "sold") {
    const closedDeals = await sudo.query.Deal.findMany({ where: { property: { id: { equals: id } }, stage: { equals: "closed_won" } }, take: 1, query: "id" });
    if (!closedDeals.length) return { ok: false, message: "A sold listing requires a closed-won deal.", itemId: id, status: item.status, replayed: false };
    try {
      await requireClosingEvidenceChain(context, closedDeals[0].id);
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Complete closing evidence is required.", itemId: id, status: item.status, replayed: false };
    }
  }
  if (domain === "commission" && next === "paid" && item.deal?.stage !== "closed_won") return { ok: false, message: "A paid commission requires a closed-won deal.", itemId: id, status: item.status, replayed: false };
  if (domain === "commission" && ["approved", "paid"].includes(next)) {
    try {
      await requireCurrentCommissionState(context, id, item.grossCommission, next === "paid");
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Current commission evidence is required.", itemId: id, status: item.status, replayed: false };
    }
  }
  if (domain === "commission" && next === "paid") {
    try {
      await requireClosingEvidenceChain(context, item.deal.id);
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Complete closing evidence is required.", itemId: id, status: item.status, replayed: false };
    }
  }
  const current = item[definition.field];
  if (current === next) return { ok: true, message: "The record is already in that status.", itemId: id, status: current, replayed: true };
  if (!transitions[domain][current]?.includes(next)) {
    return { ok: false, message: `Cannot transition ${domain} from ${current} to ${next}.`, itemId: id, status: current, replayed: false };
  }
  const nextLeadStatus = domain === "showing" && item.lead?.id ? await reconcileLeadStatusAfterShowing(context, {
    currentLeadStatus: item.lead.status,
    nextShowingStatus: next,
    brokerageId,
    leadId: item.lead.id,
    showingId: id
  }) : null;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const update = transitionUpdate(domain, next, item, now, evidenceVersion);
  if (domain === "showing" && next === "scheduled") update.scheduledEnd = item.scheduledEnd;
  await sudo.query[definition.list].updateOne({ where: { id }, data: update, query: `id ${definition.field}` });
  if (domain === "showing" && item.lead?.id && nextLeadStatus !== null && nextLeadStatus !== item.lead.status) {
    await sudo.query.Lead.updateOne({ where: { id: item.lead.id }, data: { status: nextLeadStatus }, query: "id" });
  }
  if (domain === "deal" && next === "closed_lost") {
    const openEscrows = await sudo.query.Escrow.findMany({ where: { deal: { id: { equals: id } }, status: { in: ["opened", "pending"] } }, query: "id" });
    for (const escrow of openEscrows) await sudo.query.Escrow.updateOne({ where: { id: escrow.id }, data: { status: "cancelled" }, query: "id" });
    const liveOffers = await sudo.query.Offer.findMany({ where: { deal: { id: { equals: id } }, status: { in: ["draft", "submitted", "countered"] } }, query: "id status" });
    for (const offer of liveOffers) await sudo.query.Offer.updateOne({ where: { id: offer.id }, data: { status: "withdrawn" }, query: "id" });
  }
  if (domain === "offer" && next === "accepted" && item.deal?.id) {
    await sudo.query.Deal.updateOne({ where: { id: item.deal.id }, data: { offerAmount: item.amount }, query: "id" });
  }
  const leadId = domain === "lead" ? id : item.lead?.id;
  if (leadId) {
    await sudo.query.LeadActivity.createOne({
      data: {
        lead: { connect: { id: leadId } },
        ...item.property?.id ? { property: { connect: { id: item.property.id } } } : {},
        ...domain === "showing" ? { showing: { connect: { id } } } : {},
        agent: { connect: { id: sessionId(context) } },
        activityType: "status_change",
        direction: "internal",
        channel: "crm",
        subject: `${domain} status changed`,
        body: [data.note ? safeString(data.note) : "", `${current} \u2192 ${next}`].filter(Boolean).join("\n"),
        occurredAt: now
      },
      query: "id"
    });
  }
  const result = { ok: true, message: `${domain} transitioned to ${next}.`, itemId: id, status: next, replayed: false };
  if (supportsEvents && brokerageId) {
    await enqueueDomainEvent(sudo, {
      eventKey,
      eventType: `${domain}.status_changed`,
      brokerageId,
      aggregateType: domain,
      aggregateId: id,
      actorId: sessionId(context),
      action: "transition",
      request,
      before: { ...item, [definition.field]: current },
      after: result,
      occurredAt: now
    });
  }
  return result;
}
async function transition(context, domain, data) {
  const id = safeString(data.id);
  const next = safeString(data.status);
  const key = safeString(data.idempotencyKey);
  if (!id || id.length > 200 || !next || next.length > 80 || safeString(data.note).length > 5e3 || !key || key.length > 120) return { ok: false, message: "A record, target status, and bounded idempotency key are required.", itemId: null, status: null, replayed: false };
  if (!sessionId(context) || !hasDomainPermission(context, domain)) {
    return { ok: false, message: "You are not authorized to transition this record.", itemId: null, status: null, replayed: false };
  }
  if (typeof context.transaction !== "function") {
    return { ok: false, message: "Transitions are temporarily unavailable.", itemId: null, status: null, replayed: false };
  }
  return context.transaction(async (transactionContext) => {
    const sessionContext = await freshOperatorCommandContext(context.session ? transactionContext.withSession(context.session) : transactionContext);
    if (!hasDomainPermission(sessionContext, domain)) return { ok: false, message: "You are not authorized to transition this record.", itemId: null, status: null, replayed: false };
    return transitionInContext(sessionContext, domain, data);
  }, { timeout: 3e4 });
}
var transitionLeadStatus = (_root, { data }, context) => transition(context, "lead", data);
var transitionPropertyStatus = (_root, { data }, context) => transition(context, "property", data);
var transitionOpenHouseStatus = (_root, { data }, context) => transition(context, "openHouse", data);
var transitionShowingStatus = (_root, { data }, context) => transition(context, "showing", data);
async function reviewShowingCommand(_root, { data }, context) {
  if (!data.expectedStatus || !data.expectedUpdatedAt || !/^[a-f0-9]{64}$/.test(data.expectedRevision || "") || !Number.isFinite(new Date(data.expectedUpdatedAt).getTime())) {
    return { ok: false, message: "Refresh the showing and review its current version before deciding.", itemId: null, status: null, replayed: false };
  }
  return transition(context, "showing", data);
}
var transitionOfferStatus = (_root, { data }, context) => transition(context, "offer", data);
var transitionDealStage = (_root, { data }, context) => transition(context, "deal", data);
var transitionCommissionStatus = (_root, { data }, context) => transition(context, "commission", data);
var transitionDisclosureStatus = (_root, { data }, context) => transition(context, "disclosure", data);
var transitionTransactionMilestoneStatus = (_root, { data }, context) => transition(context, "milestone", data);

// features/keystone/mutations/savedDiscovery.ts
function userId(context) {
  return context.session?.itemId;
}
function discoveryBrokerageId(session) {
  const operatorBrokerageId = activeBrokerageIds(session)[0];
  if (operatorBrokerageId) return operatorBrokerageId;
  const selected = session?.data?.activeBrokerage;
  const memberships = session?.data?.brokerageMemberships || [];
  return session?.itemId && selected?.id && selected.status === "active" && !memberships.length ? selected.id : void 0;
}
async function freshDiscoveryContext(context) {
  const session = context.session;
  if (activeBrokerageIds(session).length) return freshOperatorCommandContext(context);
  const brokerageId = discoveryBrokerageId(session);
  if (!session?.itemId || !brokerageId) throw new Error("Sign in to save homes.");
  await context.prisma.$executeRawUnsafe('SELECT "id" FROM "User" WHERE "id" = $1 FOR NO KEY UPDATE', session.itemId);
  const current = await context.sudo().query.User.findOne({
    where: { id: session.itemId },
    query: "id name email activeBrokerage { id slug status } brokerageMemberships(take: 1) { id status isPrimary brokerage { id slug status } }"
  });
  const nextSession = { ...session, data: { ...session.data, ...current } };
  if (!current || current.id !== session.itemId || discoveryBrokerageId(nextSession) !== brokerageId) throw new Error("Sign in to save homes.");
  return context.withSession(nextSession);
}
function clean3(value) {
  return String(value || "").trim();
}
function unauthenticated() {
  return { ok: false, message: "Sign in to save property discovery preferences.", itemId: null };
}
function savedPropertyStatus(value) {
  return value && ["saved", "interested", "hidden"].includes(value) ? value : "saved";
}
async function withSavedDiscoveryLock(context, kind, target, execute) {
  return context.transaction(async (transactionContext) => {
    const scoped = await freshDiscoveryContext(
      context.session ? transactionContext.withSession(context.session) : transactionContext
    );
    const currentUserId = userId(scoped);
    const brokerageId = discoveryBrokerageId(scoped.session);
    if (!currentUserId || !brokerageId) throw new Error("Sign in to save homes.");
    await lockSavedDiscoveryIdentity(scoped.sudo().prisma, kind, brokerageId, currentUserId, target);
    return execute(scoped, currentUserId, brokerageId);
  }, { timeout: 3e4 });
}
async function withSavedDiscoveryRecordLock(context, kind, recordId, notFoundMessage, readIdentity, remove) {
  const notFound = () => ({ ok: false, message: notFoundMessage, itemId: null });
  return context.transaction(async (transactionContext) => {
    const scoped = await freshDiscoveryContext(
      context.session ? transactionContext.withSession(context.session) : transactionContext
    );
    const currentUserId = userId(scoped);
    const brokerageId = discoveryBrokerageId(scoped.session);
    if (!currentUserId || !brokerageId) return notFound();
    const beforeLock = await readIdentity(scoped, recordId);
    if (!isOwnedRecordIdentity(beforeLock, recordId, currentUserId, brokerageId)) return notFound();
    await lockSavedDiscoveryIdentity(scoped.sudo().prisma, kind, brokerageId, currentUserId, beforeLock.target);
    const afterLock = await readIdentity(scoped, recordId);
    if (!isOwnedRecordIdentity(afterLock, recordId, currentUserId, brokerageId) || !sameRecordIdentity(beforeLock, afterLock)) {
      return notFound();
    }
    return remove(scoped, afterLock.itemId);
  }, { timeout: 3e4 });
}
function isOwnedRecordIdentity(identity, recordId, currentUserId, brokerageId) {
  return Boolean(identity && identity.itemId === recordId && identity.userId === currentUserId && identity.brokerageId === brokerageId && identity.target);
}
function sameRecordIdentity(left, right) {
  return left.itemId === right.itemId && left.userId === right.userId && left.brokerageId === right.brokerageId && left.target === right.target;
}
async function savePropertyForCurrentUser(_root, { data }, context) {
  const currentUserId = userId(context);
  if (!currentUserId) return unauthenticated();
  const propertyId = clean3(data.propertyId);
  if (!propertyId) return { ok: false, message: "Choose a property to save.", itemId: null };
  if (!discoveryBrokerageId(context.session)) return { ok: false, message: "This property is not available to save.", itemId: null };
  const savedStatus = savedPropertyStatus(data.status);
  return withSavedDiscoveryLock(context, "property", propertyId, async (scoped, lockedUserId, brokerageId) => {
    if (lockedUserId !== currentUserId) return unauthenticated();
    const sudo = scoped.sudo();
    const property = await sudo.query.Property.findOne({ where: { id: propertyId }, query: "id status brokerage { id }" });
    if (!property || property.brokerage?.id !== brokerageId || !["active", "coming_soon"].includes(property.status)) {
      return { ok: false, message: "This property is not available to save.", itemId: null };
    }
    const existing = await sudo.query.SavedProperty.findMany({
      where: { user: { id: { equals: lockedUserId } }, property: { id: { equals: propertyId } } },
      take: 2,
      query: "id"
    });
    if (existing.length > 1) return { ok: false, message: "This property is saved more than once. Remove the duplicate and try again.", itemId: null };
    if (existing[0]?.id) {
      const item2 = await sudo.query.SavedProperty.updateOne({
        where: { id: existing[0].id },
        data: { status: savedStatus, notes: clean3(data.notes) },
        query: "id"
      });
      return { ok: true, message: "Saved property updated.", itemId: item2.id };
    }
    const item = await sudo.query.SavedProperty.createOne({
      data: {
        status: savedStatus,
        notes: clean3(data.notes),
        property: { connect: { id: propertyId } },
        user: { connect: { id: lockedUserId } }
      },
      query: "id"
    });
    return { ok: true, message: "Property saved.", itemId: item.id };
  });
}
async function removeSavedPropertyForCurrentUser(_root, { data }, context) {
  const currentUserId = userId(context);
  if (!currentUserId) return unauthenticated();
  const id = clean3(data.savedPropertyId);
  if (!id || !discoveryBrokerageId(context.session)) return { ok: false, message: "Saved property not found.", itemId: null };
  return withSavedDiscoveryRecordLock(
    context,
    "property",
    id,
    "Saved property not found.",
    async (scoped, recordId) => {
      const item = await scoped.sudo().query.SavedProperty.findOne({
        where: { id: recordId },
        query: "id user { id } property { id brokerage { id status } }"
      });
      const propertyId = typeof item?.property?.id === "string" ? item.property.id : "";
      const brokerage = item?.property?.brokerage;
      if (!item?.id || !item.user?.id || !propertyId || clean3(propertyId) !== propertyId || !brokerage?.id || brokerage.status !== "active") return null;
      return { itemId: item.id, userId: item.user.id, brokerageId: brokerage.id, target: propertyId };
    },
    async (scoped, recordId) => {
      await scoped.sudo().query.SavedProperty.deleteOne({ where: { id: recordId }, query: "id" });
      return { ok: true, message: "Saved property removed.", itemId: recordId };
    }
  );
}
async function saveSearchForCurrentUser(_root, { data }, context) {
  const currentUserId = userId(context);
  if (!currentUserId) return unauthenticated();
  const name = clean3(data.name);
  if (!name) return { ok: false, message: "Name the search before saving it.", itemId: null };
  if (!discoveryBrokerageId(context.session)) return { ok: false, message: "Sign in to save searches.", itemId: null };
  const minPrice = clean3(data.minPrice), maxPrice = clean3(data.maxPrice);
  if (minPrice && maxPrice && /^\d+(\.\d{1,2})?$/.test(minPrice) && /^\d+(\.\d{1,2})?$/.test(maxPrice) && moneyToMinor(minPrice) > moneyToMinor(maxPrice)) return { ok: false, message: "The minimum price cannot be more than the maximum price.", itemId: null };
  return withSavedDiscoveryLock(context, "search", name, async (scoped, lockedUserId, brokerageId) => {
    if (lockedUserId !== currentUserId) return unauthenticated();
    const sudo = scoped.sudo();
    const existing = await sudo.query.SavedSearch.findMany({
      where: { brokerage: { id: { equals: brokerageId } }, user: { id: { equals: lockedUserId } }, name: { equals: name } },
      take: 2,
      query: "id"
    });
    if (existing.length > 1) return { ok: false, message: "A saved search with this name already exists more than once. Remove the duplicate and try again.", itemId: null };
    const values = {
      name,
      city: clean3(data.city),
      state: clean3(data.state),
      propertyType: clean3(data.propertyType),
      listingType: ["sale", "rent"].includes(clean3(data.listingType)) ? clean3(data.listingType) : "",
      minPrice: clean3(data.minPrice) || null,
      maxPrice: clean3(data.maxPrice) || null,
      minBedrooms: data.minBedrooms ?? null,
      minBathrooms: clean3(data.minBathrooms) || null,
      minSquareFeet: data.minSquareFeet ?? null,
      keywords: clean3(data.keywords),
      alertsEnabled: data.alertsEnabled ?? true
    };
    if (existing[0]?.id) {
      const item2 = await sudo.query.SavedSearch.updateOne({ where: { id: existing[0].id }, data: values, query: "id" });
      return { ok: true, message: "Saved search updated.", itemId: item2.id };
    }
    const item = await sudo.query.SavedSearch.createOne({
      data: { ...values, brokerage: { connect: { id: brokerageId } }, user: { connect: { id: lockedUserId } } },
      query: "id"
    });
    return { ok: true, message: "Search saved.", itemId: item.id };
  });
}
async function deleteSavedSearchForCurrentUser(_root, { data }, context) {
  const currentUserId = userId(context);
  if (!currentUserId) return unauthenticated();
  const id = clean3(data.savedSearchId);
  if (!id || !discoveryBrokerageId(context.session)) return { ok: false, message: "Saved search not found.", itemId: null };
  return withSavedDiscoveryRecordLock(
    context,
    "search",
    id,
    "Saved search not found.",
    async (scoped, recordId) => {
      const item = await scoped.sudo().query.SavedSearch.findOne({
        where: { id: recordId },
        query: "id name user { id } brokerage { id status }"
      });
      const name = typeof item?.name === "string" ? item.name : "";
      const brokerage = item?.brokerage;
      if (!item?.id || !name || clean3(name) !== name || !item.user?.id || !brokerage?.id || brokerage.status !== "active") return null;
      return { itemId: item.id, userId: item.user.id, brokerageId: brokerage.id, target: name };
    },
    async (scoped, recordId) => {
      await scoped.sudo().query.SavedSearch.deleteOne({ where: { id: recordId }, query: "id" });
      return { ok: true, message: "Saved search deleted.", itemId: recordId };
    }
  );
}

// features/keystone/mutations/submitListingInquiry.ts
function clean4(value) {
  const trimmed = String(value || "").trim();
  return trimmed.length ? trimmed : "";
}
function validContact2(email, phone) {
  const emailValid = !email || email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const phoneDigits = phone.replace(/\D/g, "");
  const phoneValid = !phone || phone.length <= 40 && phoneDigits.length >= 7 && phoneDigits.length <= 15;
  return emailValid && phoneValid && Boolean(email || phone);
}
function normalizeIntent(intent) {
  const value = clean4(intent);
  return ["buy", "rent", "sell", "invest", "unknown"].includes(value) ? value : "unknown";
}
function matchesRule(rule, property, intent) {
  if (!rule.assignedAgent?.id) return false;
  if (rule.intent && rule.intent !== "any" && rule.intent !== intent) return false;
  if (rule.source && rule.source !== "any" && rule.source !== "website") return false;
  if (rule.city && property?.city && rule.city.toLowerCase() !== property.city.toLowerCase()) return false;
  if (rule.state && property?.state && rule.state.toLowerCase() !== property.state.toLowerCase()) return false;
  if (rule.postalCode && property?.postalCode && rule.postalCode !== property.postalCode) return false;
  return true;
}
async function findRoutingAgentId2(context, property, intent) {
  const rules2 = await context.sudo().query.LeadRoutingRule.findMany({
    where: { status: { equals: "active" }, brokerage: { id: { equals: property.brokerage.id } } },
    orderBy: [{ priority: "asc" }],
    take: 50,
    query: "id intent source city state postalCode isFallback assignedAgent { id }"
  });
  const matchingRule = rules2.find((rule) => matchesRule(rule, property, intent));
  const fallbackRule = rules2.find((rule) => rule.isFallback && rule.assignedAgent?.id);
  return firstActiveBrokerageAgent(context, property.brokerage.id, [matchingRule?.assignedAgent?.id, property?.assignedAgent?.id, fallbackRule?.assignedAgent?.id]);
}
async function submitListingInquiry(root, { data }, context) {
  const brokerageSlug = clean4(data.brokerageSlug).toLowerCase();
  const propertyId = clean4(data.propertyId);
  const name = clean4(data.name);
  const email = clean4(data.email);
  const phone = clean4(data.phone);
  const message = clean4(data.message);
  const preferredTime = clean4(data.preferredTime);
  const intent = normalizeIntent(data.intent);
  if (!propertyId || propertyId.length > 200 || brokerageSlug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(brokerageSlug)) {
    return { ok: false, message: "Choose a listing before sending an inquiry.", leadId: null };
  }
  if (!name || name.length > 120 || message.length > 5e3 || preferredTime.length > 200 || !validContact2(email, phone)) {
    return {
      ok: false,
      message: "Add your name and either an email or phone number so an agent can follow up.",
      leadId: null
    };
  }
  const brokerages = await context.sudo().query.Brokerage.findMany({ where: { slug: { equals: brokerageSlug }, status: { equals: "active" } }, take: 1, query: "id" });
  if (!brokerages[0]) return { ok: false, message: "This listing is unavailable.", leadId: null };
  return context.transaction(async (transactionContext) => {
    const context2 = transactionContext;
    await lockBrokerageCommand(context2, brokerages[0].id);
    await lockPropertyForDecision(context2, propertyId, brokerages[0].id);
    const properties = await context2.sudo().query.Property.findMany({
      where: {
        id: { equals: propertyId },
        brokerage: { slug: { equals: brokerageSlug }, status: { equals: "active" } }
      },
      take: 1,
      query: "id title status city state postalCode brokerage { id } assignedAgent { id }"
    });
    const property = properties[0];
    if (!property || !["active", "coming_soon"].includes(property.status)) {
      return { ok: false, message: "This listing is no longer accepting inquiries.", leadId: null };
    }
    try {
      await requireListingAuthority(context2, { brokerageId: property.brokerage.id, propertyId, practitionerId: property.assignedAgent?.id || "", jurisdictionCode: property.state, destination: "public_site" });
    } catch {
      return { ok: false, message: "This listing is not currently authorized for public inquiry.", leadId: null };
    }
    const body = [
      message || "Website listing inquiry",
      preferredTime ? `Best time to reach: ${preferredTime}` : ""
    ].filter(Boolean).join("\n\n");
    const assignedAgentId = await findRoutingAgentId2(transactionContext, property, intent);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const capture = await capturePublicLead(transactionContext, {
      name,
      email,
      phone,
      intent,
      source: "website",
      status: "new",
      message: body,
      propertyId,
      assignedAgentId
    });
    const recent = await transactionContext.sudo().query.LeadActivity.findMany({
      where: { lead: { id: { equals: capture.lead.id } }, activityType: { equals: "inquiry" }, occurredAt: { gte: new Date(Date.now() - 60 * 6e4).toISOString() } },
      take: 5,
      query: "id"
    });
    if (recent.length >= 5) return { ok: false, message: "Unable to accept this request. Please contact the brokerage directly.", leadId: null };
    const customerId = context2.session?.itemId || null;
    const customer = customerId ? await transactionContext.sudo().query.User.findOne({ where: { id: customerId }, query: "id activeBrokerage { id }" }) : null;
    const ownedByCustomer = Boolean(customer && customer.activeBrokerage?.id === property.brokerage.id);
    const activity = await transactionContext.sudo().query.LeadActivity.createOne({
      data: {
        lead: { connect: { id: capture.lead.id } },
        ...ownedByCustomer ? { customer: { connect: { id: customerId } } } : {},
        property: { connect: { id: propertyId } },
        activityType: "inquiry",
        direction: "inbound",
        channel: "website",
        subject: capture.reused ? "Repeat website listing inquiry matched" : assignedAgentId ? "Website listing inquiry routed" : "Website listing inquiry",
        body: `${body}${assignedAgentId ? "\n\nAuto-routed by lead routing rules/property agent." : ""}`,
        occurredAt: now
      },
      query: "id"
    });
    await enqueueDomainEvent(transactionContext.sudo(), {
      eventKey: `public-inquiry:${activity.id}`,
      eventType: "lead.inquiry_captured",
      brokerageId: property.brokerage.id,
      aggregateType: "lead",
      aggregateId: capture.lead.id,
      action: "capture_inquiry",
      request: { propertyId, intent, identityKey: capture.identityKey },
      before: null,
      after: { leadId: capture.lead.id, activityId: activity.id, reused: capture.reused }
    });
    return {
      ok: true,
      message: "Inquiry sent. An agent will follow up with next steps shortly.",
      leadId: null
    };
  }, { timeout: 3e4 });
}

// features/keystone/lib/showingReschedule.ts
var RESCHEDULABLE_SHOWING_STATUSES = ["requested", "scheduled"];
function planShowingReschedule(showing, nextStart, now = Date.now()) {
  if (!RESCHEDULABLE_SHOWING_STATUSES.includes(showing.status)) {
    return { ok: false, message: `A ${showing.status.replace("_", " ")} showing can't be rescheduled.` };
  }
  const start = Date.parse(showing.scheduledStart || ""), end = Date.parse(showing.scheduledEnd || "");
  const current = Number.isFinite(start) && Number.isFinite(end) && end > start ? Math.round((end - start) / 6e4) : 60;
  const durationMinutes = Math.min(240, Math.max(15, current));
  let interval;
  try {
    interval = showingInterval(nextStart, durationMinutes, now);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Choose a valid showing time." };
  }
  if (Number.isFinite(start) && Date.parse(interval.scheduledStart) === start) return { ok: false, message: "Choose a different time to reschedule." };
  return { ok: true, ...interval, durationMinutes };
}

// features/keystone/mutations/controlledEvidenceCommand.ts
function evidenceActorId(context) {
  return context.session?.itemId;
}
function evidenceRole(context) {
  return context.session?.data?.role || {};
}
function evidenceBrokerageId(context) {
  return activeBrokerageIds(context.session)[0];
}
async function runControlledEvidenceCommand(context, options) {
  const actor = evidenceActorId(context);
  const brokerageId = evidenceBrokerageId(context);
  const role5 = evidenceRole(context);
  if (!actor || !brokerageId || !role5[options.permission] || options.managerRequired && !role5.canManagePeople) {
    return { ok: false, message: "Access denied.", itemId: null, replayed: false };
  }
  if (!options.eventKey || options.eventKey.length > 240 || !options.lockKey || options.lockKey.length > 240) {
    return { ok: false, message: "A bounded command key is required.", itemId: null, replayed: false };
  }
  return context.transaction(async (transactionContext) => {
    const scoped = await freshOperatorCommandContext(context.session ? transactionContext.withSession(context.session) : transactionContext);
    const currentRole = evidenceRole(scoped);
    if (!currentRole[options.permission] || options.managerRequired && !currentRole.canManagePeople) {
      return { ok: false, message: "Access denied.", itemId: null, replayed: false };
    }
    const sudo = scoped.sudo();
    await sudo.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", options.lockKey);
    await lockCommandAggregate(scoped, options.lockKey, evidenceBrokerageId(scoped));
    if (options.authorizeTarget && !await options.authorizeTarget(scoped)) return { ok: false, message: "Access denied.", itemId: null, replayed: false };
    const candidate = await sudo.query.CommandReceipt.findOne({ where: { eventKey: options.eventKey }, query: options.authorizeReplayHeader ? SHOWING_EVENT_HEADER_QUERY : "id requestHash payload brokerage { id }" });
    if (candidate && options.authorizeReplayHeader && !await options.authorizeReplayHeader(scoped, candidate)) return { ok: false, message: "Access denied.", itemId: null, replayed: false };
    if (candidate && options.authorizeReplayHeader && candidate.requestHash !== domainPayloadHash(options.request)) throw new Error("Domain command idempotency key was reused with different input");
    const existing = candidate && options.authorizeReplayHeader ? await sudo.query.CommandReceipt.findOne({ where: { eventKey: options.eventKey }, query: "id requestHash payloadHash payload brokerage { id }" }) : candidate;
    if (candidate && (!existing || existing.id !== candidate.id || existing.requestHash !== candidate.requestHash || options.authorizeReplayHeader && !showingEventPayloadMatches(candidate, existing))) return { ok: false, message: "Access denied.", itemId: null, replayed: false };
    if (existing) {
      if (existing.brokerage?.id !== evidenceBrokerageId(scoped)) return { ok: false, message: "Access denied.", itemId: null, replayed: false };
      if (existing.requestHash !== domainPayloadHash(options.request)) throw new Error("Domain command idempotency key was reused with different input");
      if (options.authorizeReplay && !await options.authorizeReplay(scoped, existing)) {
        return { ok: false, message: "Access denied.", itemId: null, replayed: false };
      }
      return { ...existing.payload?.result || {}, replayed: true };
    }
    const executed = await options.execute(scoped);
    if (!executed.result.ok) return { ...executed.result, replayed: false };
    await enqueueDomainEvent(sudo, { eventKey: options.eventKey, request: options.request, ...executed.event });
    return { ...executed.result, replayed: false };
  }, { timeout: 3e4 });
}

// features/keystone/mutations/operatorCommands.ts
function actorId(context) {
  return context.session?.itemId;
}
function role2(context) {
  return context.session?.data?.role || {};
}
function authorized(context, brokerageId, permission, ownerId) {
  const actor = actorId(context);
  if (!actor || !role2(context)[permission] || !activeBrokerageIds(context.session).includes(brokerageId)) return false;
  return Boolean(role2(context).canManagePeople || !ownerId || ownerId === actor);
}
function validMoney(value) {
  return /^\d{1,10}(?:\.\d{1,2})?$/.test(value);
}
async function command(context, options) {
  return runControlledEvidenceCommand(context, options);
}
async function inviteBrokerageMemberCommand(_root, { data }, context) {
  const brokerageId = commandText(data.brokerageId), name = commandText(data.name), email = commandText(data.email).toLowerCase(), password2 = String(data.temporaryPassword || ""), roleName = commandText(data.roleName), membershipRole = commandText(data.membershipRole), key = commandText(data.idempotencyKey);
  const allowedRoles = ["Brokerage Admin", "Listing Agent", "Brokerage Analyst"];
  const allowedMemberships = ["admin", "team_lead", "agent", "coordinator", "analyst"];
  if (!brokerageId || !name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320 || password2.length < 12 || password2.length > 200 || !allowedRoles.includes(roleName) || !allowedMemberships.includes(membershipRole) || !key) {
    return { ok: false, message: "Valid member details, a 12+ character temporary password, and idempotency key are required.", itemId: null, replayed: false };
  }
  const actorMembership = context.session?.data?.brokerageMemberships?.find((membership) => membership.brokerage?.id === brokerageId && membership.status === "active" && membership.brokerage?.status === "active");
  if (!actorMembership || !["owner", "admin"].includes(actorMembership.membershipRole) || !role2(context).canManageRoles) return { ok: false, message: "Brokerage owner or administrator role authority is required.", itemId: null, replayed: false };
  if ((roleName === "Brokerage Admin" || membershipRole === "admin") && actorMembership.membershipRole !== "owner") return { ok: false, message: "Only a brokerage owner can add another administrator.", itemId: null, replayed: false };
  const request = { brokerageId, name, email, password: password2, roleName, membershipRole };
  return command(context, {
    eventKey: `command:brokerage:${brokerageId}:invite-member:${key}`,
    lockKey: `membership:${brokerageId}:${email}`,
    permission: "canManagePeople",
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const [brokerage, existingUsers, roles] = await Promise.all([
        sudo.query.Brokerage.findOne({ where: { id: brokerageId }, query: "id slug status" }),
        sudo.query.User.findMany({ where: { email: { equals: email } }, take: 1, query: "id" }),
        sudo.query.Role.findMany({ where: { name: { equals: roleName } }, take: 2, query: "id name" })
      ]);
      if (!brokerage || brokerage.status !== "active" || !activeBrokerageIds(scoped.session).includes(brokerage.id)) return { result: { ok: false, message: "Brokerage not found or access denied.", itemId: null }, event: null };
      if (existingUsers.length) return { result: { ok: false, message: "That email already belongs to an account. Ask the account owner to contact your brokerage administrator.", itemId: null }, event: null };
      if (roles.length !== 1) return { result: { ok: false, message: "The selected immutable role template is unavailable.", itemId: null }, event: null };
      const user = await sudo.query.User.createOne({ data: { name, email, password: password2, role: { connect: { id: roles[0].id } }, activeBrokerage: { connect: { id: brokerage.id } }, onboardingStatus: "not_started" }, query: "id name email" });
      const membership = await sudo.query.BrokerageMembership.createOne({ data: { membershipKey: `${brokerage.slug}:${email}`, brokerage: { connect: { id: brokerage.id } }, user: { connect: { id: user.id } }, membershipRole, status: "active", isPrimary: true, joinedAt: (/* @__PURE__ */ new Date()).toISOString() }, query: "id" });
      const result = { ok: true, message: "Brokerage member created. Share the temporary password through an approved private channel.", itemId: user.id };
      return { result, event: { eventType: "brokerage.member_created", brokerageId: brokerage.id, aggregateType: "brokerageMembership", aggregateId: membership.id, actorId: actorId(scoped), action: "create_member", before: null, after: { ...result, email, roleName, membershipRole } } };
    }
  });
}
async function suspendBrokerageMemberCommand(_root, { data }, context) {
  const membershipId = commandText(data.membershipId), key = commandText(data.idempotencyKey);
  if (!membershipId || !key) return { ok: false, message: "Membership and idempotency key are required.", itemId: null, replayed: false };
  return command(context, {
    eventKey: `command:membership:${membershipId}:suspend:${key}`,
    lockKey: `membership:${membershipId}`,
    permission: "canManagePeople",
    request: { membershipId },
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const membership = await sudo.query.BrokerageMembership.findOne({ where: { id: membershipId }, query: "id status membershipRole brokerage { id } user { id email }" });
      const actorMembership = scoped.session?.data?.brokerageMemberships?.find((item) => item.brokerage?.id === membership?.brokerage?.id && item.status === "active" && item.brokerage?.status === "active");
      if (!membership || !actorMembership || !["owner", "admin"].includes(actorMembership.membershipRole) || !activeBrokerageIds(scoped.session).includes(membership.brokerage?.id) || membership.user?.id === actorId(scoped)) return { result: { ok: false, message: "Membership not found or access denied.", itemId: null }, event: null };
      if (membership.membershipRole === "owner") {
        if (actorMembership.membershipRole !== "owner") return { result: { ok: false, message: "Only an owner can suspend another owner.", itemId: null }, event: null };
        const owners = await sudo.query.BrokerageMembership.findMany({ where: { brokerage: { id: { equals: membership.brokerage.id } }, membershipRole: { equals: "owner" }, status: { equals: "active" }, id: { not: { equals: membership.id } } }, take: 1, query: "id" });
        if (!owners.length) return { result: { ok: false, message: "The last active brokerage owner cannot be suspended.", itemId: null }, event: null };
      }
      if (membership.status === "suspended") return { result: { ok: true, message: "Membership is already suspended.", itemId: membership.id }, event: { eventType: "brokerage.member_suspension_replayed", brokerageId: membership.brokerage.id, aggregateType: "brokerageMembership", aggregateId: membership.id, actorId: actorId(scoped), action: "suspend_member", before: { status: "suspended" }, after: { status: "suspended" } } };
      await sudo.query.BrokerageMembership.updateOne({ where: { id: membership.id }, data: { status: "suspended", isPrimary: false }, query: "id" });
      const result = { ok: true, message: "Membership suspended; its next request will fail active-membership authorization.", itemId: membership.id };
      return { result, event: { eventType: "brokerage.member_suspended", brokerageId: membership.brokerage.id, aggregateType: "brokerageMembership", aggregateId: membership.id, actorId: actorId(scoped), action: "suspend_member", before: { status: membership.status }, after: { ...result, status: "suspended" } } };
    }
  });
}
async function updateDealFinancialTermsCommand(_root, { data }, context) {
  const dealId = commandText(data.dealId), offerAmount = commandText(data.offerAmount), commissionAmount = commandText(data.commissionAmount), key = commandText(data.idempotencyKey);
  if (!dealId || !key || !validMoney(offerAmount) || commissionAmount && !validMoney(commissionAmount)) {
    return { ok: false, message: "Deal, valid financial terms, and idempotency key are required.", itemId: null, replayed: false };
  }
  if (!role2(context).canManagePeople) return { ok: false, message: "Brokerage manager access is required.", itemId: null, replayed: false };
  const request = { dealId, offerAmount, commissionAmount };
  return command(context, {
    eventKey: `command:deal:${dealId}:financial-terms:${key}`,
    lockKey: `aggregate:deal:${dealId}`,
    permission: "canManageDeals",
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const deal = await sudo.query.Deal.findOne({ where: { id: dealId }, query: "id stage offerAmount commissionAmount brokerage { id }" });
      if (!deal || !authorized(scoped, deal.brokerage?.id, "canManageDeals") || !role2(scoped).canManagePeople) return { result: { ok: false, message: "Deal not found or access denied.", itemId: null }, event: null };
      const accepted = await sudo.query.Offer.findMany({ where: { deal: { id: { equals: dealId } }, status: { equals: "accepted" } }, take: 1, query: "id" });
      if (["closed_won", "closed_lost"].includes(deal.stage) || accepted.length) return { result: { ok: false, message: "Accepted or closed financial terms require an append-only correction, not editing.", itemId: null }, event: null };
      await sudo.query.Deal.updateOne({ where: { id: dealId }, data: { offerAmount, commissionAmount: commissionAmount || null }, query: "id" });
      const result = { ok: true, message: "Deal financial terms recorded.", itemId: dealId };
      return { result, event: { eventType: "deal.financial_terms_updated", brokerageId: deal.brokerage.id, aggregateType: "deal", aggregateId: dealId, actorId: actorId(scoped), action: "update_financial_terms", before: { offerAmount: deal.offerAmount, commissionAmount: deal.commissionAmount }, after: { ...result, offerAmount, commissionAmount: commissionAmount || null } } };
    }
  });
}
async function updateDealNextStepCommand(_root, { data }, context) {
  const dealId = commandText(data.dealId), nextStep = commandText(data.nextStep), notes = commandText(data.notes), key = commandText(data.idempotencyKey);
  if (!dealId || !nextStep || nextStep.length > 500 || notes.length > 1e4 || !key) return { ok: false, message: "Deal, next step, and idempotency key are required.", itemId: null, replayed: false };
  const request = { dealId, nextStep, notes };
  return command(context, {
    eventKey: `command:deal:${dealId}:next-step:${key}`,
    lockKey: `aggregate:deal:${dealId}`,
    permission: "canManageDeals",
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const deal = await sudo.query.Deal.findOne({ where: { id: dealId }, query: "id nextStep notes brokerage { id } assignedAgent { id }" });
      if (!deal || !authorized(scoped, deal.brokerage?.id, "canManageDeals", deal.assignedAgent?.id)) return { result: { ok: false, message: "Deal not found or access denied.", itemId: null }, event: null };
      await sudo.query.Deal.updateOne({ where: { id: dealId }, data: { nextStep, notes }, query: "id" });
      const result = { ok: true, message: "Next step saved.", itemId: dealId };
      return { result, event: { eventType: "deal.next_step_updated", brokerageId: deal.brokerage.id, aggregateType: "deal", aggregateId: dealId, actorId: actorId(scoped), action: "update_next_step", before: { nextStep: deal.nextStep, notes: deal.notes }, after: result } };
    }
  });
}
async function completeShowingWithFeedback(_root, { data }, context) {
  const showingId = commandText(data.showingId), feedback = commandText(data.feedback), key = commandText(data.idempotencyKey);
  if (!showingId || !feedback || feedback.length > 1e4 || !key) return { ok: false, message: "Showing, feedback, and idempotency key are required.", itemId: null, replayed: false };
  const request = {
    showingId,
    feedback,
    ...data.expectedStatus != null ? { expectedStatus: commandText(data.expectedStatus) } : {},
    ...data.expectedUpdatedAt != null ? { expectedUpdatedAt: reviewedIso(commandText(data.expectedUpdatedAt)) ?? commandText(data.expectedUpdatedAt) } : {},
    ...data.expectedRevision != null ? { expectedRevision: commandText(data.expectedRevision) } : {}
  };
  return command(context, {
    eventKey: `command:showing:${showingId}:feedback:${key}`,
    lockKey: `aggregate:showing:${showingId}`,
    permission: "canManageShowings",
    request,
    authorizeTarget: async (scoped) => Boolean(await scopedShowingIdentity(scoped, showingId)),
    authorizeReplayHeader: (scoped, header) => ownedShowingEventHeader(scoped, header, { eventKey: `command:showing:${showingId}:feedback:${key}`, eventType: "showing.completed_with_feedback", purpose: "showing" }),
    authorizeReplay: async (scoped, existing) => {
      if (existing.payload?.actorId !== actorId(scoped) || existing.payload?.aggregate?.type !== "showing" || existing.payload.aggregate.id !== showingId || existing.payload?.request?.showingId !== showingId || existing.payload?.result?.itemId !== showingId || existing.payload?.result?.ok !== true) return false;
      const header = await scopedShowingIdentity(scoped, showingId);
      if (!header || existing.payload.result.subject?.showingId !== showingId || existing.payload.result.subject?.leadId !== header.lead.id || existing.payload.result.subject?.propertyId !== header.property.id) return false;
      const showing = await scoped.sudo().query.Showing.findOne({ where: { id: showingId }, query: "id brokerage { id } assignedAgent { id }" });
      return Boolean(showing && authorized(scoped, showing.brokerage?.id, "canManageShowings", showing.assignedAgent?.id));
    },
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const header = await scopedShowingIdentity(scoped, showingId);
      if (!header) return { result: { ok: false, message: "Showing not found or access denied.", itemId: null }, event: null };
      await lockPropertyForDecision(scoped, header.property.id, header.brokerage.id);
      const showing = await sudo.query.Showing.findOne({ where: { id: showingId }, query: "id status updatedAt showingType notes feedback scheduledStart scheduledEnd brokerage { id status } assignedAgent { id } lead { id status brokerage { id status } } property { id state brokerage { id status } }" });
      if (!sameShowingIdentity(showing, header)) return { result: { ok: false, message: "Showing not found or access denied.", itemId: null }, event: null };
      if (!showing || !authorized(scoped, showing.brokerage?.id, "canManageShowings", showing.assignedAgent?.id)) return { result: { ok: false, message: "Showing not found or access denied.", itemId: null }, event: null };
      if (data.expectedStatus != null && showing.status !== commandText(data.expectedStatus) || data.expectedUpdatedAt != null && !sameReviewedVersion(showing.updatedAt, commandText(data.expectedUpdatedAt)) || data.expectedRevision != null && await showingReviewRevision(scoped, showing) !== commandText(data.expectedRevision)) {
        return { result: { ok: false, message: "The showing changed after review. Refresh before saving feedback.", itemId: showingId }, event: null };
      }
      try {
        await requireRepresentationAuthority(scoped, { brokerageId: showing.brokerage.id, leadId: showing.lead?.id, propertyId: showing.property?.id, practitionerId: showing.assignedAgent?.id || actorId(scoped), jurisdictionCode: showing.property?.state, side: "buyer", allowCustomerAssistance: true });
      } catch (error) {
        return { result: { ok: false, message: error instanceof Error ? error.message : "Practitioner authority is required.", itemId: showingId }, event: null };
      }
      if (showing.status !== "scheduled") return { result: { ok: false, message: `Cannot complete showing from ${showing.status}.`, itemId: showingId }, event: null };
      const nextLeadStatus = showing.lead?.id ? await reconcileLeadStatusAfterShowing(scoped, {
        currentLeadStatus: showing.lead.status,
        nextShowingStatus: "completed",
        brokerageId: showing.brokerage.id,
        leadId: showing.lead.id,
        showingId
      }) : void 0;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await sudo.query.Showing.updateOne({ where: { id: showingId }, data: { feedback, status: "completed" }, query: "id" });
      if (showing.lead?.id) {
        await sudo.query.Lead.updateOne({ where: { id: showing.lead.id }, data: { status: nextLeadStatus || showing.lead.status, lastContactedAt: now }, query: "id" });
        await sudo.query.LeadActivity.createOne({ data: { brokerage: { connect: { id: showing.brokerage.id } }, lead: { connect: { id: showing.lead.id } }, ...showing.property?.id ? { property: { connect: { id: showing.property.id } } } : {}, showing: { connect: { id: showingId } }, agent: { connect: { id: actorId(scoped) } }, activityType: "showing_feedback", direction: "internal", channel: "crm", subject: "Showing feedback", body: feedback, occurredAt: now }, query: "id" });
      }
      const result = { ok: true, message: "Feedback saved and showing completed.", itemId: showingId };
      return { result, event: { eventType: "showing.completed_with_feedback", brokerageId: showing.brokerage.id, aggregateType: "showing", aggregateId: showingId, actorId: actorId(scoped), action: "complete_with_feedback", before: { status: showing.status, feedback: showing.feedback }, after: { ...result, status: "completed", subject: { showingId, leadId: header.lead.id, propertyId: header.property.id } } } };
    }
  });
}
async function rescheduleShowingCommand(_root, { data }, context) {
  const showingId = commandText(data.showingId), scheduledStart = commandText(data.scheduledStart), note = commandText(data.note), key = commandText(data.idempotencyKey);
  const expectedStatus = commandText(data.expectedStatus), expectedUpdatedAt = reviewedIso(commandText(data.expectedUpdatedAt)) ?? "", expectedRevision = commandText(data.expectedRevision);
  if (!showingId || !scheduledStart || note.length > 2e3 || !key || !expectedStatus || !expectedUpdatedAt || !/^[a-f0-9]{64}$/.test(expectedRevision)) {
    return { ok: false, message: "Showing, new time, current version, and idempotency key are required.", itemId: null, replayed: false };
  }
  const eventKey = `command:showing:${showingId}:reschedule:${key}`;
  const request = { showingId, scheduledStart, note, expectedStatus, expectedUpdatedAt, expectedRevision };
  return command(context, {
    eventKey,
    lockKey: `aggregate:showing:${showingId}`,
    permission: "canManageShowings",
    request,
    authorizeTarget: async (scoped) => Boolean(await scopedShowingIdentity(scoped, showingId)),
    authorizeReplayHeader: (scoped, header) => ownedShowingEventHeader(scoped, header, { eventKey, eventType: "showing.rescheduled", purpose: "showing" }),
    authorizeReplay: async (scoped, existing) => {
      if (existing.payload?.actorId !== actorId(scoped) || existing.payload?.aggregate?.type !== "showing" || existing.payload.aggregate.id !== showingId || existing.payload?.request?.showingId !== showingId || existing.payload?.result?.itemId !== showingId || existing.payload?.result?.ok !== true) return false;
      const showing = await scoped.sudo().query.Showing.findOne({ where: { id: showingId }, query: "id brokerage { id } assignedAgent { id }" });
      return Boolean(showing && authorized(scoped, showing.brokerage?.id, "canManageShowings", showing.assignedAgent?.id));
    },
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const header = await scopedShowingIdentity(scoped, showingId);
      if (!header) return { result: { ok: false, message: "Showing not found or access denied.", itemId: null }, event: null };
      await lockPropertyForDecision(scoped, header.property.id, header.brokerage.id);
      const showing = await sudo.query.Showing.findOne({ where: { id: showingId }, query: "id status updatedAt showingType notes feedback scheduledStart scheduledEnd brokerage { id status } assignedAgent { id } lead { id status brokerage { id status } } property { id state brokerage { id status } }" });
      if (!sameShowingIdentity(showing, header) || !showing || !authorized(scoped, showing.brokerage?.id, "canManageShowings", showing.assignedAgent?.id)) {
        return { result: { ok: false, message: "Showing not found or access denied.", itemId: null }, event: null };
      }
      if (showing.status !== expectedStatus || !sameReviewedVersion(showing.updatedAt, expectedUpdatedAt) || await showingReviewRevision(scoped, showing) !== expectedRevision) {
        return { result: { ok: false, message: "The showing changed after review. Refresh before rescheduling.", itemId: showingId }, event: null };
      }
      const plan = planShowingReschedule(showing, scheduledStart);
      if (!plan.ok) return { result: { ok: false, message: plan.message, itemId: showingId }, event: null };
      const agentId = showing.assignedAgent?.id;
      if (showing.status === "scheduled") {
        if (!agentId) return { result: { ok: false, message: "Assign an advisor before rescheduling a confirmed showing.", itemId: showingId }, event: null };
        try {
          await requireAvailableShowingSlot(scoped, { brokerageId: showing.brokerage.id, propertyId: showing.property.id, agentId, scheduledStart: plan.scheduledStart, scheduledEnd: plan.scheduledEnd, excludeId: showingId });
        } catch (error) {
          return { result: { ok: false, message: error instanceof Error ? error.message : "That time is not available.", itemId: showingId }, event: null };
        }
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await sudo.query.Showing.updateOne({ where: { id: showingId }, data: { scheduledStart: plan.scheduledStart, scheduledEnd: plan.scheduledEnd }, query: "id" });
      if (showing.lead?.id) {
        await sudo.query.LeadActivity.createOne({ data: { brokerage: { connect: { id: showing.brokerage.id } }, lead: { connect: { id: showing.lead.id } }, property: { connect: { id: showing.property.id } }, showing: { connect: { id: showingId } }, agent: { connect: { id: actorId(scoped) } }, activityType: "status_change", direction: "internal", channel: "crm", subject: "Showing rescheduled", body: note || `Moved from ${showing.scheduledStart} to ${plan.scheduledStart}`, occurredAt: now }, query: "id" });
      }
      const result = { ok: true, message: "Showing rescheduled.", itemId: showingId };
      return { result, event: {
        eventType: "showing.rescheduled",
        brokerageId: showing.brokerage.id,
        aggregateType: "showing",
        aggregateId: showingId,
        actorId: actorId(scoped),
        action: "reschedule",
        before: { status: showing.status, scheduledStart: showing.scheduledStart, scheduledEnd: showing.scheduledEnd },
        after: { ...result, status: showing.status, scheduledStart: plan.scheduledStart, scheduledEnd: plan.scheduledEnd, subject: { showingId, leadId: header.lead.id, propertyId: header.property.id } }
      } };
    }
  });
}
async function addLeadActivityCommand(_root, { data }, context) {
  const leadId = commandText(data.leadId), body = commandText(data.body), key = commandText(data.idempotencyKey);
  if (!leadId || !body || body.length > 1e4 || commandText(data.subject).length > 200 || !key) return { ok: false, message: "Lead, body, and idempotency key are required.", itemId: null, replayed: false };
  const request = { leadId, propertyId: commandText(data.propertyId), activityType: commandText(data.activityType) || "note", direction: commandText(data.direction) || "internal", channel: commandText(data.channel) || "crm", subject: commandText(data.subject), body };
  return command(context, {
    eventKey: `command:lead:${leadId}:activity:${key}`,
    lockKey: `aggregate:lead:${leadId}`,
    permission: "canManageLeads",
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const lead = await sudo.query.Lead.findOne({ where: { id: leadId }, query: "id brokerage { id } assignedAgent { id } property { id }" });
      if (!lead || !authorized(scoped, lead.brokerage?.id, "canManageLeads", lead.assignedAgent?.id)) return { result: { ok: false, message: "Lead not found or access denied.", itemId: null }, event: null };
      const activity = await sudo.query.LeadActivity.createOne({ data: { brokerage: { connect: { id: lead.brokerage.id } }, lead: { connect: { id: leadId } }, ...request.propertyId ? { property: { connect: { id: request.propertyId } } } : {}, agent: { connect: { id: actorId(scoped) } }, activityType: request.activityType, direction: request.direction, channel: request.channel, subject: request.subject || "CRM note", body, occurredAt: (/* @__PURE__ */ new Date()).toISOString() }, query: "id" });
      const result = { ok: true, message: "Activity saved.", itemId: activity.id };
      return { result, event: { eventType: "lead.activity_added", brokerageId: lead.brokerage.id, aggregateType: "lead", aggregateId: leadId, actorId: actorId(scoped), action: "add_activity", before: null, after: result } };
    }
  });
}
async function scheduleShowingForLeadCommand(_root, { data }, context) {
  const leadId = commandText(data.leadId), propertyId = commandText(data.propertyId), assignedAgentId = commandText(data.assignedAgentId), scheduledStart = commandText(data.scheduledStart), notes = commandText(data.notes), key = commandText(data.idempotencyKey);
  if (!leadId || !propertyId || !scheduledStart || notes.length > 5e3 || !key || !Number.isFinite(new Date(scheduledStart).getTime())) return { ok: false, message: "Lead, property, valid schedule, and idempotency key are required.", itemId: null, replayed: false };
  const originalScope = data.originalActorId == null && data.originalBrokerageId == null ? null : { originalActorId: commandText(data.originalActorId), originalBrokerageId: commandText(data.originalBrokerageId) };
  if (originalScope && (!originalScope.originalActorId || !originalScope.originalBrokerageId)) return { ok: false, message: "Original request scope is unavailable.", itemId: null, replayed: false };
  const request = { leadId, propertyId, assignedAgentId, scheduledStart, notes, ...originalScope || {} };
  return command(context, {
    eventKey: `command:lead:${leadId}:schedule-showing:${key}`,
    lockKey: `aggregate:lead:${leadId}`,
    permission: "canManageShowings",
    request,
    authorizeTarget: async (scoped) => (!originalScope || originalScope.originalActorId === actorId(scoped) && originalScope.originalBrokerageId === activeBrokerageIds(scoped.session)[0]) && Boolean(await scopedSchedulingIdentity(scoped, leadId, propertyId, false)),
    authorizeReplayHeader: (scoped, header) => ownedShowingEventHeader(scoped, header, { eventKey: `command:lead:${leadId}:schedule-showing:${key}`, eventType: "showing.scheduled", purpose: "owned_receipt", leadId, propertyId }),
    authorizeReplay: (scoped, existing) => ownsShowingScheduleReceipt(scoped, existing, leadId, propertyId),
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const identity = await scopedSchedulingIdentity(scoped, leadId, propertyId);
      if (!identity) return { result: { ok: false, message: "Lead/property not found, cross-brokerage, or access denied.", itemId: null }, event: null };
      await lockPropertyForDecision(scoped, propertyId, identity.brokerageId);
      const [lead, property] = await Promise.all([
        sudo.query.Lead.findOne({ where: { id: leadId }, query: "id status brokerage { id } assignedAgent { id } property { id }" }),
        sudo.query.Property.findOne({ where: { id: propertyId }, query: "id title slug addressLine1 city state listingType price updatedAt brokerage { id } assignedAgent { id }" })
      ]);
      if (!lead || lead.id !== leadId || !property || property.id !== propertyId || lead.brokerage?.id !== identity.brokerageId || property.brokerage?.id !== identity.brokerageId || !authorized(scoped, lead.brokerage?.id, "canManageShowings", lead.assignedAgent?.id)) return { result: { ok: false, message: "Lead/property not found, cross-brokerage, or access denied.", itemId: null }, event: null };
      if (lead.property?.id !== property.id) return { result: { ok: false, message: "The showing property must match the lead\u2019s recorded listing interest.", itemId: null }, event: null };
      if (lead.status === "closed" || lead.status === "lost") return { result: { ok: false, message: "Closed or lost leads cannot be scheduled. Reopen a lost lead before scheduling.", itemId: null }, event: null };
      const agentId = assignedAgentId || lead.assignedAgent?.id || property.assignedAgent?.id;
      if (agentId) {
        const agent = await sudo.query.User.findOne({ where: { id: agentId }, query: "id brokerageMemberships(where: { status: { equals: active } }) { brokerage { id status } }" });
        if (!(agent?.brokerageMemberships || []).some((membership) => membership.brokerage?.id === lead.brokerage.id && membership.brokerage?.status === "active")) return { result: { ok: false, message: "Assigned agent is outside the brokerage.", itemId: null }, event: null };
        try {
          await requireRepresentationAuthority(scoped, { brokerageId: lead.brokerage.id, leadId, propertyId, practitionerId: agentId, jurisdictionCode: property.state, side: "buyer", allowCustomerAssistance: true });
        } catch (error) {
          return { result: { ok: false, message: error instanceof Error ? error.message : "Showing authority is required.", itemId: null }, event: null };
        }
      } else return { result: { ok: false, message: "An authorized practitioner assignment is required.", itemId: null }, event: null };
      const settings = await sudo.query.BrokerageSettings.findMany({ where: { brokerage: { id: { equals: lead.brokerage.id } } }, take: 1, query: "showingDurationMinutes" });
      const interval = showingInterval(scheduledStart, settings[0]?.showingDurationMinutes || 60);
      await requireAvailableShowingSlot(scoped, { brokerageId: lead.brokerage.id, propertyId, agentId, ...interval });
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const showing = await sudo.query.Showing.createOne({ data: { brokerage: { connect: { id: lead.brokerage.id } }, status: "scheduled", showingType: "in_person", ...interval, notes, lead: { connect: { id: leadId } }, property: { connect: { id: propertyId } }, assignedAgent: { connect: { id: agentId } } }, query: "id" });
      await sudo.query.Lead.updateOne({ where: { id: leadId }, data: { status: leadStatusAfterShowing(lead.status, "scheduled"), lastContactedAt: now }, query: "id" });
      await sudo.query.LeadActivity.createOne({ data: { brokerage: { connect: { id: lead.brokerage.id } }, lead: { connect: { id: leadId } }, property: { connect: { id: propertyId } }, showing: { connect: { id: showing.id } }, ...agentId ? { agent: { connect: { id: agentId } } } : {}, activityType: "showing_scheduled", direction: "internal", channel: "crm", subject: "Showing scheduled", body: notes, occurredAt: now }, query: "id" });
      const result = { ok: true, message: "Showing scheduled and lead updated.", itemId: showing.id };
      const receipt = { version: 1, showingId: showing.id, leadId, propertyId };
      const snapshot = showingSnapshot(property, { leadId, assignedAgentId: agentId, ...interval, showingType: "in_person", notes }, now);
      return { result, event: { eventType: "showing.scheduled", brokerageId: lead.brokerage.id, aggregateType: "showing", aggregateId: showing.id, actorId: actorId(scoped), action: "schedule", before: null, after: { ...result, status: "scheduled", receipt, snapshot } } };
    }
  });
}
async function resolveDuplicateLeadCommand(_root, { data }, context) {
  const primaryLeadId = commandText(data.primaryLeadId), duplicateLeadId = commandText(data.duplicateLeadId), note = commandText(data.note), key = commandText(data.idempotencyKey);
  if (!primaryLeadId || !duplicateLeadId || primaryLeadId === duplicateLeadId || note.length > 5e3 || !key) return { ok: false, message: "Two different leads and an idempotency key are required.", itemId: null, replayed: false };
  const request = { primaryLeadId, duplicateLeadId, note };
  return command(context, {
    eventKey: `command:lead:${duplicateLeadId}:merge:${key}`,
    lockKey: `aggregate:lead:${duplicateLeadId}`,
    permission: "canManageLeads",
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const [primary, duplicate] = await Promise.all([primaryLeadId, duplicateLeadId].map((id) => sudo.query.Lead.findOne({ where: { id }, query: "id name identityKey status brokerage { id } assignedAgent { id } property { id }" })));
      if (!primary || !duplicate || primary.brokerage?.id !== duplicate.brokerage?.id || !authorized(scoped, primary.brokerage?.id, "canManageLeads", primary.assignedAgent?.id) || !authorized(scoped, duplicate.brokerage?.id, "canManageLeads", duplicate.assignedAgent?.id)) return { result: { ok: false, message: "Leads not found, cross-brokerage, or access denied.", itemId: null }, event: null };
      if (primary.identityKey !== duplicate.identityKey) return { result: { ok: false, message: "Lead identities do not match.", itemId: null }, event: null };
      const now = (/* @__PURE__ */ new Date()).toISOString(), body = note || `Merged duplicate ${duplicateLeadId} into ${primaryLeadId}`;
      await sudo.query.Lead.updateOne({ where: { id: duplicateLeadId }, data: { status: "lost", lastContactedAt: now }, query: "id" });
      for (const lead of [primary, duplicate]) await sudo.query.LeadActivity.createOne({ data: { brokerage: { connect: { id: primary.brokerage.id } }, lead: { connect: { id: lead.id } }, agent: { connect: { id: actorId(scoped) } }, activityType: "system", direction: "internal", channel: "crm", subject: lead.id === primaryLeadId ? "Duplicate merged" : "Marked duplicate", body, occurredAt: now }, query: "id" });
      const result = { ok: true, message: "Duplicate resolved and timelines updated.", itemId: primaryLeadId };
      return { result, event: { eventType: "lead.duplicate_resolved", brokerageId: primary.brokerage.id, aggregateType: "lead", aggregateId: primaryLeadId, actorId: actorId(scoped), action: "resolve_duplicate", before: { duplicateStatus: duplicate.status }, after: result } };
    }
  });
}

// features/keystone/lib/listingBoardCursor.ts
var import_node_crypto5 = require("node:crypto");
var INVALID_LISTING_CURSOR = "Invalid, stale, or mismatched Listing page cursor.";
function listingCursorFingerprint(binding) {
  return (0, import_node_crypto5.createHash)("sha256").update(JSON.stringify(binding)).digest("base64url");
}
function encodeListingCursor(cursor, fingerprint) {
  const date = new Date(cursor.updatedAt);
  if (!cursor.id || cursor.id.length > 200 || !Number.isFinite(date.getTime())) throw new Error(INVALID_LISTING_CURSOR);
  const payload = { version: 1, id: cursor.id, updatedAt: date.toISOString(), fingerprint };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}
function decodeListingCursor(value, expectedFingerprint) {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return null;
  try {
    const bytes = Buffer.from(value, "base64url");
    if (bytes.toString("base64url") !== value) return null;
    const payload = JSON.parse(bytes.toString("utf8"));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const candidate = payload;
    if (candidate.version !== 1 || candidate.fingerprint !== expectedFingerprint) return null;
    if (typeof candidate.id !== "string" || candidate.id.length === 0 || candidate.id.length > 200) return null;
    if (typeof candidate.updatedAt !== "string") return null;
    const date = new Date(candidate.updatedAt);
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== candidate.updatedAt) return null;
    return { id: candidate.id, updatedAt: candidate.updatedAt };
  } catch {
    return null;
  }
}

// features/keystone/lib/showingDateRange.ts
function showingDateRange(range, now = /* @__PURE__ */ new Date()) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  if (range === "upcoming") return { gte: now.toISOString() };
  if (range === "past") return { lt: start.toISOString() };
  if (!range || range === "all") return null;
  const end = new Date(start);
  if (range === "today") end.setUTCDate(end.getUTCDate() + 1);
  else if (range === "week") end.setUTCDate(end.getUTCDate() + 7);
  else if (range === "month") end.setUTCDate(end.getUTCDate() + 30);
  else return { gte: start.toISOString() };
  return { gte: start.toISOString(), lt: end.toISOString() };
}

// features/keystone/lib/showingBoardCursor.ts
var import_node_crypto6 = require("node:crypto");
var INVALID_SHOWING_CURSOR = "Invalid, stale, or mismatched Showing page cursor.";
function showingCursorFingerprint(binding) {
  return (0, import_node_crypto6.createHash)("sha256").update(JSON.stringify(binding)).digest("base64url");
}
function encodeShowingCursor(cursor, fingerprint) {
  const payload = { version: 1, ...cursor, fingerprint };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}
function decodeShowingCursor(value, expectedFingerprint) {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return null;
  try {
    const bytes = Buffer.from(value, "base64url");
    if (bytes.toString("base64url") !== value) return null;
    const payload = JSON.parse(bytes.toString("utf8"));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const candidate = payload;
    if (candidate.version !== 1 || candidate.fingerprint !== expectedFingerprint) return null;
    if (typeof candidate.id !== "string" || candidate.id.length === 0 || candidate.id.length > 200) return null;
    if (typeof candidate.scheduledStart !== "string") return null;
    const date = new Date(candidate.scheduledStart);
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== candidate.scheduledStart) return null;
    return { id: candidate.id, scheduledStart: candidate.scheduledStart };
  } catch {
    return null;
  }
}

// features/keystone/mutations/platformProjections.ts
function clean5(value) {
  return String(value || "").trim();
}
function role3(context) {
  return context.session?.data?.role || {};
}
function actorId2(context) {
  return context.session?.itemId;
}
function scope(context, permission) {
  const ids = activeBrokerageIds(context.session);
  if (!actorId2(context) || !role3(context)[permission] || !ids.length) throw new Error("Access denied.");
  return { ids, actor: actorId2(context), managesAll: Boolean(role3(context).canManagePeople) };
}
function assignmentWhere(context, permission) {
  const current = scope(context, permission);
  return {
    current,
    where: current.managesAll ? { brokerage: { id: { in: current.ids } } } : { AND: [{ brokerage: { id: { in: current.ids } } }, { assignedAgent: { id: { equals: current.actor } } }] }
  };
}
function textFilter(term, fields) {
  if (!term) return null;
  if (term.length > 120) throw new Error("Search term is too long.");
  return { OR: fields.map((field) => {
    let filter = { contains: term, mode: "insensitive" };
    for (const key of field.split(".").reverse()) filter = { [key]: filter };
    return filter;
  }) };
}
async function platformContacts(_root, args, context) {
  return leadWorkspace(args, context);
}
var LISTING_QUERY = `
  id title slug status listingType propertyType shortDescription addressLine1 city state postalCode price bedrooms bathrooms squareFeet isFeatured primaryImageUrl updatedAt
  assignedAgent { id name email }
  leadsCount showingsCount
`;
async function withCoverThumbnails(sudo, rows) {
  if (!rows.length) return rows;
  const covers = await sudo.query.PropertyMedia.findMany({
    where: { property: { id: { in: rows.map((row) => row.id) } }, isHero: { equals: true }, mediaType: { equals: "photo" } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    query: "property { id } image { url }"
  });
  const byProperty = /* @__PURE__ */ new Map();
  for (const cover of covers) {
    const url = cover.image?.url || "";
    if (cover.property?.id && /^https:\/\//.test(url) && !byProperty.has(cover.property.id)) byProperty.set(cover.property.id, url);
  }
  return rows.map((row) => ({ ...row, primaryImageUrl: byProperty.get(row.id) || row.primaryImageUrl }));
}
async function platformListings(_root, { status, q, take = 60, after: after2, before }, context) {
  const current = scope(context, "canManageListings");
  const { ids } = current;
  const pageSize = Math.min(Math.max(Number(take) || 60, 1), 100);
  const filters = [{ brokerage: { id: { in: ids } } }];
  const normalizedStatus = clean5(status), term = clean5(q);
  if (normalizedStatus && normalizedStatus !== "all") filters.push({ status: { equals: normalizedStatus } });
  const search = textFilter(term, ["title", "addressLine1", "city", "postalCode"]);
  if (search) filters.push(search);
  const hasAfter = after2 !== void 0 && after2 !== null;
  const hasBefore = before !== void 0 && before !== null;
  if (hasAfter && hasBefore) throw new Error(INVALID_LISTING_CURSOR);
  const fingerprint = listingCursorFingerprint({
    actor: current.actor,
    brokerageIds: [...ids].sort(),
    permission: "canManageListings",
    status: normalizedStatus && normalizedStatus !== "all" ? normalizedStatus : "all",
    search: term,
    pageSize
  });
  const cursorValue = hasAfter ? after2 : hasBefore ? before : null;
  const cursor = cursorValue === null ? null : decodeListingCursor(cursorValue, fingerprint);
  if (cursorValue !== null && !cursor) throw new Error(INVALID_LISTING_CURSOR);
  const sudo = context.sudo();
  if (cursor) {
    const anchor = await sudo.query.Property.findMany({
      where: { AND: [...filters, { id: { equals: cursor.id } }, { updatedAt: { equals: cursor.updatedAt } }] },
      take: 1,
      query: "id updatedAt"
    });
    if (!anchor.length) throw new Error(INVALID_LISTING_CURSOR);
  }
  const boundary = cursor ? hasAfter ? { OR: [
    { updatedAt: { lt: cursor.updatedAt } },
    { AND: [{ updatedAt: { equals: cursor.updatedAt } }, { id: { lt: cursor.id } }] }
  ] } : { OR: [
    { updatedAt: { gt: cursor.updatedAt } },
    { AND: [{ updatedAt: { equals: cursor.updatedAt } }, { id: { gt: cursor.id } }] }
  ] } : null;
  const orderBy = hasBefore ? [{ updatedAt: "asc" }, { id: "asc" }] : [{ updatedAt: "desc" }, { id: "desc" }];
  const found = await sudo.query.Property.findMany({
    where: { AND: boundary ? [...filters, boundary] : filters },
    orderBy,
    take: pageSize + 1,
    query: LISTING_QUERY
  });
  const hasMoreInDirection = found.length > pageSize;
  const pageRows = found.slice(0, pageSize);
  if (cursor && !pageRows.length) throw new Error(INVALID_LISTING_CURSOR);
  const items = await withCoverThumbnails(sudo, hasBefore ? pageRows.reverse() : pageRows);
  const pageInfo = {
    hasNextPage: hasBefore ? items.length > 0 : hasMoreInDirection,
    hasPreviousPage: hasBefore ? hasMoreInDirection : hasAfter && items.length > 0,
    nextCursor: null,
    previousCursor: null
  };
  pageInfo.nextCursor = pageInfo.hasNextPage && items.length ? encodeListingCursor(items[items.length - 1], fingerprint) : null;
  pageInfo.previousCursor = pageInfo.hasPreviousPage && items.length ? encodeListingCursor(items[0], fingerprint) : null;
  const scoped = await sudo.query.Property.findMany({ where: { brokerage: { id: { in: ids } } }, take: 500, query: "id status price listingType" });
  const count = (value) => scoped.filter((item) => item.status === value).length;
  return { items, pageInfo, stats: { total: scoped.length, active: count("active"), comingSoon: count("coming_soon"), pending: count("pending"), sold: count("sold"), offMarket: count("off_market") } };
}
async function platformShowings(_root, { status, range, q, take, after: after2, before }, context) {
  return context.transaction(async (tx) => showingWorkspace({ status, range, q, take, after: after2, before }, await freshOperatorCommandContext(tx.withSession(context.session))), { timeout: 3e4 });
}
async function showingWorkspace({ status, range, q, take = 80, after: after2, before }, context) {
  const { where: brokerageWhere, current } = assignmentWhere(context, "canManageShowings");
  const filters = [brokerageWhere];
  const normalizedStatus = clean5(status), normalizedRange = clean5(range) || "upcoming", term = clean5(q);
  const pageSize = Math.min(Math.max(Number(take) || 80, 1), 100);
  const date = showingDateRange(normalizedRange);
  if (normalizedStatus && normalizedStatus !== "all") filters.push({ status: { equals: normalizedStatus } });
  if (date) filters.push({ scheduledStart: date });
  const search = textFilter(term, ["property.title", "property.addressLine1", "property.city", "lead.name", "lead.email", "assignedAgent.name"]);
  if (search) filters.push(search);
  const hasAfter = after2 !== void 0 && after2 !== null;
  const hasBefore = before !== void 0 && before !== null;
  if (hasAfter && hasBefore) throw new Error(INVALID_SHOWING_CURSOR);
  const fingerprint = showingCursorFingerprint({
    actor: current.actor,
    brokerageIds: [...current.ids].sort(),
    managesAll: current.managesAll,
    permission: "canManageShowings",
    status: normalizedStatus && normalizedStatus !== "all" ? normalizedStatus : "all",
    range: normalizedRange,
    search: term,
    pageSize
  });
  const cursorValue = hasAfter ? after2 : hasBefore ? before : null;
  const cursor = cursorValue === null ? null : decodeShowingCursor(cursorValue, fingerprint);
  if (cursorValue !== null && !cursor) throw new Error(INVALID_SHOWING_CURSOR);
  const sudo = context.sudo();
  if (cursor) {
    const anchor = await sudo.query.Showing.findMany({
      where: { AND: [...filters, { id: { equals: cursor.id } }, { scheduledStart: { equals: cursor.scheduledStart } }] },
      take: 1,
      query: "id scheduledStart"
    });
    if (!anchor.length || !await scopedShowingIdentity(context, cursor.id)) throw new Error(INVALID_SHOWING_CURSOR);
  }
  const boundary = cursor ? hasAfter ? { OR: [
    { scheduledStart: { gt: cursor.scheduledStart } },
    { AND: [{ scheduledStart: { equals: cursor.scheduledStart } }, { id: { gt: cursor.id } }] }
  ] } : { OR: [
    { scheduledStart: { lt: cursor.scheduledStart } },
    { AND: [{ scheduledStart: { equals: cursor.scheduledStart } }, { id: { lt: cursor.id } }] }
  ] } : null;
  const orderBy = hasBefore ? [{ scheduledStart: "desc" }, { id: "desc" }] : [{ scheduledStart: "asc" }, { id: "asc" }];
  const found = await sudo.query.Showing.findMany({
    where: { AND: boundary ? [...filters, boundary] : filters },
    orderBy,
    take: pageSize + 1,
    query: "id scheduledStart brokerage { id }"
  });
  const hasMoreInDirection = found.length > pageSize;
  const pageRows = found.slice(0, pageSize);
  if (cursor && !pageRows.length) throw new Error(INVALID_SHOWING_CURSOR);
  const orderedRows = hasBefore ? pageRows.reverse() : pageRows;
  const items = [];
  for (const candidate of orderedRows) {
    const view = await scopedShowingPresentation(context, candidate.id);
    if (!view || view.showing.scheduledStart !== candidate.scheduledStart) throw new Error("Showing workspace unavailable.");
    items.push(view.showing);
  }
  const hasPreviousPage = hasBefore ? hasMoreInDirection : hasAfter;
  const hasNextPage = hasBefore ? true : hasMoreInDirection;
  const pageInfo = {
    hasNextPage,
    hasPreviousPage,
    nextCursor: hasNextPage && items.length ? encodeShowingCursor(items[items.length - 1], fingerprint) : null,
    previousCursor: hasPreviousPage && items.length ? encodeShowingCursor(items[0], fingerprint) : null
  };
  const scoped = await sudo.query.Showing.findMany({ where: brokerageWhere, take: 500, query: "id status" });
  const count = (value) => scoped.filter((item) => item.status === value).length;
  return { items, pageInfo, stats: { total: scoped.length, requested: count("requested"), scheduled: count("scheduled"), completed: count("completed"), noShow: count("no_show"), cancelled: count("cancelled") } };
}
var DEAL_QUERY = `
  id title stage transactionType offerAmount commissionAmount expectedCloseDate closedAt nextStep notes createdAt updatedAt
  property { id title city state price listingType }
  lead { id name email phone status }
  assignedAgent { id name email }
  assignedTeam { id name }
`;
async function platformPipeline(_root, _args, context) {
  const { where } = assignmentWhere(context, "canManageDeals");
  const sudo = context.sudo();
  const items = await sudo.query.Deal.findMany({ where, orderBy: [{ updatedAt: "desc" }], take: 200, query: DEAL_QUERY });
  const count = (value) => items.filter((item) => item.stage === value).length;
  const projectedCommission = sumMoney(items.filter((item) => item.stage !== "closed_lost").map((item) => item.commissionAmount || "0"));
  return { items, stats: { total: items.length, open: items.filter((item) => !["closed_won", "closed_lost"].includes(item.stage)).length, underContract: count("under_contract"), closedWon: count("closed_won"), closedLost: count("closed_lost"), projectedCommission: String(projectedCommission) } };
}
async function platformReports(_root, _args, context) {
  const current = scope(context, "canViewReports");
  if (!current.managesAll) throw new Error("Access denied.");
  const where = { brokerage: { id: { in: current.ids } } };
  const sudo = context.sudo();
  const [leads, showings, deals, activeListings, pendingListings] = await Promise.all([
    sudo.query.Lead.findMany({ where, orderBy: [{ createdAt: "desc" }], take: 250, query: "id source status assignedAgent { id name }" }),
    sudo.query.Showing.findMany({ where, orderBy: [{ scheduledStart: "desc" }], take: 250, query: "id status assignedAgent { id name }" }),
    sudo.query.Deal.findMany({ where, orderBy: [{ updatedAt: "desc" }], take: 250, query: "id stage commissionAmount assignedAgent { id name }" }),
    sudo.query.Property.count({ where: { AND: [where, { status: { equals: "active" } }] } }),
    sudo.query.Property.count({ where: { AND: [where, { status: { equals: "pending" } }] } })
  ]);
  return { leads, showings, deals, activeListings, pendingListings };
}
async function platformPeople(_root, _args, context) {
  const { ids } = scope(context, "canManagePeople");
  const sudo = context.sudo();
  const [agents, teams] = await Promise.all([
    sudo.query.User.findMany({
      where: { brokerageMemberships: { some: { status: { equals: "active" }, brokerage: { id: { in: ids } } } } },
      orderBy: [{ name: "asc" }],
      take: 100,
      query: "id name email phone licenseNumber brokerageTitle avatarUrl onboardingStatus role { id name } brokerageMemberships(where: { status: { equals: active } }) { id membershipRole isPrimary brokerage { id name slug } } assignedPropertiesCount assignedLeadsCount assignedShowingsCount assignedDealsCount"
    }),
    sudo.query.AgentTeam.findMany({
      where: { brokerage: { id: { in: ids } } },
      orderBy: [{ name: "asc" }],
      take: 100,
      query: "id name slug teamType status description leadAgent { id name email } members { id name email } leadsCount dealsCount"
    })
  ]);
  return {
    agents: agents.map((agent) => ({
      ...agent,
      memberships: (agent.brokerageMemberships || []).filter((membership) => ids.includes(membership.brokerage?.id)),
      listingCount: agent.assignedPropertiesCount || 0,
      leadCount: agent.assignedLeadsCount || 0,
      showingCount: agent.assignedShowingsCount || 0,
      dealCount: agent.assignedDealsCount || 0
    })),
    teams: teams.map((team) => ({ ...team, leadCount: team.leadsCount || 0, dealCount: team.dealsCount || 0 }))
  };
}
async function platformOperations(_root, _args, context) {
  if (!role3(context).canManagePeople) throw new Error("Access denied.");
  const dealScope = assignmentWhere(context, "canManageDeals");
  const listingScope = scope(context, "canManageListings");
  const leadScope = scope(context, "canManageLeads");
  const sudo = context.sudo();
  const [offers, transactions, commissions, savedSearches, alerts, feeds, inspections, openHouses, disclosures, mortgages, titleOrders, escrows, comps, valuations, syndications, tasks, listingEngagementAuthorities, listingPublicationAuthorityRows, practitionerLicenses, representationAuthorities, documentEvidenceEvents, commissionLedgerRows, retentionPolicies, transactionFileEvents] = await Promise.all([
    sudo.query.Offer.findMany({ where: dealScope.where, orderBy: [{ createdAt: "desc" }], take: 30, query: "id offerNumber version status amount earnestMoney financingType contingencies submittedAt responseDueAt createdAt parentOffer { id offerNumber } deal { id title } property { id title } lead { id name } assignedAgent { id name }" }),
    sudo.query.Deal.findMany({ where: dealScope.where, orderBy: [{ updatedAt: "desc" }], take: 30, query: "id title stage expectedCloseDate property { id title } lead { id name } assignedAgent { id name }" }),
    sudo.query.Commission.findMany({ where: dealScope.current.managesAll ? { brokerage: { id: { in: dealScope.current.ids } } } : { AND: [{ brokerage: { id: { in: dealScope.current.ids } } }, { agent: { id: { equals: dealScope.current.actor } } }] }, orderBy: [{ createdAt: "desc" }], take: 30, query: "id title status side grossCommission brokerageSplitPercent agentSplitPercent netCommission paidAt deal { id title } agent { id name }" }),
    sudo.query.SavedSearch.findMany({ where: { brokerage: { id: { in: leadScope.ids } } }, orderBy: [{ createdAt: "desc" }], take: 30, query: "id name city state propertyType minPrice maxPrice minBedrooms alertsEnabled lastNotifiedAt user { id name email }" }),
    sudo.query.SavedSearchAlert.findMany({ where: { brokerage: { id: { in: leadScope.ids } } }, orderBy: [{ createdAt: "desc" }], take: 30, query: "id status cadence lastSentAt sentCount savedSearch { id name } user { id name email }" }),
    sudo.query.SourceFeed.findMany({ where: { brokerage: { id: { in: listingScope.ids } } }, orderBy: [{ createdAt: "desc" }], take: 30, query: "id name provider feedType status lastImportedAt recordsImported" }),
    sudo.query.PropertyInspection.findMany({ where: { OR: [{ deal: { brokerage: { id: { in: dealScope.current.ids } } } }, { property: { brokerage: { id: { in: dealScope.current.ids } } } }] }, orderBy: [{ scheduledAt: "asc" }], take: 50, query: "id title inspectionType status scheduledAt completedAt inspectorName estimatedCost summary findings property { id title } deal { id title }" }),
    sudo.query.OpenHouse.findMany({ where: { property: { brokerage: { id: { in: listingScope.ids } } } }, orderBy: [{ startsAt: "asc" }], take: 50, query: "id title status startsAt endsAt attendeeCount notes property { id title } hostAgent { id name }" }),
    sudo.query.Disclosure.findMany({ where: { deal: { brokerage: { id: { in: dealScope.current.ids } } } }, orderBy: [{ createdAt: "desc" }], take: 50, query: "id title disclosureType status documentUrl sentAt acknowledgedAt deal { id title } property { id title }" }),
    sudo.query.MortgageApplication.findMany({ where: { deal: { brokerage: { id: { in: dealScope.current.ids } } } }, orderBy: [{ createdAt: "desc" }], take: 50, query: "id applicationNumber lenderName status loanAmount interestRate submittedAt decisionAt deal { id title } lead { id name }" }),
    sudo.query.TitleOrder.findMany({ where: { deal: { brokerage: { id: { in: dealScope.current.ids } } } }, orderBy: [{ createdAt: "desc" }], take: 50, query: "id orderNumber titleCompany status orderedAt clearedAt exceptions deal { id title } property { id title }" }),
    sudo.query.Escrow.findMany({ where: { deal: { brokerage: { id: { in: dealScope.current.ids } } } }, orderBy: [{ createdAt: "desc" }], take: 50, query: "id escrowNumber status escrowCompany officerName openedAt scheduledCloseAt closedAt depositAmount deal { id title } property { id title }" }),
    sudo.query.MarketComp.findMany({ where: { subjectProperty: { brokerage: { id: { in: listingScope.ids } } } }, orderBy: [{ soldAt: "desc" }], take: 50, query: "id addressLine1 city state status listPrice salePrice soldAt bedrooms bathrooms squareFeet distanceMiles subjectProperty { id title } neighborhood { id name }" }),
    sudo.query.PropertyValuation.findMany({ where: { property: { brokerage: { id: { in: listingScope.ids } } } }, orderBy: [{ valuedAt: "desc" }], take: 50, query: "id valuationNumber valuationType lowValue estimatedValue highValue valuedAt notes property { id title } performedBy { id name }" }),
    sudo.query.ListingSyndication.findMany({ where: { brokerage: { id: { in: listingScope.ids } } }, orderBy: [{ updatedAt: "desc" }], take: 100, query: "id channel status externalListingId listingUrl errorMessage property { id title slug }" }),
    sudo.query.AgentTask.findMany({ where: leadScope.ids.length ? { brokerage: { id: { in: leadScope.ids } } } : { id: { equals: "" } }, orderBy: [{ dueAt: "asc" }], take: 100, query: "id title status priority dueAt completedAt notes assignedAgent { id name } property { id title } lead { id name } deal { id title }" }),
    sudo.query.ListingEngagementAuthority.findMany({ where: { brokerage: { id: { in: listingScope.ids } } }, orderBy: [{ effectiveFrom: "desc" }], take: 100, query: "id authorityNumber status jurisdictionCode effectiveFrom effectiveThrough marketingAuthorized showingAuthorized documentSha256 property { id title } assignedPractitioner { id name email }" }),
    sudo.query.ListingPublicationAuthority.findMany({ where: { brokerage: { id: { in: listingScope.ids } } }, orderBy: [{ effectiveFrom: "desc" }], take: 100, query: "id authorityNumber destination status effectiveFrom effectiveThrough authorityBasis property { id title } engagement { id }" }),
    sudo.query.PractitionerLicenseAuthority.findMany({ where: { brokerage: { id: { in: listingScope.ids } } }, orderBy: [{ effectiveFrom: "desc" }], take: 100, query: "id licenseNumber licenseType jurisdictionCode status effectiveFrom effectiveThrough verifiedAt verificationSource practitioner { id name email }" }),
    sudo.query.RepresentationAuthority.findMany({ where: { brokerage: { id: { in: dealScope.current.ids } } }, orderBy: [{ effectiveFrom: "desc" }], take: 100, query: "id authorityNumber side relationshipType jurisdictionCode status effectiveFrom effectiveThrough disclosureVersion lead { id name } property { id title } deal { id title } practitioner { id name email }" }),
    sudo.query.DocumentEvidenceEvent.findMany({ where: { brokerage: { id: { in: dealScope.current.ids } } }, orderBy: [{ occurredAt: "desc" }], take: 100, query: "id eventKey eventType documentSha256 templateSha256 channel provider providerReference occurredAt acknowledgedAt document { id title } offer { id offerNumber }" }),
    sudo.query.CommissionLedgerEntry.findMany({ where: { brokerage: { id: { in: dealScope.current.ids } } }, orderBy: [{ occurredAt: "desc" }], take: 150, query: "id entryKey batchKey entryType allocationType amountCents currencyCode payeeLabel externalReference occurredAt commission { id } preparedBy { id name } approvedBy { id name }" }),
    sudo.query.RetentionPolicy.findMany({ where: { brokerage: { id: { in: dealScope.current.ids } } }, orderBy: [{ effectiveFrom: "desc" }], take: 50, query: "id policyKey retentionClass jurisdictionCode triggerType retentionDays disposition effectiveFrom effectiveThrough" }),
    sudo.query.TransactionFileEvent.findMany({ where: { brokerage: { id: { in: dealScope.current.ids } } }, orderBy: [{ occurredAt: "desc" }], take: 150, query: "id eventKey eventType triggerAt disposeAfter holdKey manifestKey manifestSha256 documentSha256 externalDeletionReference reason occurredAt deal { id title } document { id title }" })
  ]);
  const dealIds = transactions.map((deal) => deal.id);
  const [milestones, documents] = dealIds.length ? await Promise.all([
    sudo.query.TransactionMilestone.findMany({ where: { deal: { id: { in: dealIds } } }, orderBy: [{ sortOrder: "asc" }], take: 500, query: "id name status dueAt completedAt sortOrder notes deal { id } assignedTo { id name }" }),
    sudo.query.DealDocument.findMany({ where: { deal: { id: { in: dealIds } } }, orderBy: [{ createdAt: "desc" }], take: 500, query: "id title documentType status requiresSignature sentAt signedAt expiresAt deal { id }" })
  ]) : [[], []];
  const transactionDetails = transactions.map((deal) => ({
    ...deal,
    milestones: milestones.filter((item) => item.deal?.id === deal.id).map(({ deal: _deal, ...item }) => item),
    documents: documents.filter((item) => item.deal?.id === deal.id).map(({ deal: _deal, ...item }) => item)
  }));
  const listingPublicationAuthorities = listingPublicationAuthorityRows.map((item) => ({ ...item, engagementId: item.engagement?.id || null }));
  const commissionLedgerEntries = commissionLedgerRows.map((item) => ({ ...item, amountCents: String(item.amountCents), commissionId: item.commission?.id }));
  return { offers, transactions: transactionDetails, commissions, savedSearches, alerts, feeds, inspections, openHouses, disclosures, mortgages, titleOrders, escrows, comps, valuations, syndications, tasks, listingEngagementAuthorities, listingPublicationAuthorities, practitionerLicenses, representationAuthorities, documentEvidenceEvents, commissionLedgerEntries, retentionPolicies, transactionFileEvents };
}

// features/keystone/mutations/platformStorefrontSettings.ts
var SETTINGS_SELECTION = "id businessName marketLabel city state tagline description equalHousingNotice publicPhone publicEmail showingDurationMinutes brandHue logoIcon logoColor";
function activeBrokerageScope(context) {
  const ids = activeBrokerageIds(context.session);
  const session = context.session;
  const selected = session?.data.activeBrokerage || session?.data.brokerageMemberships?.find((membership) => membership.brokerage?.id === ids[0])?.brokerage;
  if (ids.length !== 1 || !selected || selected.id !== ids[0] || selected.status !== "active") {
    throw new Error("An active brokerage is required.");
  }
  return { id: ids[0], slug: selected.slug };
}
async function findScopedSettings(context, brokerageId) {
  const rows = await context.query.BrokerageSettings.findMany({
    where: { brokerage: { id: { equals: brokerageId } } },
    orderBy: [{ id: "asc" }],
    take: 2,
    query: SETTINGS_SELECTION
  });
  if (rows.length > 1) throw new Error("Multiple storefront settings records require administrator review.");
  return rows[0] || null;
}
function requiredText(value, label, max) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (normalized.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  return normalized;
}
function optionalText(value, label, max) {
  const normalized = String(value ?? "").trim();
  if (normalized.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  return normalized;
}
function normalizeInput(input) {
  const showingDurationMinutes = Number(input.showingDurationMinutes);
  if (!Number.isInteger(showingDurationMinutes) || showingDurationMinutes < 15 || showingDurationMinutes > 240) {
    throw new Error("Showing duration must be between 15 and 240 minutes.");
  }
  return {
    businessName: requiredText(input.businessName, "Business name", 120),
    marketLabel: requiredText(input.marketLabel, "Market label", 120),
    city: requiredText(input.city, "City", 120),
    state: requiredText(input.state, "State", 80),
    tagline: requiredText(input.tagline, "Tagline", 220),
    description: optionalText(input.description, "Description", 1e3),
    equalHousingNotice: optionalText(input.equalHousingNotice, "Equal housing notice", 240),
    publicPhone: optionalText(input.publicPhone, "Public phone", 80),
    publicEmail: (() => {
      const email = optionalText(input.publicEmail, "Public email", 320).toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Public email must be valid.");
      return email;
    })(),
    showingDurationMinutes,
    logoIcon: (() => {
      const raw = String(input.logoIcon || "");
      const safe = sanitizeStoreLogoSvg(raw);
      if (raw.trim() && !safe) throw new Error("This logo SVG is not supported.");
      return safe;
    })(),
    logoColor: normalizeStoreLogoColor(input.logoColor)
  };
}
async function platformStorefrontSettings(_root, _args, context) {
  if (!permissions.canManageBrokerageSettings({ session: context.session })) throw new Error("Not authorized to view storefront settings.");
  const brokerage = activeBrokerageScope(context);
  const settings = await findScopedSettings(context, brokerage.id);
  return settings ? { status: "ready", settings } : { status: "unconfigured", settings: null };
}
async function updatePlatformStorefrontSettings(_root, { data }, context) {
  if (!permissions.canManageBrokerageSettings({ session: context.session })) throw new Error("Not authorized to update storefront settings.");
  const brokerage = activeBrokerageScope(context);
  const normalized = normalizeInput(data);
  const settings = await context.transaction(async (tx) => {
    const existing = await findScopedSettings(tx, brokerage.id);
    if (existing) {
      return tx.query.BrokerageSettings.updateOne({
        where: { id: existing.id },
        data: normalized,
        query: SETTINGS_SELECTION
      });
    }
    return tx.query.BrokerageSettings.createOne({
      data: {
        ...normalized,
        key: `${brokerage.slug}:primary`,
        brokerage: { connect: { id: brokerage.id } }
      },
      query: SETTINGS_SELECTION
    });
  });
  return { status: "ready", settings };
}

// features/keystone/mutations/customerAccount.ts
async function registerRealEstateCustomer(_root, { data }, context) {
  const name = String(data.name || "").trim(), email = String(data.email || "").trim().toLowerCase(), password2 = String(data.password || "");
  const slug = String(data.brokerageSlug || "").trim();
  if (!name || name.length > 120 || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password2.length < 12 || password2.length > 200 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return { ok: false, message: "Enter a name, valid email, and a password of at least 12 characters." };
  try {
    return await context.transaction(async (tx) => {
      await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `customer-registration:${email}`);
      const sudo = tx.sudo();
      const brokerage = (await sudo.query.Brokerage.findMany({ where: { slug: { equals: slug }, status: { equals: "active" } }, take: 1, query: "id" }))[0];
      if (!brokerage || await sudo.query.User.count({}) === 0 || await sudo.query.User.findOne({ where: { email }, query: "id" })) return { ok: false, message: "Account could not be created. Sign in or use another email." };
      await sudo.query.User.createOne({ data: { name, email, password: password2, activeBrokerage: { connect: { id: brokerage.id } }, onboardingStatus: "dismissed" }, query: "id" });
      return { ok: true, message: "Account created." };
    });
  } catch {
    return { ok: false, message: "Account could not be created. Sign in or use another email." };
  }
}
async function customerShowingHistory(_root, { brokerageSlug, id }, context) {
  const actor = context.session?.itemId;
  if (!actor) throw new Error("Sign in to view your showings.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(brokerageSlug) || brokerageSlug.length > 80 || id && id.length > 200) throw new Error("Showings unavailable.");
  const rows = await context.sudo().query.Showing.findMany({
    where: {
      customer: { id: { equals: actor } },
      brokerage: { slug: { equals: brokerageSlug }, status: { equals: "active" } },
      ...id ? { id: { equals: id } } : {}
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
    query: "id status showingType scheduledStart scheduledEnd requestSnapshot"
  });
  return rows.map((row) => {
    const snapshot = row.requestSnapshot && typeof row.requestSnapshot === "object" && !Array.isArray(row.requestSnapshot) ? row.requestSnapshot : {};
    return {
      id: row.id,
      status: row.status,
      showingType: row.showingType,
      scheduledStart: row.scheduledStart,
      scheduledEnd: row.scheduledEnd,
      listingTitle: typeof snapshot.listingTitle === "string" ? snapshot.listingTitle : "Residence",
      listingSlug: typeof snapshot.listingSlug === "string" ? snapshot.listingSlug : "",
      requestedStart: typeof snapshot.scheduledStart === "string" ? snapshot.scheduledStart : row.scheduledStart
    };
  });
}
async function cancelCustomerShowing(_root, { brokerageSlug, id }, context) {
  const actor = context.session?.itemId;
  if (!actor) return { ok: false, message: "Sign in to manage your showings." };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(brokerageSlug) || brokerageSlug.length > 80 || !id || id.length > 200) return { ok: false, message: "Showing not found." };
  return context.transaction(async (tx) => {
    const sudo = tx.sudo();
    await tx.prisma.$executeRawUnsafe('SELECT "id" FROM "Showing" WHERE "id" = $1 AND "customer" = $2 FOR NO KEY UPDATE', id, actor);
    const showing = (await sudo.query.Showing.findMany({
      where: { id: { equals: id }, customer: { id: { equals: actor } }, brokerage: { slug: { equals: brokerageSlug }, status: { equals: "active" } } },
      take: 1,
      query: "id status brokerage { id } lead { id status }"
    }))[0];
    if (!showing?.brokerage?.id) return { ok: false, message: "Showing not found." };
    if (showing.status === "cancelled") return { ok: true, message: "Showing cancelled." };
    if (!["requested", "scheduled"].includes(showing.status)) return { ok: false, message: "This showing can no longer be cancelled." };
    const brokerageId = showing.brokerage.id;
    const nextLeadStatus = showing.lead?.id ? await reconcileLeadStatusAfterShowing(tx, { currentLeadStatus: showing.lead.status, nextShowingStatus: "cancelled", brokerageId, leadId: showing.lead.id, showingId: id }) : null;
    await sudo.query.Showing.updateOne({ where: { id }, data: { status: "cancelled" }, query: "id" });
    if (showing.lead?.id && nextLeadStatus !== null && nextLeadStatus !== showing.lead.status) {
      await sudo.query.Lead.updateOne({ where: { id: showing.lead.id }, data: { status: nextLeadStatus }, query: "id" });
    }
    await enqueueDomainEvent(sudo, {
      eventKey: `showing:${id}:customer_cancel`,
      eventType: "showing.status_changed",
      brokerageId,
      aggregateType: "showing",
      aggregateId: id,
      actorId: actor,
      action: "customer_cancel",
      request: { showingId: id },
      before: { status: showing.status },
      after: { status: "cancelled" }
    });
    return { ok: true, message: "Showing cancelled." };
  }, { timeout: 3e4 });
}
async function customerInquiryHistory(_root, { brokerageSlug }, context) {
  const actor = context.session?.itemId;
  if (!actor) throw new Error("Sign in to view your questions.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(brokerageSlug) || brokerageSlug.length > 80) throw new Error("Questions unavailable.");
  const rows = await context.sudo().query.LeadActivity.findMany({
    where: { customer: { id: { equals: actor } }, activityType: { equals: "inquiry" }, brokerage: { slug: { equals: brokerageSlug }, status: { equals: "active" } } },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: 100,
    query: "id body occurredAt property { title slug } lead { status }"
  });
  return rows.map((row) => ({
    id: row.id,
    // Routing notes are appended for advisors and are not part of what the shopper wrote.
    message: String(row.body || "").split("\n\nAuto-routed by")[0],
    sentAt: row.occurredAt,
    listingTitle: row.property?.title || "Residence",
    listingSlug: row.property?.slug || "",
    status: row.lead?.status || "new"
  }));
}

// features/keystone/mutations/platformCommands.ts
var import_node_crypto7 = __toESM(require("node:crypto"));
function actorId3(context) {
  return context.session?.itemId;
}
function role4(context) {
  return context.session?.data?.role || {};
}
function validKey(value) {
  return Boolean(value && value.length <= 120);
}
function validMoney2(value) {
  return /^\d{1,10}(\.\d{1,2})?$/.test(value);
}
function authorized2(context, brokerageId, permission, ownerId) {
  return Boolean(actorId3(context) && role4(context)[permission] && activeBrokerageIds(context.session).includes(brokerageId) && (role4(context).canManagePeople || !ownerId || ownerId === actorId3(context)));
}
async function runCommand(context, options) {
  return runControlledEvidenceCommand(context, options);
}
async function createOfferCommand(_root, { data }, context) {
  const dealId = commandText(data.dealId), amount = commandText(data.amount), earnestMoney = commandText(data.earnestMoney), financingType = commandText(data.financingType) || "conventional", contingencies = commandText(data.contingencies), responseDueAt = commandText(data.responseDueAt), key = commandText(data.idempotencyKey);
  if (!dealId || !validMoney2(amount) || !["cash", "conventional", "fha", "va", "other"].includes(financingType) || contingencies.length > 1e4 || responseDueAt && !Number.isFinite(new Date(responseDueAt).getTime()) || !validKey(key)) return { ok: false, message: "Deal, valid amount, and bounded idempotency key are required.", itemId: null, replayed: false };
  if (earnestMoney && !validMoney2(earnestMoney)) return { ok: false, message: "Earnest money must be a valid amount.", itemId: null, replayed: false };
  if (earnestMoney && moneyToMinor(earnestMoney) > moneyToMinor(amount)) return { ok: false, message: "Earnest money cannot be more than the offer amount.", itemId: null, replayed: false };
  const request = { dealId, amount, earnestMoney, financingType, contingencies, responseDueAt };
  return runCommand(context, {
    eventKey: `command:deal:${dealId}:create-offer:${key}`,
    lockKey: `aggregate:deal:${dealId}`,
    permission: "canManageDeals",
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const deal = await sudo.query.Deal.findOne({ where: { id: dealId }, query: "id title stage brokerage { id } property { id } lead { id } assignedAgent { id }" });
      if (!deal || !authorized2(scoped, deal.brokerage?.id, "canManageDeals", deal.assignedAgent?.id)) return { result: { ok: false, message: "Deal not found or access denied.", itemId: null }, event: null };
      if (["closed_won", "closed_lost"].includes(deal.stage)) return { result: { ok: false, message: "Closed transactions cannot receive new offers.", itemId: null }, event: null };
      const suffix2 = import_node_crypto7.default.createHash("sha256").update(`${dealId}:${key}`).digest("hex").slice(0, 16).toUpperCase();
      const offer = await sudo.query.Offer.createOne({ data: { brokerage: { connect: { id: deal.brokerage.id } }, offerNumber: `OFF-${suffix2}`, status: "draft", amount, earnestMoney: earnestMoney || null, financingType, contingencies, responseDueAt: responseDueAt || null, deal: { connect: { id: dealId } }, property: { connect: { id: deal.property.id } }, lead: { connect: { id: deal.lead.id } }, ...deal.assignedAgent?.id ? { assignedAgent: { connect: { id: deal.assignedAgent.id } } } : {} }, query: "id offerNumber status" });
      const result = { ok: true, message: "Offer draft created.", itemId: offer.id };
      return { result, event: { eventType: "offer.draft_created", brokerageId: deal.brokerage.id, aggregateType: "offer", aggregateId: offer.id, actorId: actorId3(scoped), action: "create_draft", before: null, after: { ...result, offerNumber: offer.offerNumber } } };
    }
  });
}
async function createCounterOfferCommand(_root, { data }, context) {
  const offerId = commandText(data.offerId), amount = commandText(data.amount), responseDueAt = commandText(data.responseDueAt), contingencies = commandText(data.contingencies), key = commandText(data.idempotencyKey);
  if (!offerId || !validMoney2(amount) || contingencies.length > 1e4 || responseDueAt && !Number.isFinite(new Date(responseDueAt).getTime()) || !validKey(key)) return { ok: false, message: "Offer, valid amount, and bounded idempotency key are required.", itemId: null, replayed: false };
  const request = { offerId, amount, responseDueAt, contingencies };
  return runCommand(context, {
    eventKey: `command:offer:${offerId}:counter:${key}`,
    lockKey: `aggregate:offer:${offerId}`,
    permission: "canManageDeals",
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const source = await sudo.query.Offer.findOne({ where: { id: offerId }, query: "id offerNumber version status earnestMoney financingType brokerage { id } deal { id transactionType } property { id state } lead { id } assignedAgent { id }" });
      if (!source || !authorized2(scoped, source.brokerage?.id, "canManageDeals", source.assignedAgent?.id)) return { result: { ok: false, message: "Offer not found or access denied.", itemId: null }, event: null };
      source.property = await lockAndRefreshProperty(scoped, source.property.id, source.brokerage.id);
      try {
        await requireRepresentationAuthority(scoped, { brokerageId: source.brokerage.id, leadId: source.lead.id, propertyId: source.property.id, dealId: source.deal.id, practitionerId: source.assignedAgent?.id || actorId3(scoped), jurisdictionCode: source.property.state, side: ["seller", "landlord"].includes(source.deal.transactionType) ? "seller" : "buyer" });
      } catch (error) {
        return { result: { ok: false, message: error instanceof Error ? error.message : "Negotiation authority is required.", itemId: source.id }, event: null };
      }
      if (!["submitted", "countered"].includes(source.status)) return { result: { ok: false, message: `Cannot counter an offer from ${source.status}.`, itemId: source.id }, event: null };
      const suffix2 = import_node_crypto7.default.createHash("sha256").update(key).digest("hex").slice(0, 6).toUpperCase();
      const counter = await sudo.query.Offer.createOne({ data: { brokerage: { connect: { id: source.brokerage.id } }, offerNumber: `${source.offerNumber}-C${suffix2}`, version: Number(source.version || 1) + 1, parentOffer: { connect: { id: source.id } }, status: "draft", amount, earnestMoney: source.earnestMoney, financingType: source.financingType, contingencies, responseDueAt: responseDueAt || null, deal: { connect: { id: source.deal.id } }, property: { connect: { id: source.property.id } }, lead: { connect: { id: source.lead.id } }, ...source.assignedAgent?.id ? { assignedAgent: { connect: { id: source.assignedAgent.id } } } : {} }, query: "id offerNumber" });
      await sudo.query.Offer.updateOne({ where: { id: source.id }, data: { status: "countered" }, query: "id" });
      const result = { ok: true, message: "Counteroffer draft created.", itemId: counter.id };
      return { result, event: { eventType: "offer.counter_created", brokerageId: source.brokerage.id, aggregateType: "offer", aggregateId: counter.id, actorId: actorId3(scoped), action: "counter", before: { sourceOfferId: source.id, sourceStatus: source.status }, after: { ...result, offerNumber: counter.offerNumber } } };
    }
  });
}
async function createChecklistItemCommand(_root, { data }, context) {
  const dealId = commandText(data.dealId), name = commandText(data.name), dueAt = commandText(data.dueAt), assignedToId = commandText(data.assignedToId), notes = commandText(data.notes), key = commandText(data.idempotencyKey);
  if (!dealId || !name || name.length > 160 || notes.length > 5e3 || dueAt && !Number.isFinite(new Date(dueAt).getTime()) || !validKey(key)) return { ok: false, message: "Deal, bounded checklist name, and idempotency key are required.", itemId: null, replayed: false };
  const request = { dealId, name, dueAt, assignedToId, notes };
  return runCommand(context, {
    eventKey: `command:deal:${dealId}:checklist:${key}`,
    lockKey: `aggregate:deal:${dealId}`,
    permission: "canManageDeals",
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const deal = await sudo.query.Deal.findOne({ where: { id: dealId }, query: "id brokerage { id } assignedAgent { id }" });
      if (!deal || !authorized2(scoped, deal.brokerage?.id, "canManageDeals", deal.assignedAgent?.id)) return { result: { ok: false, message: "Deal not found or access denied.", itemId: null }, event: null };
      const item = await sudo.query.TransactionMilestone.createOne({ data: { brokerage: { connect: { id: deal.brokerage.id } }, deal: { connect: { id: deal.id } }, name, status: "not_started", dueAt: dueAt || null, notes, ...assignedToId ? { assignedTo: { connect: { id: assignedToId } } } : {} }, query: "id" });
      const result = { ok: true, message: "Checklist item added.", itemId: item.id };
      return { result, event: { eventType: "transaction.checklist_item_created", brokerageId: deal.brokerage.id, aggregateType: "deal", aggregateId: deal.id, actorId: actorId3(scoped), action: "create_checklist_item", before: null, after: result } };
    }
  });
}
async function transitionDocumentCommand(_root, { data }, context) {
  const documentId = commandText(data.documentId), status = commandText(data.status), key = commandText(data.idempotencyKey);
  const allowed = { draft: ["archived"], sent: ["archived"], signed: ["archived"], archived: [] };
  if (!documentId || !status || !validKey(key)) return { ok: false, message: "Document, status, and idempotency key are required.", itemId: null, replayed: false };
  const request = { documentId, status };
  return runCommand(context, {
    eventKey: `command:document:${documentId}:status:${key}`,
    lockKey: `aggregate:document:${documentId}`,
    permission: "canManageDeals",
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const document = await sudo.query.DealDocument.findOne({ where: { id: documentId }, query: "id status brokerage { id } deal { id assignedAgent { id } }" });
      if (!document || !authorized2(scoped, document.brokerage?.id, "canManageDeals", document.deal?.assignedAgent?.id)) return { result: { ok: false, message: "Document not found or access denied.", itemId: null }, event: null };
      if (!allowed[document.status]?.includes(status)) return { result: { ok: false, message: `Cannot transition document from ${document.status} to ${status}.`, itemId: document.id }, event: null };
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await sudo.query.DealDocument.updateOne({ where: { id: document.id }, data: { status, ...status === "sent" ? { sentAt: now } : {}, ...status === "signed" ? { signedAt: now } : {} }, query: "id" });
      const result = { ok: true, message: "Document status updated.", itemId: document.id };
      return { result, event: { eventType: "transaction.document_transitioned", brokerageId: document.brokerage.id, aggregateType: "dealDocument", aggregateId: document.id, actorId: actorId3(scoped), action: "transition", before: { status: document.status }, after: { ...result, status } } };
    }
  });
}
async function transitionAgentTaskCommand(_root, { data }, context) {
  const taskId = commandText(data.taskId), status = commandText(data.status), key = commandText(data.idempotencyKey);
  const allowed = { open: ["in_progress", "blocked", "done"], in_progress: ["open", "blocked", "done"], blocked: ["open", "in_progress", "done"], done: ["open"] };
  if (!taskId || !status || !validKey(key)) return { ok: false, message: "Task, status, and idempotency key are required.", itemId: null, replayed: false };
  const request = { taskId, status };
  return runCommand(context, { eventKey: `command:agent-task:${taskId}:status:${key}`, lockKey: `aggregate:agent-task:${taskId}`, permission: "canManageLeads", request, execute: async (scoped) => {
    const sudo = scoped.sudo();
    const task = await sudo.query.AgentTask.findOne({ where: { id: taskId }, query: "id status brokerage { id } assignedAgent { id }" });
    if (!task || !authorized2(scoped, task.brokerage?.id, "canManageLeads", task.assignedAgent?.id)) return { result: { ok: false, message: "Task not found or access denied.", itemId: null }, event: null };
    if (task.status === status) return { result: { ok: true, message: "Task already has that status.", itemId: task.id }, event: { eventType: "agent_task.transition_replayed", brokerageId: task.brokerage.id, aggregateType: "agentTask", aggregateId: task.id, actorId: actorId3(scoped), action: "transition", before: { status }, after: { status } } };
    if (!allowed[task.status]?.includes(status)) return { result: { ok: false, message: `Cannot transition task from ${task.status} to ${status}.`, itemId: task.id }, event: null };
    const completedAt = status === "done" ? (/* @__PURE__ */ new Date()).toISOString() : null;
    await sudo.query.AgentTask.updateOne({ where: { id: task.id }, data: { status, completedAt }, query: "id" });
    const result = { ok: true, message: "Task status updated.", itemId: task.id };
    return { result, event: { eventType: "agent_task.transitioned", brokerageId: task.brokerage.id, aggregateType: "agentTask", aggregateId: task.id, actorId: actorId3(scoped), action: "transition", before: { status: task.status }, after: { ...result, status, completedAt } } };
  } });
}
async function transitionInspectionCommand(_root, { data }, context) {
  const inspectionId = commandText(data.inspectionId), status = commandText(data.status), key = commandText(data.idempotencyKey);
  const allowed = { scheduled: ["completed", "needs_follow_up", "waived"], needs_follow_up: ["completed", "waived"], completed: ["needs_follow_up"], waived: [] };
  if (!inspectionId || !status || !validKey(key)) return { ok: false, message: "Inspection, status, and idempotency key are required.", itemId: null, replayed: false };
  const request = { inspectionId, status };
  return runCommand(context, { eventKey: `command:inspection:${inspectionId}:status:${key}`, lockKey: `aggregate:inspection:${inspectionId}`, permission: "canManageDeals", request, execute: async (scoped) => {
    const sudo = scoped.sudo();
    const inspection = await sudo.query.PropertyInspection.findOne({ where: { id: inspectionId }, query: "id status deal { id brokerage { id } assignedAgent { id } } property { id brokerage { id } assignedAgent { id } }" });
    const brokerageId = inspection?.deal?.brokerage?.id || inspection?.property?.brokerage?.id;
    const ownerId = inspection?.deal?.assignedAgent?.id || inspection?.property?.assignedAgent?.id;
    if (!inspection || !brokerageId || !authorized2(scoped, brokerageId, "canManageDeals", ownerId)) return { result: { ok: false, message: "Inspection not found or access denied.", itemId: null }, event: null };
    if (inspection.status === status) return { result: { ok: true, message: "Inspection already has that status.", itemId: inspection.id }, event: { eventType: "inspection.transition_replayed", brokerageId, aggregateType: "propertyInspection", aggregateId: inspection.id, actorId: actorId3(scoped), action: "transition", before: { status }, after: { status } } };
    if (!allowed[inspection.status]?.includes(status)) return { result: { ok: false, message: `Cannot transition inspection from ${inspection.status} to ${status}.`, itemId: inspection.id }, event: null };
    const completedAt = status === "completed" ? (/* @__PURE__ */ new Date()).toISOString() : null;
    await sudo.query.PropertyInspection.updateOne({ where: { id: inspection.id }, data: { status, completedAt }, query: "id" });
    const result = { ok: true, message: "Inspection status updated.", itemId: inspection.id };
    return { result, event: { eventType: "inspection.transitioned", brokerageId, aggregateType: "propertyInspection", aggregateId: inspection.id, actorId: actorId3(scoped), action: "transition", before: { status: inspection.status }, after: { ...result, status, completedAt } } };
  } });
}
async function updateSavedSearchAlertCommand(_root, { data }, context) {
  const alertId = commandText(data.alertId), status = commandText(data.status), cadence = commandText(data.cadence), key = commandText(data.idempotencyKey);
  if (!alertId || !["active", "paused", "unsubscribed"].includes(status) || !["instant", "daily", "weekly"].includes(cadence) || !validKey(key)) return { ok: false, message: "Alert, valid preference, and idempotency key are required.", itemId: null, replayed: false };
  const request = { alertId, status, cadence };
  return runCommand(context, { eventKey: `command:saved-search-alert:${alertId}:preference:${key}`, lockKey: `aggregate:saved-search-alert:${alertId}`, permission: "canManageLeads", request, execute: async (scoped) => {
    const sudo = scoped.sudo();
    const alert = await sudo.query.SavedSearchAlert.findOne({ where: { id: alertId }, query: "id status cadence brokerage { id } user { id }" });
    if (!alert || !authorized2(scoped, alert.brokerage?.id, "canManageLeads", alert.user?.id)) return { result: { ok: false, message: "Alert not found or access denied.", itemId: null }, event: null };
    await sudo.query.SavedSearchAlert.updateOne({ where: { id: alert.id }, data: { status, cadence }, query: "id" });
    const result = { ok: true, message: "Alert preference updated.", itemId: alert.id };
    return { result, event: { eventType: "saved_search.preference_updated", brokerageId: alert.brokerage.id, aggregateType: "savedSearchAlert", aggregateId: alert.id, actorId: actorId3(scoped), action: "update_preference", before: { status: alert.status, cadence: alert.cadence }, after: { ...result, status, cadence } } };
  } });
}
async function queueSavedSearchAlertCommand(_root, { data }, context) {
  const alertId = commandText(data.alertId), key = commandText(data.idempotencyKey);
  if (!alertId || !validKey(key)) return { ok: false, message: "Alert and idempotency key are required.", itemId: null, replayed: false };
  const request = { alertId };
  return runCommand(context, { eventKey: `command:saved-search-alert:${alertId}:queue:${key}`, lockKey: `aggregate:saved-search-alert:${alertId}`, permission: "canManageLeads", request, execute: async (scoped) => {
    const sudo = scoped.sudo();
    const alert = await sudo.query.SavedSearchAlert.findOne({ where: { id: alertId }, query: "id status brokerage { id } savedSearch { id } user { id }" });
    if (!alert || alert.status !== "active" || !authorized2(scoped, alert.brokerage?.id, "canManageLeads", alert.user?.id)) return { result: { ok: false, message: "Active alert not found or access denied.", itemId: null }, event: null };
    const result = { ok: true, message: "Alert delivery recorded.", itemId: alert.id };
    return { result, event: { eventType: "saved_search.alert_queued", brokerageId: alert.brokerage.id, aggregateType: "savedSearchAlert", aggregateId: alert.id, actorId: actorId3(scoped), action: "queue_alert", before: null, after: result } };
  } });
}
async function transitionListingSyndicationCommand(_root, { data }, context) {
  const syndicationId = commandText(data.syndicationId), status = commandText(data.status), providerReference = commandText(data.providerReference), reason = commandText(data.reason), key = commandText(data.idempotencyKey);
  const allowed = { draft: ["published", "error", "removed"], published: ["error", "removed"], error: ["published", "removed"], removed: [] };
  if (!syndicationId || !status || providerReference.length > 500 || !reason || reason.length > 5e3 || !validKey(key)) return { ok: false, message: "Syndication, status, reason, and bounded idempotency key are required.", itemId: null, replayed: false };
  const request = { syndicationId, status, providerReference, reason };
  return runCommand(context, { eventKey: `command:listing-syndication:${syndicationId}:status:${key}`, lockKey: `aggregate:listing-syndication:${syndicationId}`, permission: "canManageListings", request, execute: async (scoped) => {
    const sudo = scoped.sudo();
    const item = await sudo.query.ListingSyndication.findOne({ where: { id: syndicationId }, query: "id status channel brokerage { id } property { id state assignedAgent { id } }" });
    if (!item || !authorized2(scoped, item.brokerage?.id, "canManageListings", item.property?.assignedAgent?.id)) return { result: { ok: false, message: "Syndication not found or access denied.", itemId: null }, event: null };
    item.property = await lockAndRefreshProperty(scoped, item.property.id, item.brokerage.id);
    if (!authorized2(scoped, item.brokerage.id, "canManageListings", item.property.assignedAgent?.id)) return { result: { ok: false, message: "Syndication authority changed.", itemId: null }, event: null };
    if (!allowed[item.status]?.includes(status)) return { result: { ok: false, message: `Cannot transition syndication from ${item.status} to ${status}.`, itemId: item.id }, event: null };
    if (status === "published") {
      const destination = item.channel === "mls" ? "mls" : item.channel === "website" ? "public_site" : "syndication";
      try {
        await requireListingAuthority(scoped, { brokerageId: item.brokerage.id, propertyId: item.property.id, practitionerId: item.property.assignedAgent?.id || "", jurisdictionCode: item.property.state, destination });
      } catch (error) {
        return { result: { ok: false, message: error instanceof Error ? error.message : "Publication authority is required.", itemId: item.id }, event: null };
      }
    }
    await sudo.query.ListingSyndication.updateOne({ where: { id: item.id }, data: { status, ...status === "published" || status === "removed" ? { errorMessage: null } : {}, ...status === "error" ? { errorMessage: reason } : {}, metadata: { providerReference: providerReference || null, evidenceOnly: true } }, query: "id" });
    const message = status === "published" ? "Listing marked as published." : status === "removed" ? "Listing marked as removed." : "Syndication error recorded.";
    const result = { ok: true, message, itemId: item.id };
    return { result, event: { eventType: "listing_syndication.local_status_reported", brokerageId: item.brokerage.id, aggregateType: "listingSyndication", aggregateId: item.id, actorId: actorId3(scoped), action: "record_local_status", before: { status: item.status }, after: { ...result, status, providerReference, verification: "unverified" } } };
  } });
}
async function queueSourceImportCommand(_root, { data }, context) {
  const sourceFeedId = commandText(data.sourceFeedId), mode = commandText(data.mode) || "incremental", key = commandText(data.idempotencyKey);
  if (!sourceFeedId || !["incremental", "full", "dry_run"].includes(mode) || !validKey(key)) return { ok: false, message: "Source feed, valid mode, and idempotency key are required.", itemId: null, replayed: false };
  const request = { sourceFeedId, mode };
  return runCommand(context, { eventKey: `command:source-feed:${sourceFeedId}:import:${key}`, lockKey: `aggregate:source-feed:${sourceFeedId}`, permission: "canManageListings", request, execute: async (scoped) => {
    const sudo = scoped.sudo();
    const feed = await sudo.query.SourceFeed.findOne({ where: { id: sourceFeedId }, query: "id name status brokerage { id }" });
    if (!feed || feed.status !== "active" || !authorized2(scoped, feed.brokerage?.id, "canManageListings")) return { result: { ok: false, message: "Active source feed not found or access denied.", itemId: null }, event: null };
    const result = { ok: true, message: `${mode === "dry_run" ? "Dry run" : mode === "full" ? "Full" : "Incremental"} import queued.`, itemId: feed.id };
    return { result, event: { eventType: "integration.import_queued", brokerageId: feed.brokerage.id, aggregateType: "sourceFeed", aggregateId: feed.id, actorId: actorId3(scoped), action: "queue_import", before: null, after: { ...result, mode } } };
  } });
}

// features/keystone/mutations/authorityCommands.ts
var import_node_crypto8 = __toESM(require("node:crypto"));
function clean6(value) {
  return String(value || "").trim();
}
function timestamp37(value, label) {
  const date = new Date(clean6(value));
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} must be a valid timestamp.`);
  return date.toISOString();
}
function effectiveRange(fromValue, throughValue) {
  const effectiveFrom = timestamp37(fromValue, "Effective from");
  const effectiveThrough = timestamp37(throughValue, "Effective through");
  if (new Date(effectiveFrom) >= new Date(effectiveThrough)) throw new Error("Effective through must be after effective from.");
  return { effectiveFrom, effectiveThrough };
}
function suffix(key) {
  return import_node_crypto8.default.createHash("sha256").update(key).digest("hex").slice(0, 12).toUpperCase();
}
async function recordPractitionerLicenseAuthorityCommand(_root, { data }, context) {
  const practitionerId = clean6(data.practitionerId), licenseNumber = clean6(data.licenseNumber), licenseType = clean6(data.licenseType), jurisdictionCode = clean6(data.jurisdictionCode).toUpperCase(), status = clean6(data.status), verificationSource = clean6(data.verificationSource), restrictions = clean6(data.restrictions), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  const range = effectiveRange(data.effectiveFrom, data.effectiveThrough);
  const verifiedAt = timestamp37(data.verifiedAt, "Verified at");
  if (new Date(verifiedAt) > /* @__PURE__ */ new Date()) throw new Error("License verification time cannot be in the future.");
  if (!practitionerId || !licenseNumber || licenseNumber.length > 120 || !["broker", "associate_broker", "sales_agent"].includes(licenseType) || !/^[A-Z]{2}(?:-[A-Z0-9-]{1,20})?$/.test(jurisdictionCode) || !["verified_active", "restricted", "inactive", "expired", "suspended", "revoked"].includes(status) || !verificationSource || verificationSource.length > 500 || restrictions.length > 5e3) throw new Error("Valid bounded practitioner-license evidence is required.");
  const brokerageId = evidenceBrokerageId(context) || "";
  const request = { practitionerId, licenseNumber, licenseType, jurisdictionCode, status, ...range, verifiedAt, verificationSource, restrictions, reason };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:license:${practitionerId}:${jurisdictionCode}:${key}`,
    lockKey: `authority:license:${practitionerId}:${jurisdictionCode}`,
    permission: "canManagePeople",
    managerRequired: true,
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const [practitioner, prior] = await Promise.all([
        sudo.query.User.findOne({ where: { id: practitionerId }, query: "id brokerageMemberships(where: { status: { equals: active } }) { brokerage { id status } }" }),
        sudo.query.PractitionerLicenseAuthority.findMany({ where: { brokerage: { id: { equals: brokerageId } }, practitioner: { id: { equals: practitionerId } }, jurisdictionCode: { equals: jurisdictionCode } }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }], take: 1, query: "id" })
      ]);
      if (!(practitioner?.brokerageMemberships || []).some((membership) => membership.brokerage?.id === brokerageId && membership.brokerage?.status === "active")) return { result: { ok: false, message: "Practitioner is not an active brokerage member.", itemId: null }, event: null };
      const item = await sudo.query.PractitionerLicenseAuthority.createOne({ data: { brokerage: { connect: { id: brokerageId } }, practitioner: { connect: { id: practitionerId } }, licenseNumber, licenseType, jurisdictionCode, status, ...range, verifiedAt, verificationSource, restrictions, ...prior[0]?.id ? { supersedes: { connect: { id: prior[0].id } } } : {}, reason, verifiedBy: { connect: { id: evidenceActorId(scoped) } } }, query: "id" });
      const result = { ok: true, message: "Practitioner license authority evidence appended.", itemId: item.id };
      return { result, event: { eventType: "authority.practitioner_license_recorded", brokerageId, aggregateType: "practitionerLicenseAuthority", aggregateId: item.id, actorId: evidenceActorId(scoped), action: "record", before: prior[0] || null, after: { ...result, practitionerId, jurisdictionCode, status } } };
    }
  });
}
async function recordListingEngagementAuthorityCommand(_root, { data }, context) {
  const propertyId = clean6(data.propertyId), practitionerId = clean6(data.practitionerId), status = clean6(data.status), jurisdictionCode = clean6(data.jurisdictionCode).toUpperCase(), signatoryCapacity = clean6(data.signatoryCapacity), documentSha256 = clean6(data.documentSha256).toLowerCase(), providerReference = clean6(data.providerReference), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  const range = effectiveRange(data.effectiveFrom, data.effectiveThrough);
  if (!propertyId || !practitionerId || !["executed", "revoked", "expired"].includes(status) || !jurisdictionCode || !signatoryCapacity || signatoryCapacity.length > 500 || !isSha256(documentSha256) || providerReference.length > 500) throw new Error("Valid listing-engagement authority evidence is required.");
  const brokerageId = evidenceBrokerageId(context) || "";
  const sellerPartySummary = normalizeDomainJson(data.sellerPartySummary || null);
  const request = { propertyId, practitionerId, status, jurisdictionCode, ...range, exclusive: Boolean(data.exclusive), marketingAuthorized: Boolean(data.marketingAuthorized), showingAuthorized: Boolean(data.showingAuthorized), sellerPartySummary, signatoryCapacity, documentSha256, providerReference, reason };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:listing-engagement:${propertyId}:${key}`,
    lockKey: `authority:listing:${propertyId}`,
    permission: "canManageListings",
    managerRequired: true,
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const [property, prior] = await Promise.all([
        sudo.query.Property.findOne({ where: { id: propertyId }, query: "id state brokerage { id } assignedAgent { id }" }),
        sudo.query.ListingEngagementAuthority.findMany({ where: { brokerage: { id: { equals: brokerageId } }, property: { id: { equals: propertyId } } }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }], take: 1, query: "id" })
      ]);
      if (!property || property.brokerage?.id !== brokerageId || property.assignedAgent?.id !== practitionerId || property.state.toUpperCase() !== jurisdictionCode) return { result: { ok: false, message: "Property, practitioner, and jurisdiction authority do not align.", itemId: null }, event: null };
      if (status === "executed") await requirePractitionerLicense(scoped, { brokerageId, practitionerId, jurisdictionCode });
      const item = await sudo.query.ListingEngagementAuthority.createOne({ data: { brokerage: { connect: { id: brokerageId } }, authorityNumber: `LE-${suffix(key)}`, property: { connect: { id: propertyId } }, assignedPractitioner: { connect: { id: practitionerId } }, status, jurisdictionCode, ...range, exclusive: request.exclusive, marketingAuthorized: request.marketingAuthorized, showingAuthorized: request.showingAuthorized, sellerPartySummary: request.sellerPartySummary, signatoryCapacity, documentSha256, documentProviderReference: providerReference, ...prior[0]?.id ? { supersedes: { connect: { id: prior[0].id } } } : {}, reason, recordedBy: { connect: { id: evidenceActorId(scoped) } }, recordedAt: (/* @__PURE__ */ new Date()).toISOString() }, query: "id" });
      const result = { ok: true, message: "Listing engagement authority evidence appended.", itemId: item.id };
      return { result, event: { eventType: "authority.listing_engagement_recorded", brokerageId, aggregateType: "listingEngagementAuthority", aggregateId: item.id, actorId: evidenceActorId(scoped), action: "record", before: prior[0] || null, after: { ...result, propertyId, status } } };
    }
  });
}
async function recordListingPublicationAuthorityCommand(_root, { data }, context) {
  const propertyId = clean6(data.propertyId), engagementId = clean6(data.engagementId), destination = clean6(data.destination), status = clean6(data.status), authorityBasis = clean6(data.authorityBasis), localRuleReference = clean6(data.localRuleReference), dataUseGrantReference = clean6(data.dataUseGrantReference), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  const range = effectiveRange(data.effectiveFrom, data.effectiveThrough);
  if (!propertyId || !engagementId || !["public_site", "mls", "idx", "syndication"].includes(destination) || !["authorized", "revoked", "expired"].includes(status) || !authorityBasis || authorityBasis.length > 1e3 || localRuleReference.length > 500 || dataUseGrantReference.length > 500) throw new Error("Valid publication-authority evidence is required.");
  const brokerageId = evidenceBrokerageId(context) || "";
  const request = { propertyId, engagementId, destination, status, ...range, authorityBasis, localRuleReference, dataUseGrantReference, reason };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:listing-publication:${propertyId}:${destination}:${key}`,
    lockKey: `authority:listing:${propertyId}`,
    permission: "canManageListings",
    managerRequired: true,
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const [property, engagement, prior] = await Promise.all([
        sudo.query.Property.findOne({ where: { id: propertyId }, query: "id brokerage { id }" }),
        sudo.query.ListingEngagementAuthority.findOne({ where: { id: engagementId }, query: "id status effectiveFrom effectiveThrough marketingAuthorized brokerage { id } property { id }" }),
        sudo.query.ListingPublicationAuthority.findMany({ where: { brokerage: { id: { equals: brokerageId } }, property: { id: { equals: propertyId } }, destination: { equals: destination } }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }], take: 1, query: "id" })
      ]);
      if (!property || property.brokerage?.id !== brokerageId || !engagement || engagement.brokerage?.id !== brokerageId || engagement.property?.id !== propertyId || new Date(range.effectiveFrom) < new Date(engagement.effectiveFrom) || new Date(range.effectiveThrough) > new Date(engagement.effectiveThrough) || status === "authorized" && (engagement.status !== "executed" || !engagement.marketingAuthorized)) return { result: { ok: false, message: "An aligned executed listing engagement is required.", itemId: null }, event: null };
      const item = await sudo.query.ListingPublicationAuthority.createOne({ data: { brokerage: { connect: { id: brokerageId } }, authorityNumber: `PA-${suffix(key)}`, property: { connect: { id: propertyId } }, engagement: { connect: { id: engagementId } }, destination, status, ...range, authorityBasis, localRuleReference, dataUseGrantReference, ...prior[0]?.id ? { supersedes: { connect: { id: prior[0].id } } } : {}, reason, recordedBy: { connect: { id: evidenceActorId(scoped) } }, recordedAt: (/* @__PURE__ */ new Date()).toISOString() }, query: "id" });
      const result = { ok: true, message: "Listing publication authority evidence appended.", itemId: item.id };
      return { result, event: { eventType: "authority.listing_publication_recorded", brokerageId, aggregateType: "listingPublicationAuthority", aggregateId: item.id, actorId: evidenceActorId(scoped), action: "record", before: prior[0] || null, after: { ...result, propertyId, destination, status } } };
    }
  });
}
async function recordRepresentationAuthorityCommand(_root, { data }, context) {
  const leadId = clean6(data.leadId), propertyId = clean6(data.propertyId), dealId = clean6(data.dealId), practitionerId = clean6(data.practitionerId), side = clean6(data.side), relationshipType = clean6(data.relationshipType), jurisdictionCode = clean6(data.jurisdictionCode).toUpperCase(), status = clean6(data.status), scopeSummary = clean6(data.scopeSummary), documentSha256 = clean6(data.documentSha256).toLowerCase(), disclosureVersion = clean6(data.disclosureVersion), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  const range = effectiveRange(data.effectiveFrom, data.effectiveThrough);
  const consentRecordedAt = timestamp37(data.consentRecordedAt, "Consent recorded at");
  if (!leadId || !practitionerId || !["buyer", "seller"].includes(side) || !["exclusive_agency", "nonexclusive_agency", "transaction_brokerage", "customer_assistance"].includes(relationshipType) || !["executed", "terminated", "expired"].includes(status) || !jurisdictionCode || !scopeSummary || scopeSummary.length > 5e3 || !isSha256(documentSha256) || !disclosureVersion || disclosureVersion.length > 300) throw new Error("Valid representation-authority evidence is required.");
  const brokerageId = evidenceBrokerageId(context) || "";
  const request = { leadId, propertyId, dealId, practitionerId, side, relationshipType, jurisdictionCode, status, ...range, scopeSummary, documentSha256, disclosureVersion, consentRecordedAt, reason };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:representation:${leadId}:${key}`,
    lockKey: `authority:representation:${leadId}`,
    permission: "canManageDeals",
    managerRequired: true,
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const [lead, property, deal, prior] = await Promise.all([
        sudo.query.Lead.findOne({ where: { id: leadId }, query: "id brokerage { id }" }),
        propertyId ? sudo.query.Property.findOne({ where: { id: propertyId }, query: "id state brokerage { id }" }) : null,
        dealId ? sudo.query.Deal.findOne({ where: { id: dealId }, query: "id transactionType brokerage { id } lead { id } property { id }" }) : null,
        sudo.query.RepresentationAuthority.findMany({ where: { brokerage: { id: { equals: brokerageId } }, lead: { id: { equals: leadId } }, practitioner: { id: { equals: practitionerId } }, side: { equals: side } }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }], take: 1, query: "id" })
      ]);
      if (!lead || lead.brokerage?.id !== brokerageId || propertyId && (!property || property.brokerage?.id !== brokerageId || property.state.toUpperCase() !== jurisdictionCode) || dealId && (!deal || deal.brokerage?.id !== brokerageId || deal.lead?.id !== leadId || propertyId && deal.property?.id !== propertyId)) return { result: { ok: false, message: "Representation parties and scope do not align within the brokerage.", itemId: null }, event: null };
      if (status === "executed") await requirePractitionerLicense(scoped, { brokerageId, practitionerId, jurisdictionCode });
      const item = await sudo.query.RepresentationAuthority.createOne({ data: { brokerage: { connect: { id: brokerageId } }, authorityNumber: `RA-${suffix(key)}`, lead: { connect: { id: leadId } }, ...propertyId ? { property: { connect: { id: propertyId } } } : {}, ...dealId ? { deal: { connect: { id: dealId } } } : {}, practitioner: { connect: { id: practitionerId } }, side, relationshipType, jurisdictionCode, status, ...range, scopeSummary, documentSha256, disclosureVersion, consentRecordedAt, ...prior[0]?.id ? { supersedes: { connect: { id: prior[0].id } } } : {}, reason, recordedBy: { connect: { id: evidenceActorId(scoped) } }, recordedAt: (/* @__PURE__ */ new Date()).toISOString() }, query: "id" });
      const result = { ok: true, message: "Representation authority evidence appended.", itemId: item.id };
      return { result, event: { eventType: "authority.representation_recorded", brokerageId, aggregateType: "representationAuthority", aggregateId: item.id, actorId: evidenceActorId(scoped), action: "record", before: prior[0] || null, after: { ...result, leadId, side, status } } };
    }
  });
}

// features/keystone/mutations/documentEvidenceCommands.ts
var import_node_crypto9 = __toESM(require("node:crypto"));
function clean7(value) {
  return commandText(value);
}
function validTimestamp(value, required = true) {
  const raw = clean7(value);
  if (!raw && !required) return "";
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) throw new Error("A valid evidence timestamp is required.");
  return date.toISOString();
}
function validateRecipients(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 25) throw new Error("One to 25 bounded evidence recipients are required.");
  return value.map((recipient) => {
    const name = clean7(recipient?.name), address = clean7(recipient?.address), role5 = clean7(recipient?.role);
    if (!name || name.length > 160 || !address || address.length > 320 || !role5 || role5.length > 100) throw new Error("Each evidence recipient requires bounded name, address, and role values.");
    return { name, address, role: role5 };
  });
}
async function appendDocumentEvidenceEventCommand(_root, { data }, context) {
  const documentId = clean7(data.documentId), offerId = clean7(data.offerId), eventType = clean7(data.eventType), documentSha256 = clean7(data.documentSha256).toLowerCase(), templateSha256 = clean7(data.templateSha256).toLowerCase(), certificateSha256 = clean7(data.certificateSha256).toLowerCase(), channel = clean7(data.channel), provider = clean7(data.provider), providerReference = clean7(data.providerReference), acknowledgementReference = clean7(data.acknowledgementReference), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  const occurredAt = validTimestamp(data.occurredAt);
  const providerReportedAt = validTimestamp(data.providerReportedAt, false);
  const acknowledgedAt = validTimestamp(data.acknowledgedAt, false);
  const recipients = validateRecipients(data.recipients);
  const allowedEvents = ["generated", "signed", "delivered", "received", "presented", "acknowledged", "voided"];
  const allowedChannels = ["esign", "email", "portal", "in_person", "other"];
  if (!documentId || !allowedEvents.includes(eventType) || !isSha256(documentSha256) || !isSha256(templateSha256) || eventType === "signed" && !isSha256(certificateSha256) || !allowedChannels.includes(channel) || !provider || provider.length > 160 || !providerReference || providerReference.length > 500 || eventType === "acknowledged" && (!acknowledgedAt || !acknowledgementReference)) throw new Error("Complete immutable document evidence is required.");
  const brokerageId = evidenceBrokerageId(context) || "";
  const request = { documentId, offerId, eventType, documentSha256, templateSha256, certificateSha256, recipients, channel, provider, providerReference, occurredAt, providerReportedAt, acknowledgedAt, acknowledgementReference, reason };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:document-evidence:${documentId}:${key}`,
    lockKey: `evidence:document:${documentId}`,
    permission: "canManageDeals",
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const [document, offer, prior] = await Promise.all([
        sudo.query.DealDocument.findOne({ where: { id: documentId }, query: "id documentType brokerage { id } deal { id assignedAgent { id } }" }),
        offerId ? sudo.query.Offer.findOne({ where: { id: offerId }, query: "id deal { id } brokerage { id }" }) : null,
        decisionRows(sudo.query.DocumentEvidenceEvent, { where: { document: { id: { equals: documentId } } }, orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }, { id: "asc" }], query: "id eventType documentSha256 templateSha256 occurredAt" })
      ]);
      const actor = evidenceActorId(scoped);
      if (!document || document.brokerage?.id !== brokerageId || !evidenceRole(scoped).canManagePeople && document.deal?.assignedAgent?.id !== actor || offerId && (!offer || offer.brokerage?.id !== brokerageId || offer.deal?.id !== document.deal?.id)) return { result: { ok: false, message: "Document, offer, or assignment scope is invalid.", itemId: null }, event: null };
      if (prior.some((event) => event.eventType !== "voided" && (event.documentSha256 !== documentSha256 || event.templateSha256 !== templateSha256))) return { result: { ok: false, message: "Evidence hashes do not match the immutable document version.", itemId: null }, event: null };
      const eventTypes = new Set(prior.map((event) => event.eventType));
      const predecessor = { signed: "generated", delivered: "signed", received: "delivered", presented: "received", acknowledged: "presented" };
      if (predecessor[eventType] && !eventTypes.has(predecessor[eventType])) return { result: { ok: false, message: `${eventType} evidence requires prior ${predecessor[eventType]} evidence.`, itemId: null }, event: null };
      if (eventTypes.has("voided") && eventType !== "voided") return { result: { ok: false, message: "Voided document evidence cannot be extended.", itemId: null }, event: null };
      if (prior.length && new Date(occurredAt) < new Date(prior[prior.length - 1].occurredAt)) return { result: { ok: false, message: "Evidence chronology cannot move backward.", itemId: null }, event: null };
      const eventKey = `DE-${import_node_crypto9.default.createHash("sha256").update(`${documentId}:${key}`).digest("hex").slice(0, 24)}`;
      const item = await sudo.query.DocumentEvidenceEvent.createOne({ data: { brokerage: { connect: { id: brokerageId } }, eventKey, document: { connect: { id: documentId } }, deal: { connect: { id: document.deal.id } }, ...offerId ? { offer: { connect: { id: offerId } } } : {}, eventType, documentSha256, templateSha256, certificateSha256: certificateSha256 || null, recipients, channel, provider, providerReference, occurredAt, providerReportedAt: providerReportedAt || null, acknowledgedAt: acknowledgedAt || null, acknowledgementReference: acknowledgementReference || null, reason, actor: { connect: { id: actor } } }, query: "id" });
      if (eventType === "signed") await sudo.query.DealDocument.updateOne({ where: { id: documentId }, data: { status: "signed", signedAt: occurredAt }, query: "id" });
      if (eventType === "delivered") await sudo.query.DealDocument.updateOne({ where: { id: documentId }, data: { sentAt: occurredAt }, query: "id" });
      if (eventType === "voided") await sudo.query.DealDocument.updateOne({ where: { id: documentId }, data: { status: "archived" }, query: "id" });
      const result = { ok: true, message: "Immutable document evidence appended; provider and legal effect remain externally authoritative.", itemId: item.id };
      return { result, event: { eventType: `document_evidence.${eventType}`, brokerageId, aggregateType: "dealDocument", aggregateId: documentId, actorId: actor, action: eventType, before: prior[prior.length - 1] || null, after: { ...result, documentSha256, templateSha256, providerReference } } };
    }
  });
}

// features/keystone/mutations/commissionLedgerCommands.ts
var import_node_crypto10 = __toESM(require("node:crypto"));
function clean8(value) {
  return String(value || "").trim();
}
function cents(value, label, allowZero = false) {
  const raw = clean8(value);
  if (!/^-?\d{1,18}$/.test(raw)) throw new Error(`${label} must be an integer cent amount.`);
  const amount = BigInt(raw);
  if (!allowZero && amount <= BigInt(0) || allowZero && amount < BigInt(0)) throw new Error(`${label} must be ${allowZero ? "non-negative" : "positive"}.`);
  return amount;
}
function commissionDecimalToCents(value) {
  const raw = clean8(value);
  const match = raw.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error("Commission gross amount is invalid.");
  return BigInt(match[1]) * BigInt(100) + BigInt((match[2] || "").padEnd(2, "0"));
}
function commissionCentsConserve(expected, amounts) {
  return amounts.reduce((sum, amount) => sum + BigInt(amount), BigInt(0)) === expected;
}
function currency(value) {
  const code = clean8(value).toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new Error("A three-letter currency code is required.");
  return code;
}
function batchKey(commissionId, key) {
  return `CB-${import_node_crypto10.default.createHash("sha256").update(`${commissionId}:${key}`).digest("hex").slice(0, 20)}`;
}
async function loadCommission(scoped, commissionId) {
  return scoped.sudo().query.Commission.findOne({ where: { id: commissionId }, query: "id status grossCommission brokerage { id } deal { id stage } agent { id }" });
}
function commissionAuthorized(scoped, commission) {
  const actor = evidenceActorId(scoped);
  return commission?.brokerage?.id === evidenceBrokerageId(scoped) && (evidenceRole(scoped).canManagePeople || commission.agent?.id === actor);
}
async function proposeCommissionAllocationCommand(_root, { data }, context) {
  const commissionId = clean8(data.commissionId), code = currency(data.currencyCode), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  if (!commissionId || !Array.isArray(data.lines) || data.lines.length < 1 || data.lines.length > 50) throw new Error("One to 50 commission allocation lines are required.");
  const lines = data.lines.map((line) => {
    const allocationType = clean8(line.allocationType), amountCents = cents(line.amountCents, "Allocation amount"), payeeUserId = clean8(line.payeeUserId), payeeLabel = clean8(line.payeeLabel);
    if (!["brokerage", "agent", "team", "referral", "fee", "unallocated"].includes(allocationType) || !payeeUserId && !payeeLabel || payeeLabel.length > 300) throw new Error("Each allocation requires a type, positive cents, and payee.");
    return { allocationType, amountCents: amountCents.toString(), payeeUserId, payeeLabel };
  });
  const brokerageId = evidenceBrokerageId(context) || "", batch = batchKey(commissionId, key);
  const request = { commissionId, currencyCode: code, lines, reason, batch };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:commission:${commissionId}:allocation:${key}`,
    lockKey: `ledger:commission:${commissionId}`,
    permission: "canManageDeals",
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const commission = await loadCommission(scoped, commissionId);
      if (!commissionAuthorized(scoped, commission) || !["projected", "approved"].includes(commission.status)) return { result: { ok: false, message: "Commission is unavailable for allocation.", itemId: null }, event: null };
      if (activeAllocationBatches(await commissionDecisionEntries(scoped, commissionId)).size) return { result: { ok: false, message: "Reverse or review the existing allocation before proposing another batch.", itemId: null }, event: null };
      const grossCents = commissionDecimalToCents(commission.grossCommission);
      const allocationTotal = lines.reduce((sum, line) => sum + BigInt(line.amountCents), BigInt(0));
      if (!commissionCentsConserve(grossCents, lines.map((line) => line.amountCents))) return { result: { ok: false, message: `Allocation cents must conserve the gross commission (${grossCents}).`, itemId: null }, event: null };
      for (const line of lines) {
        if (line.payeeUserId) {
          const payee = await sudo.query.User.findOne({ where: { id: line.payeeUserId }, query: "id brokerageMemberships(where: { status: { equals: active } }) { brokerage { id status } }" });
          if (!(payee?.brokerageMemberships || []).some((membership) => membership.brokerage?.id === brokerageId && membership.brokerage?.status === "active")) return { result: { ok: false, message: "An allocation payee is outside the active brokerage.", itemId: null }, event: null };
        }
      }
      const created = [];
      for (const [index, line] of lines.entries()) {
        created.push(await sudo.query.CommissionLedgerEntry.createOne({ data: { brokerage: { connect: { id: brokerageId } }, entryKey: `${batch}:allocation:${index + 1}`, batchKey: batch, commission: { connect: { id: commission.id } }, deal: { connect: { id: commission.deal.id } }, entryType: "allocation", allocationType: line.allocationType, amountCents: line.amountCents, currencyCode: code, ...line.payeeUserId ? { payeeUser: { connect: { id: line.payeeUserId } } } : {}, payeeLabel: line.payeeLabel, reason, preparedBy: { connect: { id: evidenceActorId(scoped) } }, occurredAt: (/* @__PURE__ */ new Date()).toISOString() }, query: "id" }));
      }
      const result = { ok: true, message: "Cent-conserving commission allocation proposal appended.", itemId: created[0].id };
      return { result, event: { eventType: "commission.allocation_proposed", brokerageId, aggregateType: "commission", aggregateId: commission.id, actorId: evidenceActorId(scoped), action: "propose_allocation", before: null, after: { ...result, batchKey: batch, grossCents: grossCents.toString(), lineCount: created.length } } };
    }
  });
}
async function approveCommissionAllocationCommand(_root, { data }, context) {
  const commissionId = clean8(data.commissionId), batch = clean8(data.batchKey), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  if (!commissionId || !batch) throw new Error("Commission and allocation batch are required.");
  const brokerageId = evidenceBrokerageId(context) || "", request = { commissionId, batchKey: batch, reason };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:commission:${commissionId}:approve-allocation:${key}`,
    lockKey: `ledger:commission:${commissionId}`,
    permission: "canManageDeals",
    managerRequired: true,
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo(), commission = await loadCommission(scoped, commissionId), actor = evidenceActorId(scoped);
      if (!commissionAuthorized(scoped, commission)) return { result: { ok: false, message: "Commission is unavailable.", itemId: null }, event: null };
      const [allocations, approvals] = await Promise.all([
        sudo.query.CommissionLedgerEntry.findMany({ where: { commission: { id: { equals: commissionId } }, batchKey: { equals: batch }, entryType: { equals: "allocation" } }, take: 100, query: "id amountCents currencyCode preparedBy { id }" }),
        sudo.query.CommissionLedgerEntry.findMany({ where: { commission: { id: { equals: commissionId } }, batchKey: { equals: batch }, entryType: { equals: "allocation_approval" } }, take: 1, query: "id" })
      ]);
      if (!allocations.length || approvals.length) return { result: { ok: false, message: "Allocation batch is missing or already approved.", itemId: null }, event: null };
      if (allocations.some((entry) => entry.preparedBy?.id === actor)) return { result: { ok: false, message: "Allocation approver must differ from its preparer.", itemId: null }, event: null };
      const total = allocations.reduce((sum, entry) => sum + BigInt(entry.amountCents), BigInt(0));
      if (!commissionCentsConserve(commissionDecimalToCents(commission.grossCommission), allocations.map((entry) => entry.amountCents)) || new Set(allocations.map((entry) => entry.currencyCode)).size !== 1) return { result: { ok: false, message: "Allocation batch does not conserve commission cents or currency.", itemId: null }, event: null };
      const item = await sudo.query.CommissionLedgerEntry.createOne({ data: { brokerage: { connect: { id: brokerageId } }, entryKey: `${batch}:approval:${key}`, batchKey: batch, commission: { connect: { id: commission.id } }, deal: { connect: { id: commission.deal.id } }, entryType: "allocation_approval", amountCents: "0", currencyCode: allocations[0].currencyCode, reason, preparedBy: { connect: { id: allocations[0].preparedBy.id } }, approvedBy: { connect: { id: actor } }, occurredAt: (/* @__PURE__ */ new Date()).toISOString() }, query: "id" });
      const result = { ok: true, message: "Commission allocation batch approved by a separate authority.", itemId: item.id };
      return { result, event: { eventType: "commission.allocation_approved", brokerageId, aggregateType: "commission", aggregateId: commission.id, actorId: actor, action: "approve_allocation", before: null, after: { ...result, batchKey: batch, totalCents: total.toString() } } };
    }
  });
}
async function recordCommissionReceiptCommand(_root, { data }, context) {
  const commissionId = clean8(data.commissionId), batch = clean8(data.batchKey), amount = cents(data.amountCents, "Receipt amount"), code = currency(data.currencyCode), externalReference = clean8(data.externalReference), sourceDocumentSha256 = clean8(data.sourceDocumentSha256).toLowerCase(), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  if (!commissionId || !batch || !externalReference || externalReference.length > 500 || !isSha256(sourceDocumentSha256)) throw new Error("Receipt requires an approved batch, external reference, and source-document hash.");
  const brokerageId = evidenceBrokerageId(context) || "", request = { commissionId, batchKey: batch, amountCents: amount.toString(), currencyCode: code, externalReference, sourceDocumentSha256, reason };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:commission:${commissionId}:receipt:${key}`,
    lockKey: `ledger:commission:${commissionId}`,
    permission: "canManageDeals",
    managerRequired: true,
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo(), commission = await loadCommission(scoped, commissionId);
      if (!commissionAuthorized(scoped, commission) || commission.deal?.stage !== "closed_won") return { result: { ok: false, message: "A closed-won commission is required.", itemId: null }, event: null };
      if (["paid", "clawed_back"].includes(commission.status)) return { result: { ok: false, message: "Terminal commission receipt changes require a reviewed correction; no receipt was appended.", itemId: null }, event: null };
      const approvals = await sudo.query.CommissionLedgerEntry.findMany({ where: { commission: { id: { equals: commissionId } }, batchKey: { equals: batch }, entryType: { equals: "allocation_approval" } }, take: 1, query: "id currencyCode" });
      if (!approvals.length || approvals[0].currencyCode !== code) return { result: { ok: false, message: "A matching approved allocation batch is required.", itemId: null }, event: null };
      const duplicates = await sudo.query.CommissionLedgerEntry.findMany({ where: { commission: { id: { equals: commissionId } }, entryType: { equals: "receipt" }, externalReference: { equals: externalReference } }, take: 1, query: "id" });
      if (duplicates.length) return { result: { ok: false, message: "This external receipt reference is already recorded.", itemId: null }, event: null };
      const item = await sudo.query.CommissionLedgerEntry.createOne({ data: { brokerage: { connect: { id: brokerageId } }, entryKey: `${batch}:receipt:${key}`, batchKey: batch, commission: { connect: { id: commission.id } }, deal: { connect: { id: commission.deal.id } }, entryType: "receipt", amountCents: amount.toString(), currencyCode: code, externalReference, sourceDocumentSha256, reason, preparedBy: { connect: { id: evidenceActorId(scoped) } }, approvedBy: { connect: { id: evidenceActorId(scoped) } }, occurredAt: (/* @__PURE__ */ new Date()).toISOString() }, query: "id" });
      const result = { ok: true, message: "External commission receipt evidence appended; no funds were moved.", itemId: item.id };
      return { result, event: { eventType: "commission.receipt_recorded", brokerageId, aggregateType: "commission", aggregateId: commission.id, actorId: evidenceActorId(scoped), action: "record_receipt", before: null, after: { ...result, amountCents: amount.toString(), externalReference } } };
    }
  });
}
async function reverseCommissionLedgerEntryCommand(_root, { data }, context) {
  const entryId = clean8(data.entryId), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  if (!entryId) throw new Error("Ledger entry is required.");
  const brokerageId = evidenceBrokerageId(context) || "", request = { entryId, reason };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:commission-ledger:${entryId}:reverse:${key}`,
    lockKey: `ledger-entry:${entryId}`,
    permission: "canManageDeals",
    managerRequired: true,
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const entry = await sudo.query.CommissionLedgerEntry.findOne({ where: { id: entryId }, query: "id entryKey batchKey entryType amountCents currencyCode brokerage { id } commission { id } deal { id } preparedBy { id }" });
      if (!entry || entry.brokerage?.id !== brokerageId || !["allocation", "receipt"].includes(entry.entryType)) return { result: { ok: false, message: "Reversible ledger entry not found.", itemId: null }, event: null };
      const existing = await sudo.query.CommissionLedgerEntry.findMany({ where: { reverses: { id: { equals: entry.id } }, entryType: { equals: "reversal" } }, take: 1, query: "id" });
      if (existing.length) return { result: { ok: false, message: "Ledger entry already has a reversal.", itemId: null }, event: null };
      const item = await sudo.query.CommissionLedgerEntry.createOne({ data: { brokerage: { connect: { id: brokerageId } }, entryKey: `${entry.entryKey}:reversal:${key}`, batchKey: entry.batchKey, commission: { connect: { id: entry.commission.id } }, deal: { connect: { id: entry.deal.id } }, entryType: "reversal", amountCents: (-BigInt(entry.amountCents)).toString(), currencyCode: entry.currencyCode, reverses: { connect: { id: entry.id } }, reason, preparedBy: { connect: { id: evidenceActorId(scoped) } }, approvedBy: { connect: { id: evidenceActorId(scoped) } }, occurredAt: (/* @__PURE__ */ new Date()).toISOString() }, query: "id" });
      const commission = await loadCommission(scoped, entry.commission.id);
      if (commission?.status === "paid") await sudo.query.Commission.updateOne({ where: { id: commission.id }, data: { status: "clawed_back" }, query: "id" });
      const result = { ok: true, message: "Append-only commission reversal recorded; previous reconciliation is no longer current.", itemId: item.id };
      return { result, event: { eventType: "commission.entry_reversed", brokerageId, aggregateType: "commission", aggregateId: entry.commission.id, actorId: evidenceActorId(scoped), action: "reverse_entry", before: entry, after: result } };
    }
  });
}
async function reconcileCommissionLedgerCommand(_root, { data }, context) {
  const commissionId = clean8(data.commissionId), batch = clean8(data.batchKey), externalReference = clean8(data.externalReference), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  if (!commissionId || !batch || !externalReference || externalReference.length > 500) throw new Error("Commission, batch, and accounting reconciliation reference are required.");
  const brokerageId = evidenceBrokerageId(context) || "", request = { commissionId, batchKey: batch, externalReference, reason };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:commission:${commissionId}:reconcile:${key}`,
    lockKey: `ledger:commission:${commissionId}`,
    permission: "canManageDeals",
    managerRequired: true,
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo(), commission = await loadCommission(scoped, commissionId);
      if (!commissionAuthorized(scoped, commission)) return { result: { ok: false, message: "Commission is unavailable.", itemId: null }, event: null };
      const entries = await commissionDecisionEntries(scoped, commissionId);
      const gross = commissionDecimalToCents(commission.grossCommission);
      const state = commissionBatchState(entries, batch, gross);
      if (!state.validReceipts) return { result: { ok: false, message: `Reconciliation requires separately approved allocations and conserved allocation/receipt cents (${gross}).`, itemId: null }, event: null };
      const code = state.currencyCode;
      const item = await sudo.query.CommissionLedgerEntry.createOne({ data: { brokerage: { connect: { id: brokerageId } }, entryKey: `${batch}:reconciliation:${key}`, batchKey: batch, commission: { connect: { id: commission.id } }, deal: { connect: { id: commission.deal.id } }, entryType: "reconciliation", amountCents: "0", currencyCode: code, ledgerStateHash: state.ledgerStateHash, externalReference, reason, preparedBy: { connect: { id: evidenceActorId(scoped) } }, approvedBy: { connect: { id: evidenceActorId(scoped) } }, occurredAt: (/* @__PURE__ */ new Date()).toISOString() }, query: "id" });
      const result = { ok: true, message: "Commission ledger reconciled with cent conservation; accounting remains authoritative.", itemId: item.id };
      return { result, event: { eventType: "commission.reconciled", brokerageId, aggregateType: "commission", aggregateId: commission.id, actorId: evidenceActorId(scoped), action: "reconcile", before: null, after: { ...result, grossCents: gross.toString(), externalReference } } };
    }
  });
}

// features/keystone/lib/paymentState.ts
var import_node_crypto11 = require("node:crypto");
var REQUESTABLE_PURPOSES = ["holding_deposit", "rent"];
var MAX_REQUEST_MINOR = 5e6;
var PaymentMismatchError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "PaymentMismatchError";
  }
};
function applicationFeeFor(property) {
  if (!property || property.listingType !== "rent") return null;
  const fee = property.applicationFeeMinor;
  return typeof fee === "number" && Number.isSafeInteger(fee) && fee > 0 ? fee : null;
}
function newAccessToken() {
  return (0, import_node_crypto11.randomBytes)(24).toString("base64url");
}
function mapProviderStatus(status) {
  switch (String(status || "").toLowerCase()) {
    case "succeeded":
    case "paid":
    case "captured":
      return "captured";
    case "requires_capture":
    case "processing":
    case "authorized":
      return "authorized";
    case "canceled":
    case "cancelled":
    case "failed":
    case "expired":
      return "failed";
    case "requires_payment_method":
    case "requires_action":
    case "requires_confirmation":
    case "pending":
    case "open":
    case "unpaid":
      return "pending";
    default:
      return "unknown";
  }
}
function assertAmountAndCurrency(payment, amount, currency2) {
  if (!Number.isSafeInteger(amount)) throw new PaymentMismatchError("Provider amount is not an integer in minor units.");
  if (amount !== payment.amountMinor) throw new PaymentMismatchError("Provider amount does not match the local payment.");
  if (String(currency2 || "").toUpperCase() !== String(payment.currency).toUpperCase()) throw new PaymentMismatchError("Provider currency does not match the local payment.");
}
function nextPaymentState(payment, result) {
  const mapped = mapProviderStatus(result.status);
  if (mapped === "captured" || mapped === "authorized" || (result.refundedAmount ?? 0) > 0) {
    try {
      assertAmountAndCurrency(payment, result.amount, result.currency);
    } catch (error) {
      if (!(error instanceof PaymentMismatchError)) throw error;
      return payment.status === "unknown" ? null : { status: "unknown", mismatch: true };
    }
  }
  const refunded = result.refundedAmount ?? 0;
  let status = mapped;
  if (refunded > 0 && refunded >= payment.amountMinor) status = "refunded";
  else if (refunded > 0 && mapped === "captured") status = "captured";
  if (payment.status === "refunded" && status !== "refunded") return null;
  if (payment.status === "captured" && (status === "pending" || status === "authorized" || status === "unknown")) return null;
  if (payment.status === "failed" && status === "pending") return null;
  if (payment.status === status && refunded === (payment.refundedMinor ?? 0)) return null;
  return { status, refundedMinor: refunded, ...result.paymentIntentId ? { paymentIntentId: result.paymentIntentId } : {} };
}
function publicStatusMessage(status) {
  switch (status) {
    case "captured":
      return "Payment received. Thank you.";
    case "authorized":
      return "Your payment is processing. This page updates when it clears.";
    case "refunded":
      return "This payment was refunded.";
    case "failed":
      return "This payment did not go through. You have not been charged.";
    case "unknown":
      return "We could not confirm this payment yet. If you were charged, contact the brokerage with your receipt.";
    default:
      return "Waiting for payment.";
  }
}

// features/integrations/payment/index.ts
var paymentProviderAdapters = {
  stripe: () => Promise.resolve().then(() => (init_stripe(), stripe_exports)),
  paypal: () => Promise.resolve().then(() => (init_paypal(), paypal_exports)),
  manual: () => Promise.resolve().then(() => (init_manual(), manual_exports))
};

// features/keystone/utils/paymentProviderAdapter.ts
var ADAPTERS = new Set(Object.keys(paymentProviderAdapters));
var ADAPTER_OPERATIONS = /* @__PURE__ */ new Set(["createPaymentFunction", "capturePaymentFunction", "refundPaymentFunction", "getPaymentStatusFunction", "generatePaymentLinkFunction", "handleWebhookFunction", "cancelPaymentFunction"]);
function paymentAdapterPayload(provider, args) {
  const projectedProvider = { id: provider.id, code: provider.code, credentials: provider.credentials || {} };
  const input = {};
  for (const key of ["payment", "amount", "currency", "idempotencyKey", "paymentId", "refundId", "event", "headers", "rawBody"]) {
    if (args?.[key] !== void 0) input[key] = args[key];
  }
  const record4 = input.payment;
  if (record4 && typeof record4 === "object") {
    input.payment = Object.fromEntries(["id", "purpose", "description", "customerEmail", "successUrl", "cancelUrl"].filter((field) => record4[field] !== void 0).map((field) => [field, record4[field]]));
  }
  if (input.headers && typeof input.headers === "object") {
    input.headers = Object.fromEntries(Object.entries(input.headers).filter(([key]) => key.toLowerCase() === "stripe-signature" || key.toLowerCase().startsWith("paypal-")));
  }
  return { ...input, provider: projectedProvider };
}
async function executeAdapterFunction({ provider, functionName, args }) {
  if (!ADAPTER_OPERATIONS.has(functionName)) throw new Error("Unknown payment adapter operation");
  const functionPath = provider?.[functionName];
  if (typeof functionPath !== "string") throw new Error("Payment adapter is not configured");
  const payload = paymentAdapterPayload(provider, args);
  if (/^https?:/i.test(functionPath)) {
    const endpoint2 = functionPath;
    try {
      const response = await fetch(endpoint2, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(3e4),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error("Payment adapter rejected request");
      return await response.json();
    } catch {
      throw new Error("External payment adapter request failed; reconcile the original attempt before retrying");
    }
  }
  if (!ADAPTERS.has(functionPath)) throw new Error("Unknown registered payment adapter");
  const adapter = await paymentProviderAdapters[functionPath]();
  const fn = adapter[functionName];
  if (typeof fn !== "function") throw new Error("Payment adapter operation is unavailable");
  try {
    return await fn(payload);
  } catch {
    throw new Error(`Payment adapter ${functionName} failed; reconcile the original attempt before retrying`);
  }
}
async function createPayment({ provider, payment, amount, currency: currency2, idempotencyKey }) {
  return executeAdapterFunction({
    provider,
    functionName: "createPaymentFunction",
    args: { payment, amount, currency: currency2, idempotencyKey }
  });
}
async function refundPayment({ provider, paymentId, amount, currency: currency2, idempotencyKey, refundId }) {
  return executeAdapterFunction({
    provider,
    functionName: "refundPaymentFunction",
    args: { paymentId, amount, currency: currency2, idempotencyKey, refundId }
  });
}
async function getPaymentStatus({ provider, paymentId }) {
  return executeAdapterFunction({
    provider,
    functionName: "getPaymentStatusFunction",
    args: { paymentId }
  });
}

// features/keystone/utils/paymentProviderConfig.ts
function isPaymentProviderConfigured(provider) {
  const code = typeof provider === "string" ? provider : provider.code;
  const credentials = typeof provider === "string" ? {} : provider.credentials || {};
  if (code.startsWith("pp_stripe")) {
    return Boolean(credentials.secretKey || process.env.STRIPE_SECRET_KEY);
  }
  if (code.startsWith("pp_paypal")) {
    return Boolean(
      (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID) && process.env.PAYPAL_CLIENT_SECRET
    );
  }
  return code === "pp_system_default" || code.startsWith("pp_manual");
}

// features/keystone/mutations/payments.ts
var PROVIDER_QUERY = "id code name isInstalled credentials createPaymentFunction capturePaymentFunction refundPaymentFunction getPaymentStatusFunction generatePaymentLinkFunction handleWebhookFunction brokerage { id status }";
var PAYMENT_QUERY = `id purpose status amountMinor currency providerPaymentId providerPaymentIntentId idempotencyKey accessToken payerName payerEmail checkoutUrl paidAt refundedMinor
  brokerage { id name slug status } paymentProvider { id } property { id title } lead { id name email } deal { id }`;
var asPayment = (value) => value;
function validToken(token) {
  return typeof token === "string" && /^[A-Za-z0-9_-]{20,80}$/.test(token);
}
function publicBaseUrl(context) {
  const configured = process.env.PUBLIC_APP_URL || process.env.SMTP_STORE_LINK;
  if (configured) return configured.replace(/\/+$/, "");
  const headers = context.req?.headers || {};
  const first = (value) => String(Array.isArray(value) ? value[0] : value || "").split(",")[0].trim();
  const host = first(headers["x-forwarded-host"]) || first(headers.host);
  const proto = first(headers["x-forwarded-proto"]) || (/^(localhost|127\.)/.test(host) ? "http" : "https");
  if (!host || !/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) throw new Error("Public URL is not configured");
  return `${proto}://${host}`;
}
async function onlineProvider(context, brokerageId) {
  const providers = await context.sudo().query.PaymentProvider.findMany({
    where: { brokerage: { id: { equals: brokerageId } }, isInstalled: { equals: true } },
    orderBy: [{ createdAt: "asc" }],
    take: 20,
    query: PROVIDER_QUERY
  });
  const usable = [...providers].filter((provider) => provider.createPaymentFunction !== "manual" && isPaymentProviderConfigured(provider));
  return usable.find((provider) => String(provider.code).startsWith("pp_stripe")) || usable[0] || null;
}
async function loadByToken(context, token) {
  if (!validToken(token)) return null;
  const rows = await context.sudo().query.Payment.findMany({ where: { accessToken: { equals: token } }, take: 1, query: PAYMENT_QUERY });
  const payment = rows[0] ? asPayment(rows[0]) : null;
  return payment && payment.brokerage?.status === "active" ? payment : null;
}
function describe(payment) {
  const label = { application_fee: "Rental application fee", holding_deposit: "Holding deposit", rent: "Rent", agent_fee: "Agent fee" }[payment.purpose];
  return payment.property ? `${label} \xB7 ${payment.property.title}` : label;
}
function publicView(payment) {
  return {
    token: payment.accessToken,
    purpose: payment.purpose,
    status: payment.status,
    statusMessage: publicStatusMessage(payment.status),
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    description: describe(payment),
    brokerageName: payment.brokerage.name,
    propertyTitle: payment.property?.title || "",
    payerName: payment.payerName || payment.lead?.name || "",
    paidAt: payment.paidAt || null,
    canPay: ["pending", "failed"].includes(payment.status)
  };
}
async function paymentByToken(_root, { token }, context) {
  const payment = await loadByToken(context, token);
  return payment ? publicView(payment) : null;
}
async function providerFor(context, payment) {
  if (!payment.paymentProvider?.id) return null;
  const provider = await context.sudo().query.PaymentProvider.findOne({ where: { id: payment.paymentProvider.id }, query: PROVIDER_QUERY });
  return provider && provider.brokerage?.id === payment.brokerage.id && provider.isInstalled ? provider : null;
}
async function applyProviderResult(context, paymentId, result, actor) {
  return context.transaction(async (tx) => {
    await applyInTransaction(tx, paymentId, result, actor.eventKey, actor.actorId);
    const current = await tx.sudo().query.Payment.findOne({ where: { id: paymentId }, query: PAYMENT_QUERY });
    return current ? asPayment(current) : null;
  }, { timeout: 3e4 });
}
async function reconcile(context, payment, source, actorId4) {
  if (!payment.providerPaymentId) return payment;
  const provider = await providerFor(context, payment);
  if (!provider) return payment;
  let result;
  try {
    result = await getPaymentStatus({ provider, paymentId: payment.providerPaymentId });
  } catch {
    return payment;
  }
  return await applyProviderResult(context, payment.id, result, { eventKey: source, actorId: actorId4 }) || payment;
}
async function reconcilePaymentByToken(_root, { token }, context) {
  const payment = await loadByToken(context, token);
  if (!payment) return null;
  return publicView(await reconcile(context, payment, `return:${Date.now()}`));
}
async function beginPaymentCheckout(_root, { token }, context) {
  const payment = await loadByToken(context, token);
  if (!payment) return { ok: false, message: "This payment link is not valid.", url: null, token: null };
  const settled = await reconcile(context, payment, `begin:${Date.now()}`);
  if (settled.status === "captured") return { ok: true, message: publicStatusMessage("captured"), url: null, token: settled.accessToken };
  if (!["pending", "failed"].includes(settled.status)) return { ok: false, message: publicStatusMessage(settled.status), url: null, token: settled.accessToken };
  const provider = await providerFor(context, settled);
  if (!provider || provider.createPaymentFunction === "manual" || !isPaymentProviderConfigured(provider)) return { ok: false, message: "Online payment is not available right now. Please contact the brokerage.", url: null, token: settled.accessToken };
  if (settled.status === "pending" && settled.providerPaymentId) {
    try {
      const status = await getPaymentStatus({ provider, paymentId: settled.providerPaymentId });
      if (status.url) return { ok: true, message: "Continue to secure checkout.", url: status.url, token: settled.accessToken };
    } catch {
    }
  }
  const attempt = settled.providerPaymentId ? `:retry-${Date.now()}` : "";
  const base = publicBaseUrl(context);
  const page = `${base}/pay/${settled.accessToken}`;
  try {
    const created = await createPayment({
      provider,
      payment: { id: settled.id, purpose: settled.purpose, description: describe(settled), customerEmail: settled.payerEmail || settled.lead?.email || void 0, successUrl: `${page}?checkout=return`, cancelUrl: `${page}?checkout=cancelled` },
      amount: settled.amountMinor,
      currency: settled.currency,
      idempotencyKey: `${settled.idempotencyKey}${attempt}`
    });
    assertAmountAndCurrency(settled, created.amount, created.currency);
    if (!created.id || !created.url) throw new Error("Provider did not return a checkout");
    await context.sudo().query.Payment.updateOne({ where: { id: settled.id }, data: { providerPaymentId: String(created.id), checkoutUrl: String(created.url), status: "pending" }, query: "id" });
    return { ok: true, message: "Continue to secure checkout.", url: String(created.url), token: settled.accessToken };
  } catch (error) {
    const mismatch = error instanceof PaymentMismatchError;
    await context.sudo().query.Payment.updateOne({ where: { id: settled.id }, data: { status: "unknown" }, query: "id" });
    return { ok: false, message: mismatch ? "This payment could not be started. Please contact the brokerage." : "We could not start checkout. Please try again in a moment.", url: null, token: settled.accessToken };
  }
}
async function startApplicationFeeCheckout(root, { data }, context) {
  const fail = (message) => ({ ok: false, message, url: null, token: null });
  const brokerageSlug = commandText(data.brokerageSlug).toLowerCase(), propertyId = commandText(data.propertyId);
  const name = commandText(data.name), email = commandText(data.email).toLowerCase(), phone = commandText(data.phone);
  if (!propertyId || propertyId.length > 200 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(brokerageSlug) || brokerageSlug.length > 80) return fail("Choose a listing before applying.");
  if (!name || name.length > 120 || !email && !phone) return fail("Add your name and an email or phone number.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email address.");
  const sudo = context.sudo();
  const property = (await sudo.query.Property.findMany({
    where: { id: { equals: propertyId }, brokerage: { slug: { equals: brokerageSlug }, status: { equals: "active" } }, status: { in: ["active", "coming_soon"] } },
    take: 1,
    query: "id title listingType applicationFeeMinor brokerage { id }"
  }))[0];
  const fee = applicationFeeFor(property);
  if (!property || !fee) return fail("This listing is not taking applications online.");
  const provider = await onlineProvider(context, property.brokerage.id);
  if (!provider) return fail("Online payment is not available for this listing yet. Please contact the agent.");
  const inquiry = await submitListingInquiry(root, { data: { brokerageSlug, propertyId, name, email, phone, intent: "rent", message: commandText(data.message) || "Rental application", preferredTime: "" } }, context);
  if (!inquiry.ok) return fail(inquiry.message);
  const identityKey = leadIdentityKey(email, phone);
  const lead = identityKey ? (await sudo.query.Lead.findMany({ where: { identityKey: { equals: identityKey }, property: { id: { equals: propertyId } }, status: { notIn: ["closed", "lost"] } }, orderBy: [{ createdAt: "asc" }], take: 1, query: "id" }))[0] : null;
  if (!lead) return fail("We could not record your application. Please try again.");
  const payment = await context.transaction(async (tx) => {
    const scoped = tx.sudo();
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `application-fee:${propertyId}:${lead.id}`);
    const existing = await scoped.query.Payment.findMany({ where: { lead: { id: { equals: lead.id } }, property: { id: { equals: propertyId } }, purpose: { equals: "application_fee" }, status: { in: ["pending", "authorized", "captured", "unknown"] } }, orderBy: [{ createdAt: "desc" }], take: 10, query: "id status accessToken amountMinor" });
    const settled = existing.find((item) => ["captured", "authorized"].includes(item.status));
    if (settled) return { token: settled.accessToken, already: true };
    const reusable = existing.find((item) => item.status === "pending" && item.amountMinor === fee);
    if (reusable) return { token: reusable.accessToken, already: false };
    const token = newAccessToken();
    await scoped.query.Payment.createOne({
      data: {
        brokerage: { connect: { id: property.brokerage.id } },
        paymentProvider: { connect: { id: provider.id } },
        property: { connect: { id: propertyId } },
        lead: { connect: { id: lead.id } },
        purpose: "application_fee",
        status: "pending",
        amountMinor: fee,
        currency: "USD",
        idempotencyKey: `application_fee:${lead.id}:${propertyId}:${token.slice(0, 12)}`,
        accessToken: token,
        payerName: name,
        payerEmail: email
      },
      query: "id"
    });
    return { token, already: false };
  }, { timeout: 3e4 });
  if (payment.already) return { ok: true, message: "Your application fee is already paid.", url: null, token: payment.token };
  return beginPaymentCheckout(root, { token: payment.token }, context);
}
function staffCan(context, brokerageId, permission, ownerId) {
  const session = context.session;
  const role5 = session?.data?.role || {};
  if (!session?.itemId || !role5[permission] || !activeBrokerageIds(session).includes(brokerageId)) return false;
  return Boolean(role5.canManagePeople || !ownerId || ownerId === session.itemId);
}
async function requestPaymentCommand(_root, { data }, context) {
  const leadId = commandText(data.leadId), dealId = commandText(data.dealId), purpose = commandText(data.purpose), key = commandText(data.idempotencyKey);
  const amountMinor = data.amountMinor;
  if (!leadId || !key || key.length > 120 || !REQUESTABLE_PURPOSES.includes(purpose) || !Number.isSafeInteger(amountMinor) || amountMinor < 1 || amountMinor > MAX_REQUEST_MINOR) {
    return { ok: false, message: "Choose a lead, a purpose, and an amount between $0.01 and $50,000.", itemId: null, url: null, replayed: false };
  }
  const result = await runControlledEvidenceCommand(context, {
    eventKey: `command:lead:${leadId}:request-payment:${key}`,
    lockKey: `aggregate:lead:${leadId}`,
    permission: "canManageLeads",
    request: { leadId, dealId, purpose, amountMinor },
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const lead = await sudo.query.Lead.findOne({ where: { id: leadId }, query: "id name email brokerage { id name } assignedAgent { id } property { id title }" });
      if (!lead || !staffCan(scoped, lead.brokerage?.id, "canManageLeads", lead.assignedAgent?.id)) return { result: { ok: false, message: "Lead not found or access denied.", itemId: null, url: null }, event: null };
      let propertyId = lead.property?.id || null;
      if (dealId) {
        const deal = await sudo.query.Deal.findOne({ where: { id: dealId }, query: "id lead { id } property { id } brokerage { id }" });
        if (!deal || deal.brokerage?.id !== lead.brokerage.id || deal.lead?.id !== leadId) return { result: { ok: false, message: "That deal does not belong to this lead.", itemId: null, url: null }, event: null };
        propertyId = deal.property?.id || propertyId;
      }
      const provider = await onlineProvider(scoped, lead.brokerage.id);
      if (!provider) return { result: { ok: false, message: "Add and configure a payment provider before requesting payments.", itemId: null, url: null }, event: null };
      const token = newAccessToken();
      const payment = await sudo.query.Payment.createOne({
        data: {
          brokerage: { connect: { id: lead.brokerage.id } },
          paymentProvider: { connect: { id: provider.id } },
          lead: { connect: { id: leadId } },
          ...propertyId ? { property: { connect: { id: propertyId } } } : {},
          ...dealId ? { deal: { connect: { id: dealId } } } : {},
          purpose,
          status: "pending",
          amountMinor,
          currency: "USD",
          idempotencyKey: `${purpose}:${leadId}:${key}`,
          accessToken: token,
          payerName: lead.name,
          payerEmail: lead.email || ""
        },
        query: "id"
      });
      const url = `${publicBaseUrl(scoped)}/pay/${token}`;
      const outcome = { ok: true, message: "Payment requested. Share the link with the payer.", itemId: payment.id, url };
      return { result: outcome, event: { eventType: "payment.requested", brokerageId: lead.brokerage.id, aggregateType: "payment", aggregateId: payment.id, actorId: scoped.session.itemId, action: "request_payment", before: null, after: { ...outcome, paymentId: payment.id, purpose, amountMinor, currency: "USD", leadId, dealId: dealId || null } } };
    }
  });
  return result;
}
async function reconcilePaymentCommand(_root, { paymentId }, context) {
  const session = context.session;
  if (!session?.itemId || !paymentId || paymentId.length > 200) return { ok: false, message: "Access denied.", itemId: null, url: null, replayed: false };
  const row = await context.sudo().query.Payment.findOne({ where: { id: paymentId }, query: PAYMENT_QUERY });
  const payment = row ? asPayment(row) : null;
  if (!payment || !staffCan(context, payment.brokerage.id, "canManageLeads", null) && !staffCan(context, payment.brokerage.id, "canManageDeals", null)) return { ok: false, message: "Payment not found or access denied.", itemId: null, url: null, replayed: false };
  if (!payment.providerPaymentId) return { ok: true, message: "No checkout has been started for this payment yet.", itemId: payment.id, url: null, replayed: false };
  const provider = await providerFor(context, payment);
  if (!provider) return { ok: false, message: "The payment provider for this payment is not available.", itemId: payment.id, url: null, replayed: false };
  try {
    const result = await getPaymentStatus({ provider, paymentId: payment.providerPaymentId });
    const updated = await applyProviderResult(context, payment.id, result, { eventKey: `check:${Date.now()}`, actorId: session.itemId });
    return { ok: true, message: `Status: ${updated?.status || payment.status}.`, itemId: payment.id, url: null, replayed: false };
  } catch {
    return { ok: false, message: "The provider could not be reached. Try again shortly.", itemId: payment.id, url: null, replayed: false };
  }
}
async function refundPaymentCommand(_root, { paymentId }, context) {
  const session = context.session;
  if (!session?.itemId || !paymentId || paymentId.length > 200) return { ok: false, message: "Access denied.", itemId: null, url: null, replayed: false };
  const row = await context.sudo().query.Payment.findOne({ where: { id: paymentId }, query: PAYMENT_QUERY });
  const payment = row ? asPayment(row) : null;
  if (!payment || !staffCan(context, payment.brokerage.id, "canManageDeals", null) && !staffCan(context, payment.brokerage.id, "canManageLeads", null)) return { ok: false, message: "Payment not found or access denied.", itemId: null, url: null, replayed: false };
  if (payment.status === "refunded") return { ok: true, message: "This payment is already refunded.", itemId: payment.id, url: null, replayed: true };
  if (payment.status !== "captured") return { ok: false, message: "Only paid payments can be refunded.", itemId: payment.id, url: null, replayed: false };
  const provider = await providerFor(context, payment);
  if (!provider) return { ok: false, message: "The payment provider for this payment is not available.", itemId: payment.id, url: null, replayed: false };
  let intentId = payment.providerPaymentIntentId;
  if (!intentId && payment.providerPaymentId) {
    try {
      const status = await getPaymentStatus({ provider, paymentId: payment.providerPaymentId });
      intentId = status?.paymentIntentId || null;
    } catch {
    }
  }
  const amount = payment.amountMinor - (payment.refundedMinor || 0);
  if (!intentId || amount < 1) return { ok: false, message: "The provider payment could not be found. Use Check status, then try again.", itemId: payment.id, url: null, replayed: false };
  try {
    await refundPayment({ provider, paymentId: intentId, amount, currency: payment.currency, idempotencyKey: `refund:${payment.id}:${amount}` });
  } catch {
    return { ok: false, message: "The provider did not accept the refund. Nothing was changed.", itemId: payment.id, url: null, replayed: false };
  }
  const updated = await reconcile(context, payment, `refund:${Date.now()}`, session.itemId);
  return { ok: true, message: updated.status === "refunded" ? "Refunded in full." : "Refund sent. The status updates when the provider confirms it.", itemId: payment.id, url: null, replayed: false };
}
async function applyInTransaction(tx, paymentId, result, eventKey, actorId4) {
  await tx.prisma.$executeRawUnsafe('SELECT "id" FROM "Payment" WHERE "id" = $1 FOR NO KEY UPDATE', paymentId);
  const sudo = tx.sudo();
  const payment = asPayment(await sudo.query.Payment.findOne({ where: { id: paymentId }, query: PAYMENT_QUERY }));
  const next = nextPaymentState({ status: payment.status, amountMinor: payment.amountMinor, currency: payment.currency, refundedMinor: payment.refundedMinor }, result);
  if (!next) return;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await sudo.query.Payment.updateOne({
    where: { id: paymentId },
    data: {
      status: next.status,
      ...next.refundedMinor !== void 0 ? { refundedMinor: next.refundedMinor } : {},
      ...next.paymentIntentId && !payment.providerPaymentIntentId ? { providerPaymentIntentId: next.paymentIntentId } : {},
      ...next.status === "captured" && !payment.paidAt ? { paidAt: now } : {},
      lastCheckedAt: now
    },
    query: "id"
  });
  if (next.status === payment.status) return;
  if (payment.lead && ["captured", "refunded", "unknown"].includes(next.status)) {
    await sudo.query.LeadActivity.createOne({
      data: {
        brokerage: { connect: { id: payment.brokerage.id } },
        lead: { connect: { id: payment.lead.id } },
        ...payment.property ? { property: { connect: { id: payment.property.id } } } : {},
        activityType: "system",
        direction: "inbound",
        channel: "website",
        subject: next.status === "captured" ? `${describe(payment)} paid` : next.status === "refunded" ? `${describe(payment)} refunded` : `${describe(payment)} needs review`,
        body: `${(payment.amountMinor / 100).toFixed(2)} ${payment.currency} \xB7 payment ${payment.id}`,
        occurredAt: now
      },
      query: "id"
    });
  }
  await enqueueDomainEvent(sudo, {
    eventKey: `payment:${paymentId}:${next.status}:${eventKey}`,
    eventType: `payment.${next.status}`,
    brokerageId: payment.brokerage.id,
    aggregateType: "payment",
    aggregateId: paymentId,
    actorId: actorId4 || null,
    action: `payment_${next.status}`,
    request: { source: eventKey },
    before: { status: payment.status },
    after: { status: next.status, amountMinor: payment.amountMinor, currency: payment.currency, purpose: payment.purpose }
  });
}

// features/keystone/mutations/retentionCommands.ts
var import_node_crypto13 = __toESM(require("node:crypto"));
function at(value, label) {
  const date = new Date(commandText(value));
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} must be a valid timestamp.`);
  return date;
}
function policySuffix(key) {
  return import_node_crypto13.default.createHash("sha256").update(key).digest("hex").slice(0, 16);
}
function transactionManifestSha256(manifestKey, dealId, items) {
  const canonicalItems = [...items].sort((left, right) => left.documentId.localeCompare(right.documentId));
  return import_node_crypto13.default.createHash("sha256").update(canonicalDomainJson({ manifestKey, dealId, items: canonicalItems })).digest("hex");
}
async function recordRetentionPolicyCommand(_root, { data }, context) {
  const retentionClass = commandText(data.retentionClass), jurisdictionCode = commandText(data.jurisdictionCode).toUpperCase(), triggerType = commandText(data.triggerType), retentionDays = Number(data.retentionDays), disposition = commandText(data.disposition), legalBasis = commandText(data.legalBasis), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  const effectiveFrom = at(data.effectiveFrom, "Effective from").toISOString(), effectiveThrough = commandText(data.effectiveThrough) ? at(data.effectiveThrough, "Effective through").toISOString() : "";
  if (!["transaction_file", "listing_no_close", "consent_proof", "security_incident"].includes(retentionClass) || !jurisdictionCode || !["deal_closed", "listing_ended", "document_signed", "manual_verified"].includes(triggerType) || !Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 36500 || !["tombstone_delete", "archive", "review"].includes(disposition) || !legalBasis || legalBasis.length > 5e3 || effectiveThrough && new Date(effectiveThrough) <= new Date(effectiveFrom)) throw new Error("Valid effective-dated retention policy evidence is required.");
  const brokerageId = evidenceBrokerageId(context) || "", request = { retentionClass, jurisdictionCode, triggerType, retentionDays, disposition, legalBasis, effectiveFrom, effectiveThrough, reason };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:retention-policy:${retentionClass}:${jurisdictionCode}:${key}`,
    lockKey: `retention-policy:${brokerageId}:${retentionClass}:${jurisdictionCode}`,
    permission: "canAccessDashboard",
    managerRequired: true,
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const prior = await sudo.query.RetentionPolicy.findMany({ where: { brokerage: { id: { equals: brokerageId } }, retentionClass: { equals: retentionClass }, jurisdictionCode: { equals: jurisdictionCode } }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }], take: 1, query: "id" });
      const item = await sudo.query.RetentionPolicy.createOne({ data: { brokerage: { connect: { id: brokerageId } }, policyKey: `RP-${retentionClass}-${jurisdictionCode}-${policySuffix(key)}`, retentionClass, jurisdictionCode, triggerType, retentionDays, disposition, legalBasis, effectiveFrom, effectiveThrough: effectiveThrough || null, ...prior[0]?.id ? { supersedes: { connect: { id: prior[0].id } } } : {}, approvedBy: { connect: { id: evidenceActorId(scoped) } }, approvedAt: (/* @__PURE__ */ new Date()).toISOString(), reason }, query: "id" });
      const result = { ok: true, message: "Immutable effective-dated retention policy appended.", itemId: item.id };
      return { result, event: { eventType: "retention.policy_recorded", brokerageId, aggregateType: "retentionPolicy", aggregateId: item.id, actorId: evidenceActorId(scoped), action: "record_policy", before: prior[0] || null, after: { ...result, retentionClass, jurisdictionCode } } };
    }
  });
}
async function assignTransactionFileRetentionCommand(_root, { data }, context) {
  const dealId = commandText(data.dealId), documentId = commandText(data.documentId), policyId = commandText(data.policyId), documentSha256 = commandText(data.documentSha256).toLowerCase(), triggerAt = at(data.triggerAt, "Retention trigger").toISOString(), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  if (!dealId || !documentId || !policyId || !isSha256(documentSha256)) throw new Error("Deal, document, policy, and checksum are required.");
  const brokerageId = evidenceBrokerageId(context) || "", request = { dealId, documentId, policyId, documentSha256, triggerAt, reason };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:transaction-file:${documentId}:assign-retention:${key}`,
    lockKey: `transaction-file:${documentId}`,
    permission: "canManageDeals",
    managerRequired: true,
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const [deal, document, policy, evidence] = await Promise.all([
        sudo.query.Deal.findOne({ where: { id: dealId }, query: "id stage closedAt property { state } brokerage { id }" }),
        sudo.query.DealDocument.findOne({ where: { id: documentId }, query: "id status signedAt createdAt deal { id } brokerage { id }" }),
        sudo.query.RetentionPolicy.findOne({ where: { id: policyId }, query: "id retentionClass jurisdictionCode triggerType retentionDays disposition effectiveFrom effectiveThrough brokerage { id }" }),
        sudo.query.DocumentEvidenceEvent.findMany({ where: { document: { id: { equals: documentId } }, documentSha256: { equals: documentSha256 } }, take: 1, query: "id" })
      ]);
      const trigger = new Date(triggerAt), policyEffective = policy && new Date(policy.effectiveFrom) <= trigger && (!policy.effectiveThrough || new Date(policy.effectiveThrough) >= trigger);
      const triggerValid = policy?.triggerType === "deal_closed" ? ["closed_won", "closed_lost"].includes(deal?.stage) && Boolean(deal?.closedAt) && trigger.getTime() === new Date(deal.closedAt).getTime() : policy?.triggerType === "document_signed" ? ["signed", "archived"].includes(document?.status) && Boolean(document?.signedAt) && trigger.getTime() === new Date(document.signedAt).getTime() : policy?.triggerType === "manual_verified" && trigger.getTime() >= new Date(document?.createdAt).getTime() && trigger.getTime() <= Date.now();
      if (policy?.retentionClass !== "transaction_file" || policy?.jurisdictionCode !== String(deal?.property?.state || "").toUpperCase()) return { result: { ok: false, message: "The transaction-file policy must match the listing jurisdiction.", itemId: null }, event: null };
      if (!deal || !document || document.deal?.id !== dealId || deal.brokerage?.id !== brokerageId || document.brokerage?.id !== brokerageId || !policy || policy.brokerage?.id !== brokerageId || !policyEffective || !triggerValid || !evidence.length) return { result: { ok: false, message: "Retention assignment lacks coherent trigger, policy, checksum evidence, or brokerage scope.", itemId: null }, event: null };
      const disposeAfter = new Date(trigger.getTime() + Number(policy.retentionDays) * 24 * 60 * 6e4).toISOString();
      const item = await sudo.query.TransactionFileEvent.createOne({ data: { brokerage: { connect: { id: brokerageId } }, eventKey: `TF-${policySuffix(`${documentId}:${key}`)}`, deal: { connect: { id: dealId } }, document: { connect: { id: documentId } }, policy: { connect: { id: policyId } }, eventType: "retention_assigned", triggerAt, disposeAfter, documentSha256, reason, actor: { connect: { id: evidenceActorId(scoped) } }, approvedBy: { connect: { id: evidenceActorId(scoped) } }, occurredAt: (/* @__PURE__ */ new Date()).toISOString() }, query: "id" });
      const result = { ok: true, message: "Transaction-file retention trigger and disposition date recorded.", itemId: item.id };
      return { result, event: { eventType: "retention.assigned", brokerageId, aggregateType: "dealDocument", aggregateId: documentId, actorId: evidenceActorId(scoped), action: "assign_retention", before: null, after: { ...result, triggerAt, disposeAfter, documentSha256 } } };
    }
  });
}
async function recordTransactionLegalHoldCommand(_root, { data }, context) {
  const dealId = commandText(data.dealId), documentId = commandText(data.documentId), holdKey = commandText(data.holdKey), action = commandText(data.action), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  if (!dealId || !holdKey || holdKey.length > 160 || !["place", "release"].includes(action)) throw new Error("Deal, bounded hold key, and hold action are required.");
  const brokerageId = evidenceBrokerageId(context) || "", request = { dealId, documentId, holdKey, action, reason };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:legal-hold:${holdKey}:${action}:${key}`,
    lockKey: `legal-hold:${brokerageId}:${holdKey}`,
    permission: "canManageDeals",
    managerRequired: true,
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const [deal, document, prior] = await Promise.all([
        sudo.query.Deal.findOne({ where: { id: dealId }, query: "id brokerage { id }" }),
        documentId ? sudo.query.DealDocument.findOne({ where: { id: documentId }, query: "id deal { id } brokerage { id }" }) : null,
        sudo.query.TransactionFileEvent.findMany({ where: { brokerage: { id: { equals: brokerageId } }, holdKey: { equals: holdKey }, eventType: { in: ["hold_placed", "hold_released"] } }, orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }, { id: "desc" }], take: 1, query: "id eventType deal { id } document { id }" })
      ]);
      if (prior[0] && (prior[0].deal?.id !== dealId || (prior[0].document?.id || "") !== documentId)) return { result: { ok: false, message: "A hold key cannot be moved to another transaction or document.", itemId: null }, event: null };
      if (!deal || deal.brokerage?.id !== brokerageId || documentId && (!document || document.brokerage?.id !== brokerageId || document.deal?.id !== dealId) || action === "place" && prior[0]?.eventType === "hold_placed" || action === "release" && prior[0]?.eventType !== "hold_placed") return { result: { ok: false, message: "Legal-hold state or transaction-file scope is invalid.", itemId: null }, event: null };
      const item = await sudo.query.TransactionFileEvent.createOne({ data: { brokerage: { connect: { id: brokerageId } }, eventKey: `HOLD-${policySuffix(`${holdKey}:${action}:${key}`)}`, deal: { connect: { id: dealId } }, ...documentId ? { document: { connect: { id: documentId } } } : {}, eventType: action === "place" ? "hold_placed" : "hold_released", holdKey, ...prior[0]?.id ? { reverses: { connect: { id: prior[0].id } } } : {}, reason, actor: { connect: { id: evidenceActorId(scoped) } }, approvedBy: { connect: { id: evidenceActorId(scoped) } }, occurredAt: (/* @__PURE__ */ new Date()).toISOString() }, query: "id" });
      const result = { ok: true, message: `Legal hold ${action === "place" ? "placed" : "released"} without deleting transaction evidence.`, itemId: item.id };
      return { result, event: { eventType: `retention.hold_${action === "place" ? "placed" : "released"}`, brokerageId, aggregateType: "deal", aggregateId: dealId, actorId: evidenceActorId(scoped), action: `hold_${action}`, before: prior[0] || null, after: { ...result, holdKey, documentId: documentId || null } } };
    }
  });
}
async function createTransactionExportManifestCommand(_root, { data }, context) {
  const dealId = commandText(data.dealId), manifestKey = commandText(data.manifestKey), manifestSha256 = commandText(data.manifestSha256).toLowerCase(), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey);
  if (!dealId || !manifestKey || manifestKey.length > 200 || !Array.isArray(data.items) || data.items.length < 1 || data.items.length > 500) throw new Error("Deal, manifest key, and one to 500 checksummed items are required.");
  const items = data.items.map((item) => ({ documentId: commandText(item.documentId), sha256: commandText(item.sha256).toLowerCase() })).sort((left, right) => left.documentId.localeCompare(right.documentId));
  if (items.some((item) => !item.documentId || !isSha256(item.sha256))) throw new Error("Every export item requires a document and SHA-256 checksum.");
  const computedHash = transactionManifestSha256(manifestKey, dealId, items);
  if (manifestSha256 !== computedHash) throw new Error("Export manifest checksum does not match its canonical contents.");
  const brokerageId = evidenceBrokerageId(context) || "", request = { dealId, manifestKey, manifestSha256, items, reason };
  return runControlledEvidenceCommand(context, {
    eventKey: `command:transaction-file:${dealId}:manifest:${key}`,
    lockKey: `transaction-file-manifest:${dealId}`,
    permission: "canManageDeals",
    managerRequired: true,
    request,
    execute: async (scoped) => {
      const sudo = scoped.sudo();
      const deal = await sudo.query.Deal.findOne({ where: { id: dealId }, query: "id brokerage { id }" });
      if (!deal || deal.brokerage?.id !== brokerageId) return { result: { ok: false, message: "Deal not found or access denied.", itemId: null }, event: null };
      for (const entry of items) {
        const [document, evidence] = await Promise.all([
          sudo.query.DealDocument.findOne({ where: { id: entry.documentId }, query: "id deal { id } brokerage { id }" }),
          sudo.query.DocumentEvidenceEvent.findMany({ where: { document: { id: { equals: entry.documentId } }, documentSha256: { equals: entry.sha256 } }, take: 1, query: "id" })
        ]);
        if (!document || document.deal?.id !== dealId || document.brokerage?.id !== brokerageId || !evidence.length) return { result: { ok: false, message: "Manifest contains an unscoped or unverified document checksum.", itemId: null }, event: null };
      }
      const item = await sudo.query.TransactionFileEvent.createOne({ data: { brokerage: { connect: { id: brokerageId } }, eventKey: `MANIFEST-${policySuffix(`${manifestKey}:${key}`)}`, deal: { connect: { id: dealId } }, eventType: "export_manifested", manifestKey, manifestSha256, manifestItems: items, reason, actor: { connect: { id: evidenceActorId(scoped) } }, approvedBy: { connect: { id: evidenceActorId(scoped) } }, occurredAt: (/* @__PURE__ */ new Date()).toISOString() }, query: "id" });
      const result = { ok: true, message: "Immutable checksummed transaction export manifest appended.", itemId: item.id };
      return { result, event: { eventType: "retention.export_manifested", brokerageId, aggregateType: "deal", aggregateId: dealId, actorId: evidenceActorId(scoped), action: "manifest_export", before: null, after: { ...result, manifestKey, manifestSha256, itemCount: items.length } } };
    }
  });
}

// features/keystone/mutations/index.ts
var graphql8 = String.raw;
function extendGraphqlSchema(baseSchema) {
  return (0, import_schema.mergeSchemas)({
    schemas: [baseSchema],
    typeDefs: graphql8`
      type PlatformPerson { id: ID! name: String! email: String phone: String }
      type PlatformPropertySummary { id: ID! title: String! slug: String city: String state: String addressLine1: String price: String listingType: String }
      type PlatformLeadSummary { id: ID! name: String! email: String phone: String status: String intent: String }
      type PlatformActivity { id: ID! activityType: String! direction: String channel: String subject: String body: String occurredAt: String agent: PlatformPerson }
      type PlatformContact { id: ID! name: String! email: String phone: String status: String! intent: String source: String message: String lastContactedAt: String createdAt: String updatedAt: String activityAccess: String! property: PlatformPropertySummary assignedAgent: PlatformPerson showingsCount: Int activities: [PlatformActivity!]! }
      type PlatformContactCandidate { id: ID! name: String! email: String phone: String status: String! source: String createdAt: String assignedAgent: PlatformPerson property: PlatformPropertySummary }
      type PlatformDuplicateGroup { key: String! reason: String! candidates: [PlatformContactCandidate!]! }
      type PlatformContactStats { total: Int! new: Int! qualified: Int! tourScheduled: Int! offer: Int! }
      type PlatformOperatorViewer { actorId: ID! brokerageId: ID! }
      type PlatformContactPageInfo { hasNextPage: Boolean! hasPreviousPage: Boolean! nextCursor: String previousCursor: String }
      type PlatformContactWorkspace { items: [PlatformContact!]! duplicateGroups: [PlatformDuplicateGroup!]! stats: PlatformContactStats! pageInfo: PlatformContactPageInfo! viewer: PlatformOperatorViewer! }
      type PlatformLeadDetail { lead: PlatformContact! activityAccess: String! nextActivityCursor: String viewer: PlatformOperatorViewer! }

      type PlatformListing { id: ID! title: String! slug: String! status: String! listingType: String propertyType: String shortDescription: String addressLine1: String city: String state: String postalCode: String price: String bedrooms: Int bathrooms: String squareFeet: Int isFeatured: Boolean primaryImageUrl: String updatedAt: String assignedAgent: PlatformPerson leadsCount: Int showingsCount: Int }
      type PlatformListingStats { total: Int! active: Int! comingSoon: Int! pending: Int! sold: Int! offMarket: Int! }
      type PlatformListingPageInfo { hasNextPage: Boolean! hasPreviousPage: Boolean! nextCursor: String previousCursor: String }
      type PlatformListingWorkspace { items: [PlatformListing!]! stats: PlatformListingStats! pageInfo: PlatformListingPageInfo! }

      type PlatformShowing { id: ID! status: String! showingType: String scheduledStart: String! scheduledEnd: String notes: String feedback: String createdAt: String property: PlatformPropertySummary lead: PlatformLeadSummary assignedAgent: PlatformPerson }
      type ShowingCommandReceipt { version: Int! showingId: ID! leadId: ID! propertyId: ID! }
      type ShowingSourceSnapshot { version: Int! capturedAt: String! propertyId: ID! leadId: ID! assignedAgentId: ID scheduledStart: String! scheduledEnd: String! showingType: String! listingTitle: String! listingSlug: String! addressLine1: String! city: String! state: String! listingType: String! price: String notes: String! propertyUpdatedAt: String }
      type ShowingHistoryEntry { id: ID! action: String! occurredAt: String! fromStatus: String toStatus: String }
      type PlatformShowingDetail { showing: PlatformShowing! updatedAt: String! revision: String! snapshot: ShowingSourceSnapshot history: [ShowingHistoryEntry!]! nextHistoryCursor: String }
      type PlatformShowingStats { total: Int! requested: Int! scheduled: Int! completed: Int! noShow: Int! cancelled: Int! }
      type PlatformShowingPageInfo { hasNextPage: Boolean! hasPreviousPage: Boolean! nextCursor: String previousCursor: String }
      type PlatformShowingWorkspace { items: [PlatformShowing!]! stats: PlatformShowingStats! pageInfo: PlatformShowingPageInfo! }

      type PlatformDeal { id: ID! title: String! stage: String! transactionType: String offerAmount: String commissionAmount: String expectedCloseDate: String closedAt: String nextStep: String notes: String createdAt: String updatedAt: String property: PlatformPropertySummary lead: PlatformLeadSummary assignedAgent: PlatformPerson assignedTeam: PlatformTeam }
      type PlatformTeam { id: ID! name: String! }
      type PlatformPipelineStats { total: Int! open: Int! underContract: Int! closedWon: Int! closedLost: Int! projectedCommission: String! }
      type PlatformPipelineWorkspace { items: [PlatformDeal!]! stats: PlatformPipelineStats! }

      type PlatformMembership { id: ID! membershipRole: String! isPrimary: Boolean! brokerage: PlatformBrokerageRef }
      type PlatformBrokerageRef { id: ID! name: String! slug: String! }
      type PlatformAgent { id: ID! name: String! email: String phone: String licenseNumber: String brokerageTitle: String avatarUrl: String onboardingStatus: String role: PlatformRoleRef memberships: [PlatformMembership!]! listingCount: Int! leadCount: Int! showingCount: Int! dealCount: Int! }
      type PlatformRoleRef { id: ID! name: String! }
      type PlatformAgentTeam { id: ID! name: String! slug: String! teamType: String! status: String! description: String leadAgent: PlatformPerson members: [PlatformPerson!]! leadCount: Int! dealCount: Int! }
      type PlatformPeopleWorkspace { agents: [PlatformAgent!]! teams: [PlatformAgentTeam!]! }

      type PlatformOfferRef { id: ID! offerNumber: String! }
      type PlatformOffer { id: ID! offerNumber: String! version: Int! parentOffer: PlatformOfferRef status: String! amount: String earnestMoney: String financingType: String contingencies: String submittedAt: String responseDueAt: String createdAt: String deal: PlatformDealRef property: PlatformPropertyRef lead: PlatformLeadRef assignedAgent: PlatformPerson }
      type PlatformDealRef { id: ID! title: String! }
      type PlatformPropertyRef { id: ID! title: String! }
      type PlatformLeadRef { id: ID! name: String! }
      type PlatformMilestone { id: ID! name: String! status: String! dueAt: String completedAt: String sortOrder: Int notes: String assignedTo: PlatformPerson }
      type PlatformDocument { id: ID! title: String! documentType: String! status: String! requiresSignature: Boolean! sentAt: String signedAt: String expiresAt: String }
      type PlatformTransaction { id: ID! title: String! stage: String! expectedCloseDate: String property: PlatformPropertyRef lead: PlatformLeadRef assignedAgent: PlatformPerson milestones: [PlatformMilestone!]! documents: [PlatformDocument!]! }
      type PlatformCommission { id: ID! title: String! status: String! side: String! grossCommission: String brokerageSplitPercent: String agentSplitPercent: String netCommission: String paidAt: String deal: PlatformDealRef agent: PlatformPerson }
      type PlatformSavedSearch { id: ID! name: String! city: String state: String propertyType: String minPrice: String maxPrice: String minBedrooms: Int alertsEnabled: Boolean! lastNotifiedAt: String user: PlatformPerson }
      type PlatformSavedSearchAlert { id: ID! status: String! cadence: String! lastSentAt: String sentCount: Int savedSearch: PlatformSearchRef user: PlatformPerson }
      type PlatformSearchRef { id: ID! name: String! }
      type PlatformSourceFeed { id: ID! name: String! provider: String feedType: String! status: String! lastImportedAt: String recordsImported: Int }
      type PlatformDisclosure { id: ID! title: String! disclosureType: String! status: String! documentUrl: String sentAt: String acknowledgedAt: String deal: PlatformDealRef property: PlatformPropertyRef }
      type PlatformMortgageEvidence { id: ID! applicationNumber: String! lenderName: String status: String! loanAmount: String interestRate: String submittedAt: String decisionAt: String deal: PlatformDealRef lead: PlatformLeadRef }
      type PlatformTitleEvidence { id: ID! orderNumber: String! titleCompany: String status: String! orderedAt: String clearedAt: String exceptions: String deal: PlatformDealRef property: PlatformPropertyRef }
      type PlatformEscrowEvidence { id: ID! escrowNumber: String! status: String! escrowCompany: String officerName: String openedAt: String scheduledCloseAt: String closedAt: String depositAmount: String deal: PlatformDealRef property: PlatformPropertyRef }
      type PlatformOpenHouse { id: ID! title: String! status: String! startsAt: String! endsAt: String! attendeeCount: Int notes: String property: PlatformPropertyRef hostAgent: PlatformPerson }
      type PlatformInspection { id: ID! title: String! inspectionType: String! status: String! scheduledAt: String completedAt: String inspectorName: String estimatedCost: String summary: String findings: String property: PlatformPropertyRef deal: PlatformDealRef }
      type PlatformMarketComp { id: ID! addressLine1: String! city: String state: String status: String! listPrice: String salePrice: String soldAt: String bedrooms: Int bathrooms: String squareFeet: Int distanceMiles: String subjectProperty: PlatformPropertyRef neighborhood: PlatformNeighborhoodRef }
      type PlatformNeighborhoodRef { id: ID! name: String! }
      type PlatformValuation { id: ID! valuationNumber: String! valuationType: String! lowValue: String estimatedValue: String highValue: String valuedAt: String notes: String property: PlatformPropertyRef performedBy: PlatformPerson }
      type PlatformSyndication { id: ID! channel: String! status: String! externalListingId: String listingUrl: String publishedAt: String lastSyncedAt: String errorMessage: String property: PlatformPropertySummary }
      type PlatformAgentTask { id: ID! title: String! status: String! priority: String! dueAt: String completedAt: String notes: String assignedAgent: PlatformPerson property: PlatformPropertyRef lead: PlatformLeadRef deal: PlatformDealRef }
      type PlatformReportLead { id: ID! source: String status: String! assignedAgent: PlatformPerson }
      type PlatformReportShowing { id: ID! status: String! assignedAgent: PlatformPerson }
      type PlatformReportDeal { id: ID! stage: String! commissionAmount: String assignedAgent: PlatformPerson }
      type PlatformReportsWorkspace { leads: [PlatformReportLead!]! showings: [PlatformReportShowing!]! deals: [PlatformReportDeal!]! activeListings: Int! pendingListings: Int! }
      type PlatformListingEngagementAuthority { id: ID! authorityNumber: String! status: String! jurisdictionCode: String! effectiveFrom: String! effectiveThrough: String! marketingAuthorized: Boolean! showingAuthorized: Boolean! documentSha256: String! property: PlatformPropertyRef practitioner: PlatformPerson }
      type PlatformListingPublicationAuthority { id: ID! authorityNumber: String! destination: String! status: String! effectiveFrom: String! effectiveThrough: String! authorityBasis: String! property: PlatformPropertyRef engagementId: ID }
      type PlatformPractitionerLicenseAuthority { id: ID! licenseNumber: String! licenseType: String! jurisdictionCode: String! status: String! effectiveFrom: String! effectiveThrough: String! verifiedAt: String! verificationSource: String! practitioner: PlatformPerson }
      type PlatformRepresentationAuthority { id: ID! authorityNumber: String! side: String! relationshipType: String! jurisdictionCode: String! status: String! effectiveFrom: String! effectiveThrough: String! disclosureVersion: String! lead: PlatformLeadRef property: PlatformPropertyRef deal: PlatformDealRef practitioner: PlatformPerson }
      type PlatformDocumentEvidenceEvent { id: ID! eventKey: String! eventType: String! documentSha256: String! templateSha256: String! channel: String! provider: String! providerReference: String! occurredAt: String! acknowledgedAt: String document: PlatformDocumentRef offer: PlatformOfferRef }
      type PlatformDocumentRef { id: ID! title: String! }
      type PlatformCommissionLedgerEntry { id: ID! entryKey: String! batchKey: String! entryType: String! allocationType: String amountCents: String! currencyCode: String! payeeLabel: String externalReference: String occurredAt: String! commissionId: ID! preparedBy: PlatformPerson approvedBy: PlatformPerson }
      type PlatformRetentionPolicy { id: ID! policyKey: String! retentionClass: String! jurisdictionCode: String! triggerType: String! retentionDays: Int! disposition: String! effectiveFrom: String! effectiveThrough: String }
      type PlatformTransactionFileEvent { id: ID! eventKey: String! eventType: String! triggerAt: String disposeAfter: String holdKey: String manifestKey: String manifestSha256: String documentSha256: String externalDeletionReference: String reason: String! occurredAt: String! deal: PlatformDealRef document: PlatformDocumentRef }

      type PlatformOperationsWorkspace { offers: [PlatformOffer!]! transactions: [PlatformTransaction!]! commissions: [PlatformCommission!]! savedSearches: [PlatformSavedSearch!]! alerts: [PlatformSavedSearchAlert!]! feeds: [PlatformSourceFeed!]!  inspections: [PlatformInspection!]! openHouses: [PlatformOpenHouse!]! disclosures: [PlatformDisclosure!]! mortgages: [PlatformMortgageEvidence!]! titleOrders: [PlatformTitleEvidence!]! escrows: [PlatformEscrowEvidence!]! comps: [PlatformMarketComp!]! valuations: [PlatformValuation!]! syndications: [PlatformSyndication!]! tasks: [PlatformAgentTask!]! listingEngagementAuthorities: [PlatformListingEngagementAuthority!]! listingPublicationAuthorities: [PlatformListingPublicationAuthority!]! practitionerLicenses: [PlatformPractitionerLicenseAuthority!]! representationAuthorities: [PlatformRepresentationAuthority!]! documentEvidenceEvents: [PlatformDocumentEvidenceEvent!]! commissionLedgerEntries: [PlatformCommissionLedgerEntry!]! retentionPolicies: [PlatformRetentionPolicy!]! transactionFileEvents: [PlatformTransactionFileEvent!]! }

      input PublicRealEstateListingFilters {
        q: String
        city: String
        listingType: String
        propertyType: String
        minPrice: String
        maxPrice: String
        bedrooms: Int
        bathrooms: Int
        sort: String
        west: Float
        south: Float
        east: Float
        north: Float
      }

      type PublicRealEstateAgent {
        name: String!
        email: String!
        phone: String!
        brokerageTitle: String!
        licenseNumber: String!
        imagePath: String!
      }

      type PublicRealEstateMedia {
        title: String!
        mediaType: String!
        imagePath: String!
        externalUrl: String!
        altText: String!
        caption: String!
        sortOrder: Int!
        isHero: Boolean!
      }

      type PublicOpenHouse {
        id: ID!
        title: String!
        startsAt: String!
        endsAt: String!
        hostName: String!
      }

      type PublicRealEstateListing {
        id: ID!
        title: String!
        slug: String!
        status: String!
        listingType: String!
        propertyType: String!
        shortDescription: String!
        description: String!
        addressLine1: String!
        addressLine2: String!
        city: String!
        state: String!
        postalCode: String!
        neighborhood: String!
        latitude: Float
        longitude: Float
        price: String!
        bedrooms: Int
        bathrooms: String!
        squareFeet: Int
        lotSizeSquareFeet: Int
        yearBuilt: Int
        hoaFee: String!
        availableAt: String!
        isFeatured: Boolean!
        virtualTourUrl: String!
        leaseTerm: String!
        securityDeposit: Int
        applicationFeeMinor: Int
        petPolicy: String!
        imagePath: String!
        assignedAgent: PublicRealEstateAgent
        media: [PublicRealEstateMedia!]!
        openHouses: [PublicOpenHouse!]!
      }

      input StartApplicationFeeCheckoutInput {
        brokerageSlug: String!
        propertyId: ID!
        name: String!
        email: String
        phone: String
        message: String
      }

      type PaymentCheckoutResult {
        ok: Boolean!
        message: String!
        url: String
        token: String
      }

      type PublicPayment {
        token: String!
        purpose: String!
        status: String!
        statusMessage: String!
        amountMinor: Int!
        currency: String!
        description: String!
        brokerageName: String!
        propertyTitle: String!
        payerName: String!
        paidAt: String
        canPay: Boolean!
      }

      input RequestPaymentCommandInput {
        leadId: ID!
        dealId: ID
        purpose: String!
        amountMinor: Int!
        description: String
        idempotencyKey: String!
      }

      type PaymentCommandResult {
        ok: Boolean!
        message: String!
        itemId: ID
        url: String
        replayed: Boolean!
      }

      input SubmitListingInquiryInput {
        brokerageSlug: String!
        propertyId: ID!
        name: String!
        email: String
        phone: String
        intent: String
        message: String
        preferredTime: String
      }

      type SubmitListingInquiryResult {
        ok: Boolean!
        message: String!
      }

      input RequestPropertyShowingInput {
        brokerageSlug: String!
        propertyId: ID!
        name: String!
        email: String
        phone: String
        requestedStart: String!
        showingType: String
        message: String
        idempotencyKey: String
      }

      type RequestPropertyShowingResult {
        ok: Boolean!
        message: String!
        requestReference: String
      }

      type CustomerRegistrationResult { ok: Boolean! message: String! }
      input RealEstateCustomerInput { name: String! email: String! password: String! brokerageSlug: String! }
      type CustomerShowing { id: ID! status: String! showingType: String! scheduledStart: String! scheduledEnd: String listingTitle: String! listingSlug: String! requestedStart: String! }
      type CustomerSavedProperty { id: ID! propertyId: ID! }
      type CustomerInquiry { id: ID! message: String! sentAt: String! listingTitle: String! listingSlug: String! status: String! }

      type PublicBrokerageIdentity {
        businessName: String!
        marketLabel: String!
        city: String!
        state: String!
        tagline: String!
        description: String!
        equalHousingNotice: String!
        publicPhone: String!
        publicEmail: String!
        brandHue: Int!
        logoIcon: String!
        logoColor: String!
      }

      type PublicBrokerageIdentityState {
        status: String!
        brokerageSlug: String
        settings: PublicBrokerageIdentity
      }

      type PlatformStorefrontSettings {
        id: ID!
        businessName: String!
        marketLabel: String!
        city: String!
        state: String!
        tagline: String!
        description: String!
        equalHousingNotice: String!
        publicPhone: String!
        publicEmail: String!
        showingDurationMinutes: Int!
        brandHue: Int!
        logoIcon: String!
        logoColor: String!
      }

      type PlatformStorefrontSettingsState {
        status: String!
        settings: PlatformStorefrontSettings
      }

      input PlatformStorefrontSettingsInput {
        businessName: String!
        marketLabel: String!
        city: String!
        state: String!
        tagline: String!
        description: String!
        equalHousingNotice: String!
        publicPhone: String!
        publicEmail: String!
        showingDurationMinutes: Int!
        brandHue: Int
        logoIcon: String
        logoColor: String
      }

      input ShowingReviewInput { id: ID! status: String! expectedStatus: String! expectedUpdatedAt: String! expectedRevision: String! note: String idempotencyKey: String! }
      input OperatorTransitionInput {
        id: ID!
        status: String!
        note: String
        idempotencyKey: String!
        expectedStatus: String
        expectedUpdatedAt: String
      }

      type OperatorTransitionResult {
        ok: Boolean!
        message: String!
        itemId: ID
        status: String
        replayed: Boolean!
      }

      type OperatorCommandResult {
        ok: Boolean!
        message: String!
        itemId: ID
        replayed: Boolean!
      }

      input CreateOfferCommandInput { dealId: ID! amount: String! earnestMoney: String financingType: String contingencies: String responseDueAt: DateTime idempotencyKey: String! }
      input CreateCounterOfferCommandInput { offerId: ID! amount: String! contingencies: String responseDueAt: DateTime idempotencyKey: String! }
      input CreateChecklistItemCommandInput { dealId: ID! name: String! dueAt: DateTime assignedToId: ID notes: String idempotencyKey: String! }
      input TransitionDocumentCommandInput { documentId: ID! status: String! idempotencyKey: String! }
      input TransitionAgentTaskCommandInput { taskId: ID! status: String! idempotencyKey: String! }
      input TransitionInspectionCommandInput { inspectionId: ID! status: String! idempotencyKey: String! }
      input UpdateSavedSearchAlertCommandInput { alertId: ID! status: String! cadence: String! idempotencyKey: String! }
      input QueueSavedSearchAlertCommandInput { alertId: ID! idempotencyKey: String! }
      input QueueSourceImportCommandInput { sourceFeedId: ID! mode: String! idempotencyKey: String! }
      input TransitionListingSyndicationCommandInput { syndicationId: ID! status: String! providerReference: String reason: String! idempotencyKey: String! }

      input RecordPractitionerLicenseAuthorityInput { practitionerId: ID! licenseNumber: String! licenseType: String! jurisdictionCode: String! status: String! effectiveFrom: DateTime! effectiveThrough: DateTime! verifiedAt: DateTime! verificationSource: String! restrictions: String reason: String! idempotencyKey: String! }
      input RecordListingEngagementAuthorityInput { propertyId: ID! practitionerId: ID! status: String! jurisdictionCode: String! effectiveFrom: DateTime! effectiveThrough: DateTime! exclusive: Boolean marketingAuthorized: Boolean showingAuthorized: Boolean sellerPartySummary: JSON signatoryCapacity: String! documentSha256: String! providerReference: String reason: String! idempotencyKey: String! }
      input RecordListingPublicationAuthorityInput { propertyId: ID! engagementId: ID! destination: String! status: String! effectiveFrom: DateTime! effectiveThrough: DateTime! authorityBasis: String! localRuleReference: String dataUseGrantReference: String reason: String! idempotencyKey: String! }
      input RecordRepresentationAuthorityInput { leadId: ID! propertyId: ID dealId: ID practitionerId: ID! side: String! relationshipType: String! jurisdictionCode: String! status: String! effectiveFrom: DateTime! effectiveThrough: DateTime! scopeSummary: String! documentSha256: String! disclosureVersion: String! consentRecordedAt: DateTime! reason: String! idempotencyKey: String! }

      input AppendDocumentEvidenceEventInput { documentId: ID! offerId: ID eventType: String! documentSha256: String! templateSha256: String! certificateSha256: String recipients: JSON! channel: String! provider: String! providerReference: String! occurredAt: DateTime! providerReportedAt: DateTime acknowledgedAt: DateTime acknowledgementReference: String reason: String! idempotencyKey: String! }

      input CommissionAllocationLineInput { allocationType: String! amountCents: String! payeeUserId: ID payeeLabel: String }
      input ProposeCommissionAllocationInput { commissionId: ID! currencyCode: String! lines: [CommissionAllocationLineInput!]! reason: String! idempotencyKey: String! }
      input ApproveCommissionAllocationInput { commissionId: ID! batchKey: String! reason: String! idempotencyKey: String! }
      input RecordCommissionReceiptInput { commissionId: ID! batchKey: String! amountCents: String! currencyCode: String! externalReference: String! sourceDocumentSha256: String! reason: String! idempotencyKey: String! }
      input ReverseCommissionLedgerEntryInput { entryId: ID! reason: String! idempotencyKey: String! }
      input ReconcileCommissionLedgerInput { commissionId: ID! batchKey: String! externalReference: String! reason: String! idempotencyKey: String! }

      input RecordRetentionPolicyInput { retentionClass: String! jurisdictionCode: String! triggerType: String! retentionDays: Int! disposition: String! legalBasis: String! effectiveFrom: DateTime! effectiveThrough: DateTime reason: String! idempotencyKey: String! }
      input AssignTransactionFileRetentionInput { dealId: ID! documentId: ID! policyId: ID! documentSha256: String! triggerAt: DateTime! reason: String! idempotencyKey: String! }
      input RecordTransactionLegalHoldInput { dealId: ID! documentId: ID holdKey: String! action: String! reason: String! idempotencyKey: String! }
      input TransactionExportManifestItemInput { documentId: ID! sha256: String! }
      input CreateTransactionExportManifestInput { dealId: ID! manifestKey: String! manifestSha256: String! items: [TransactionExportManifestItemInput!]! reason: String! idempotencyKey: String! }
      input InviteBrokerageMemberInput {
        brokerageId: ID!
        name: String!
        email: String!
        temporaryPassword: String!
        roleName: String!
        membershipRole: String!
        idempotencyKey: String!
      }

      input SuspendBrokerageMemberInput { membershipId: ID! idempotencyKey: String! }

      input UpdateDealFinancialTermsInput {
        dealId: ID!
        offerAmount: String!
        commissionAmount: String
        idempotencyKey: String!
      }

      input UpdateDealNextStepInput {
        dealId: ID!
        nextStep: String!
        notes: String
        idempotencyKey: String!
      }

      input RescheduleShowingInput {
        showingId: ID!
        scheduledStart: String!
        note: String
        idempotencyKey: String!
        expectedStatus: String!
        expectedUpdatedAt: String!
        expectedRevision: String!
      }

      input CompleteShowingWithFeedbackInput {
        showingId: ID!
        feedback: String!
        idempotencyKey: String!
        expectedStatus: String
        expectedUpdatedAt: String
        expectedRevision: String
      }

      input ScheduleShowingForLeadInput {
        originalActorId: ID
        originalBrokerageId: ID
        leadId: ID!
        propertyId: ID!
        assignedAgentId: ID
        scheduledStart: DateTime!
        notes: String
        idempotencyKey: String!
      }

      input AddLeadActivityCommandInput {
        leadId: ID!
        propertyId: ID
        activityType: String
        direction: String
        channel: String
        subject: String
        body: String!
        idempotencyKey: String!
      }

      input ResolveDuplicateLeadInput {
        primaryLeadId: ID!
        duplicateLeadId: ID!
        note: String
        idempotencyKey: String!
      }

      input SavePropertyForCurrentUserInput {
        propertyId: ID!
        status: SavedPropertyStatusType
        notes: String
      }

      input SavedPropertyIdInput {
        savedPropertyId: ID!
      }

      input SaveSearchForCurrentUserInput {
        name: String!
        city: String
        state: String
        propertyType: String
        listingType: String
        minPrice: String
        maxPrice: String
        minBedrooms: Int
        minBathrooms: String
        minSquareFeet: Int
        keywords: String
        alertsEnabled: Boolean
      }

      input SavedSearchIdInput {
        savedSearchId: ID!
      }

      type SavedDiscoveryResult {
        ok: Boolean!
        message: String!
        itemId: ID
      }

      type OnboardingSeedSummary {
        created: Int!
        skipped: Int!
        total: Int!
      }

      type RealEstateOnboardingResult {
        completed: Boolean!
        status: String!
        core: OnboardingSeedSummary
        expansion: OnboardingSeedSummary
      }

      type Query {
        redirectToInit: Boolean
        publicBrokerageIdentity(brokerageSlug: String): PublicBrokerageIdentityState!
        customerShowingHistory(brokerageSlug: String!, id: ID): [CustomerShowing!]!
        customerInquiryHistory(brokerageSlug: String!): [CustomerInquiry!]!
        customerSavedProperties(brokerageSlug: String!): [CustomerSavedProperty!]!
        customerSavedHomes(brokerageSlug: String!): [PublicRealEstateListing!]!
        publicRealEstateListings(brokerageSlug: String!, filters: PublicRealEstateListingFilters, take: Int = 24, skip: Int = 0): [PublicRealEstateListing!]!
        publicRealEstateListing(brokerageSlug: String!, slug: String!): PublicRealEstateListing
        platformContacts(status: String = "all", q: String, take: Int = 50, after: String, before: String): PlatformContactWorkspace!
        platformLeadDetail(id: ID!, before: String): PlatformLeadDetail
        platformShowingRequestViewer: PlatformOperatorViewer
        platformListings(status: String = "all", q: String, take: Int = 60, after: String, before: String): PlatformListingWorkspace!
        scheduledShowingReceipt(data: ScheduleShowingForLeadInput!): ShowingCommandReceipt
        platformShowingDetail(id: ID!, before: String): PlatformShowingDetail
        platformShowings(status: String = "all", range: String = "upcoming", q: String, take: Int = 80, after: String, before: String): PlatformShowingWorkspace!
        platformPipeline: PlatformPipelineWorkspace!
        platformPeople: PlatformPeopleWorkspace!
        platformReports: PlatformReportsWorkspace!
        platformOperations: PlatformOperationsWorkspace!
        platformStorefrontSettings: PlatformStorefrontSettingsState!
        paymentByToken(token: String!): PublicPayment
      }

      type Mutation {
        startApplicationFeeCheckout(data: StartApplicationFeeCheckoutInput!): PaymentCheckoutResult!
        beginPaymentCheckout(token: String!): PaymentCheckoutResult!
        reconcilePaymentByToken(token: String!): PublicPayment
        requestPaymentCommand(data: RequestPaymentCommandInput!): PaymentCommandResult!
        reconcilePaymentCommand(paymentId: ID!): PaymentCommandResult!
        refundPaymentCommand(paymentId: ID!): PaymentCommandResult!
        submitListingInquiry(data: SubmitListingInquiryInput!): SubmitListingInquiryResult!
        requestPropertyShowing(data: RequestPropertyShowingInput!): RequestPropertyShowingResult!
        transitionLeadStatus(data: OperatorTransitionInput!): OperatorTransitionResult!
        transitionPropertyStatus(data: OperatorTransitionInput!): OperatorTransitionResult!
        transitionShowingStatus(data: OperatorTransitionInput!): OperatorTransitionResult!
        reviewShowingCommand(data: ShowingReviewInput!): OperatorTransitionResult!
        transitionOpenHouseStatus(data: OperatorTransitionInput!): OperatorTransitionResult!
        transitionOfferStatus(data: OperatorTransitionInput!): OperatorTransitionResult!
        transitionDealStage(data: OperatorTransitionInput!): OperatorTransitionResult!
        transitionCommissionStatus(data: OperatorTransitionInput!): OperatorTransitionResult!
        transitionDisclosureStatus(data: OperatorTransitionInput!): OperatorTransitionResult!
        transitionTransactionMilestoneStatus(data: OperatorTransitionInput!): OperatorTransitionResult!
        createOfferCommand(data: CreateOfferCommandInput!): OperatorCommandResult!
        createCounterOfferCommand(data: CreateCounterOfferCommandInput!): OperatorCommandResult!
        createChecklistItemCommand(data: CreateChecklistItemCommandInput!): OperatorCommandResult!
        transitionDocumentCommand(data: TransitionDocumentCommandInput!): OperatorCommandResult!
        transitionAgentTaskCommand(data: TransitionAgentTaskCommandInput!): OperatorCommandResult!
        transitionInspectionCommand(data: TransitionInspectionCommandInput!): OperatorCommandResult!
        updateSavedSearchAlertCommand(data: UpdateSavedSearchAlertCommandInput!): OperatorCommandResult!
        queueSavedSearchAlertCommand(data: QueueSavedSearchAlertCommandInput!): OperatorCommandResult!
        queueSourceImportCommand(data: QueueSourceImportCommandInput!): OperatorCommandResult!
        transitionListingSyndicationCommand(data: TransitionListingSyndicationCommandInput!): OperatorCommandResult!
        recordPractitionerLicenseAuthorityCommand(data: RecordPractitionerLicenseAuthorityInput!): OperatorCommandResult!
        recordListingEngagementAuthorityCommand(data: RecordListingEngagementAuthorityInput!): OperatorCommandResult!
        recordListingPublicationAuthorityCommand(data: RecordListingPublicationAuthorityInput!): OperatorCommandResult!
        recordRepresentationAuthorityCommand(data: RecordRepresentationAuthorityInput!): OperatorCommandResult!
        appendDocumentEvidenceEventCommand(data: AppendDocumentEvidenceEventInput!): OperatorCommandResult!
        proposeCommissionAllocationCommand(data: ProposeCommissionAllocationInput!): OperatorCommandResult!
        approveCommissionAllocationCommand(data: ApproveCommissionAllocationInput!): OperatorCommandResult!
        recordCommissionReceiptCommand(data: RecordCommissionReceiptInput!): OperatorCommandResult!
        reverseCommissionLedgerEntryCommand(data: ReverseCommissionLedgerEntryInput!): OperatorCommandResult!
        reconcileCommissionLedgerCommand(data: ReconcileCommissionLedgerInput!): OperatorCommandResult!
        recordRetentionPolicyCommand(data: RecordRetentionPolicyInput!): OperatorCommandResult!
        assignTransactionFileRetentionCommand(data: AssignTransactionFileRetentionInput!): OperatorCommandResult!
        recordTransactionLegalHoldCommand(data: RecordTransactionLegalHoldInput!): OperatorCommandResult!
        createTransactionExportManifestCommand(data: CreateTransactionExportManifestInput!): OperatorCommandResult!
        inviteBrokerageMemberCommand(data: InviteBrokerageMemberInput!): OperatorCommandResult!
        suspendBrokerageMemberCommand(data: SuspendBrokerageMemberInput!): OperatorCommandResult!
        updateDealFinancialTermsCommand(data: UpdateDealFinancialTermsInput!): OperatorCommandResult!
        updateDealNextStepCommand(data: UpdateDealNextStepInput!): OperatorCommandResult!
        completeShowingWithFeedback(data: CompleteShowingWithFeedbackInput!): OperatorCommandResult!
        rescheduleShowingCommand(data: RescheduleShowingInput!): OperatorCommandResult!
        scheduleShowingForLeadCommand(data: ScheduleShowingForLeadInput!): OperatorCommandResult!
        addLeadActivityCommand(data: AddLeadActivityCommandInput!): OperatorCommandResult!
        resolveDuplicateLeadCommand(data: ResolveDuplicateLeadInput!): OperatorCommandResult!
        savePropertyForCurrentUser(data: SavePropertyForCurrentUserInput!): SavedDiscoveryResult!
        removeSavedPropertyForCurrentUser(data: SavedPropertyIdInput!): SavedDiscoveryResult!
        saveSearchForCurrentUser(data: SaveSearchForCurrentUserInput!): SavedDiscoveryResult!
        deleteSavedSearchForCurrentUser(data: SavedSearchIdInput!): SavedDiscoveryResult!
        runRealEstateOnboarding(template: String = "full"): RealEstateOnboardingResult!
        dismissRealEstateOnboarding: RealEstateOnboardingResult!
        updatePlatformStorefrontSettings(data: PlatformStorefrontSettingsInput!): PlatformStorefrontSettingsState!
        registerRealEstateCustomer(data: RealEstateCustomerInput!): CustomerRegistrationResult!
        cancelCustomerShowing(brokerageSlug: String!, id: ID!): CustomerRegistrationResult!
      }
    `,
    resolvers: {
      Query: {
        redirectToInit: redirectToInit_default,
        publicBrokerageIdentity,
        customerShowingHistory,
        customerInquiryHistory,
        customerSavedProperties,
        customerSavedHomes,
        publicRealEstateListings,
        publicRealEstateListing,
        platformContacts,
        platformLeadDetail,
        platformShowingRequestViewer,
        platformListings,
        platformShowings,
        platformShowingDetail,
        scheduledShowingReceipt,
        platformPipeline,
        platformPeople,
        platformReports,
        platformOperations,
        platformStorefrontSettings,
        paymentByToken
      },
      Mutation: {
        startApplicationFeeCheckout,
        beginPaymentCheckout,
        reconcilePaymentByToken,
        requestPaymentCommand,
        reconcilePaymentCommand,
        refundPaymentCommand,
        submitListingInquiry,
        requestPropertyShowing,
        transitionLeadStatus,
        transitionPropertyStatus,
        transitionShowingStatus,
        reviewShowingCommand,
        transitionOpenHouseStatus,
        transitionOfferStatus,
        transitionDealStage,
        transitionCommissionStatus,
        transitionDisclosureStatus,
        transitionTransactionMilestoneStatus,
        createOfferCommand,
        createCounterOfferCommand,
        createChecklistItemCommand,
        transitionDocumentCommand,
        transitionAgentTaskCommand,
        transitionInspectionCommand,
        updateSavedSearchAlertCommand,
        queueSavedSearchAlertCommand,
        queueSourceImportCommand,
        transitionListingSyndicationCommand,
        recordPractitionerLicenseAuthorityCommand,
        recordListingEngagementAuthorityCommand,
        recordListingPublicationAuthorityCommand,
        recordRepresentationAuthorityCommand,
        appendDocumentEvidenceEventCommand,
        proposeCommissionAllocationCommand,
        approveCommissionAllocationCommand,
        recordCommissionReceiptCommand,
        reverseCommissionLedgerEntryCommand,
        reconcileCommissionLedgerCommand,
        recordRetentionPolicyCommand,
        assignTransactionFileRetentionCommand,
        recordTransactionLegalHoldCommand,
        createTransactionExportManifestCommand,
        inviteBrokerageMemberCommand,
        suspendBrokerageMemberCommand,
        updateDealFinancialTermsCommand,
        updateDealNextStepCommand,
        completeShowingWithFeedback,
        rescheduleShowingCommand,
        scheduleShowingForLeadCommand,
        addLeadActivityCommand,
        resolveDuplicateLeadCommand,
        savePropertyForCurrentUser,
        removeSavedPropertyForCurrentUser,
        saveSearchForCurrentUser,
        deleteSavedSearchForCurrentUser,
        runRealEstateOnboarding: runRealEstateOnboardingMutation,
        dismissRealEstateOnboarding,
        updatePlatformStorefrontSettings,
        registerRealEstateCustomer,
        cancelCustomerShowing
      }
    }
  });
}

// features/keystone/lib/mail.ts
var import_nodemailer = require("nodemailer");

// features/keystone/lib/email-layout.ts
var SUPPORT_EMAIL = "hello@real-estate.openship.org";
var FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
var C = {
  canvas: "#f4f4f5",
  card: "#ffffff",
  text: "#18181b",
  muted: "#52525b",
  subtle: "#71717a",
  line: "#e4e4e7",
  panel: "#fafafa",
  button: "#18181b",
  buttonText: "#ffffff",
  link: "#18181b"
};
var escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function storeNameFromEnv(fallback = "Real Estate") {
  const match = /^\s*"?([^"<]+?)"?\s*</.exec(process.env.SMTP_FROM || "");
  return match?.[1]?.trim() || fallback;
}
var p = (html, style = "") => `<p class="em-text" style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:24px;color:${C.text};${style}">${html}</p>`;
var emailParagraph = p;
var emailMuted = (html) => `<p class="em-muted" style="margin:0 0 16px;font-family:${FONT};font-size:14px;line-height:22px;color:${C.muted};">${html}</p>`;
function emailButton(label, href) {
  return `<table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin:8px 0 24px;">
<tr><td class="em-btn" align="center" bgcolor="${C.button}" style="border-radius:8px;background:${C.button};">
<a class="em-btn-a" href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:600;line-height:20px;color:${C.buttonText};text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
</td></tr></table>`;
}
function emailLayout(input) {
  const store = escapeHtml(input.storeName || storeNameFromEnv());
  const support = escapeHtml(input.supportEmail || SUPPORT_EMAIL);
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(input.title)}</title>
<style>
:root { color-scheme: light dark; supported-color-schemes: light dark; }
body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
a { color:${C.link}; }
@media (max-width: 620px) { .em-pad { padding-left:20px !important; padding-right:20px !important; } }
@media (prefers-color-scheme: dark) {
  .em-canvas { background:#09090b !important; }
  .em-card { background:#18181b !important; border-color:#27272a !important; }
  .em-text { color:#fafafa !important; }
  .em-muted { color:#a1a1aa !important; }
  .em-line { border-color:#3f3f46 !important; }
  .em-panel { background:#27272a !important; border-color:#3f3f46 !important; color:#fafafa !important; }
  .em-btn { background:#fafafa !important; }
  .em-btn-a { color:#18181b !important; }
  .em-link { color:#fafafa !important; }
}
[data-ogsc] .em-text { color:#fafafa !important; }
[data-ogsc] .em-muted { color:#a1a1aa !important; }
[data-ogsb] .em-canvas { background:#09090b !important; }
[data-ogsb] .em-card { background:#18181b !important; }
</style>
</head>
<body class="em-canvas" style="margin:0;padding:0;background:${C.canvas};">
${input.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(input.preheader)}</div>` : ""}
<table role="presentation" class="em-canvas" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="${C.canvas}" style="background:${C.canvas};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;">
<tr><td class="em-pad" style="padding:8px 32px 20px;font-family:${FONT};font-size:18px;line-height:24px;font-weight:700;letter-spacing:-0.01em;"><span class="em-text" style="color:${C.text};">${store}</span></td></tr>
<tr><td class="em-card" bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.line};border-radius:12px;">
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
<tr><td class="em-pad" style="padding:32px 32px 16px;">
<h1 class="em-text" style="margin:0 0 16px;font-family:${FONT};font-size:24px;line-height:32px;font-weight:700;letter-spacing:-0.02em;color:${C.text};">${escapeHtml(input.title)}</h1>
${input.body}
</td></tr>
</table>
</td></tr>
<tr><td class="em-pad" style="padding:20px 32px 8px;font-family:${FONT};font-size:13px;line-height:20px;color:${C.subtle};">
<span class="em-muted" style="color:${C.subtle};">${input.footerNote ? `${input.footerNote}<br>` : ""}Questions? Email <a class="em-link" href="mailto:${support}" style="color:${C.muted};text-decoration:underline;">${support}</a>.<br>${store}</span>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// features/keystone/lib/mail.ts
function getBaseUrlForEmails() {
  if (process.env.SMTP_STORE_LINK) {
    return process.env.SMTP_STORE_LINK;
  }
  console.warn("SMTP_STORE_LINK not set. Please add SMTP_STORE_LINK to your environment variables for email links to work properly.");
  return "";
}
var transport = (0, import_nodemailer.createTransport)({
  // @ts-ignore
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});
function passwordResetEmail({ url }) {
  return emailLayout({
    preheader: "Use this link to choose a new password.",
    title: "Reset your password",
    body: `${emailParagraph("We received a request to reset the password for your account. Use the button below to choose a new one.")}
${emailButton("Reset password", url)}
${emailMuted("If you did not request this, you can safely ignore this email. Your password will not change.")}`
  });
}
async function sendPasswordResetEmail(resetToken, to, baseUrl, resetPath) {
  const frontendUrl = baseUrl || getBaseUrlForEmails();
  const info = await transport.sendMail({
    to,
    from: process.env.SMTP_FROM,
    subject: "Reset your password",
    html: passwordResetEmail({
      url: resetPath ? `${frontendUrl}${resetPath}?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(to)}` : `${frontendUrl}${basePath && basePath}/reset?token=${encodeURIComponent(resetToken)}`
    })
  });
  if (process.env.MAIL_USER?.includes("ethereal.email")) {
    console.log(`\u{1F4E7} Message Sent!  Preview it at ${(0, import_nodemailer.getTestMessageUrl)(info)}`);
  }
}

// features/keystone/lib/initialOwnerBootstrap.ts
var BROKERAGE_NAME = "My Brokerage";
var BROKERAGE_SLUG = "my-brokerage";
var MEMBERSHIP_KEY = `${BROKERAGE_SLUG}:initial-owner`;
var ROLE_NAME = "Admin";
var roleData = {
  name: ROLE_NAME,
  canSeeOtherPeople: true,
  canEditOtherPeople: true,
  canManagePeople: true,
  canManageRoles: true,
  canAccessDashboard: true,
  canManageListings: true,
  canManageLeads: true,
  canManageShowings: true,
  canManageDeals: true,
  canViewReports: true,
  canManageOnboarding: true
};
function exactlyOne(items, label) {
  if (items.length > 1) throw new Error(`Cannot create the first account: more than one ${label} already exists.`);
  return items[0];
}
async function createInitialOwner(context, data) {
  return context.transaction(async (transactionContext) => {
    const sudo = transactionContext.sudo();
    await sudo.prisma.$executeRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      "bootstrap:initial-owner"
    );
    if (await sudo.db.User.count()) {
      throw new Error("Initial items can only be created when no users exist.");
    }
    const brokerageMatches = await sudo.query.Brokerage.findMany({
      where: { slug: { equals: BROKERAGE_SLUG } },
      take: 2,
      query: "id name slug status isPrimary"
    });
    let brokerage = await exactlyOne(brokerageMatches, "starter brokerage");
    const otherPrimaries = await sudo.query.Brokerage.findMany({
      where: { isPrimary: { equals: true }, slug: { not: { equals: BROKERAGE_SLUG } } },
      query: "id"
    });
    for (const other of otherPrimaries) {
      await sudo.db.Brokerage.updateOne({ where: { id: String(other.id) }, data: { isPrimary: false } });
    }
    if (brokerage) {
      brokerage = await sudo.db.Brokerage.updateOne({
        where: { id: brokerage.id },
        data: { status: "active", isPrimary: true }
      });
    } else {
      brokerage = await sudo.db.Brokerage.createOne({
        data: { name: BROKERAGE_NAME, slug: BROKERAGE_SLUG, status: "active", isPrimary: true }
      });
    }
    const roleMatches = await sudo.query.Role.findMany({
      where: { name: { equals: ROLE_NAME } },
      take: 2,
      query: "id name"
    });
    let role5 = await exactlyOne(roleMatches, "Admin role");
    role5 = role5 ? await sudo.db.Role.updateOne({ where: { id: role5.id }, data: roleData }) : await sudo.db.Role.createOne({ data: roleData });
    const existingMemberships = await sudo.query.BrokerageMembership.findMany({
      where: { membershipKey: { equals: MEMBERSHIP_KEY } },
      take: 2,
      query: "id brokerage { id } user { id }"
    });
    if (existingMemberships.length) {
      throw new Error("Cannot create the first account: an owner membership already exists.");
    }
    const user = await sudo.db.User.createOne({
      data: {
        ...data,
        role: { connect: { id: role5.id } },
        activeBrokerage: { connect: { id: brokerage.id } },
        onboardingStatus: "not_started"
      }
    });
    const membership = await sudo.db.BrokerageMembership.createOne({
      data: {
        membershipKey: MEMBERSHIP_KEY,
        brokerage: { connect: { id: brokerage.id } },
        user: { connect: { id: user.id } },
        membershipRole: "owner",
        status: "active",
        isPrimary: true,
        joinedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
    const memberships = await sudo.query.BrokerageMembership.findMany({
      where: { user: { id: { equals: user.id } } },
      take: 2,
      query: "id membershipRole status isPrimary brokerage { id } user { id }"
    });
    if (await sudo.db.User.count() !== 1 || memberships.length !== 1 || memberships[0].id !== membership.id || memberships[0].brokerage?.id !== brokerage.id || memberships[0].user?.id !== user.id || memberships[0].membershipRole !== "owner" || memberships[0].status !== "active" || !memberships[0].isPrimary) {
      throw new Error("Initial owner bootstrap invariant failed; the transaction was rolled back.");
    }
    return user;
  }, { timeout: 3e4 });
}
function installInitialOwnerResolver(schema) {
  const field = schema.getMutationType()?.getFields()?.createInitialUser;
  if (!field) throw new Error("Keystone createInitialUser mutation is unavailable.");
  field.resolve = async (_root, { data }, context) => {
    if (!context.sessionStrategy) throw new Error("No session implementation available on context.");
    const item = await createInitialOwner(context, data);
    const sessionToken = await context.sessionStrategy.start({
      data: { listKey: "User", itemId: item.id.toString() },
      context
    });
    if (typeof sessionToken !== "string" || !sessionToken.length) throw new Error("Failed to start session.");
    return { item, sessionToken };
  };
  return schema;
}

// features/keystone/lib/s3-storage.ts
function s3ForcePathStyle(endpoint2) {
  let hostname = "";
  try {
    hostname = endpoint2 ? new URL(endpoint2).hostname : "";
  } catch {
  }
  return !(hostname === "storageapi.dev" || hostname.endsWith(".storageapi.dev"));
}

// features/keystone/database-url.ts
var POOL_SIZES = { web: 15, worker: 5 };
var OVERRIDE_ENV = {
  web: "DATABASE_CONNECTION_LIMIT",
  worker: "DATABASE_CONNECTION_LIMIT_WORKER"
};
function pooledDatabaseUrl(url, role5 = "web") {
  if (!url || !/^postgres(ql)?:\/\//.test(url)) return url;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.searchParams.has("connection_limit")) return url;
  const override = Number(process.env[OVERRIDE_ENV[role5]]);
  parsed.searchParams.set("connection_limit", String(Number.isInteger(override) && override > 0 ? override : POOL_SIZES[role5]));
  return parsed.toString();
}

// features/keystone/lib/keystonePrismaErrors.ts
var RAW_METHOD = /^\$(queryRaw|executeRaw|queryRawUnsafe|executeRawUnsafe|queryRawTyped|runCommandRaw)$/;
var clients = /* @__PURE__ */ new WeakMap();
var delegates = /* @__PURE__ */ new WeakMap();
function isKeystonePrismaError(value) {
  return value instanceof Error && value.extensions?.code === "KS_PRISMA_ERROR";
}
function rethrowKeystonePrismaError(value) {
  if (!isKeystonePrismaError(value)) return value;
  const prisma = value.extensions.prisma ?? {};
  throw Object.assign(value, { code: prisma.code, meta: prisma.meta, clientVersion: prisma.clientVersion });
}
function throwing(result) {
  if (!result || typeof result.then !== "function") return rethrowKeystonePrismaError(result);
  const settled = () => result.then(rethrowKeystonePrismaError);
  return new Proxy(result, {
    get(target, key) {
      if (key === "then") return (ok, fail) => settled().then(ok, fail);
      if (key === "catch") return (fail) => settled().catch(fail);
      if (key === "finally") return (done) => settled().finally(done);
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}
function throwingDelegate(delegate) {
  const cached = delegates.get(delegate);
  if (cached) return cached;
  const wrapped = new Proxy(delegate, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? (...args) => throwing(value.apply(target, args)) : value;
    }
  });
  delegates.set(delegate, wrapped);
  return wrapped;
}
function throwKeystonePrismaErrors(client) {
  const cached = clients.get(client);
  if (cached) return cached;
  const wrapped = new Proxy(client, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if (key === "$transaction" && typeof value === "function") {
        return (work, ...options) => {
          if (typeof work === "function") return value.call(target, (tx) => work(throwKeystonePrismaErrors(tx)), ...options);
          return Promise.resolve(value.call(target, work, ...options)).then((results) => Array.isArray(results) ? results.map(rethrowKeystonePrismaError) : results);
        };
      }
      if (key === "$extends" && typeof value === "function") return (...args) => throwKeystonePrismaErrors(value.apply(target, args));
      if (typeof key === "string" && RAW_METHOD.test(key) && typeof value === "function") return (...args) => throwing(value.apply(target, args));
      if (typeof value === "function") return value.bind(target);
      if (typeof key === "string" && !key.startsWith("$") && value && typeof value === "object" && typeof value.findFirst === "function") return throwingDelegate(value);
      return value;
    }
  });
  clients.set(client, wrapped);
  return wrapped;
}

// features/keystone/index.ts
function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
var databaseURL = requiredEnv("DATABASE_URL");
function productionEnv(name, developmentFallback) {
  if (process.env[name]) return process.env[name];
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} is required in production`);
  }
  return developmentFallback;
}
var bucketName = productionEnv("S3_BUCKET_NAME", "keystone-test");
var region = productionEnv("S3_REGION", "ap-southeast-2");
var accessKeyId = productionEnv("S3_ACCESS_KEY_ID", "keystone");
var secretAccessKey = productionEnv("S3_SECRET_ACCESS_KEY", "keystone");
var endpoint = productionEnv("S3_ENDPOINT", "https://sfo3.digitaloceanspaces.com");
var sessionSecret = requiredEnv("SESSION_SECRET");
if (sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET must be at least 32 characters long");
}
var requiredBrokerageModels = [
  "AgentTask",
  "DealDocument",
  "SavedSearch",
  "SavedSearchAlert",
  "SourceFeed",
  "TransactionMilestone"
];
function enforceRequiredBrokerageRelations(schema) {
  let next = schema;
  for (const model of requiredBrokerageModels) {
    const blockPattern = new RegExp(`(model ${model} \\{[\\s\\S]*?\\n\\})`);
    const match = next.match(blockPattern);
    if (!match) throw new Error(`Generated Prisma model ${model} is missing.`);
    const updated = match[1].replace(/brokerage(\s+)Brokerage\?(\s+)@relation/, "brokerage$1Brokerage$2@relation").replace(/brokerageId(\s+)String\?(\s+)@map\("brokerage"\)/, 'brokerageId$1String$2@map("brokerage")');
    if (updated === match[1]) throw new Error(`Generated Prisma model ${model} no longer has the expected brokerage relation shape.`);
    next = next.replace(match[1], updated);
  }
  return next;
}
var basePath = "/dashboard";
var sessionConfig = {
  maxAge: 60 * 60 * 24 * 30,
  secret: sessionSecret
};
var { withAuth } = (0, import_auth.createAuth)({
  listKey: "User",
  identityField: "email",
  secretField: "password",
  initFirstItem: {
    fields: ["name", "email", "password"],
    // The generated createInitialUser resolver is replaced below so the user,
    // authority roots, required membership, and active brokerage commit together.
    itemData: {}
  },
  passwordResetLink: {
    async sendToken(args) {
      const user = await args.context.sudo().query.User.findOne({ where: { id: String(args.itemId) }, query: "id brokerageMemberships(take: 1) { id }" });
      const customer = Boolean(user && !user.brokerageMemberships?.length);
      await sendPasswordResetEmail(args.token, args.identity, void 0, customer ? "/password-reset" : void 0);
    }
  },
  sessionData: `
    id
    name
    email
    activeBrokerage { id slug status }
    brokerageMemberships {
      id
      membershipRole
      status
      isPrimary
      brokerage { id slug status }
    }
    role {
      id
      name
      canSeeOtherPeople
      canEditOtherPeople
      canManagePeople
      canManageRoles
      canAccessDashboard
      canManageListings
      canManageLeads
      canManageShowings
      canManageDeals
      canViewReports
      canManageOnboarding
    }
  `
});
var keystone_default = withAuth(
  (0, import_core46.config)({
    db: {
      provider: "postgresql",
      url: pooledDatabaseUrl(databaseURL),
      // Keystone returns failed queries as values; this makes them throw so transactions roll back.
      extendPrismaClient: throwKeystonePrismaErrors,
      extendPrismaSchema: (schema) => preserveLegacyMoneyColumns(enforceRequiredBrokerageRelations(schema))
    },
    lists: models,
    storage: {
      my_images: {
        kind: "s3",
        type: "image",
        bucketName,
        region,
        accessKeyId,
        secretAccessKey,
        endpoint,
        signed: { expiry: 5e3 },
        forcePathStyle: s3ForcePathStyle(endpoint)
      }
    },
    ui: {
      isAccessAllowed: ({ session }) => permissions.canAccessDashboard({ session }),
      basePath
    },
    session: (0, import_session.statelessSessions)(sessionConfig),
    graphql: {
      extendGraphqlSchema: (schema) => installInitialOwnerResolver(extendGraphqlSchema(schema))
    }
  })
);

// keystone.ts
var keystone_default2 = keystone_default;
//# sourceMappingURL=config.js.map
