import { test } from 'node:test'
import assert from 'node:assert/strict'
import { plural } from './plural'

test('one is singular, everything else is plural', () => {
  assert.equal(plural(1, 'deal'), '1 deal')
  assert.equal(plural(0, 'deal'), '0 deals')
  assert.equal(plural(2, 'listing'), '2 listings')
  assert.equal(plural(1, 'person', 'people'), '1 person')
  assert.equal(plural(3, 'person', 'people'), '3 people')
})
