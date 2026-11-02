// Showing-request receipt email: once on success, never in a failed request, mail errors
// don't surface, replay doesn't resend, unconfigured is recorded as skipped. No DB/network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(relative, { env, mocks }) {
  const filename = path.resolve(root, relative);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    module, exports: module.exports, process: { env }, console: { warn() {}, error() {}, log() {} }, Intl, Date, Promise,
    require: (spec) => { if (Object.hasOwn(mocks, spec)) return mocks[spec]; throw new Error(`Unmocked dependency: ${spec}`); },
  }, { filename });
  return module.exports;
}

const receipt = { showingId: 'sh1', brokerageId: 'b1', brokerageName: 'Harbor Realty', to: 'buyer@mail.test', propertyTitle: 'Riverfront Loft', address: '1 River St, Austin, TX', requestedStart: '2027-01-15T16:00:00.000Z', timeZone: 'America/Chicago', showingType: 'in_person', listingUrl: 'https://shop.test/listings/loft' };

function fakeSudo() {
  const rows = new Map();
  return {
    rows,
    query: { DomainAuditEvent: {
      async createOne({ data }) { if (rows.has(data.eventKey)) throw new Error('unique'); rows.set(data.eventKey, { id: data.eventKey, ...data }); return { id: data.eventKey }; },
      async findOne({ where }) { return rows.has(where.eventKey) ? { id: where.eventKey } : null; },
      async updateOne({ where, data }) { Object.assign(rows.get(where.id), data); return { id: where.id }; },
    } },
  };
}

function setup({ env, send }) {
  const sent = [];
  const mail = { sendShowingRequestEmail: async (to, d) => { sent.push({ to, d }); return send ? send() : { sent: true }; } };
  const mod = load('features/keystone/lib/showingRequestEmail.ts', { env, mocks: { './mail': mail } });
  return { mod, sent };
}
const configured = { SMTP_HOST: 'smtp.test', SMTP_FROM: 'a@b.test' };

test('sends once and records sent; replay does not resend', async () => {
  const { mod, sent } = setup({ env: configured });
  const sudo = fakeSudo();
  await mod.deliverShowingRequestEmail(sudo, receipt);
  await mod.deliverShowingRequestEmail(sudo, receipt);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].d.url, 'https://shop.test/listings/loft');
  assert.match(sent[0].d.whenLabel, /10:00 AM CST/);
  assert.equal(sudo.rows.get('showing-request-email:sh1').afterState.status, 'sent');
});

test('a mail throw or failure is recorded and never surfaces', async () => {
  const { mod } = setup({ env: configured, send: () => { throw new Error('boom'); } });
  const sudo = fakeSudo();
  await assert.doesNotReject(mod.deliverShowingRequestEmail(sudo, receipt));
  assert.equal(sudo.rows.get('showing-request-email:sh1').afterState.status, 'failed');
  const failed = setup({ env: configured, send: () => ({ sent: false, error: 'rejected' }) });
  const sudo2 = fakeSudo();
  await failed.mod.deliverShowingRequestEmail(sudo2, receipt);
  assert.equal(sudo2.rows.get('showing-request-email:sh1').afterState.error, 'rejected');
});

test('unconfigured mail is recorded as skipped_not_configured', async () => {
  const { mod, sent } = setup({ env: {} });
  const sudo = fakeSudo();
  await mod.deliverShowingRequestEmail(sudo, receipt);
  assert.equal(sent.length, 0);
  assert.equal(sudo.rows.get('showing-request-email:sh1').afterState.status, 'skipped_not_configured');
});

test('the request mutation sends only after the transaction and only when ok', () => {
  const source = fs.readFileSync(path.join(root, 'features/keystone/mutations/requestPropertyShowing.ts'), 'utf8');
  const txEnd = source.indexOf("}, { timeout: 30_000 })");
  const send = source.indexOf('deliverShowingRequestEmail');
  assert.ok(txEnd > 0 && send > txEnd, 'email is delivered after context.transaction returns');
  assert.match(source, /if \(receipt && outcome\?\.ok\)/);
  assert.match(source, /import\('\.\.\/lib\/showingRequestEmail'\)/);
});
