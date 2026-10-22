'use client'

import { useActionState, useEffect, useId, useRef } from 'react'
import { toast } from 'sonner'
import { localDateTimeToIso } from '@/features/lib/date-time'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { addChecklistItem, createCounterOffer, createOffer, queueAlert, queueImport, transitionCommissionWorkflow, transitionDisclosureWorkflow, transitionDocument, transitionInspection, transitionMilestoneWorkflow, transitionOpenHouse, transitionOfferWorkflow, transitionTask, updateAlert } from '../actions/operations'
import { pillClass, trackClass } from '../../components/styles'

type FormState = { ok: boolean; message: string; uncertain?: boolean }
const initial: FormState = { ok: false, message: '' }

function useResultToast(state: FormState, onSuccess?: () => void) {
  useEffect(() => {
    if (!state.message || state.uncertain) return
    if (state.ok) { toast.success(state.message); onSuccess?.() }
    else toast.error(state.message)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])
}

function UncertainNote({ state }: { state: FormState }) {
  return state.uncertain && state.message ? <p role="status" className="mt-1 text-xs text-amber-700 dark:text-amber-400">{state.message}</p> : null
}

function WorkflowButton({ action, idName, id, status, label }: { action: (state: FormState, form: FormData) => Promise<FormState>; idName: string; id: string; status: string; label: string }) {
  const [state, formAction, pending] = useActionState(action, initial)
  useResultToast(state)
  return (
    <form action={formAction} className="inline-flex flex-col items-start">
      <input type="hidden" name={idName} value={id} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant="ghost" size="sm" className={pillClass} disabled={pending || state.uncertain}>{pending ? 'Updating…' : state.uncertain ? 'Refresh to check' : label}</Button>
      <UncertainNote state={state} />
    </form>
  )
}
export function OfferAction(props: { offerId: string; status: string; label: string }) { return <WorkflowButton action={transitionOfferWorkflow} idName="offerId" id={props.offerId} status={props.status} label={props.label} /> }
export function MilestoneAction(props: { milestoneId: string; status: string; label: string }) { return <WorkflowButton action={transitionMilestoneWorkflow} idName="milestoneId" id={props.milestoneId} status={props.status} label={props.label} /> }
export function DisclosureAction(props: { disclosureId: string; status: string; label: string }) { return <WorkflowButton action={transitionDisclosureWorkflow} idName="disclosureId" id={props.disclosureId} status={props.status} label={props.label} /> }
export function CommissionAction(props: { commissionId: string; status: string; label: string }) { return <WorkflowButton action={transitionCommissionWorkflow} idName="commissionId" id={props.commissionId} status={props.status} label={props.label} /> }
export function TaskAction(props: { taskId: string; status: string; label: string }) { return <WorkflowButton action={transitionTask} idName="taskId" id={props.taskId} status={props.status} label={props.label} /> }
export function OpenHouseAction(props: { openHouseId: string; status: string; label: string }) { return <WorkflowButton action={transitionOpenHouse} idName="openHouseId" id={props.openHouseId} status={props.status} label={props.label} /> }
export function InspectionAction(props: { inspectionId: string; status: string; label: string }) { return <WorkflowButton action={transitionInspection} idName="inspectionId" id={props.inspectionId} status={props.status} label={props.label} /> }

