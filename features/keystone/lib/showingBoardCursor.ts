import { createHash } from 'node:crypto'

export type ShowingBoardCursor = {
  id: string
  scheduledStart: string
}

type EncodedShowingBoardCursor = ShowingBoardCursor & {
  version: 1
  fingerprint: string
}

export const INVALID_SHOWING_CURSOR = 'Invalid, stale, or mismatched Showing page cursor.'

export function showingCursorFingerprint(binding: object): string {
  return createHash('sha256').update(JSON.stringify(binding)).digest('base64url')
}

export function encodeShowingCursor(cursor: ShowingBoardCursor, fingerprint: string): string {
  const payload: EncodedShowingBoardCursor = { version: 1, ...cursor, fingerprint }
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

export function decodeShowingCursor(value: unknown, expectedFingerprint: string): ShowingBoardCursor | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return null

  try {
    const bytes = Buffer.from(value, 'base64url')
    if (bytes.toString('base64url') !== value) return null
    const payload: unknown = JSON.parse(bytes.toString('utf8'))
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null

    const candidate = payload as Partial<EncodedShowingBoardCursor>
    if (candidate.version !== 1 || candidate.fingerprint !== expectedFingerprint) return null
    if (typeof candidate.id !== 'string' || candidate.id.length === 0 || candidate.id.length > 200) return null
    if (typeof candidate.scheduledStart !== 'string') return null
    const date = new Date(candidate.scheduledStart)
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== candidate.scheduledStart) return null

    return { id: candidate.id, scheduledStart: candidate.scheduledStart }
  } catch {
    return null
  }
}
