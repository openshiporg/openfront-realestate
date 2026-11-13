// Count-filter attack: for anonymous and each limited role, `<list>Count(where: <path> {field: {startsWith}})`
// must give the same count for a value that exists and one that does not, or an access error.
// Run on a scratch DB: DATABASE_URL=... SESSION_SECRET=... tsx --test tests/relation-filter-access.test.ts
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { getContext } from '@keystone-6/core/context'
import * as PrismaModule from '@prisma/client'
import config from '../features/keystone'

const ctx: any = getContext(config as any, PrismaModule as any)
const sudo = ctx.sudo()
const run = Date.now().toString(36)
const flags = (o: Record<string, boolean>) => ({ canAccessDashboard: true, ...o })
const roles: Record<string, Record<string, boolean>> = {
  admin: flags({ canSeeOtherPeople: true, canEditOtherPeople: true, canManagePeople: true, canManageRoles: true, canManageListings: true, canManageLeads: true, canManageShowings: true, canManageDeals: true, canViewReports: true }),
  agent: flags({ canManageListings: true, canManageLeads: true, canManageShowings: true, canManageDeals: true }),
  analyst: flags({ canViewReports: true }),
}
const sessions: Record<string, any> = {}
const ids: Record<string, string> = {}

before(async () => {
  const brokerage = await sudo.query.Brokerage.createOne({ data: { name: 'Flt Realty', slug: `flt-${run}`, status: 'active' }, query: 'id slug status' })
  const fake = (name: string) => ({ itemId: '', listKey: 'User', data: { name, role: null as any, activeBrokerage: brokerage, brokerageMemberships: [] as any[] } })
  for (const [name, f] of Object.entries(roles)) {
    const role = await sudo.query.Role.createOne({ data: { name: `Role ${name}`, ...f }, query: 'id name canSeeOtherPeople canEditOtherPeople canManagePeople canManageRoles canAccessDashboard canManageListings canManageLeads canManageShowings canManageDeals canViewReports canManageOnboarding' })
    const user = await sudo.query.User.createOne({ data: { name: `Zed ${name}`, email: `zed.${name}.${run}@example.com`, password: 'a-long-password-123', role: { connect: { id: role.id } }, activeBrokerage: { connect: { id: brokerage.id } } }, query: 'id' })
    const membership = await sudo.query.BrokerageMembership.createOne({ data: { membershipKey: `m-${name}-${run}`, brokerage: { connect: { id: brokerage.id } }, user: { connect: { id: user.id } }, membershipRole: name === 'admin' ? 'admin' : 'agent', status: 'active' }, query: 'id membershipRole status isPrimary brokerage { id slug status }' })
    const s = fake(name); s.itemId = user.id; s.data.role = role; s.data.brokerageMemberships = [membership]; sessions[name] = s
    ids[name] = user.id
  }
  if (process.env.WRITE_LOGINS) (await import('node:fs')).writeFileSync(process.env.WRITE_LOGINS, JSON.stringify({ roles: Object.keys(roles).map(n => ({ role: n, email: `zed.${n}.${run}@example.com`, password: 'a-long-password-123' })) }))
  const property = await sudo.query.Property.createOne({ data: { title: 'Secret Hall', slug: `secret-hall-${run}`, addressLine1: '1 Aardvark St', city: 'Aville', state: 'CA', brokerage: { connect: { id: brokerage.id } } }, query: 'id' })
  const lead = await sudo.query.Lead.createOne({ data: { name: 'Alice Hidden', email: 'alice.hidden@example.com', phone: '555-0100', brokerage: { connect: { id: brokerage.id } }, property: { connect: { id: property.id } } }, query: 'id' })
  await sudo.query.Showing.createOne({ data: { scheduledStart: new Date().toISOString(), notes: 'alpha notes', brokerage: { connect: { id: brokerage.id } }, property: { connect: { id: property.id } }, lead: { connect: { id: lead.id } } }, query: 'id' })
  await sudo.query.Deal.createOne({ data: { title: 'Alpha deal', notes: 'alpha deal notes', brokerage: { connect: { id: brokerage.id } }, property: { connect: { id: property.id } }, lead: { connect: { id: lead.id } } }, query: 'id' })
  const provider = await sudo.query.PaymentProvider.createOne({ data: { name: 'Stripe', code: `pp_stripe_${run}`, createPaymentFunction: 'x', capturePaymentFunction: 'x', refundPaymentFunction: 'x', getPaymentStatusFunction: 'x', generatePaymentLinkFunction: 'x', handleWebhookFunction: 'x', brokerage: { connect: { id: brokerage.id } } }, query: 'id' })
  await sudo.query.Payment.createOne({ data: { purpose: 'rent', amountMinor: 123456, payerEmail: 'alpha.payer@example.com', payerName: 'Alpha Payer', idempotencyKey: `k-${run}`, accessToken: `alpha-token-${run}`, paymentProvider: { connect: { id: provider.id } }, property: { connect: { id: property.id } }, lead: { connect: { id: lead.id } }, brokerage: { connect: { id: brokerage.id } } }, query: 'id' })
})

