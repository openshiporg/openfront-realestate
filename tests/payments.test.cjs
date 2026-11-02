// Payments: server-owned amounts, amount/currency mismatch, durable webhook dedupe and signature checks.
// Node's built-in runner; loads real source with isolated mocks. No DB, network or real env.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function sandbox({ env = {}, mocks = {}, fetch: fetchImpl } = {}) {
  const cache = new Map();
  function load(relative) {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const source = fs.readFileSync(filename, 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const module = { exports: {} };
    cache.set(filename, module);
    function localRequire(specifier) {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
      if (specifier.startsWith('node:')) return require(specifier);
      const resolved = specifier.startsWith('@/') ? path.join(root, specifier.slice(2))
        : specifier.startsWith('.') ? path.resolve(path.dirname(filename), specifier) : null;
      if (resolved) {
        for (const candidate of [`${resolved}.ts`, path.join(resolved, 'index.ts')]) if (fs.existsSync(candidate)) return load(candidate);
      }
      throw new Error(`Unmocked dependency: ${specifier}`);
    }
    vm.runInNewContext(output, {
      module, exports: module.exports, require: localRequire, process: { env }, console, URL, URLSearchParams, Buffer, AbortSignal, Date, Number, JSON,
      Response, Headers, setTimeout, Promise, Intl,
      fetch: fetchImpl || (() => { throw new Error('Unexpected network request'); }),
    }, { filename });
    return module.exports;
  }
  return { load };
}

const state = 'features/keystone/lib/paymentState.ts';
const plain = value => JSON.parse(JSON.stringify(value));

test('application fee comes from the Property only: rentals with a stored fee, otherwise none', () => {
  const { applicationFeeFor } = sandbox().load(state);
  assert.equal(applicationFeeFor({ listingType: 'rent', applicationFeeMinor: 5500 }), 5500);
  assert.equal(applicationFeeFor({ listingType: 'rent', applicationFeeMinor: null }), null);
  assert.equal(applicationFeeFor({ listingType: 'rent', applicationFeeMinor: 0 }), null);
  assert.equal(applicationFeeFor({ listingType: 'rent', applicationFeeMinor: 55.5 }), null);
  assert.equal(applicationFeeFor({ listingType: 'sale', applicationFeeMinor: 5500 }), null);
  assert.equal(applicationFeeFor(null), null);
});

