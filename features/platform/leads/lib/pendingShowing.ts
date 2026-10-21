import type { ScheduleShowingActionState, ScheduleShowingRequest } from './scheduleShowingFromLeadAction'
import { isOperatorViewer, type OperatorViewer } from './leadDetail'

export const PENDING_SHOWING_KEY = 'real-estate:pending-showing:v1'
export type PendingShowing = { version: 1; purpose: 'schedule_showing_for_lead'; viewer: OperatorViewer; request: ScheduleShowingRequest }
export type PendingStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export type PendingRead = { kind: 'empty' } | { kind: 'held' } | { kind: 'unavailable' } | { kind: 'owned'; pending: PendingShowing; bytes: string }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)) }
export function parsePendingShowing(bytes: string): PendingShowing | null {
  try {
    if (!bytes || bytes.length > 12_000) return null
    const value: unknown = JSON.parse(bytes)
    if (!record(value) || value.version !== 1 || value.purpose !== 'schedule_showing_for_lead' || !isOperatorViewer(value.viewer) || !record(value.request)) return null
    const request = value.request
    for (const field of ['leadId', 'propertyId', 'idempotencyKey', 'scheduledStart'] as const) if (typeof request[field] !== 'string' || !request[field] || request[field].length > 200) return null
    if (typeof request.notes !== 'string' || request.notes.length > 5000 || !(request.assignedAgentId === null || (typeof request.assignedAgentId === 'string' && request.assignedAgentId.length <= 200))
      || request.originalActorId !== value.viewer.actorId || request.originalBrokerageId !== value.viewer.brokerageId
      || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(String(request.idempotencyKey))
      || new Date(String(request.scheduledStart)).toISOString() !== request.scheduledStart) return null
    return value as PendingShowing
  } catch { return null }
}
export function readPendingShowing(storage: PendingStorage, viewer: OperatorViewer): PendingRead {
  try {
    const bytes = storage.getItem(PENDING_SHOWING_KEY)
    if (bytes === null) return { kind: 'empty' }
    const pending = parsePendingShowing(bytes)
    if (!pending || !isOperatorViewer(viewer) || pending.viewer.actorId !== viewer.actorId || pending.viewer.brokerageId !== viewer.brokerageId) return { kind: 'held' }
    return { kind: 'owned', pending, bytes }
  } catch { return { kind: 'unavailable' } }
}
type Dependencies = {
  storage: PendingStorage; viewer: OperatorViewer; changed?: () => void
  submit: (pending: PendingShowing) => Promise<ScheduleShowingActionState>
  verify: (pending: PendingShowing) => Promise<ScheduleShowingActionState>
}
const unavailable = (): ScheduleShowingActionState => ({ ok: false, uncertain: true, message: 'We couldn\u2019t confirm the showing request. Nothing new was sent.' })
async function finish(read: Extract<PendingRead, { kind: 'owned' }>, deps: Dependencies, verify: boolean) {
  let result: ScheduleShowingActionState
  try { result = await (verify ? deps.verify : deps.submit)(read.pending) } catch { return unavailable() }
  if (!result || typeof result.ok !== 'boolean' || typeof result.message !== 'string' || !result.message.trim()) return unavailable()
  // Only the server's exact owned-receipt confirmation releases this original attempt.
  if (result.ok && result.uncertain !== true) {
    try {
      if (deps.storage.getItem(PENDING_SHOWING_KEY) !== read.bytes) return unavailable()
      deps.storage.removeItem(PENDING_SHOWING_KEY)
      if (deps.storage.getItem(PENDING_SHOWING_KEY) !== null) return unavailable()
      deps.changed?.()
    } catch { return { ok: true, message: 'Showing confirmed. Refresh the page before scheduling another.' } }
  }
  return result
}
export async function submitNewPendingShowing(request: ScheduleShowingRequest, deps: Dependencies) {
  if (!isOperatorViewer(deps.viewer) || readPendingShowing(deps.storage, deps.viewer).kind !== 'empty') return unavailable()
  const pending: PendingShowing = { version: 1, purpose: 'schedule_showing_for_lead', viewer: deps.viewer, request: {
    ...request, originalActorId: deps.viewer.actorId, originalBrokerageId: deps.viewer.brokerageId,
  } }
  const bytes = JSON.stringify(pending)
  if (!parsePendingShowing(bytes)) return unavailable()
  try {
    deps.storage.setItem(PENDING_SHOWING_KEY, bytes)
    if (deps.storage.getItem(PENDING_SHOWING_KEY) !== bytes) return unavailable()
    deps.changed?.()
  } catch { return unavailable() }
  return finish({ kind: 'owned', pending, bytes }, deps, false)
}
/** Reload recovery uses original bytes. Explicit SAME retry never generates a key or edits its body. */
export async function recoverPendingShowing(deps: Dependencies, retrySame = false) {
  const read = readPendingShowing(deps.storage, deps.viewer)
  if (read.kind !== 'owned') return unavailable()
  return finish(read, deps, !retrySame)
}
