import { domainPayloadHash } from './domainEvents'

export type LeadCursor = { id: string; at: string }
export const INVALID_LEAD_CURSOR = 'Invalid, stale, or mismatched Lead page cursor.'
export function leadCursorBinding(scope: object) { return domainPayloadHash(scope) }
export function encodeLeadCursor(row: LeadCursor, binding: string) {
  if (!row.id || row.id.length > 200 || !Number.isFinite(new Date(row.at).getTime())) throw new Error(INVALID_LEAD_CURSOR)
  return Buffer.from(JSON.stringify({ version: 1, ...row, binding }), 'utf8').toString('base64url')
}
export function decodeLeadCursor(value: unknown, binding: string): LeadCursor {
  try {
    if (typeof value !== 'string' || !value || value.length > 2048) throw new Error()
    const bytes = Buffer.from(value, 'base64url')
    if (bytes.toString('base64url') !== value) throw new Error()
    const parsed: unknown = JSON.parse(bytes.toString('utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
    const row = parsed as { version?: unknown; binding?: unknown; id?: unknown; at?: unknown }
    if (row.version !== 1 || row.binding !== binding || typeof row.id !== 'string' || !row.id || row.id.length > 200
      || typeof row.at !== 'string' || new Date(row.at).toISOString() !== row.at) throw new Error()
    return { id: row.id, at: row.at }
  } catch { throw new Error(INVALID_LEAD_CURSOR) }
}
