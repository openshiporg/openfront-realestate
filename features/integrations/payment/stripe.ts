import { createHmac, timingSafeEqual } from "node:crypto";

type StripeResponse = Record<string, any>;
type Provider = { credentials?: Record<string, any> } | undefined;

const WEBHOOK_TOLERANCE_SECONDS = 300;

function secretKey(provider: Provider) {
  const key = provider?.credentials?.secretKey || process.env.STRIPE_SECRET_KEY;
  if (!key || !/^(sk|rk)_(test|live)_/.test(key)) throw new Error("Stripe secret key not configured");
  return key as string;
}

function formEncode(params: Record<string, string | number | boolean | undefined | null>) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null) body.append(key, String(value));
  return body;
}

async function stripeRequest(provider: Provider, path: string, method: "GET" | "POST" = "GET", params?: Record<string, string | number | boolean | undefined | null>, idempotencyKey?: string): Promise<StripeResponse> {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
    headers: {
      Authorization: `Bearer ${secretKey(provider)}`,
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: params ? formEncode(params) : undefined,
  });
  const result = (await response.json()) as StripeResponse;
  if (!response.ok) throw new Error(`Stripe request failed: ${result?.error?.type || response.status}`);
  return result;
}

const PURPOSE_LABEL: Record<string, string> = {
  application_fee: "Rental application fee",
  holding_deposit: "Holding deposit",
  rent: "Rent payment",
  agent_fee: "Agent desk fee",
};

/** Creates a hosted Checkout Session. Rent is collected by ACH (us_bank_account); everything else by card. */
export async function createPaymentFunction({ provider, payment, amount, currency, idempotencyKey }: { provider?: Provider; payment: any; amount: number; currency: string; idempotencyKey?: string }) {
  if (!Number.isSafeInteger(amount) || amount < 1) throw new Error("Invalid payment amount");
  if (!payment?.id || !payment.successUrl || !payment.cancelUrl) throw new Error("Payment context is incomplete");
  const method = payment.purpose === "rent" ? "us_bank_account" : "card";
  const session = await stripeRequest(provider, "checkout/sessions", "POST", {
    mode: "payment",
    success_url: payment.successUrl,
    cancel_url: payment.cancelUrl,
    client_reference_id: payment.id,
    customer_email: payment.customerEmail || undefined,
    "payment_method_types[0]": method,
    "line_items[0][quantity]": 1,
    "line_items[0][price_data][currency]": currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": amount,
    "line_items[0][price_data][product_data][name]": payment.description || PURPOSE_LABEL[payment.purpose] || "Payment",
    "metadata[paymentId]": payment.id,
    "metadata[purpose]": payment.purpose || "",
    "payment_intent_data[metadata][paymentId]": payment.id,
  }, idempotencyKey);
  return {
    id: session.id as string,
    url: session.url as string,
    status: session.payment_status as string,
    amount: session.amount_total as number,
    currency: String(session.currency).toUpperCase(),
    expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
  };
}

export async function capturePaymentFunction({ provider, paymentId, amount, idempotencyKey }: { provider?: Provider; paymentId: string; amount?: number; idempotencyKey?: string }) {
  const intent = await stripeRequest(provider, `payment_intents/${encodeURIComponent(paymentId)}/capture`, "POST", amount == null ? {} : { amount_to_capture: amount }, idempotencyKey);
  return { id: intent.id, status: intent.status, amount: intent.amount_received, currency: String(intent.currency).toUpperCase() };
}

export async function refundPaymentFunction({ provider, paymentId, amount, idempotencyKey, refundId }: { provider?: Provider; paymentId: string; amount: number; idempotencyKey?: string; refundId?: string }) {
  const refund = refundId
    ? await stripeRequest(provider, `refunds/${encodeURIComponent(refundId)}`)
    : await stripeRequest(provider, "refunds", "POST", { payment_intent: paymentId, amount }, idempotencyKey);
  return { id: refund.id, refundId: refund.id, status: refund.status, amount: refund.amount, currency: String(refund.currency).toUpperCase() };
}

/** Accepts a Checkout Session id (cs_…) or a PaymentIntent id (pi_…) and answers in PaymentIntent vocabulary. */
export async function getPaymentStatusFunction({ provider, paymentId }: { provider?: Provider; paymentId: string }) {
  if (paymentId.startsWith("cs_")) {
    const session = await stripeRequest(provider, `checkout/sessions/${encodeURIComponent(paymentId)}?expand[]=payment_intent.latest_charge`);
    const intent = session.payment_intent && typeof session.payment_intent === "object" ? session.payment_intent : null;
    const charge = intent?.latest_charge && typeof intent.latest_charge === "object" ? intent.latest_charge : null;
    let status: string;
    if (session.payment_status === "paid" && intent?.status === "succeeded") status = "succeeded";
    else if (session.status === "expired") status = "canceled";
    else status = intent?.status || "requires_payment_method";
    return {
      id: session.id as string,
      paymentIntentId: (intent?.id ?? (typeof session.payment_intent === "string" ? session.payment_intent : null)) as string | null,
      url: session.status === "open" ? (session.url as string) : null,
      status,
      amount: (status === "succeeded" && intent ? (intent.amount_received || intent.amount) : session.amount_total) as number,
      currency: String(session.currency).toUpperCase(),
      refundedAmount: (charge?.amount_refunded ?? 0) as number,
    };
  }
  const intent = await stripeRequest(provider, `payment_intents/${encodeURIComponent(paymentId)}?expand[]=latest_charge`);
  const charge = intent.latest_charge && typeof intent.latest_charge === "object" ? intent.latest_charge : null;
  return {
    id: intent.id as string,
    paymentIntentId: intent.id as string,
    url: null,
    status: intent.status as string,
    amount: (intent.status === "succeeded" ? intent.amount_received : intent.amount) as number,
    currency: String(intent.currency).toUpperCase(),
    refundedAmount: (charge?.amount_refunded ?? 0) as number,
  };
}

export async function generatePaymentLinkFunction({ provider, paymentId }: { provider?: Provider; paymentId: string }) {
  const mode = secretKey(provider).includes("_test_") ? "test/" : "";
  return `https://dashboard.stripe.com/${mode}payments/${encodeURIComponent(paymentId)}`;
}

export async function cancelPaymentFunction({ provider, paymentId, idempotencyKey }: { provider?: Provider; paymentId: string; idempotencyKey?: string }) {
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

/** Verifies the Stripe-Signature header over the raw body (HMAC-SHA256, constant time, replay window). */
export async function handleWebhookFunction({ provider, headers, rawBody }: { provider?: Provider; headers: Record<string, string>; rawBody?: string }) {
  const secret = provider?.credentials?.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("Stripe webhook secret is not configured");
  if (!rawBody) throw new Error("Stripe webhook raw body is required");
  const header = headers["stripe-signature"];
  if (!header) throw new Error("Stripe signature is required");
  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key === "t") timestamp = value;
    if (key === "v1") signatures.push(value);
  }
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!timestamp || !Number.isFinite(age) || age > WEBHOOK_TOLERANCE_SECONDS) throw new Error("Stripe signature timestamp outside tolerance");
  const expected = Buffer.from(createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex"));
  const valid = signatures.some(signature => {
    const actual = Buffer.from(signature);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
  if (!valid) throw new Error("Invalid Stripe signature");
  const event = JSON.parse(rawBody);
  return { isValid: true, event, type: event.type as string, resource: event.data?.object };
}
