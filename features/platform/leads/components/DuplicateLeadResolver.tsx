'use client'

import { useActionState, useEffect, useId, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { resolveDuplicateLead, type LeadDuplicateGroup, type LeadQuickActionState } from '../actions/leads'
import { label, leadStatusLabels } from '../lib/labels'

const initialState: LeadQuickActionState = { ok: false, message: '' }

function candidateLabel(candidate: LeadDuplicateGroup['candidates'][number]) {
  return `${candidate.name} · ${candidate.email || candidate.phone || 'No contact details'} · ${label(leadStatusLabels, candidate.status)}`
}

export function DuplicateLeadResolver({ group }: { group: LeadDuplicateGroup }) {
  const [state, action, pending] = useActionState(resolveDuplicateLead, initialState)
  const [primaryId, setPrimaryId] = useState(group.candidates[0].id)
  const [duplicateId, setDuplicateId] = useState(group.candidates[1].id)
  const id = useId()
  useEffect(() => {
    if (!state.message || state.uncertain) return
    if (state.ok) toast.success(state.message)
    else toast.error(state.message)
  }, [state])

  function choosePrimary(value: string) {
    setPrimaryId(value)
    if (value === duplicateId) setDuplicateId(group.candidates.find((candidate) => candidate.id !== value)?.id || '')
  }

  return (
    <form action={action} className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">{group.reason}</h3>
          <div className="mt-3 grid gap-2 text-sm">
            {group.candidates.map((candidate) => (
              <div key={candidate.id} className="rounded-md border border-border bg-muted/40 p-3">
                <p className="font-medium text-foreground">{candidate.name} <span className="font-normal text-muted-foreground">· {label(leadStatusLabels, candidate.status)}</span></p>
                <p className="text-muted-foreground">{[candidate.email, candidate.phone].filter(Boolean).join(' · ') || 'No contact details'}</p>
                <p className="text-xs text-muted-foreground">{candidate.property?.title || 'No listing'}{candidate.assignedAgent?.name ? ` · ${candidate.assignedAgent.name}` : ''}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="w-full space-y-3 lg:w-[28rem]">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-primary`}>Lead to keep</Label>
            <Select name="primaryLeadId" value={primaryId} onValueChange={choosePrimary}>
              <SelectTrigger id={`${id}-primary`} className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {group.candidates.map((candidate) => <SelectItem key={candidate.id} value={candidate.id}>{candidateLabel(candidate)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-duplicate`}>Duplicate to close</Label>
            <Select name="duplicateLeadId" value={duplicateId} onValueChange={setDuplicateId}>
              <SelectTrigger id={`${id}-duplicate`} className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {group.candidates.filter((candidate) => candidate.id !== primaryId).map((candidate) => <SelectItem key={candidate.id} value={candidate.id}>{candidateLabel(candidate)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-note`}>Note</Label>
            <Textarea id={`${id}-note`} name="note" rows={2} />
          </div>
          <Button type="submit" size="sm" className="w-full" disabled={pending || state.uncertain === true || !duplicateId}>
            {pending ? 'Resolving…' : state.uncertain ? 'Refresh to check' : 'Resolve duplicate'}
          </Button>
          {state.uncertain && state.message ? <p role="status" className="text-xs text-amber-700 dark:text-amber-400">{state.message}</p> : null}
        </div>
      </div>
    </form>
  )
}
