import { test } from 'node:test'
import assert from 'node:assert/strict'
import { customerShowingTime } from './showing-time'

test('an unmoved showing shows the time the buyer asked for', () => {
  assert.deepEqual(customerShowingTime({ scheduledStart: '2026-11-03T15:00:00.000Z', requestedStart: '2026-11-03T15:00:00.000Z' }), { start: '2026-11-03T15:00:00.000Z', movedFrom: null })
})

test('a rescheduled showing shows the new time and where it moved from', () => {
  assert.deepEqual(customerShowingTime({ scheduledStart: '2026-11-04T17:30:00.000Z', requestedStart: '2026-11-03T15:00:00.000Z' }), { start: '2026-11-04T17:30:00.000Z', movedFrom: '2026-11-03T15:00:00.000Z' })
})

test('a missing current time falls back to the request', () => {
  assert.deepEqual(customerShowingTime({ scheduledStart: '', requestedStart: '2026-11-03T15:00:00.000Z' }), { start: '2026-11-03T15:00:00.000Z', movedFrom: null })
})
