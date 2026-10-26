import Link from 'next/link'
import { Fragment } from 'react'
import { cn } from '@/lib/utils'
import { DataTable, EmptyState, ErrorBanner, PlatformPage, StatusCell, Td, rowActionLineClass, rowActionsBlockClass, type Tone } from '../../components/PlatformUI'
import { FilterTabs } from '../../listings/components/FilterTabs'
import { LocalDateTime } from '../../showings/components/LocalDateTime'
import { TaskDrawer, priorityOptions } from '../components/TaskForms'
import { TaskRowActions } from '../components/TaskRowActions'
import { getTaskOptions, getTaskQueue, getViewerId, type AgentTaskRow, type TaskCounts } from '../lib/tasks'

const statusMeta: Record<string, { label: string; tone: Tone }> = {
  open: { label: 'Open', tone: 'sky' },
  in_progress: { label: 'In progress', tone: 'amber' },
  blocked: { label: 'Blocked', tone: 'rose' },
  done: { label: 'Done', tone: 'emerald' },
}

/** "Active" is the working set: open and in progress. Single statuses stay reachable for old links. */
const views: Record<string, string[] | null> = {
  active: ['open', 'in_progress'],
  open: ['open'],
  in_progress: ['in_progress'],
  blocked: ['blocked'],
  done: ['done'],
  all: null,
}

const HOUR = 36e5
const buckets: Array<{ label: string; test: (due: number | null, now: number) => boolean }> = [
  { label: 'Overdue', test: (due, now) => due !== null && due < now },
  { label: 'Due within 24 hours', test: (due, now) => due !== null && due < now + 24 * HOUR },
  { label: 'Due within 7 days', test: (due, now) => due !== null && due < now + 7 * 24 * HOUR },
  { label: 'Later', test: due => due !== null },
  { label: 'No due date', test: () => true },
]

const priorityLabel = (value: string) => priorityOptions.find(([key]) => key === value)?.[1] || value
const priorityClass: Record<string, string> = { urgent: 'font-semibold text-foreground', high: 'font-medium text-foreground', normal: 'text-muted-foreground', low: 'text-muted-foreground' }

const activeCount = (counts: TaskCounts | null) => (counts ? counts.open + counts.inProgress : null)

/** Scope is always explicit in links, so a page that opened on Everyone (nothing active is yours) can still go to Mine. */
function tasksHref(view: string, scope: string) {
  const params = new URLSearchParams()
  if (view !== 'active') params.set('status', view)
  params.set('scope', scope)
  const query = params.toString()
  return query ? `/dashboard/platform/tasks?${query}` : '/dashboard/platform/tasks'
}

function Due({ task, now, className }: { task: AgentTaskRow; now: number; className?: string }) {
  if (!task.dueAt) return <span className={cn('text-muted-foreground', className)}>No date</span>
  const overdue = task.status !== 'done' && Date.parse(task.dueAt) < now
  return (
    <span className={cn('whitespace-nowrap tabular-nums', overdue ? 'font-semibold text-destructive' : 'text-foreground', className)}>
      {overdue ? 'Overdue · ' : null}<LocalDateTime value={task.dueAt} options={{ month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }} />
    </span>
  )
}

