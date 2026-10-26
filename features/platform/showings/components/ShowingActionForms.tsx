'use client'

import { useActionState, useEffect, useId } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { pillClass, pillPrimaryClass } from '../../components/styles'
import { addShowingFeedback, updateShowingStatus } from '../actions/showings'
import type { ShowingActionState } from '../lib/showingActionFeedback'

/** Destructive but rare: plain text that turns red on hover, kept last in its row. */
const quietClass = 'h-8 rounded-[6px] px-3 text-muted-foreground shadow-none hover:bg-destructive/5 hover:text-destructive active:scale-[0.98]'

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

export function ShowingStatusButton({ showingId, leadId, status, label, expectedStatus, expectedUpdatedAt, expectedRevision, quiet = false }: { showingId: string; leadId?: string; status: string; label: string; expectedStatus: string; expectedUpdatedAt: string; expectedRevision: string; quiet?: boolean }) {
  const [state, action, pending] = useActionState(updateShowingStatus, initialState)
  useResultToast(state)

  return (
    <form action={action} className="inline-flex shrink-0 flex-col gap-1">
      <input type="hidden" name="showingId" value={showingId} />
      <input type="hidden" name="leadId" value={leadId || ''} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="expectedRevision" value={expectedRevision} />
      <input type="hidden" name="expectedStatus" value={expectedStatus} />
      <input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} />
      <Button type="submit" variant="ghost" size="sm" className={cn(status === 'scheduled' ? pillPrimaryClass : quiet ? quietClass : pillClass, 'max-sm:h-9')} disabled={pending || state.uncertain}>
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
    <form action={action} className="space-y-3">
      <input type="hidden" name="showingId" value={showingId} />
      <input type="hidden" name="leadId" value={leadId || ''} />
      <input type="hidden" name="expectedStatus" value={expectedStatus} />
      <input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} />
      <input type="hidden" name="expectedRevision" value={expectedRevision} />
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-feedback`}>Feedback</Label>
        <Textarea className="rounded-[6px]" id={`${id}-feedback`} disabled={state.uncertain} name="feedback" rows={3} />
      </div>
      <Button type="submit" size="sm" className="rounded-[6px] active:scale-[0.98]" disabled={pending || state.uncertain}>
        {pending ? 'Saving…' : state.uncertain ? 'Refresh to check' : 'Complete with feedback'}
      </Button>
      <UncertainNote state={state} />
    </form>
  )
}
