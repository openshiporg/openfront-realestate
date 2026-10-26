'use client'

import { Fragment, startTransition, useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { pillClass, pillPrimaryClass } from '../../components/styles'
import { transitionTask } from '../../operations/actions/operations'
import type { AgentTaskRow, TaskOptions } from '../lib/tasks'
import { TaskDrawer } from './TaskForms'

type State = { ok: boolean; message: string; uncertain?: boolean }
const initial: State = { ok: false, message: '' }

/** Primary move per status first; the rest go in the menu. "Blocked" is last as the move nobody wants. */
const moves: Record<string, Array<[string, string]>> = {
  open: [['in_progress', 'Start'], ['done', 'Mark done'], ['blocked', 'Mark blocked']],
  in_progress: [['done', 'Mark done'], ['open', 'Move back to open'], ['blocked', 'Mark blocked']],
  blocked: [['in_progress', 'Resume'], ['done', 'Mark done']],
  done: [['open', 'Reopen']],
}

export function TaskRowActions({ task, options }: { task: AgentTaskRow; options: TaskOptions }) {
  const [state, action, pending] = useActionState(transitionTask, initial)
  const [target, setTarget] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!state.message) return
    if (state.uncertain) toast.warning(state.message)
    else if (state.ok) { toast.success(state.message); router.refresh() }
    else toast.error(state.message)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const [primary, ...rest] = moves[task.status] || []
  const blocked = pending || state.uncertain === true

  function move(status: string) {
    if (blocked) return
    setTarget(status)
    const form = new FormData()
    form.set('taskId', task.id)
    form.set('status', status)
    startTransition(() => action(form))
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {primary ? (
        <Button type="button" variant="ghost" size="sm" className={cn(task.status === 'done' ? pillClass : pillPrimaryClass, 'max-sm:h-9')} disabled={blocked} onClick={() => move(primary[0])}>
          {state.uncertain ? 'Refresh to check' : pending && target === primary[0] ? 'Updating…' : primary[1]}
        </Button>
      ) : null}
      <TaskDrawer task={task} options={options} />
      {rest.length ? (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label={`More actions for ${task.title}`} className="size-8 rounded-[6px] border border-transparent text-muted-foreground shadow-none hover:border-border hover:text-foreground active:scale-[0.97] data-[state=open]:border-border max-sm:size-9">
              <MoreHorizontal aria-hidden className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44 rounded-[6px]">
            {rest.map(([status, label], index) => (
              <Fragment key={status}>
                {status === 'blocked' && index ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem className="rounded-[4px]" disabled={blocked} onSelect={() => move(status)}>{pending && target === status ? 'Updating…' : label}</DropdownMenuItem>
              </Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}
