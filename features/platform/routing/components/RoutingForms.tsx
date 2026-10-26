'use client'

import { startTransition, useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { Choice, Field, FormDrawer, RecordForm, Toggle } from '../../components/RecordForm'
import { pillClass } from '../../components/styles'
import { deleteRoutingRule, saveRoutingRule, setRoutingRuleStatus } from '../actions/routing'
import type { RoutingOptions, RoutingRule } from '../lib/rules'
import { intentOptions, sourceOptions } from '../lib/options'


export function RoutingRuleDrawer({ rule, options, nextPriority }: { rule?: RoutingRule; options: RoutingOptions; nextPriority?: number }) {
  return (
    <FormDrawer trigger={rule ? 'Edit' : 'New rule'} title={rule ? 'Edit rule' : 'New rule'} primary={!rule}>
      {close => (
        <RecordForm action={saveRoutingRule} submitLabel={rule ? 'Save rule' : 'Add rule'} onDone={close}>
          {rule ? <input type="hidden" name="id" value={rule.id} /> : null}
          <Field name="name" label="Name" required wide defaultValue={rule?.name} />
          <Field name="priority" label="Priority (lower runs first)" type="number" min={0} defaultValue={rule?.priority ?? nextPriority ?? 100} />
          <Toggle name="isFallback" label="Fallback when no rule matches" defaultChecked={rule?.isFallback} />
          <Choice name="intent" label="Intent" options={intentOptions} defaultValue={rule?.intent || 'any'} />
          <Choice name="source" label="Source" options={sourceOptions} defaultValue={rule?.source || 'any'} />
          <Field name="city" label="City" defaultValue={rule?.city} />
          <div className="grid grid-cols-2 gap-3">
            <Field name="state" label="State" placeholder="TX" defaultValue={rule?.state} />
            <Field name="postalCode" label="ZIP" defaultValue={rule?.postalCode} />
          </div>
          <Choice name="assignedAgentId" label="Agent" options={options.agents.map(a => [a.id, a.name])} defaultValue={rule?.assignedAgent?.id} emptyLabel="No agent" />
          <Choice name="assignedTeamId" label="Team" options={options.teams.map(t => [t.id, t.name])} defaultValue={rule?.assignedTeam?.id} emptyLabel="No team" />
        </RecordForm>
      )}
    </FormDrawer>
  )
}

function useCommand(action: typeof setRoutingRuleStatus) {
  const [state, run, pending] = useActionState(action, { ok: false, message: '' })
  const router = useRouter()
  useEffect(() => {
    if (!state.message) return
    if (state.ok) { toast.success(state.message); router.refresh() } else toast.error(state.message)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])
  return { run, pending }
}

/** Pause/activate and delete behind one menu; Delete is last, after a rule, and asks first. */
export function RoutingRuleActions({ rule }: { rule: RoutingRule }) {
  const status = useCommand(setRoutingRuleStatus)
  const remove = useCommand(deleteRoutingRule)
  const pending = status.pending || remove.pending
  const send = (command: ReturnType<typeof useCommand>, fields: Record<string, string>) => {
    const form = new FormData()
    Object.entries(fields).forEach(([name, value]) => form.set(name, value))
    startTransition(() => command.run(form))
  }
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className={cn(pillClass, 'w-8 px-0 data-[state=open]:border-foreground/40')} disabled={pending} aria-label={`More actions for ${rule.name}`}>
          <MoreHorizontal aria-hidden className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40 rounded-[6px] shadow-md">
        <DropdownMenuItem className="h-9 rounded-[4px]" onSelect={() => send(status, { id: rule.id, status: rule.status === 'active' ? 'paused' : 'active' })}>
          {rule.status === 'active' ? 'Pause rule' : 'Activate rule'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="h-9 rounded-[4px] text-muted-foreground focus:text-destructive" onSelect={() => { if (window.confirm(`Delete "${rule.name}"?`)) send(remove, { id: rule.id }) }}>
          Delete rule
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