test('the apply and checkout GraphQL inputs carry no amount, so a client cannot choose the fee', () => {
  const schema = fs.readFileSync(path.join(root, 'features/keystone/mutations/index.ts'), 'utf8');
  const input = schema.match(/input StartApplicationFeeCheckoutInput \{([^}]*)\}/)[1];
  assert.doesNotMatch(input, /amount|fee|price|currency/i);
  assert.match(schema, /beginPaymentCheckout\(token: String!\)/);
  const storefront = fs.readFileSync(path.join(root, 'features/storefront/lib/data/payments.ts'), 'utf8');
  assert.doesNotMatch(storefront, /formData\.get\('(amount|fee|price|currency)/i);
  const payments = fs.readFileSync(path.join(root, 'features/keystone/mutations/payments.ts'), 'utf8');
  assert.match(payments, /applicationFeeFor\(property\)/);
  assert.match(payments, /amountMinor: fee/);
});

test('amount and currency mismatches are never accepted as money received', () => {
  const { nextPaymentState, assertAmountAndCurrency, PaymentMismatchError } = sandbox().load(state);
  const payment = { status: 'pending', amountMinor: 5500, currency: 'USD', refundedMinor: 0 };
  assert.deepEqual(plain(nextPaymentState(payment, { status: 'succeeded', amount: 5500, currency: 'usd' })), { status: 'captured', refundedMinor: 0 });
  assert.deepEqual(plain(nextPaymentState(payment, { status: 'succeeded', amount: 100, currency: 'usd' })), { status: 'unknown', mismatch: true });
  assert.deepEqual(plain(nextPaymentState(payment, { status: 'succeeded', amount: 5500, currency: 'eur' })), { status: 'unknown', mismatch: true });
  assert.deepEqual(plain(nextPaymentState(payment, { status: 'succeeded', amount: 55.5, currency: 'usd' })), { status: 'unknown', mismatch: true });
  assert.deepEqual(plain(nextPaymentState(payment, { status: 'succeeded', currency: 'usd' })), { status: 'unknown', mismatch: true });
  assert.throws(() => assertAmountAndCurrency(payment, 5499, 'USD'), error => error.name === 'PaymentMismatchError');
});

test('money states only move forward and ambiguous outcomes stay unknown', () => {
  const { nextPaymentState } = sandbox().load(state);
  const captured = { status: 'captured', amountMinor: 5500, currency: 'USD', refundedMinor: 0 };
  assert.equal(nextPaymentState(captured, { status: 'requires_payment_method' }), null);
  assert.equal(nextPaymentState(captured, { status: 'succeeded', amount: 5500, currency: 'USD' }), null);
  assert.equal(nextPaymentState(captured, { status: 'weird_new_status' }), null);
  assert.equal(nextPaymentState({ ...captured, status: 'pending' }, { status: 'weird_new_status' }).status, 'unknown');
  assert.equal(nextPaymentState(captured, { status: 'succeeded', amount: 5500, currency: 'USD', refundedAmount: 5500 }).status, 'refunded');
  assert.equal(nextPaymentState({ ...captured, status: 'refunded' }, { status: 'succeeded', amount: 5500, currency: 'USD' }), null);
});

function stripeSignature(secret, body, timestamp = Math.floor(Date.now() / 1000)) {
  return `t=${timestamp},v1=${crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
}

test('Stripe webhook signature: raw-body HMAC, constant-time, replay window', async () => {
  const { handleWebhookFunction } = sandbox({ env: { STRIPE_WEBHOOK_SECRET: 'whsec_test_secret' } }).load('features/integrations/payment/stripe.ts');
  const body = JSON.stringify({ id: 'evt_1', type: 'payment_intent.succeeded', data: { object: { id: 'pi_1' } } });
  const ok = await handleWebhookFunction({ headers: { 'stripe-signature': stripeSignature('whsec_test_secret', body) }, rawBody: body });
  assert.equal(ok.isValid, true);
  assert.equal(ok.event.id, 'evt_1');
  await assert.rejects(handleWebhookFunction({ headers: { 'stripe-signature': stripeSignature('whsec_other', body) }, rawBody: body }), /Invalid Stripe signature/);
  await assert.rejects(handleWebhookFunction({ headers: { 'stripe-signature': stripeSignature('whsec_test_secret', body) }, rawBody: body + ' ' }), /Invalid Stripe signature/);
  await assert.rejects(handleWebhookFunction({ headers: { 'stripe-signature': stripeSignature('whsec_test_secret', body, 1000) }, rawBody: body }), /tolerance/);
  await assert.rejects(handleWebhookFunction({ headers: {}, rawBody: body }), /signature is required/);
});

// A tiny in-memory Keystone context for the webhook handler.
function webhookHarness(payment) {
  const receipts = new Map();
  const updates = [];
  const activities = [];
  const events = [];
  const row = { id: 'pay_1', purpose: 'application_fee', status: 'pending', amountMinor: 5500, currency: 'USD', providerPaymentId: 'cs_test_1', providerPaymentIntentId: null, accessToken: 'tok', payerName: 'A', payerEmail: 'a@example.com', checkoutUrl: null, paidAt: null, refundedMinor: 0, idempotencyKey: 'k',
    brokerage: { id: 'b1', name: 'B', slug: 'b', status: 'active' }, paymentProvider: { id: 'prov_1' }, property: { id: 'p1', title: 'Flat' }, lead: { id: 'l1', name: 'A', email: 'a@example.com' }, deal: null, ...payment };
  const provider = { id: 'prov_1', code: 'pp_stripe', isInstalled: true, credentials: { webhookSecret: 'whsec_x' }, handleWebhookFunction: 'stripe', brokerage: { id: 'b1', status: 'active' } };
  const sudo = {
    prisma: { $executeRawUnsafe: async () => 1 },
    query: {
      PaymentProvider: { findOne: async ({ where }) => (where.id === provider.id ? provider : null) },
      PaymentWebhookReceipt: { findOne: async ({ where }) => receipts.get(where.eventKey) || null, createOne: async ({ data }) => { receipts.set(data.eventKey, data); return { id: 'r' }; } },
      Payment: {
        findMany: async ({ where }) => {
          const [field, filter] = Object.entries(where).find(([key]) => key !== 'paymentProvider');
          return row[field] === filter.equals ? [{ id: row.id, providerPaymentId: row.providerPaymentId }] : [];
        },
        findOne: async () => ({ ...row }),
        updateOne: async ({ data }) => { updates.push(data); Object.assign(row, data); return { ...row }; },
      },
      LeadActivity: { createOne: async ({ data }) => { activities.push(data); return { id: 'a' }; } },
      DomainOutboxEvent: { findOne: async () => null, createOne: async ({ data }) => { events.push(data); return { id: 'e' }; } },
    },
  };
  const context = { sudo: () => sudo, prisma: sudo.prisma, transaction: async fn => fn(context) };
  return { context, row, receipts, updates, activities, events };
}

function paymentsModule() {
  const real = sandbox({ env: { STRIPE_WEBHOOK_SECRET: 'whsec_x' }, mocks: {
    '.keystone/types': {}, '../lib/mail': { sendPaymentRequestEmail: async () => true },
    './submitListingInquiry': { submitListingInquiry: async () => ({ ok: true }) },
    './leadCapture': { leadIdentityKey: () => null },
    './controlledEvidenceCommand': { runControlledEvidenceCommand: async () => ({}) },
    '../lib/domainEvents': { enqueueDomainEvent: async (context, event) => { context.__events?.push(event); } },
    '../access': { activeBrokerageIds: () => [] },
    '../../lib/date-time': { commandText: v => String(v ?? '').trim() },
  } });
  return real.load('features/keystone/mutations/payments.ts');
}

const sessionEvent = (id, { amount = 5500, currency = 'usd', paid = true } = {}) => JSON.stringify({
  id, type: 'checkout.session.completed',
  data: { object: { id: 'cs_test_1', payment_intent: 'pi_test_1', payment_status: paid ? 'paid' : 'unpaid', amount_total: amount, currency, metadata: { paymentId: 'pay_1' } } },
});

test('webhook: a good event captures the payment once; the same event again is a no-op', async () => {
  const { handlePaymentProviderWebhook } = paymentsModule();
  const harness = webhookHarness();
  const body = sessionEvent('evt_a');
  const headers = { 'stripe-signature': stripeSignature('whsec_x', body) };
  const first = await handlePaymentProviderWebhook(harness.context, 'prov_1', body, headers);
  assert.equal(first.status, 200);
  assert.equal(first.body.outcome, 'applied');
  assert.equal(harness.row.status, 'captured');
  assert.equal(harness.row.providerPaymentIntentId, 'pi_test_1');
  assert.equal(harness.activities.length, 1);
  const again = await handlePaymentProviderWebhook(harness.context, 'prov_1', body, { 'stripe-signature': stripeSignature('whsec_x', body) });
  assert.equal(again.status, 200);
  assert.equal(again.body.duplicate, true);
  assert.equal(harness.updates.length, 1, 'duplicate delivery must not write again');
  assert.equal(harness.activities.length, 1, 'duplicate delivery must not log a second activity');
  assert.equal(harness.receipts.size, 1);
});

test('webhook: wrong amount or currency never captures; the payment is parked as unknown', async () => {
  const { handlePaymentProviderWebhook } = paymentsModule();
  for (const event of [sessionEvent('evt_amt', { amount: 100 }), sessionEvent('evt_cur', { currency: 'eur' })]) {
    const harness = webhookHarness();
    const result = await handlePaymentProviderWebhook(harness.context, 'prov_1', event, { 'stripe-signature': stripeSignature('whsec_x', event) });
    assert.equal(result.status, 200);
    assert.equal(harness.row.status, 'unknown');
    assert.equal(harness.row.paidAt, null);
  }
});

test('webhook: a bad signature is rejected before anything is read or written', async () => {
  const { handlePaymentProviderWebhook } = paymentsModule();
  const harness = webhookHarness();
  const body = sessionEvent('evt_b');
  const result = await handlePaymentProviderWebhook(harness.context, 'prov_1', body, { 'stripe-signature': stripeSignature('whsec_wrong', body) });
  assert.equal(result.status, 400);
  assert.equal(harness.receipts.size, 0);
  assert.equal(harness.row.status, 'pending');
  const unknown = await handlePaymentProviderWebhook(harness.context, 'missing', body, {});
  assert.equal(unknown.status, 404);
});

test('webhook: an event that names a different checkout session than the stored one is not applied', async () => {
  const { handlePaymentProviderWebhook } = paymentsModule();
  const harness = webhookHarness({ providerPaymentId: 'cs_test_OTHER' });
  const body = sessionEvent('evt_c');
  const result = await handlePaymentProviderWebhook(harness.context, 'prov_1', body, { 'stripe-signature': stripeSignature('whsec_x', body) });
  assert.equal(result.body.outcome, 'uncorrelated');
  assert.equal(harness.row.status, 'pending');
});

test('webhook: ACH that is still processing is not money received', async () => {
  const { handlePaymentProviderWebhook } = paymentsModule();
  const harness = webhookHarness();
  const body = sessionEvent('evt_d', { paid: false });
  await handlePaymentProviderWebhook(harness.context, 'prov_1', body, { 'stripe-signature': stripeSignature('whsec_x', body) });
  assert.equal(harness.row.status, 'authorized');
  assert.equal(harness.row.paidAt, null);
});

test('dispatcher: finite registry, projected provider, filtered headers, normalized errors', async () => {
  const { executeAdapterFunction, paymentAdapterPayload } = sandbox().load('features/keystone/utils/paymentProviderAdapter.ts');
  const payload = paymentAdapterPayload({ id: 'p', code: 'pp_x', credentials: { secretKey: 's' }, junk: 1 }, { headers: { cookie: 'session', 'stripe-signature': 'sig' }, payment: { id: 'x', lead: { email: 'private' } } });
  assert.deepEqual(plain(Object.keys(payload.headers)), ['stripe-signature']);
  assert.equal(payload.payment.lead, undefined);
  assert.equal(payload.provider.junk, undefined);
  await assert.rejects(executeAdapterFunction({ provider: { getPaymentStatusFunction: '../../etc/passwd' }, functionName: 'getPaymentStatusFunction', args: {} }), /Unknown registered payment adapter/);
  await assert.rejects(executeAdapterFunction({ provider: {}, functionName: 'eval', args: {} }), /Unknown payment adapter operation/);
});

test('refund: staff command refunds the unrefunded balance once, wired to the Payments page', () => {
  const source = fs.readFileSync(path.join(root, 'features/keystone/mutations/payments.ts'), 'utf8');
  const body = source.slice(source.indexOf('export async function refundPaymentCommand'), source.indexOf('// ── Webhook ingress'));
  assert.match(body, /payment\.status !== 'captured'/);
  assert.match(body, /const amount = payment\.amountMinor - \(payment\.refundedMinor \|\| 0\)/);
  assert.match(body, /idempotencyKey: `refund:\$\{payment\.id\}:\$\{amount\}`/);
  assert.match(body, /staffCan\(context, payment\.brokerage\.id/);
  const index = fs.readFileSync(path.join(root, 'features/keystone/mutations/index.ts'), 'utf8');
  assert.match(index, /refundPaymentCommand\(paymentId: ID!\): PaymentCommandResult!/);
  const page = fs.readFileSync(path.join(root, 'features/platform/payments/screens/PaymentsPage.tsx'), 'utf8');
  assert.match(page, /<RefundPaymentButton paymentId=\{payment\.id\} \/>/);
});
