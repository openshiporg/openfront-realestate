import { createHash } from 'node:crypto'

export type ListingBoardCursor = {
  id: string
  updatedAt: string
}

type EncodedListingBoardCursor = ListingBoardCursor & {
  version: 1
  fingerprint: string
}

export const INVALID_LISTING_CURSOR = 'Invalid, stale, or mismatched Listing page cursor.'

export function listingCursorFingerprint(binding: object): string {
  return createHash('sha256').update(JSON.stringify(binding)).digest('base64url')
}

export function encodeListingCursor(cursor: ListingBoardCursor, fingerprint: string): string {
  const date = new Date(cursor.updatedAt)
  if (!cursor.id || cursor.id.length > 200 || !Number.isFinite(date.getTime())) throw new Error(INVALID_LISTING_CURSOR)
  const payload: EncodedListingBoardCursor = { version: 1, id: cursor.id, updatedAt: date.toISOString(), fingerprint }
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

export function decodeListingCursor(value: unknown, expectedFingerprint: string): ListingBoardCursor | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return null

  try {
    const bytes = Buffer.from(value, 'base64url')
    if (bytes.toString('base64url') !== value) return null
    const payload: unknown = JSON.parse(bytes.toString('utf8'))
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null

    const candidate = payload as Partial<EncodedListingBoardCursor>
    if (candidate.version !== 1 || candidate.fingerprint !== expectedFingerprint) return null
    if (typeof candidate.id !== 'string' || candidate.id.length === 0 || candidate.id.length > 200) return null
    if (typeof candidate.updatedAt !== 'string') return null
    const date = new Date(candidate.updatedAt)
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== candidate.updatedAt) return null

    return { id: candidate.id, updatedAt: candidate.updatedAt }
  } catch {
    return null
  }
}
