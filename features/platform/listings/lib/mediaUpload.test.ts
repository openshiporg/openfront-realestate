import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mediaUploadProblem } from './mediaUpload'

const photo = { size: 300_000, type: 'image/jpeg' }

test('a photo upload is accepted without a link', () => {
  assert.equal(mediaUploadProblem({ file: photo, url: '', propertyId: 'p1' }), null)
})

test('only JPEG, PNG and WebP photos up to 8 MB are accepted', () => {
  assert.equal(mediaUploadProblem({ file: { size: 1000, type: 'image/gif' }, url: '', propertyId: 'p1' }), 'Upload a JPEG, PNG or WebP photo.')
  assert.equal(mediaUploadProblem({ file: { size: 9 * 1024 * 1024, type: 'image/png' }, url: '', propertyId: 'p1' }), 'Photos can be up to 8 MB.')
})

test('without a photo, an https link is required', () => {
  assert.equal(mediaUploadProblem({ file: null, url: '', propertyId: 'p1' }), 'Upload a photo or enter a link.')
  assert.equal(mediaUploadProblem({ file: null, url: 'http://x.example', propertyId: 'p1' }), 'Use an https:// link.')
  assert.equal(mediaUploadProblem({ file: null, url: 'https://tour.example/1', propertyId: 'p1' }), null)
})

test('a missing listing is refused', () => {
  assert.equal(mediaUploadProblem({ file: photo, url: '', propertyId: '' }), 'Listing not found.')
})
