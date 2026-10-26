'use client'

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { localDateTimeToIso } from '@/features/lib/date-time'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { addChecklistItem, createCounterOffer, createOffer, queueAlert, queueImport, transitionCommissionWorkflow, transitionDisclosureWorkflow, transitionDocument, transitionInspection, transitionMilestoneWorkflow, transitionOpenHouse, transitionOfferWorkflow, transitionTask, updateAlert } from '../actions/operations'
import { pillClass, pillPrimaryClass, trackClass } from '../../components/styles'

/** Quiet treatment for a destructive or backward step: last in the row, no border until hover. */
const quietClass = cn(pillClass, 'border-transparent text-muted-foreground hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive')
const submitClass = cn(pillPrimaryClass, 'h-9')
const fieldRadius = 'rounded-[6px]'

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

type Emphasis = 'primary' | 'quiet'
function WorkflowButton({ action, idName, id, status, label, emphasis }: { action: (state: FormState, form: FormData) => Promise<FormState>; idName: string; id: string; status: string; label: string; emphasis?: Emphasis }) {
  const [state, formAction, pending] = useActionState(action, initial)
  useResultToast(state)
  return (
    <form action={formAction} className="inline-flex flex-col items-start">
      <input type="hidden" name={idName} value={id} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant="ghost" size="sm" className={emphasis === 'primary' ? pillPrimaryClass : emphasis === 'quiet' ? quietClass : pillClass} disabled={pending || state.uncertain}>{pending ? 'Updating…' : state.uncertain ? 'Refresh to check' : label}</Button>
      <UncertainNote state={state} />
    </form>
  )
}
export function OfferAction(props: { offerId: string; status: string; label: string; emphasis?: Emphasis }) { return <WorkflowButton emphasis={props.emphasis} action={transitionOfferWorkflow} idName="offerId" id={props.offerId} status={props.status} label={props.label} /> }
export function MilestoneAction(props: { milestoneId: string; status: string; label: string; emphasis?: Emphasis }) { return <WorkflowButton emphasis={props.emphasis} action={transitionMilestoneWorkflow} idName="milestoneId" id={props.milestoneId} status={props.status} label={props.label} /> }
export function DisclosureAction(props: { disclosureId: string; status: string; label: string; emphasis?: Emphasis }) { return <WorkflowButton emphasis={props.emphasis} action={transitionDisclosureWorkflow} idName="disclosureId" id={props.disclosureId} status={props.status} label={props.label} /> }
export function CommissionAction(props: { commissionId: string; status: string; label: string; emphasis?: Emphasis }) { return <WorkflowButton emphasis={props.emphasis} action={transitionCommissionWorkflow} idName="commissionId" id={props.commissionId} status={props.status} label={props.label} /> }
export function TaskAction(props: { taskId: string; status: string; label: string; emphasis?: Emphasis }) { return <WorkflowButton emphasis={props.emphasis} action={transitionTask} idName="taskId" id={props.taskId} status={props.status} label={props.label} /> }
export function OpenHouseAction(props: { openHouseId: string; status: string; label: string; emphasis?: Emphasis }) { return <WorkflowButton emphasis={props.emphasis} action={transitionOpenHouse} idName="openHouseId" id={props.openHouseId} status={props.status} label={props.label} /> }
export function InspectionAction(props: { inspectionId: string; status: string; label: string; emphasis?: Emphasis }) { return <WorkflowButton emphasis={props.emphasis} action={transitionInspection} idName="inspectionId" id={props.inspectionId} status={props.status} label={props.label} /> }

