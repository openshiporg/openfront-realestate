import { test } from 'node:test'
import assert from 'node:assert/strict'
import seed from '../../platform/onboarding/lib/seed.json'
import { applyCoreSeed, type SeedContext } from './seed-runtime'
import { DEFAULT_STORE_LOGO_COLOR, DEFAULT_STORE_LOGO_ICON } from '../../lib/store-logo'

function recordingContext() {
  const created: Record<string, Record<string, unknown>[]> = {}
  let next = 0
  const list = (key: string) => ({
    findMany: async () => [],
    createOne: async ({ data }: { data: Record<string, unknown> }) => { (created[key] ||= []).push(data); return { id: `${key}-${++next}` } },
    updateOne: async () => ({ id: 'brokerage-1' }),
  })
  const query = new Proxy({}, { get: (_t, key: string) => list(key) }) as SeedContext['query']
  return { context: { query } as SeedContext, created }
}

test('onboarding writes the brokerage logo mark and colour from seed.json', async () => {
  const settings = seed.sections.brokerageSettings.items[0].data as Record<string, unknown>
  assert.equal(typeof settings.logoIcon, 'string')
  assert.ok(String(settings.logoIcon).startsWith('<svg'))
  assert.equal(typeof settings.logoColor, 'string')

  for (const template of ['minimal', 'full'] as const) {
    const { context, created } = recordingContext()
    await applyCoreSeed(context, seed as any, { id: 'brokerage-1', slug: 'juniper' }, template)
    const [written] = created.BrokerageSettings
    assert.equal(written.logoIcon, settings.logoIcon, template)
    assert.equal(written.logoColor, settings.logoColor, template)
    assert.deepEqual(written.brokerage, { connect: { id: 'brokerage-1' } })
  }
})

test('the seeded mark is the platform placeholder, so the storefront shows the wordmark until the owner picks one', () => {
  const settings = seed.sections.brokerageSettings.items[0].data as Record<string, unknown>
  assert.equal(settings.logoIcon, DEFAULT_STORE_LOGO_ICON)
  assert.equal(settings.logoColor, DEFAULT_STORE_LOGO_COLOR)
})
