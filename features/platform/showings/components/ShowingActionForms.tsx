'use client'

import { useActionState, useEffect, useId, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { localDateTimeToIso } from '@/features/lib/date-time'
import { toLocalInput } from '../../components/RecordForm'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { pillClass, pillPrimaryClass } from '../../components/styles'
import { addShowingFeedback, rescheduleShowing, updateShowingStatus } from '../actions/showings'
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
      <Button type="submit" variant="ghost" size="sm" className={pillPrimaryClass} disabled={pending || state.uncertain}>
        {pending ? 'Saving…' : state.uncertain ? 'Refresh to check' : 'Complete with feedback'}
      </Button>
      <UncertainNote state={state} />
    </form>
  )
}

/** Moves an open showing to a new time. The dialog is the confirmation; the buyer sees the new time in My showings. */
export function ShowingRescheduleDialog({ showingId, scheduledStart, expectedStatus, expectedUpdatedAt, expectedRevision }: { showingId: string; scheduledStart: string; expectedStatus: string; expectedUpdatedAt: string; expectedRevision: string }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(async (previous: ShowingActionState, formData: FormData) => {
    formData.set('scheduledStart', localDateTimeToIso(String(formData.get('localStart') || '')))
    const next = await rescheduleShowing(previous, formData)
    if (next.ok) setOpen(false)
    return next
  }, initialState)
  const id = useId()
  useResultToast(state)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className={cn(pillClass, 'max-sm:h-9')} disabled={state.uncertain}>
          {state.uncertain ? 'Refresh to check' : 'Reschedule'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-[10px]">
        <form action={action} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Reschedule showing</DialogTitle>
            <DialogDescription>The buyer sees the new time in their showings. The visit keeps its length and status.</DialogDescription>
          </DialogHeader>
          <input type="hidden" name="showingId" value={showingId} />
          <input type="hidden" name="expectedStatus" value={expectedStatus} />
          <input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} />
          <input type="hidden" name="expectedRevision" value={expectedRevision} />
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-start`}>New time</Label>
            <Input className="rounded-[6px]" id={`${id}-start`} name="localStart" type="datetime-local" required defaultValue={toLocalInput(scheduledStart)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-note`}>Note for the timeline (optional)</Label>
            <Textarea className="rounded-[6px]" id={`${id}-note`} name="note" rows={2} maxLength={2000} />
          </div>
          {state.message && !state.ok && !state.uncertain ? <p role="alert" className="text-sm text-destructive">{state.message}</p> : null}
          <UncertainNote state={state} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" size="sm" className={pillClass} onClick={() => setOpen(false)}>Keep current time</Button>
            <Button type="submit" variant="ghost" size="sm" className={pillPrimaryClass} disabled={pending || state.uncertain}>{pending ? 'Saving…' : 'Reschedule showing'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
