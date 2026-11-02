import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planShowingReschedule } from './showingReschedule'

const now = Date.parse('2026-11-01T18:00:00.000Z')
const open = { status: 'scheduled', scheduledStart: '2026-11-03T15:00:00.000Z', scheduledEnd: '2026-11-03T15:45:00.000Z' }

test('moves an open showing and keeps its length', () => {
  const plan = planShowingReschedule(open, '2026-11-04T17:30:00.000Z', now)
  assert.deepEqual(plan, { ok: true, scheduledStart: '2026-11-04T17:30:00.000Z', scheduledEnd: '2026-11-04T18:15:00.000Z', durationMinutes: 45 })
})

test('a requested showing can be moved before it is confirmed', () => {
  const plan = planShowingReschedule({ ...open, status: 'requested' }, '2026-11-05T16:00:00.000Z', now)
  assert.equal(plan.ok, true)
})

test('a showing with no end gets one hour', () => {
  const plan = planShowingReschedule({ ...open, scheduledEnd: null }, '2026-11-04T17:00:00.000Z', now)
  assert.equal(plan.ok && plan.scheduledEnd, '2026-11-04T18:00:00.000Z')
})

test('closed showings stay where they are', () => {
  for (const status of ['completed', 'cancelled', 'no_show']) {
    const plan = planShowingReschedule({ ...open, status }, '2026-11-04T17:00:00.000Z', now)
    assert.equal(plan.ok, false, status)
  }
})

test('the new time must be in the future, within a year, and different', () => {
  assert.equal(planShowingReschedule(open, '2026-10-31T17:00:00.000Z', now).ok, false)
  assert.equal(planShowingReschedule(open, '2028-01-01T17:00:00.000Z', now).ok, false)
  assert.equal(planShowingReschedule(open, 'not a date', now).ok, false)
  const same = planShowingReschedule(open, open.scheduledStart, now)
  assert.deepEqual(same, { ok: false, message: 'Choose a different time to reschedule.' })
})
