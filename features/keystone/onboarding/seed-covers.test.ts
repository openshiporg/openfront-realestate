import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import path from 'node:path'
import seed from '../../platform/onboarding/lib/seed.json'
import { applySeedCovers, COVER_PHOTO_DIR, fileUpload } from './seed-covers'
import type { SeedContext } from './seed-runtime'

const target = { id: 'b1', slug: 'juniper' }

function fakeContext({ heroFor = new Set<string>(), failUpload = false } = {}) {
  const created: any[] = []
  const query: any = {
    Property: { findMany: async ({ where }: any) => [{ id: `p-${where.slug.equals}` }], createOne: async () => ({ id: '' }) },
    PropertyMedia: {
      findMany: async ({ where }: any) => heroFor.has(where.property.id.equals) ? [{ id: 'existing' }] : [],
      createOne: async ({ data }: any) => { if (failUpload) throw new Error('storage down'); created.push(data); return { id: `m${created.length}` } },
    },
  }
  return { context: { query } as SeedContext, created }
}

test('every seeded listing has a cover photo in the repo, outside /public', () => {
  const slugs = seed.sections.properties.items.map(item => item.data.slug)
  assert.deepEqual(seed.imagePack.properties.map(item => item.key).sort(), [...slugs].sort())
  for (const cover of seed.imagePack.properties) {
    assert.ok(existsSync(path.join(COVER_PHOTO_DIR, cover.photo)), cover.photo)
    assert.ok(!existsSync(path.join(process.cwd(), 'public/images/real-estate/photos', cover.photo)), `${cover.photo} is still in /public`)
  }
  for (const item of seed.sections.properties.items) assert.equal((item.data as any).primaryImageUrl, undefined)
})

test('setup uploads one cover per chosen listing as the hero photo', async () => {
  const { context, created } = fakeContext()
  const result = await applySeedCovers(context, seed.imagePack.properties, new Set(['riverfront-loft-austin']), target, { upload: file => ({ file }) })
  assert.deepEqual(result, { created: 1, skipped: 0, total: 1, missing: [] })
  assert.equal(created[0].isHero, true)
  assert.equal(created[0].mediaType, 'photo')
  assert.deepEqual(created[0].property, { connect: { id: 'p-riverfront-loft-austin' } })
  assert.equal(path.basename(created[0].image.upload.file), 'riverfront-loft-austin.jpg')
  assert.ok(created[0].altText)
})

test('a listing that already has a cover keeps it (setup can be run again)', async () => {
  const { context, created } = fakeContext({ heroFor: new Set(['p-hill-country-estate']) })
  const result = await applySeedCovers(context, seed.imagePack.properties, new Set(['hill-country-estate', 'mueller-bungalow']), target, { upload: file => ({ file }) })
  assert.equal(result.skipped, 1)
  assert.equal(result.created, 1)
  assert.equal(created.length, 1)
})

test('storage trouble is reported, not fatal, so setup still finishes', async () => {
  const { context } = fakeContext({ failUpload: true })
  const result = await applySeedCovers(context, seed.imagePack.properties, new Set(['eastside-townhome-rental']), target, { upload: file => ({ file }) })
  assert.deepEqual(result.missing, ['eastside-townhome-rental'])
})

test('the upload resolves like a multipart file for the image field', async () => {
  const upload: any = fileUpload(path.join(COVER_PHOTO_DIR, 'mueller-bungalow.jpg'))
  const file = await upload.promise
  assert.equal(file.filename, 'mueller-bungalow.jpg')
  assert.equal(file.mimetype, 'image/jpeg')
  const chunks: Buffer[] = []
  for await (const chunk of file.createReadStream()) chunks.push(chunk)
  assert.ok(Buffer.concat(chunks).length > 100_000)
})