export async function TaskListPage({ searchParams }: { searchParams: Promise<{ status?: string; scope?: string }> }) {
  const params = await searchParams
  const view = params.status && params.status in views ? params.status : 'active'
  const viewerId = await getViewerId()
  // Both scopes are loaded so each scope tab carries its count, and so an operator with
  // nothing active of their own (an admin, a coordinator) does not open on an empty page
  // while the brokerage has overdue work: without an explicit scope the page then opens on Everyone.
  const [mine, everyone, options] = await Promise.all([
    viewerId ? getTaskQueue(viewerId) : Promise.resolve(null),
    getTaskQueue(null),
    getTaskOptions(),
  ])
  const requestedScope = params.scope === 'everyone' || params.scope === 'mine' ? params.scope : null
  const scope = !viewerId || !mine ? 'everyone'
    : requestedScope ? requestedScope
    : mine.error || (activeCount(mine.counts) ?? 0) > 0 ? 'mine'
    : (activeCount(everyone.counts) ?? 0) > 0 ? 'everyone' : 'mine'
  const { tasks, counts, error } = scope === 'mine' && mine ? mine : everyone
  const defaultedToEveryone = Boolean(viewerId && mine && !requestedScope && scope === 'everyone')

  const now = Date.now()
  const statuses = views[view]
  const visible = statuses ? tasks.filter(task => statuses.includes(task.status)) : tasks
  let grouped: Array<{ label: string; items: AgentTaskRow[] }>
  if (view === 'done') {
    grouped = [{ label: '', items: [...visible].sort((a, b) => (Date.parse(b.completedAt || '') || 0) - (Date.parse(a.completedAt || '') || 0)) }]
  } else {
    grouped = buckets.map(bucket => ({ label: bucket.label, items: [] }))
    for (const task of visible) {
      const due = task.dueAt ? Date.parse(task.dueAt) : null
      const index = buckets.findIndex(bucket => bucket.test(due, now))
      grouped[index]?.items.push(task)
    }
  }
  const groups = grouped.filter(group => group.items.length)
  const overdue = visible.filter(task => task.status !== 'done' && task.dueAt && Date.parse(task.dueAt) < now).length
  const showAgent = scope === 'everyone'
  const metaParts = error ? [] : [
    defaultedToEveryone ? <span key="scope">Nothing active is assigned to you, so this shows everyone’s tasks</span> : null,
    overdue && view !== 'done' ? <span key="overdue" className="font-medium text-destructive">{overdue} overdue</span> : null,
  ].filter(Boolean).flatMap((node, index) => index ? [<span key={`sep-${index}`} aria-hidden> · </span>, node] : [node])

  const head = [
    { label: 'Task' },
    { label: 'Status', className: 'hidden md:table-cell' },
    { label: 'Due', className: 'hidden w-40 md:table-cell' },
    { label: 'Priority', className: 'hidden w-24 lg:table-cell' },
    ...(showAgent ? [{ label: 'Agent', className: 'hidden xl:table-cell' }] : []),
    { label: <span className="sr-only">Actions</span>, className: 'hidden w-px md:table-cell' },
  ]
  const columns = head.length

  // Whose tasks and which status share one underline row: scope first, then a divider, then status.
  const scopeItems = viewerId && mine ? [
    { label: 'Mine', href: tasksHref(view, 'mine'), active: scope === 'mine', current: 'true' as const, count: activeCount(mine.counts) },
    { label: 'Everyone', href: tasksHref(view, 'everyone'), active: scope === 'everyone', current: 'true' as const, count: activeCount(everyone.counts) },
  ] : []
  const tabItems = [
    ...scopeItems,
    { divider: scopeItems.length > 0, label: 'Active', href: tasksHref('active', scope), active: view === 'active' || view === 'open' || view === 'in_progress', count: counts ? counts.open + counts.inProgress : null },
    { label: 'Blocked', href: tasksHref('blocked', scope), active: view === 'blocked', count: counts ? counts.blocked : null },
    { label: 'Done', href: tasksHref('done', scope), active: view === 'done', count: counts ? counts.done : null },
    { label: 'All', href: tasksHref('all', scope), active: view === 'all', count: counts ? counts.open + counts.inProgress + counts.blocked + counts.done : null },
  ]

  return (
    <PlatformPage
      crumbs={[{ label: 'Tasks' }]}
      title={scope === 'mine' ? 'My tasks' : 'Tasks'}
      meta={metaParts.length ? metaParts : null}
      actions={<TaskDrawer options={options} />}
      toolbar={<FilterTabs label="Whose tasks and task status" items={tabItems} />}
    >
      <div className="pb-16">
        {error ? <ErrorBanner>Tasks could not be loaded. {error}</ErrorBanner> : groups.length ? (
          <DataTable label="Tasks" head={head}>
            {groups.map(group => (
              <Fragment key={group.label || 'done'}>
                {group.label ? (
                  <tr>
                    <th scope="colgroup" colSpan={columns} className={cn('border-b bg-muted/20 px-3 py-1.5 text-left text-xs font-semibold', group.label === 'Overdue' ? 'text-destructive' : 'text-foreground')}>
                      {group.label}<span className="ml-2 font-medium tabular-nums text-muted-foreground">{group.items.length}</span>
                    </th>
                  </tr>
                ) : null}
                {group.items.map(task => {
                  const related = [
                    task.lead ? <Link key="lead" href={`/dashboard/platform/leads/${task.lead.id}`} className="hover:text-foreground hover:underline">{task.lead.name}</Link> : null,
                    task.deal ? <Link key="deal" href={`/dashboard/platform/pipeline/${task.deal.id}`} className="hover:text-foreground hover:underline">{task.deal.title}</Link> : null,
                    task.property ? <Link key="property" href={`/dashboard/platform/listings/${task.property.id}`} className="hover:text-foreground hover:underline">{task.property.title}</Link> : null,
                  ].filter(Boolean).flatMap((node, index) => index ? [' · ', node] : [node])
                  const meta = statusMeta[task.status] || { label: task.status, tone: 'zinc' as Tone }
                  return (
                    <tr key={task.id} className="transition-colors hover:bg-muted/30">
                      <Td className="min-w-0 max-w-[28rem] py-2">
                        <span className="block font-medium text-foreground">{task.title}</span>
                        {related.length ? <span className="block truncate text-xs text-muted-foreground">{related}</span> : null}
                        {task.notes ? <span className="block truncate text-xs text-foreground/80">{task.notes}</span> : null}
                        <span className="mt-1 flex flex-wrap items-center gap-x-3 text-xs md:hidden"><StatusCell tone={meta.tone}>{meta.label}</StatusCell><Due task={task} now={now} /></span>
                        {showAgent ? <span className="block text-xs text-muted-foreground xl:hidden">{task.assignedAgent?.name || 'Unassigned'}</span> : null}
                        <div className={rowActionLineClass}><TaskRowActions task={task} options={options} className={rowActionsBlockClass} /></div>
                      </Td>
                      <Td className="hidden py-2 md:table-cell"><StatusCell tone={meta.tone}>{meta.label}</StatusCell></Td>
                      <Td className="hidden py-2 text-[13px] md:table-cell"><Due task={task} now={now} /></Td>
                      <Td className={cn('hidden py-2 text-[13px] lg:table-cell', priorityClass[task.priority] || 'text-muted-foreground')}>{priorityLabel(task.priority)}</Td>
                      {showAgent ? <Td className="hidden whitespace-nowrap py-2 text-[13px] xl:table-cell">{task.assignedAgent?.name || <span className="text-muted-foreground">Unassigned</span>}</Td> : null}
                      <Td className="hidden py-2 md:table-cell"><TaskRowActions task={task} options={options} /></Td>
                    </tr>
                  )
                })}
              </Fragment>
            ))}
          </DataTable>
        ) : (
          <EmptyState title={view === 'active' ? (scope === 'mine' ? 'No active tasks assigned to you' : 'No active tasks') : view === 'all' ? 'No tasks' : `No ${(statusMeta[view]?.label || view).toLowerCase()} tasks`}>
            {scope === 'mine' && viewerId ? <Link href={tasksHref(view, 'everyone')} className="text-sm font-medium text-foreground underline-offset-2 hover:underline">Everyone’s tasks</Link> : null}
          </EmptyState>
        )}
      </div>
    </PlatformPage>
  )
}
