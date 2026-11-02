import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mediaSourceProblem, publicHeroImagePath, publicMediaImagePath } from './propertyMediaSource'
import { s3ForcePathStyle } from './s3-storage'

const legacy = (url?: string | null) => (url || '').startsWith('/images/real-estate/') ? url! : ''
const s3 = 'https://bucket.storageapi.dev/abc123.jpg?X-Amz-Signature=1'

test('a media item needs an uploaded image or a link', () => {
  assert.equal(mediaSourceProblem({ imageId: null, url: '' }), 'Upload a photo or enter a link.')
  assert.equal(mediaSourceProblem({ imageId: null, url: '   ' }), 'Upload a photo or enter a link.')
  assert.equal(mediaSourceProblem({ imageId: 'abc', url: '' }), null)
  assert.equal(mediaSourceProblem({ imageId: null, url: 'https://tour.example/1' }), null)
})

test('an uploaded S3 image is shown before the older link', () => {
  assert.equal(publicMediaImagePath({ image: { url: s3 }, url: '/images/real-estate/photos/a.jpg' }, legacy), s3)
})

test('without an upload the older /images/real-estate/ link still shows', () => {
  assert.equal(publicMediaImagePath({ image: null, url: '/images/real-estate/photos/a.jpg' }, legacy), '/images/real-estate/photos/a.jpg')
})

test('links that are not storefront photos and non-https uploads are not shown', () => {
  assert.equal(publicMediaImagePath({ image: null, url: 'https://elsewhere.example/a.jpg' }, legacy), '')
  assert.equal(publicMediaImagePath({ image: { url: 'javascript:alert(1)' }, url: '' }, legacy), '')
})

test('an uploaded cover photo leads the listing; otherwise its own image does', () => {
  const media = [
    { mediaType: 'photo', isHero: false, image: { url: 'https://b.storageapi.dev/side.jpg' } },
    { mediaType: 'photo', isHero: true, image: { url: s3 } },
  ]
  assert.equal(publicHeroImagePath(media, '/images/real-estate/photos/hero.jpg'), s3)
  assert.equal(publicHeroImagePath(media.slice(0, 1), '/images/real-estate/photos/hero.jpg'), '/images/real-estate/photos/hero.jpg')
  assert.equal(publicHeroImagePath([{ mediaType: 'floor_plan', isHero: true, image: { url: s3 } }], ''), '')
})

test('Railway buckets use virtual-hosted addressing; other endpoints stay path-style', () => {
  assert.equal(s3ForcePathStyle('https://storageapi.dev'), false)
  assert.equal(s3ForcePathStyle('https://t3.storageapi.dev'), false)
  assert.equal(s3ForcePathStyle('https://sfo3.digitaloceanspaces.com'), true)
  assert.equal(s3ForcePathStyle(undefined), true)
})
