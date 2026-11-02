import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyShowingRescheduleResponse, SHOWING_RESCHEDULE_UNCONFIRMED } from './showingActionFeedback'

const wrap = (row: unknown) => ({ success: true, data: { rescheduleShowingCommand: row } })

test('a confirmed reschedule reports success', () => {
  assert.deepEqual(classifyShowingRescheduleResponse(wrap({ ok: true, message: 'Showing rescheduled.', itemId: 's1', replayed: false }), 's1'), { ok: true, message: 'Showing rescheduled.' })
})

test('a refused reschedule shows the reason', () => {
  assert.deepEqual(classifyShowingRescheduleResponse(wrap({ ok: false, message: 'Choose a different time to reschedule.', itemId: 's1', replayed: false }), 's1'), { ok: false, message: 'Choose a different time to reschedule.' })
})

test('a lost or mismatched response asks for a refresh instead of a retry', () => {
  for (const response of [null, { success: false }, wrap({ ok: true, message: 'x', itemId: 'other', replayed: false })]) {
    assert.deepEqual(classifyShowingRescheduleResponse(response, 's1'), { ok: false, uncertain: true, message: SHOWING_RESCHEDULE_UNCONFIRMED })
  }
})
