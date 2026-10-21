'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { updateLeadStatus, type LeadQuickActionState } from '../actions/leads'

const initialState: LeadQuickActionState = { ok: false, message: '' }

export function LeadStatusForm({ leadId, nextStatus, label }: { leadId: string; nextStatus: string; label: string }) {
  const [state, action, pending] = useActionState(updateLeadStatus, initialState)
  useEffect(() => {
    if (!state.message || state.uncertain) return
    if (state.ok) toast.success(state.message)
    else toast.error(state.message)
  }, [state])

  return (
    <form action={action} className="inline-flex flex-col gap-1">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="status" value={nextStatus} />
      <Button type="submit" variant="outline" size="sm" disabled={pending || state.uncertain === true}>
        {pending ? 'Updating…' : state.uncertain ? 'Refresh to check' : label}
      </Button>
      {state.uncertain && state.message ? <span role="status" className="text-xs text-amber-700 dark:text-amber-400">{state.message}</span> : null}
    </form>
  )
}
