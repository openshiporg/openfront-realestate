// Fable audit fixes (2026-11-17). Pure checks on the real source; no DB, network or env.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.resolve(root, relative), 'utf8');

function loadModels(relative) {
  const output = ts.transpileModule(read(relative), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const stub = new Proxy(() => stub, { get: () => stub, apply: () => stub });
  const fake = (name) => (config) => ({ __field: name, config });
  const mocks = {
    '@keystone-6/core': { list: (config) => config },
    '@keystone-6/core/fields': new Proxy({}, { get: (_t, name) => fake(name) }),
  };
  new Function('module', 'exports', 'require', output)(module, module.exports, (s) => mocks[s] ?? stub);
  return module.exports;
}

test('saving only the webhook secret keeps the stored secret key (#5)', () => {
  const { PaymentProvider } = loadModels('features/keystone/models/PaymentProvider.ts');
  const hook = PaymentProvider.fields.credentials.config.hooks.resolveInput;
  const merged = hook({ operation: 'update', resolvedData: { credentials: { webhookSecret: 'whsec_new' } }, item: { credentials: { secretKey: 'sk_test_old', webhookSecret: 'whsec_old' } } });
  assert.deepEqual(merged, { secretKey: 'sk_test_old', webhookSecret: 'whsec_new' });
  assert.deepEqual(hook({ operation: 'create', resolvedData: { credentials: { secretKey: 'sk_test_a' } }, item: undefined }), { secretKey: 'sk_test_a' });
  assert.equal(hook({ operation: 'update', resolvedData: {}, item: { credentials: { secretKey: 'x' } } }), undefined);
});

test('a checkout error leaves the payment payable unless the amount mismatched (#3) and never opens a second session (#9)', () => {
  const source = read('features/keystone/mutations/payments.ts');
  assert.match(source, /if \(mismatch\) await context\.sudo\(\)\.query\.Payment\.updateOne\(\{ where: \{ id: settled\.id \}, data: \{ status: 'unknown' \}/);
  assert.doesNotMatch(source, /fall through to a fresh session/);
});

test('managers keep control of a departed agent\'s showings; unchanged people are not re-checked on update (#4)', () => {
  const assoc = read('features/keystone/lib/showingAssociations.ts');
  assert.match(assoc, /activeShowingAgent\(context, header\.assignedAgent\?\.id \|\| null, brokerageId, Boolean\(session\.data\.role\.canManagePeople\)\)/);
  const hooks = read('features/keystone/lib/tenantOwnedHooks.ts');
  assert.match(hooks, /if \(operation === 'update' && !relationshipId\(inputData, field\) && !relationshipId\(resolvedData, field\)\) continue/);
});

test('inviting a member adds a missing role template from the setup seed (#8)', () => {
  const seed = JSON.parse(read('features/platform/onboarding/lib/seed.json'));
  for (const name of ['Brokerage Admin', 'Listing Agent', 'Brokerage Analyst']) {
    assert.ok(seed.sections.roles.items.find((item) => item.data?.name === name), name);
  }
  assert.match(read('features/keystone/mutations/operatorCommands.ts'), /if \(!roles\.length\) \{[\s\S]*?Role\.createOne\(\{ data: template/);
});

test('the unreachable PayPal adapter is gone (#10)', () => {
  assert.equal(fs.existsSync(path.resolve(root, 'features/integrations/payment/paypal.ts')), false);
  assert.doesNotMatch(read('features/integrations/payment/index.ts'), /paypal/);
});
