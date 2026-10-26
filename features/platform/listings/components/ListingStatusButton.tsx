'use client'

import { startTransition, useActionState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { pillClass, pillPrimaryClass } from '../../components/styles'
import { transitionListingStatus } from '../actions/listings'
import type { ListingTransition } from '../lib/listingStatus'

function useTransitionToast() {
  const [state, action, pending] = useActionState(transitionListingStatus, { ok: false, message: '' })
  useEffect(() => {
    if (!state.message) return
    if (state.ok) toast.success(state.message)
    else toast.error(state.message)
  }, [state])
  return { action, pending }
}

export function ListingStatusButton({ propertyId, status, label, primary = false }: { propertyId: string; status: string; label: string; primary?: boolean }) {
  const { action, pending } = useTransitionToast()
  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant="ghost" size="sm" className={primary ? pillPrimaryClass : pillClass} disabled={pending}>{pending ? 'Updating…' : label}</Button>
    </form>
  )
}

/** Secondary status changes behind one menu; Withdraw sits last, after a rule. */
export function ListingStatusMenu({ propertyId, title, moves, label = 'Status' }: { propertyId: string; title: string; moves: ListingTransition[]; label?: string }) {
  const { action, pending } = useTransitionToast()
  if (!moves.length) return null
  const regular = moves.filter(move => move.kind !== 'withdraw')
  const withdraw = moves.filter(move => move.kind === 'withdraw')
  const run = (status: string) => {
    const form = new FormData()
    form.set('propertyId', propertyId)
    form.set('status', status)
    startTransition(() => action(form))
  }
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className={cn(pillClass, 'gap-1 pr-2 data-[state=open]:border-foreground/40')} disabled={pending} aria-label={`Change status of ${title}`}>
          {pending ? 'Updating…' : label}
          <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44 rounded-[6px] shadow-md">
        {regular.map(move => <DropdownMenuItem key={move.status + move.label} className="h-9 rounded-[4px]" onSelect={() => run(move.status)}>{move.label}</DropdownMenuItem>)}
        {regular.length && withdraw.length ? <DropdownMenuSeparator /> : null}
        {withdraw.map(move => <DropdownMenuItem key={move.status} className="h-9 rounded-[4px] text-muted-foreground focus:text-destructive" onSelect={() => run(move.status)}>{move.label}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
