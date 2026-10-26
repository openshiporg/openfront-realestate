'use client'

import { useActionState, useEffect, useId, useRef } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { pillClass, pillPrimaryClass } from '../../components/styles'
import { updateDealFinancialTerms, updateDealNextStep, updateDealStage, type DealActionState } from '../actions/deals'

const initialState: DealActionState = { ok: false, message: '' }

function useResultToast(state: DealActionState) {
  useEffect(() => {
    if (!state.message) return
    if (state.ok) toast.success(state.message)
    else toast.error(state.message)
  }, [state])
}

export function DealStageButton({ dealId, stage, label, confirm, primary = false }: { dealId: string; stage: string; label: string; confirm?: { title: string; description: string }; primary?: boolean }) {
  const [state, action, pending] = useActionState(updateDealStage, initialState)
  const formRef = useRef<HTMLFormElement>(null)
  useResultToast(state)
  return (
    <form ref={formRef} action={action} className="shrink-0">
      <input type="hidden" name="dealId" value={dealId} />
      <input type="hidden" name="stage" value={stage} />
      {confirm ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className={pillClass} disabled={pending}>{pending ? 'Moving…' : label}</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirm.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className={pillClass}>Cancel</AlertDialogCancel>
              <AlertDialogAction className={pillPrimaryClass} onClick={() => formRef.current?.requestSubmit()}>{label}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Button type="submit" variant="ghost" size="sm" className={primary ? pillPrimaryClass : pillClass} disabled={pending}>{pending ? 'Moving…' : label}</Button>
      )}
    </form>
  )
}

export function DealFinancialTermsForm({ dealId, offerAmount, commissionAmount }: { dealId: string; offerAmount?: string | null; commissionAmount?: string | null }) {
  const [state, action, pending] = useActionState(updateDealFinancialTerms, initialState)
  const id = useId()
  useResultToast(state)
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="dealId" value={dealId} />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-offer`}>Offer amount</Label>
          <Input className="rounded-[6px]" id={`${id}-offer`} name="offerAmount" inputMode="decimal" defaultValue={offerAmount || ''} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-commission`}>Commission</Label>
          <Input className="rounded-[6px]" id={`${id}-commission`} name="commissionAmount" inputMode="decimal" defaultValue={commissionAmount || ''} />
        </div>
      </div>
      <Button type="submit" variant="ghost" size="sm" className={pillPrimaryClass} disabled={pending}>{pending ? 'Saving…' : 'Save amounts'}</Button>
    </form>
  )
}

export function DealNextStepForm({ dealId, nextStep, notes }: { dealId: string; nextStep?: string | null; notes?: string | null }) {
  const [state, action, pending] = useActionState(updateDealNextStep, initialState)
  const id = useId()
  useResultToast(state)
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="dealId" value={dealId} />
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-next`}>Next step</Label>
        <Input className="rounded-[6px]" id={`${id}-next`} name="nextStep" defaultValue={nextStep || ''} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-notes`}>Notes</Label>
        <Textarea className="rounded-[6px]" id={`${id}-notes`} name="notes" defaultValue={notes || ''} rows={3} />
      </div>
      <Button type="submit" variant="ghost" size="sm" className={pillPrimaryClass} disabled={pending}>{pending ? 'Saving…' : 'Save next step'}</Button>
    </form>
  )
}