export function OfferDraftForm({ dealId, deals, onDone }: { dealId?: string; deals?: Array<[string, string]>; onDone?: () => void }) {
  const [state, action, pending] = useActionState(createOffer, initial)
  const formRef = useRef<HTMLFormElement>(null)
  const id = useId()
  useResultToast(state, () => { formRef.current?.reset(); onDone?.() })
  return (
    <form ref={formRef} action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
      {dealId ? <input type="hidden" name="dealId" value={dealId} /> : null}
      {!dealId && deals ? (
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`${id}-deal`}>Deal</Label>
          <Select name="dealId" required>
            <SelectTrigger id={`${id}-deal`} className="h-9 w-full rounded-[6px] text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent className="rounded-[6px]">{deals.map(([value, text]) => <SelectItem key={value} value={value}>{text}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      ) : null}
      <div className="space-y-1.5"><Label htmlFor={`${id}-amount`}>Offer amount</Label><Input className={fieldRadius} id={`${id}-amount`} required name="amount" inputMode="decimal" placeholder="0.00" /></div>
      <div className="space-y-1.5"><Label htmlFor={`${id}-earnest`}>Earnest money</Label><Input className={fieldRadius} id={`${id}-earnest`} name="earnestMoney" inputMode="decimal" placeholder="0.00" /></div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-financing`}>Financing</Label>
        <Select name="financingType" defaultValue="conventional">
          <SelectTrigger id={`${id}-financing`} className="h-9 w-full rounded-[6px] text-sm"><SelectValue /></SelectTrigger>
          <SelectContent className="rounded-[6px]">
            <SelectItem value="conventional">Conventional</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="fha">FHA</SelectItem>
            <SelectItem value="va">VA</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5"><Label htmlFor={`${id}-contingencies`}>Contingencies</Label><Input className={fieldRadius} id={`${id}-contingencies`} name="contingencies" placeholder="Inspection, financing" /></div>
      <div className="sm:col-span-2"><Button type="submit" variant="ghost" size="sm" className={submitClass} disabled={pending}>{pending ? 'Creating…' : 'Create offer'}</Button></div>
    </form>
  )
}

export function CounterOfferForm({ offerId, onDone }: { offerId: string; onDone?: () => void }) {
  const [state, action, pending] = useActionState(createCounterOffer, initial)
  const formRef = useRef<HTMLFormElement>(null)
  const id = useId()
  useResultToast(state, () => { formRef.current?.reset(); onDone?.() })
  return (
    <form ref={formRef} action={action} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="offerId" value={offerId} />
      <div className="space-y-1.5"><Label htmlFor={`${id}-amount`}>Counter amount</Label><Input className={fieldRadius} id={`${id}-amount`} required name="amount" inputMode="decimal" placeholder="0.00" /></div>
      <div className="space-y-1.5"><Label htmlFor={`${id}-terms`}>Terms</Label><Input className={fieldRadius} id={`${id}-terms`} name="contingencies" /></div>
      <Button type="submit" variant="ghost" size="sm" className={submitClass} disabled={pending}>{pending ? 'Creating…' : 'Counter'}</Button>
    </form>
  )
}

export function ChecklistForm({ dealId, onDone }: { dealId: string; onDone?: () => void }) {
  const [state, action, pending] = useActionState(addChecklistItem, initial)
  const formRef = useRef<HTMLFormElement>(null)
  const id = useId()
  useResultToast(state, () => { formRef.current?.reset(); onDone?.() })
  return (
    <form ref={formRef} action={formData => {
      const local = String(formData.get('dueAt') || '')
      if (local) formData.set('dueAt', localDateTimeToIso(local))
      action(formData)
    }} className="mt-3 grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
      <input type="hidden" name="dealId" value={dealId} />
      <div className="space-y-1.5"><Label htmlFor={`${id}-name`}>New item</Label><Input className={fieldRadius} id={`${id}-name`} required name="name" /></div>
      <div className="space-y-1.5"><Label htmlFor={`${id}-due`}>Due</Label><Input className={fieldRadius} id={`${id}-due`} name="dueAt" type="datetime-local" /></div>
      <Button type="submit" variant="ghost" size="sm" className={submitClass} disabled={pending}>{pending ? 'Adding…' : 'Add'}</Button>
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
            <SelectTrigger id={`${id}-status`} className="h-9 w-full rounded-[6px] text-sm"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-[6px]">
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-cadence`}>Frequency</Label>
          <Select name="cadence" defaultValue={cadence}>
            <SelectTrigger id={`${id}-cadence`} className="h-9 w-full rounded-[6px] text-sm"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-[6px]">
              <SelectItem value="instant">Instant</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" variant="ghost" size="sm" className={submitClass} disabled={preferencePending}>{preferencePending ? 'Saving…' : 'Save'}</Button>
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

export function ImportForm({ sourceFeedId, onDone }: { sourceFeedId: string; onDone?: () => void }) {
  const [state, action, pending] = useActionState(queueImport, initial)
  const id = useId()
  useResultToast(state, onDone)
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="sourceFeedId" value={sourceFeedId} />
      <div className="min-w-48 space-y-1.5">
        <Label htmlFor={`${id}-mode`}>Import type</Label>
        <Select name="mode" defaultValue="incremental">
          <SelectTrigger id={`${id}-mode`} className="h-9 w-full rounded-[6px] text-sm"><SelectValue /></SelectTrigger>
          <SelectContent className="rounded-[6px]">
            <SelectItem value="incremental">New changes</SelectItem>
            <SelectItem value="dry_run">Test run</SelectItem>
            <SelectItem value="full">Full import</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" variant="ghost" size="sm" className={submitClass} disabled={pending}>{pending ? 'Starting…' : 'Start import'}</Button>
    </form>
  )
}

/** A side drawer holding one operations form; the form closes it on success. */
export function OpsDrawer({ trigger, title, primary = false, children }: { trigger: ReactNode; title: string; primary?: boolean; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className={primary ? pillPrimaryClass : pillClass}>{trigger}</Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader><SheetTitle>{title}</SheetTitle></SheetHeader>
        <div className="px-4 pb-6">{children(() => setOpen(false))}</div>
      </SheetContent>
    </Sheet>
  )
}

export function CounterOfferDrawer({ offerId, offerLabel }: { offerId: string; offerLabel: string }) {
  return <OpsDrawer trigger="Counter" title={`Counter ${offerLabel}`}>{close => <CounterOfferForm offerId={offerId} onDone={close} />}</OpsDrawer>
}

export function NewOfferDrawer({ deals }: { deals: Array<[string, string]> }) {
  return <OpsDrawer trigger="New offer" title="New offer">{close => <OfferDraftForm deals={deals} onDone={close} />}</OpsDrawer>
}

export function ImportDrawer({ sourceFeedId, feedName }: { sourceFeedId: string; feedName: string }) {
  return <OpsDrawer trigger="Start import" title={`Import from ${feedName}`}>{close => <ImportForm sourceFeedId={sourceFeedId} onDone={close} />}</OpsDrawer>
}

export function AlertDrawer({ alertId, status, cadence, name }: { alertId: string; status: string; cadence: string; name: string }) {
  return <OpsDrawer trigger="Manage" title={name}>{() => <AlertActions alertId={alertId} status={status} cadence={cadence} />}</OpsDrawer>
}

type FileMilestone = { id: string; name: string; status: string; dueAt?: string | null; assignedTo?: { name?: string | null } | null }
type FileDocument = { id: string; title: string; documentType?: string | null; status: string; requiresSignature?: boolean | null }

function shortDate(value?: string | null) {
  if (!value) return 'No date'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'
}
const words = (value?: string | null) => value ? value.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase()) : ''

