'use client'

import { startTransition, useActionState, useEffect, useState } from 'react'
import { Mail, MoreHorizontal, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { pillClass, pillPrimaryClass, trackItemClass } from '../../components/styles'
import { updateLeadStatus, type LeadQuickActionState } from '../actions/leads'
import type { OperatorViewer } from '../lib/leadDetail'
import { LeadActivityForm } from './LeadActivityForm'
import { ScheduleShowingForm } from './PendingShowingForms'

const initialState: LeadQuickActionState = { ok: false, message: '' }

/** Valid next steps per status, verbed, in the order an agent normally takes them (matches the server's transition map). */
const steps: Record<string, Array<[string, string]>> = {
  new: [['attempted_contact', 'Mark contacted'], ['qualified', 'Mark qualified']],
  attempted_contact: [['qualified', 'Mark qualified']],
  qualified: [['offer', 'Move to offer']],
  tour_scheduled: [['offer', 'Move to offer'], ['qualified', 'Back to qualified']],
  offer: [['closed', 'Mark closed']],
  lost: [['qualified', 'Reopen as qualified']],
  closed: [],
}

export type LeadActionTarget = {
  id: string
  name: string
  status: string
  phone?: string | null
  email?: string | null
  propertyId?: string | null
  assignedAgentId?: string | null
}

function telHref(phone: string) {
  return `tel:${phone.replace(/[^+\d]/g, '')}`
}

/**
 * Row and header actions for a lead: one primary next step, everything else in a menu with
 * "Mark lost" last. Scheduling and logging open in a side sheet on demand.
 */
export function LeadRowActions({ lead, viewer, showContact = false, className }: { lead: LeadActionTarget; viewer: OperatorViewer | null; showContact?: boolean; className?: string }) {
  const [state, action, pending] = useActionState(updateLeadStatus, initialState)
  const [target, setTarget] = useState<string | null>(null)
  const [sheet, setSheet] = useState<'schedule' | 'activity' | null>(null)

  useEffect(() => {
    if (!state.message) return
    if (state.uncertain) toast.warning(state.message)
    else if (state.ok) toast.success(state.message)
    else toast.error(state.message)
  }, [state])

  const terminal = ['closed', 'lost'].includes(lead.status)
  const canSchedule = Boolean(viewer && lead.propertyId && !terminal)
  const available = steps[lead.status] || []
  const scheduleIsPrimary = lead.status === 'qualified' && canSchedule
  const primaryStep = scheduleIsPrimary || lead.status === 'lost' ? null : available[0] || null
  const menuSteps = available.filter(step => step !== primaryStep)
  const blocked = pending || state.uncertain === true

  function move(status: string) {
    if (blocked) return
    setTarget(status)
    const form = new FormData()
    form.set('leadId', lead.id)
    form.set('status', status)
    startTransition(() => action(form))
  }

  const pendingLabel = (status: string, label: string) => (pending && target === status ? 'Updating…' : label)

  return (
    <div className={cn('flex items-center justify-end gap-1.5', className)}>
      {showContact && lead.phone ? <a href={telHref(lead.phone)} className={cn(trackItemClass(false), 'max-sm:h-9')}><Phone aria-hidden className="size-3.5" />Call</a> : null}
      {showContact && lead.email ? <a href={`mailto:${lead.email}`} className={cn(trackItemClass(false), 'max-sm:h-9')}><Mail aria-hidden className="size-3.5" />Email</a> : null}

      {state.uncertain ? (
        <Button type="button" variant="ghost" size="sm" className={cn(pillClass, 'max-sm:h-9')} disabled>Refresh to check</Button>
      ) : scheduleIsPrimary ? (
        <Button type="button" variant="ghost" size="sm" className={cn(pillPrimaryClass, 'max-sm:h-9')} onClick={() => setSheet('schedule')}>Schedule showing</Button>
      ) : primaryStep ? (
        <Button type="button" variant="ghost" size="sm" className={cn(pillPrimaryClass, 'max-sm:h-9')} disabled={blocked} onClick={() => move(primaryStep[0])}>
          {pendingLabel(primaryStep[0], primaryStep[1])}
        </Button>
      ) : lead.status === 'lost' && available[0] ? (
        <Button type="button" variant="ghost" size="sm" className={cn(pillClass, 'max-sm:h-9')} disabled={blocked} onClick={() => move(available[0][0])}>
          {pendingLabel(available[0][0], available[0][1])}
        </Button>
      ) : null}

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label={`More actions for ${lead.name}`} className="size-8 rounded-[6px] border border-transparent text-muted-foreground shadow-none hover:border-border hover:text-foreground active:scale-[0.97] data-[state=open]:border-border max-sm:size-9">
            <MoreHorizontal aria-hidden className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48 rounded-[6px]">
          {lead.status !== 'lost' ? menuSteps.map(([status, label]) => (
            <DropdownMenuItem key={status} className="rounded-[4px]" disabled={blocked} onSelect={() => move(status)}>{label}</DropdownMenuItem>
          )) : null}
          {canSchedule && !scheduleIsPrimary ? <DropdownMenuItem className="rounded-[4px]" onSelect={() => setSheet('schedule')}>Schedule showing…</DropdownMenuItem> : null}
          <DropdownMenuItem className="rounded-[4px]" onSelect={() => setSheet('activity')}>Log activity…</DropdownMenuItem>
          {!showContact && (lead.phone || lead.email) ? <DropdownMenuSeparator /> : null}
          {!showContact && lead.phone ? <DropdownMenuItem asChild className="rounded-[4px]"><a href={telHref(lead.phone)}><Phone aria-hidden className="size-3.5" />Call</a></DropdownMenuItem> : null}
          {!showContact && lead.email ? <DropdownMenuItem asChild className="rounded-[4px]"><a href={`mailto:${lead.email}`}><Mail aria-hidden className="size-3.5" />Email</a></DropdownMenuItem> : null}
          {!terminal ? <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" className="rounded-[4px]" disabled={blocked} onSelect={() => move('lost')}>{pendingLabel('lost', 'Mark lost')}</DropdownMenuItem>
          </> : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={sheet !== null} onOpenChange={open => { if (!open) setSheet(null) }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader><SheetTitle>{sheet === 'schedule' ? `Schedule showing · ${lead.name}` : `Log activity · ${lead.name}`}</SheetTitle></SheetHeader>
          <div className="px-4 pb-6">
            {sheet === 'schedule' && viewer ? <ScheduleShowingForm viewer={viewer} leadId={lead.id} propertyId={lead.propertyId || undefined} assignedAgentId={lead.assignedAgentId || undefined} /> : null}
            {sheet === 'activity' ? <LeadActivityForm leadId={lead.id} propertyId={lead.propertyId || undefined} /> : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
