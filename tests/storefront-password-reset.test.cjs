// Storefront password reset: with no mail transport (SMTP_HOST unset) every email gets the
// same plain answer and Keystone is never called. Same loader as shared-dashboard.test.cjs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function loadAccount({ env, keystoneClient }) {
  const cache = new Map();
  const mocks = {
    'next/headers': { cookies: async () => ({ get() {}, set() {}, delete() {} }) },
    'next/navigation': { redirect() {} },
    'next/cache': { revalidatePath() {} },
    '@/features/dashboard/lib/keystoneClient': { keystoneClient },
    '@/features/storefront/lib/brokerage': { getStorefrontBrokerageSlug: async () => 'qa' },
  };
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText;
    const module = { exports: {} };
    cache.set(filename, module);
    vm.runInNewContext(output, {
      module, exports: module.exports, process: { env }, console: { error() {}, warn() {}, log() {} },
      require(specifier) {
        if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
        if (specifier.startsWith('@/')) return load(path.join(root, `${specifier.slice(2)}.ts`));
        throw new Error(`Unmocked dependency: ${specifier}`);
      },
    }, { filename });
    return module.exports;
  }
  return load(path.join(root, 'features/storefront/lib/data/account.ts'));
}

function form(email) {
  return { get: (key) => (key === 'email' ? email : null) };
}

test('without SMTP_HOST the reset request answers plainly and never calls Keystone', async () => {
  let calls = 0;
  const account = loadAccount({ env: {}, keystoneClient: async () => { calls += 1; return { success: true, data: {} }; } });
  const known = await account.requestCustomerPasswordReset({ ok: false, message: '' }, form('buyer@example.test'));
  const unknown = await account.requestCustomerPasswordReset({ ok: false, message: '' }, form('nobody@example.test'));
  assert.equal(calls, 0);
  assert.equal(known.ok, false);
  assert.match(known.message, /not set up/);
  assert.equal(known.message, unknown.message);
});

test('with SMTP_HOST the reset request sends and returns the neutral message', async () => {
  let calls = 0;
  const account = loadAccount({ env: { SMTP_HOST: 'smtp.example.test' }, keystoneClient: async () => { calls += 1; return { success: false }; } });
  const result = await account.requestCustomerPasswordReset({ ok: false, message: '' }, form('buyer@example.test'));
  assert.equal(calls, 1);
  assert.equal(result.ok, true);
  assert.match(result.message, /If an account uses this email/);
});