/** The deal file (checklist and documents) in a drawer, with the same per-item actions as before. */
export function DealFileDrawer({ dealId, dealTitle, milestones, documents }: { dealId: string; dealTitle: string; milestones: FileMilestone[]; documents: FileDocument[] }) {
  return (
    <OpsDrawer trigger="Checklist" title={dealTitle}>
      {() => (
        <div className="space-y-6">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Checklist</h3>
            <ul className="divide-y rounded-[6px] border">
              {milestones.length ? milestones.map(item => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{words(item.status)} · Due {shortDate(item.dueAt)} · {item.assignedTo?.name || 'Unassigned'}</p>
                  </div>
                  {item.status !== 'complete' ? <MilestoneAction milestoneId={item.id} status="complete" label="Complete" /> : null}
                </li>
              )) : <li className="px-3 py-3 text-sm text-muted-foreground">No checklist items</li>}
            </ul>
            <ChecklistForm dealId={dealId} />
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Documents</h3>
            <ul className="divide-y rounded-[6px] border">
              {documents.length ? documents.map(document => (
                <li key={document.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{document.title}</p>
                    <p className="text-xs text-muted-foreground">{[words(document.documentType), words(document.status), document.requiresSignature ? 'Signature required' : ''].filter(Boolean).join(' · ')}</p>
                  </div>
                  <DocumentAction documentId={document.id} currentStatus={document.status} />
                </li>
              )) : <li className="px-3 py-3 text-sm text-muted-foreground">No documents</li>}
            </ul>
          </section>
        </div>
      )}
    </OpsDrawer>
  )
}
