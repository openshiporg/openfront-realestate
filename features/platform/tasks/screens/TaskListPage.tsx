import Link from 'next/link'
import { EmptyState, ErrorBanner, PlatformPage, TitleLine, Track, type Tone } from '../../components/PlatformUI'
import { FilterTabs } from '../../listings/components/FilterTabs'
import { TaskAction } from '../../operations/components/TaskForms'
import { LocalDateTime } from '../../showings/components/LocalDateTime'
import { TaskDrawer, priorityOptions } from '../components/TaskForms'
import { getTaskOptions, getTasks } from '../lib/tasks'

const statuses: Array<{ value: string; label: string; tone: Tone; count: 'open' | 'inProgress' | 'blocked' | 'done' }> = [
  { value: 'open', label: 'Open', tone: 'sky', count: 'open' },
  { value: 'in_progress', label: 'In progress', tone: 'amber', count: 'inProgress' },
  { value: 'blocked', label: 'Blocked', tone: 'rose', count: 'blocked' },
  { value: 'done', label: 'Done', tone: 'emerald', count: 'done' },
]
const next: Record<string, Array<[string, string]>> = {
  open: [['in_progress', 'Start'], ['done', 'Done'], ['blocked', 'Blocked']],
  in_progress: [['done', 'Done'], ['blocked', 'Blocked'], ['open', 'Reopen']],
  blocked: [['in_progress', 'Resume'], ['done', 'Done']],
  done: [['open', 'Reopen']],
}
const isOverdue = (dueAt: string | null, status: string) => Boolean(dueAt && status !== 'done' && Date.parse(dueAt) < Date.now())
const priorityLabel = (value: string) => priorityOptions.find(([key]) => key === value)?.[1] || value

export async function TaskListPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams
  const status = statuses.some(entry => entry.value === params.status) || params.status === 'all' ? params.status! : 'open'
  const [{ tasks, counts, error }, options] = await Promise.all([getTasks(status), getTaskOptions()])

  return (
    <PlatformPage
      crumbs={[{ label: 'Tasks' }]}
      title="Tasks"
      actions={<Track><TaskDrawer options={options} /></Track>}
      toolbar={<FilterTabs label="Task status" items={[
        ...statuses.map(entry => ({ label: entry.label, href: `/dashboard/platform/tasks?status=${entry.value}`, active: status === entry.value, count: counts ? counts[entry.count] : null })),
        { label: 'All', href: '/dashboard/platform/tasks?status=all', active: status === 'all', count: null },
      ]} />}
    >
      {error ? <ErrorBanner>Tasks could not be loaded. {error}</ErrorBanner> : tasks.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {tasks.map(task => {
            const tone = statuses.find(entry => entry.value === task.status)?.tone || 'zinc'
            const overdue = isOverdue(task.dueAt, task.status)
            return (
              <li key={task.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <TitleLine tone={tone} status={[statuses.find(entry => entry.value === task.status)?.label, priorityLabel(task.priority)].filter(Boolean).join(' · ')} headingClassName="text-sm">{task.title}</TitleLine>
                  <p className="text-sm text-muted-foreground">
                    {task.assignedAgent?.name || 'Unassigned'}
                    {task.dueAt ? <> · <span className={overdue ? 'font-medium text-destructive' : undefined}>{overdue ? 'Overdue ' : 'Due '}<LocalDateTime value={task.dueAt} options={{ month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }} /></span></> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      task.lead ? <Link key="lead" href={`/dashboard/platform/leads/${task.lead.id}`} className="hover:underline">{task.lead.name}</Link> : null,
                      task.deal ? <Link key="deal" href={`/dashboard/platform/pipeline/${task.deal.id}`} className="hover:underline">{task.deal.title}</Link> : null,
                      task.property ? <Link key="property" href={`/dashboard/platform/listings/${task.property.id}`} className="hover:underline">{task.property.title}</Link> : null,
                    ].filter(Boolean).flatMap((node, index) => index ? [' · ', node] : [node])}
                  </p>
                  {task.notes ? <p className="mt-1 text-sm text-foreground/90">{task.notes}</p> : null}
                </div>
                <Track label={`${task.title} actions`}>
                  {(next[task.status] || []).map(([value, text]) => <TaskAction key={value} taskId={task.id} status={value} label={text} />)}
                  <TaskDrawer task={task} options={options} />
                </Track>
              </li>
            )
          })}
        </ul>
      ) : <EmptyState title={status === 'all' ? 'No tasks' : `No ${statuses.find(entry => entry.value === status)?.label.toLowerCase()} tasks`} />}
    </PlatformPage>
  )
}
