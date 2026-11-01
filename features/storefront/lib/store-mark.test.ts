import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_STORE_LOGO_ICON } from '../../lib/store-logo'
import { storeOwnMark } from './store-mark'

test('no saved mark means wordmark only', () => {
  assert.equal(storeOwnMark(null), '')
  assert.equal(storeOwnMark(undefined), '')
  assert.equal(storeOwnMark('   '), '')
})

test("the platform placeholder saved by onboarding is not the store's mark", () => {
  assert.equal(storeOwnMark(DEFAULT_STORE_LOGO_ICON), '')
  assert.equal(storeOwnMark(`  ${DEFAULT_STORE_LOGO_ICON}\n`), '')
})

test('a mark set in Store Settings still shows', () => {
  const roof = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#14532d" d="M3 11 12 4l9 7v9H3z"/></svg>'
  const out = storeOwnMark(roof)
  assert.match(out, /^<svg/)
  assert.match(out, /M3 11 12 4l9 7v9H3z/)
})
