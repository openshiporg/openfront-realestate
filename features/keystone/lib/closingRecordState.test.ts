import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ESCROW_TRANSITIONS, MORTGAGE_TRANSITIONS, TITLE_ORDER_TRANSITIONS, canTransition, guardStatusField } from './closingRecordState'

test('terminal escrow and clear title cannot be reopened', () => {
  assert.equal(canTransition(ESCROW_TRANSITIONS, 'closed', 'opened'), false)
  assert.equal(canTransition(ESCROW_TRANSITIONS, 'cancelled', 'closed'), false)
  assert.equal(canTransition(TITLE_ORDER_TRANSITIONS, 'clear', 'exception'), false)
  assert.equal(canTransition(MORTGAGE_TRANSITIONS, 'approved', 'denied'), false)
  assert.equal(canTransition(MORTGAGE_TRANSITIONS, 'started', 'approved'), false)
})
test('forward moves and same-status writes are allowed', () => {
  assert.equal(canTransition(ESCROW_TRANSITIONS, 'opened', 'closed'), true)
  assert.equal(canTransition(MORTGAGE_TRANSITIONS, 'underwriting', 'approved'), true)
  assert.equal(canTransition(TITLE_ORDER_TRANSITIONS, 'exception', 'clear'), true)
  assert.equal(canTransition(ESCROW_TRANSITIONS, 'closed', 'closed'), true)
})
test('hook rejects illegal update and stamps completion once', async () => {
  const hooks = guardStatusField({}, ESCROW_TRANSITIONS, 'escrow', { closed: 'closedAt' })
  const errors: string[] = []
  await (hooks as any).validateInput({ operation: 'update', item: { status: 'closed' }, resolvedData: { status: 'opened' }, addValidationError: (m: string) => errors.push(m) })
  assert.equal(errors.length, 1)
  const stamped = await (hooks as any).resolveInput({ operation: 'update', item: { status: 'opened', closedAt: null }, resolvedData: { status: 'closed' } })
  assert.ok(stamped.closedAt instanceof Date)
  const kept = await (hooks as any).resolveInput({ operation: 'update', item: { status: 'opened', closedAt: new Date(1) }, resolvedData: { status: 'closed' } })
  assert.equal(kept.closedAt, undefined)
})
