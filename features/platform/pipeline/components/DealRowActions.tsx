'use client'

import { startTransition, useActionState, useEffect, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { pillPrimaryClass } from '../../components/styles'
import { updateDealStage, type DealActionState } from '../actions/deals'
import { moveLabel, stageNext } from '../lib/stages'
import { DealFinancialTermsForm, DealNextStepForm } from './DealActionForms'

const initialState: DealActionState = { ok: false, message: '' }

export type DealActionTarget = { id: string; title: string; stage: string; offerAmount?: string | null; commissionAmount?: string | null; nextStep?: string | null; notes?: string | null }

/**
 * One verbed primary stage move per deal; other valid moves, editing and "Mark lost" (confirmed) sit in the menu.
 * `editInMenu` is off on the deal page, where the terms and next step are edited in place.
 */
export function DealRowActions({ deal, editInMenu = true, className }: { deal: DealActionTarget; editInMenu?: boolean; className?: string }) {
  const [state, action, pending] = useActionState(updateDealStage, initialState)
  const [target, setTarget] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [confirmLost, setConfirmLost] = useState(false)

  useEffect(() => {
    if (!state.message) return
    if (state.ok) toast.success(state.message)
    else toast.error(state.message)
  }, [state])

  const open = !['closed_won', 'closed_lost'].includes(deal.stage)
  const [primary, ...others] = stageNext[deal.stage] || []

  function move(stage: string) {
    if (pending) return
    setTarget(stage)
    const form = new FormData()
    form.set('dealId', deal.id)
    form.set('stage', stage)
    startTransition(() => action(form))
  }

  if (!open && !editInMenu) return null

  return (
    <div className={cn('flex items-center justify-end gap-1.5', className)}>
      {open && primary ? (
        <Button type="button" variant="ghost" size="sm" className={cn(pillPrimaryClass, 'max-sm:h-9')} disabled={pending} onClick={() => move(primary)}>
          {pending && target === primary ? 'Moving…' : moveLabel(primary)}
        </Button>
      ) : null}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label={`More actions for ${deal.title}`} className="size-8 rounded-[6px] border border-transparent text-muted-foreground shadow-none hover:border-border hover:text-foreground active:scale-[0.97] data-[state=open]:border-border max-sm:size-9">
            <MoreHorizontal aria-hidden className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52 rounded-[6px]">
          {open ? others.map(stage => <DropdownMenuItem key={stage} className="rounded-[4px]" disabled={pending} onSelect={() => move(stage)}>{pending && target === stage ? 'Moving…' : moveLabel(stage)}</DropdownMenuItem>) : null}
          {editInMenu ? <DropdownMenuItem className="rounded-[4px]" onSelect={() => setEditing(true)}>Edit amounts and next step…</DropdownMenuItem> : null}
          {open ? <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" className="rounded-[4px]" disabled={pending} onSelect={() => setConfirmLost(true)}>Mark lost…</DropdownMenuItem>
          </> : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmLost} onOpenChange={setConfirmLost}>
        <AlertDialogContent className="rounded-[6px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this deal as lost?</AlertDialogTitle>
            <AlertDialogDescription>{deal.title} will move to Closed lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-[6px]">Cancel</AlertDialogCancel>
            <Button type="button" variant="destructive" className="rounded-[6px] active:scale-[0.98]" onClick={() => { setConfirmLost(false); move('closed_lost') }}>Mark lost</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editInMenu ? (
        <Sheet open={editing} onOpenChange={setEditing}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader><SheetTitle>{deal.title}</SheetTitle></SheetHeader>
            <div className="space-y-6 px-4 pb-6">
              <DealNextStepForm dealId={deal.id} nextStep={deal.nextStep} notes={deal.notes} />
              <div className="border-t border-border pt-5"><DealFinancialTermsForm dealId={deal.id} offerAmount={deal.offerAmount} commissionAmount={deal.commissionAmount} /></div>
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  )
}
