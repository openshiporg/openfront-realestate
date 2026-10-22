'use client'

import { useId, useState, useSyncExternalStore } from 'react'
import { localDateTimeToIso } from '@/features/lib/date-time'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { pillClass, trackClass } from '../../components/styles'
import { submitRetainedShowing, verifyRetainedShowing, type LeadQuickActionState } from '../actions/leads'
import { PENDING_SHOWING_KEY, parsePendingShowing, recoverPendingShowing, submitNewPendingShowing, type PendingShowing } from '../lib/pendingShowing'
import type { OperatorViewer } from '../lib/leadDetail'

const EVENT = 'real-estate-pending-showing-change'
function subscribe(listener: () => void) {
  window.addEventListener(EVENT, listener)
  window.addEventListener('storage', listener)
  return () => { window.removeEventListener(EVENT, listener); window.removeEventListener('storage', listener) }
}
// No pending request is assumed when storage cannot be read; saving a new request then fails safely.
function snapshot() { try { return window.sessionStorage.getItem(PENDING_SHOWING_KEY) } catch { return null } }
function serverSnapshot() { return null }
function changed() { window.dispatchEvent(new Event(EVENT)) }
function dependencies(viewer: OperatorViewer) {
  return { viewer, storage: window.sessionStorage, changed,
    submit: (pending: PendingShowing) => submitRetainedShowing(JSON.stringify(pending)),
    verify: (pending: PendingShowing) => verifyRetainedShowing(JSON.stringify(pending)),
  }
}
function messageTone(state: LeadQuickActionState) {
  return state.uncertain ? 'text-amber-700 dark:text-amber-400' : state.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'
}

export function OriginalShowingRecovery({ viewer }: { viewer: OperatorViewer }) {
  const bytes = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  const [state, setState] = useState<LeadQuickActionState>({ ok: false, message: '' })
  const [busy, setBusy] = useState(false)
  if (bytes === null) return state.message ? <p role="status" className={`rounded-lg border border-border bg-card p-4 text-sm ${messageTone(state)}`}>{state.message}</p> : null
  const saved = parsePendingShowing(bytes)
  const owned = saved?.viewer.actorId === viewer.actorId && saved?.viewer.brokerageId === viewer.brokerageId
  async function recover(retrySame: boolean) {
    setBusy(true)
    try { setState(await recoverPendingShowing(dependencies(viewer), retrySame)) }
    catch { setState({ ok: false, uncertain: true, message: 'We couldn’t check the showing request. Nothing new was sent.' }) }
    finally { setBusy(false) }
  }
  return (
    <section className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30" aria-label="Unconfirmed showing request">
      <h2 className="text-sm font-semibold text-foreground">Showing request not confirmed</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {owned
          ? 'A showing request you sent earlier hasn’t been confirmed. Check its status or send it again before scheduling another.'
          : 'An earlier showing request on this browser hasn’t been confirmed. Sign in with the account that sent it to resolve it.'}
      </p>
      {owned ? (
        <div className={`mt-3 ${trackClass}`}>
          <Button type="button" variant="ghost" size="sm" className={pillClass} disabled={busy} onClick={() => recover(false)}>Check status</Button>
          <Button type="button" variant="ghost" size="sm" className={pillClass} disabled={busy} onClick={() => recover(true)}>Send again</Button>
        </div>
      ) : null}
      {state.message ? <p role="status" className={`mt-3 text-sm ${messageTone(state)}`}>{state.message}</p> : null}
    </section>
  )
}

export function ScheduleShowingForm({ leadId, propertyId, assignedAgentId, viewer }: {
  leadId: string; propertyId?: string; assignedAgentId?: string; viewer: OperatorViewer
}) {
  const bytes = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  const [state, setState] = useState<LeadQuickActionState>({ ok: false, message: '' })
  const [busy, setBusy] = useState(false)
  const id = useId()
  const blocked = busy || bytes !== null || !propertyId
  return (
    <form onSubmit={async event => {
      event.preventDefault()
      if (busy || bytes !== null || !propertyId) return
      const form = new FormData(event.currentTarget)
      setBusy(true)
      try {
        setState(await submitNewPendingShowing({ leadId, propertyId, assignedAgentId: assignedAgentId || null,
          scheduledStart: localDateTimeToIso(String(form.get('scheduledStart') || '')), notes: String(form.get('notes') || ''), idempotencyKey: crypto.randomUUID(),
        }, dependencies(viewer)))
      } catch { setState({ ok: false, uncertain: true, message: 'We couldn’t confirm the showing request. Refresh the page to check before trying again.' }) }
      finally { setBusy(false) }
    }} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-start`}>Showing time</Label>
        <Input id={`${id}-start`} name="scheduledStart" type="datetime-local" required disabled={blocked} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-notes`}>Notes</Label>
        <Textarea id={`${id}-notes`} name="notes" rows={2} disabled={blocked} />
      </div>
      {!propertyId ? <p className="text-xs text-muted-foreground">No listing on this lead</p> : null}
      <Button type="submit" size="sm" className="w-full rounded-full" disabled={blocked}>{busy ? 'Scheduling…' : bytes !== null ? 'Earlier request unresolved' : 'Schedule showing'}</Button>
      {state.message ? <p role="status" className={`text-xs ${messageTone(state)}`}>{state.message}</p> : null}
    </form>
  )
}
