'use client'

import { useActionState, useEffect, useId } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { addShowingFeedback, updateShowingStatus, type ShowingActionState } from '../actions/showings'

const initialState: ShowingActionState = { ok: false, message: '' }

function useResultToast(state: ShowingActionState) {
  useEffect(() => {
    if (!state.message || state.uncertain) return
    if (state.ok) toast.success(state.message)
    else toast.error(state.message)
  }, [state])
}

function UncertainNote({ state }: { state: ShowingActionState }) {
  return state.uncertain && state.message ? <p role="status" className="text-xs text-amber-700 dark:text-amber-400">{state.message}</p> : null
}

export function ShowingStatusButton({ showingId, leadId, status, label, expectedStatus, expectedUpdatedAt, expectedRevision }: { showingId: string; leadId?: string; status: string; label: string; expectedStatus: string; expectedUpdatedAt: string; expectedRevision: string }) {
  const [state, action, pending] = useActionState(updateShowingStatus, initialState)
  useResultToast(state)

  return (
    <form action={action} className="inline-flex flex-col gap-1">
      <input type="hidden" name="showingId" value={showingId} />
      <input type="hidden" name="leadId" value={leadId || ''} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="expectedRevision" value={expectedRevision} />
      <input type="hidden" name="expectedStatus" value={expectedStatus} />
      <input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} />
      <Button type="submit" variant={status === 'scheduled' ? 'default' : 'outline'} size="sm" disabled={pending || state.uncertain}>
        {pending ? 'Updating…' : state.uncertain ? 'Refresh to check' : label}
      </Button>
      <UncertainNote state={state} />
    </form>
  )
}

export function ShowingFeedbackForm({ showingId, leadId, expectedStatus, expectedUpdatedAt, expectedRevision }: { showingId: string; leadId?: string; expectedStatus: string; expectedUpdatedAt: string; expectedRevision: string }) {
  const [state, action, pending] = useActionState(addShowingFeedback, initialState)
  const id = useId()
  useResultToast(state)

  return (
    <form action={action} className="mt-4 space-y-3 rounded-lg border border-border bg-muted/40 p-4">
      <input type="hidden" name="showingId" value={showingId} />
      <input type="hidden" name="leadId" value={leadId || ''} />
      <input type="hidden" name="expectedStatus" value={expectedStatus} />
      <input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} />
      <input type="hidden" name="expectedRevision" value={expectedRevision} />
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-feedback`}>Feedback</Label>
        <Textarea id={`${id}-feedback`} disabled={state.uncertain} name="feedback" rows={3} />
      </div>
      <Button type="submit" size="sm" disabled={pending || state.uncertain}>
        {pending ? 'Saving…' : state.uncertain ? 'Refresh to check' : 'Save feedback and complete'}
      </Button>
      <UncertainNote state={state} />
    </form>
  )
}