// Not probed: fields the role may legitimately read (payments for lead/deal managers, memberships and brokerage, its own role and brokerage).
// [list, path, field, existing prefix, missing prefix]
const probes: Array<[string, string, string, string, string]> = [
  ['Property', 'leads: { some: ', 'email', 'alice', 'zzz'],
  ['Property', 'assignedAgent: ', 'name', 'Zed', 'zzz'],
  ['Lead', 'property: ', 'title', 'Secret', 'zzz'],
  ['Lead', 'showings: { some: ', 'notes', 'alpha', 'zzz'],
  ['Lead', 'payments: { some: ', 'payerEmail', 'alpha', 'zzz'],
  ['Property', 'deals: { some: ', 'notes', 'alpha', 'zzz'],
  ['Property', 'showings: { some: ', 'notes', 'alpha', 'zzz'],
  ['Deal', 'payments: { some: ', 'payerEmail', 'alpha', 'zzz'],
  ['Payment', 'lead: ', 'email', 'alice', 'zzz'],
  ['Payment', '', 'accessToken', 'alpha', 'zzz'],
  ['Brokerage', 'leads: { some: ', 'email', 'alice', 'zzz'],
  ['Brokerage', 'deals: { some: ', 'notes', 'alpha', 'zzz'],
  ['Brokerage', 'activeUsers: { some: ', 'name', 'Zed', 'zzz'],
  ['Role', 'assignedTo: { some: ', 'name', 'Zed', 'zzz'],
  ['User', 'assignedLeads: { some: ', 'email', 'alice', 'zzz'],
  ['User', 'assignedDeals: { some: ', 'notes', 'alpha', 'zzz'],
  ['BrokerageMembership', 'user: ', 'name', 'Zed', 'zzz'],
  ['DomainAuditEvent', 'actor: ', 'name', 'Zed', 'zzz'],
  ['SavedProperty', 'property: ', 'title', 'Secret', 'zzz'],
  ['SavedProperty', 'user: ', 'name', 'Zed', 'zzz'],
  ['SavedSearch', 'user: ', 'name', 'Zed', 'zzz'],
  ['Showing', 'lead: ', 'email', 'alice', 'zzz'],
  ['Showing', 'customer: ', 'name', 'Zed', 'zzz'],
  ['Deal', 'lead: ', 'email', 'alice', 'zzz'],
]

async function count(who: string, [list, path, field, ok, no]: (typeof probes)[number], value: string) {
  const c = who === 'anonymous' ? ctx : ctx.withSession(sessions[who])
  const where = `{ ${path ? `${path}{ ${field}: { startsWith: "${value}" } }${path.includes('some') ? ' }' : ''}` : `${field}: { startsWith: "${value}" }`} }`
  const lc = list[0].toLowerCase() + list.slice(1)
  const plural = ({ Property: 'properties', SavedProperty: 'savedProperties', SavedSearch: 'savedSearches' } as Record<string, string>)[list] || `${lc}s`
  const res = await c.graphql.raw({ query: `query { ${plural}Count(where: ${where}) }` })
  if (process.env.DBG && res.errors?.length) console.log(who, list, path, field, '::', res.errors[0].message.slice(0, 130))
  return res.errors?.length ? `error` : String(res.data?.[`${plural}Count`])
}

for (const who of ['anonymous', 'agent', 'analyst']) {
  test(`${who}: relation/hidden-field filters leak no count difference`, async () => {
    const bad: string[] = []
    for (const p of probes) {
      const [hit, miss] = [await count(who, p, p[3]), await count(who, p, p[4])]
      if (hit !== miss) bad.push(`${p[0]}.${p[1]}${p[2]} hit=${hit} miss=${miss}`)
    }
    assert.deepEqual(bad, [])
  })
}

test('admin keeps its real filters', async () => {
  const hit = await count('admin', probes[0], 'alice')
  const miss = await count('admin', probes[0], 'zzz')
  assert.equal(hit, '1'); assert.equal(miss, '0')
  assert.equal(await count('admin', ['Lead', '', 'email', '', ''], 'alice'), '1')
})