export function OfferDraftForm({ dealId }: { dealId: string }) {
  const [state, action, pending] = useActionState(createOffer, initial)
  const formRef = useRef<HTMLFormElement>(null)
  const id = useId()
  useResultToast(state, () => formRef.current?.reset())
  return (
    <form ref={formRef} action={action} className="mt-3 grid gap-3 rounded-lg border border-border bg-muted/40 p-3 sm:grid-cols-2">
      <input type="hidden" name="dealId" value={dealId} />
      <div className="space-y-1.5"><Label htmlFor={`${id}-amount`}>Offer amount</Label><Input id={`${id}-amount`} required name="amount" inputMode="decimal" placeholder="0.00" /></div>
      <div className="space-y-1.5"><Label htmlFor={`${id}-earnest`}>Earnest money</Label><Input id={`${id}-earnest`} name="earnestMoney" inputMode="decimal" placeholder="0.00" /></div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-financing`}>Financing</Label>
        <Select name="financingType" defaultValue="conventional">
          <SelectTrigger id={`${id}-financing`} className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="conventional">Conventional</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="fha">FHA</SelectItem>
            <SelectItem value="va">VA</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5"><Label htmlFor={`${id}-contingencies`}>Contingencies</Label><Input id={`${id}-contingencies`} name="contingencies" placeholder="Inspection, financing" /></div>
      <div className="sm:col-span-2"><Button type="submit" size="sm" className="rounded-full" disabled={pending}>{pending ? 'Creating…' : 'Create offer'}</Button></div>
    </form>
  )
}

export function CounterOfferForm({ offerId }: { offerId: string }) {
  const [state, action, pending] = useActionState(createCounterOffer, initial)
  const formRef = useRef<HTMLFormElement>(null)
  const id = useId()
  useResultToast(state, () => formRef.current?.reset())
  return (
    <form ref={formRef} action={action} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="offerId" value={offerId} />
      <div className="space-y-1.5"><Label htmlFor={`${id}-amount`}>Counter amount</Label><Input id={`${id}-amount`} required name="amount" inputMode="decimal" placeholder="0.00" /></div>
      <div className="space-y-1.5"><Label htmlFor={`${id}-terms`}>Terms</Label><Input id={`${id}-terms`} name="contingencies" /></div>
      <Button type="submit" size="sm" className="rounded-full" disabled={pending}>{pending ? 'Creating…' : 'Counter'}</Button>
    </form>
  )
}

export function ChecklistForm({ dealId }: { dealId: string }) {
  const [state, action, pending] = useActionState(addChecklistItem, initial)
  const formRef = useRef<HTMLFormElement>(null)
  const id = useId()
  useResultToast(state, () => formRef.current?.reset())
  return (
    <form ref={formRef} action={formData => {
      const local = String(formData.get('dueAt') || '')
      if (local) formData.set('dueAt', localDateTimeToIso(local))
      action(formData)
    }} className="mt-3 grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
      <input type="hidden" name="dealId" value={dealId} />
      <div className="space-y-1.5"><Label htmlFor={`${id}-name`}>New item</Label><Input id={`${id}-name`} required name="name" /></div>
      <div className="space-y-1.5"><Label htmlFor={`${id}-due`}>Due</Label><Input id={`${id}-due`} name="dueAt" type="datetime-local" /></div>
      <Button type="submit" size="sm" className="rounded-full" disabled={pending}>{pending ? 'Adding…' : 'Add'}</Button>
    </form>
  )
}

const documentNext: Record<string, [string, string]> = { draft: ['sent', 'Mark sent'], sent: ['signed', 'Mark signed'], signed: ['archived', 'Archive'] }

export function DocumentAction({ documentId, currentStatus }: { documentId: string; currentStatus: string }) {
  const [state, action, pending] = useActionState(transitionDocument, initial)
  useResultToast(state)
  const next = documentNext[currentStatus]
  if (!next) return null
  return (
    <form action={action} className={trackClass}>
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="status" value={next[0]} />
      <Button type="submit" variant="ghost" size="sm" className={pillClass} disabled={pending}>{pending ? 'Updating…' : next[1]}</Button>
    </form>
  )
}

export function AlertActions({ alertId, status, cadence }: { alertId: string; status: string; cadence: string }) {
  const [preference, preferenceAction, preferencePending] = useActionState(updateAlert, initial)
  const [queued, queueAction, queuePending] = useActionState(queueAlert, initial)
  const id = useId()
  useResultToast(preference)
  useResultToast(queued)
  return (
    <div className="mt-3 space-y-2">
      <form action={preferenceAction} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="alertId" value={alertId} />
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-status`}>Status</Label>
          <Select name="status" defaultValue={status}>
            <SelectTrigger id={`${id}-status`} className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-cadence`}>Frequency</Label>
          <Select name="cadence" defaultValue={cadence}>
            <SelectTrigger id={`${id}-cadence`} className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="instant">Instant</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" size="sm" className="rounded-full" disabled={preferencePending}>{preferencePending ? 'Saving…' : 'Save'}</Button>
      </form>
      {status === 'active' ? (
        <form action={queueAction} className={trackClass}>
          <input type="hidden" name="alertId" value={alertId} />
          <Button type="submit" variant="ghost" size="sm" className={pillClass} disabled={queuePending}>{queuePending ? 'Sending…' : 'Send now'}</Button>
        </form>
      ) : null}
    </div>
  )
}

export function ImportForm({ sourceFeedId }: { sourceFeedId: string }) {
  const [state, action, pending] = useActionState(queueImport, initial)
  const id = useId()
  useResultToast(state)
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="sourceFeedId" value={sourceFeedId} />
      <div className="min-w-48 space-y-1.5">
        <Label htmlFor={`${id}-mode`}>Import type</Label>
        <Select name="mode" defaultValue="incremental">
          <SelectTrigger id={`${id}-mode`} className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="incremental">New changes</SelectItem>
            <SelectItem value="dry_run">Test run</SelectItem>
            <SelectItem value="full">Full import</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" size="sm" className="rounded-full" disabled={pending}>{pending ? 'Starting…' : 'Start import'}</Button>
    </form>
  )
}
