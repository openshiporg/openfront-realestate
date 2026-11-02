import { test } from 'node:test'
import assert from 'node:assert/strict'
import { auditableInput } from './tenantOwnedHooks'
import { normalizeDomainJson } from './domainEvents'

class FileUpload { createReadStream() { return null } }

test('an image upload is recorded as a marker, not the upload stream', () => {
  const input = { title: 'Kitchen', image: { upload: Promise.resolve(new FileUpload()) }, property: { connect: { id: 'p1' } } }
  // The raw input can't be stored as a domain event.
  assert.throws(() => normalizeDomainJson(input))
  const audited = auditableInput(input)
  assert.deepEqual(audited, { title: 'Kitchen', image: { upload: 'file' }, property: { connect: { id: 'p1' } } })
  assert.doesNotThrow(() => normalizeDomainJson(audited))
})

test('input without uploads is kept as it was', () => {
  const input = { title: 'Kitchen', url: 'https://tour.example/1', sortOrder: 2 }
  assert.deepEqual(auditableInput(input), input)
  assert.equal(auditableInput(null), null)
})
