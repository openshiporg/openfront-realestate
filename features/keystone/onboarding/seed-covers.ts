import { createReadStream, existsSync } from 'node:fs'
import path from 'node:path'
// The same module the Upload scalar checks with instanceof, so the image field accepts it.
// @ts-ignore graphql-upload ships CommonJS without types for this path
import Upload from 'graphql-upload/Upload.js'
import type { SeedContext, SeedTarget } from './seed-runtime'

export type CoverPhoto = { key: string; photo: string; title: string; altText: string }

/** Starter cover photos live in public/ (so they ship in the deployed build) and are uploaded to image storage on setup. */
export const COVER_PHOTO_DIR = path.join(process.cwd(), 'public/images/real-estate/covers')

const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

/** An upload the image field reads exactly like one sent from the admin's Add media form. */
export function fileUpload(filePath: string) {
  const upload = new Upload()
  const filename = path.basename(filePath)
  upload.resolve({
    filename,
    mimetype: MIME[path.extname(filename).toLowerCase()] || 'application/octet-stream',
    encoding: '7bit',
    createReadStream: () => createReadStream(/*turbopackIgnore: true*/ filePath),
  })
  return upload
}

type CoverResult = { created: number; skipped: number; total: number; missing: string[] }

/**
 * Give each seeded listing an uploaded cover photo. Insert-only: a listing that already has a
 * cover keeps it. A photo that can't be read or stored is reported, not fatal, so setup still
 * finishes (the listing shows without a photo until one is added in the admin).
 */
export async function applySeedCovers(
  context: SeedContext,
  covers: readonly CoverPhoto[],
  propertySlugs: ReadonlySet<string>,
  target: SeedTarget,
  { upload = fileUpload }: { upload?: (filePath: string) => unknown } = {},
): Promise<CoverResult> {
  const properties = context.query.Property, media = context.query.PropertyMedia
  if (!properties || !media) throw new Error('Cover photos need the Property and PropertyMedia lists.')
  const result: CoverResult = { created: 0, skipped: 0, total: 0, missing: [] }
  for (const cover of covers.filter(item => propertySlugs.has(item.key))) {
    result.total += 1
    const [property] = await properties.findMany({ where: { slug: { equals: cover.key }, brokerage: { id: { equals: target.id } } }, take: 1, query: 'id' })
    if (!property?.id) { result.missing.push(cover.key); continue }
    const existing = await media.findMany({ where: { property: { id: { equals: property.id } }, isHero: { equals: true } }, take: 1, query: 'id' })
    if (existing[0]?.id) { result.skipped += 1; continue }
    const file = path.join(COVER_PHOTO_DIR, path.basename(cover.photo))
    if (!existsSync(file)) { result.missing.push(cover.key); continue }
    try {
      await media.createOne({
        data: { property: { connect: { id: property.id } }, title: cover.title, altText: cover.altText, mediaType: 'photo', isHero: true, sortOrder: 0, image: { upload: upload(file) } },
        query: 'id',
      })
      result.created += 1
    } catch {
      result.missing.push(cover.key)
    }
  }
  return result
}
