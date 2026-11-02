import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reviewedIso, sameReviewedVersion } from './reviewedVersion'

const stored = '2026-11-01T18:30:00.000Z'

test('the same instant in another ISO form is accepted', () => {
  for (const form of ['2026-11-01T18:30:00Z', '2026-11-01T18:30:00.000+00:00', '2026-11-01T12:30:00-06:00', new Date(stored), ` ${stored} `]) {
    assert.equal(sameReviewedVersion(stored, form), true, String(form))
  }
  assert.equal(sameReviewedVersion(new Date(stored), '2026-11-01T18:30:00+00:00'), true)
})

test('a real change after review is refused', () => {
  assert.equal(sameReviewedVersion(stored, '2026-11-01T18:30:00.001Z'), false)
  assert.equal(sameReviewedVersion('2026-11-01T18:31:12.400Z', stored), false)
})

test('missing or unreadable versions are refused, never treated as equal', () => {
  for (const bad of ['', 'not a date', null, undefined, 1730485800000, {}]) assert.equal(sameReviewedVersion(stored, bad), false, String(bad))
  assert.equal(sameReviewedVersion(null, null), false)
  assert.equal(sameReviewedVersion('garbage', 'garbage'), false)
})

test('the bound request form is canonical, so a retry in another form replays', () => {
  assert.equal(reviewedIso('2026-11-01T12:30:00-06:00'), stored)
  assert.equal(reviewedIso(new Date(stored)), stored)
  assert.equal(reviewedIso('nope'), null)
})
