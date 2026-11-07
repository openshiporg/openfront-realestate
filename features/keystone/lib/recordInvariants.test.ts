import assert from 'node:assert/strict'
import test from 'node:test'

import { agentNetMinor, commissionSplit, moneyOrder, timeOrder, withDerivedCommissionNet, withRecordInvariants } from './recordInvariants'

async function run(hooks: any, args: any) {
  const errors: string[] = []
  const resolved = hooks.resolveInput ? await hooks.resolveInput({ ...args, resolvedData: args.resolvedData }) : args.resolvedData
  await hooks.validateInput({ ...args, resolvedData: resolved, addValidationError: (message: string) => errors.push(message) })
  return { errors, resolved }
}

test('money order compares the record after the write', async () => {
  const hooks = withRecordInvariants({}, [moneyOrder('budgetMin', 'budgetMax', 'min > max')])
  assert.deepEqual((await run(hooks, { operation: 'create', resolvedData: { budgetMin: 50_000_00n, budgetMax: 40_000_00n } })).errors, ['min > max'])
  assert.deepEqual((await run(hooks, { operation: 'update', item: { budgetMin: 10n, budgetMax: 20n }, resolvedData: { budgetMin: 30n } })).errors, ['min > max'])
  assert.deepEqual((await run(hooks, { operation: 'update', item: { budgetMin: 10n, budgetMax: 20n }, resolvedData: { budgetMax: null } })).errors, [])
})

test('time order rejects an end at or before the start', () => {
  const rule = timeOrder('startsAt', 'endsAt', 'bad')
  assert.equal(rule({ startsAt: new Date('2026-11-08T15:00:00Z'), endsAt: new Date('2026-11-08T15:00:00Z') }, 'create'), 'bad')
  assert.equal(rule({ startsAt: '2026-11-08T15:00:00Z', endsAt: '2026-11-08T17:00:00Z' }, 'create'), null)
})

test('commission split stays within 100 percent and net within gross', () => {
  assert.match(String(commissionSplit({ brokerageSplitPercent: '40.00', agentSplitPercent: '70.00' }, 'create')), /more than 100/)
  assert.match(String(commissionSplit({ agentSplitPercent: '-5' }, 'create')), /between 0 and 100/)
  assert.match(String(commissionSplit({ grossCommission: 100n, netCommission: 101n }, 'create')), /Net commission/)
  assert.equal(commissionSplit({ brokerageSplitPercent: '30.00', agentSplitPercent: '70.00', grossCommission: 2_730_000n, netCommission: 1_911_000n }, 'create'), null)
})

test('commission net is derived from gross and agent split, rounded half up', async () => {
  assert.equal(agentNetMinor(2_730_000n, '70.00'), 1_911_000n)
  assert.equal(agentNetMinor(1n, '50'), 1n)
  assert.equal(agentNetMinor(100n, ''), null)
  const hooks = withDerivedCommissionNet({})
  const derived = await run(hooks, { operation: 'create', inputData: {}, resolvedData: { grossCommission: 1_000_000n, agentSplitPercent: '65.5' } })
  assert.equal(derived.resolved.netCommission, 655_000n)
  const wrong = await run(hooks, { operation: 'create', inputData: { netCommission: '9000.00' }, resolvedData: { grossCommission: 1_000_000n, agentSplitPercent: '65.5', netCommission: 900_000n } })
  assert.deepEqual(wrong.errors, ['Net commission must equal the gross commission times the agent split.'])
})
