import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type AgentTaskRow = {
  id: string; title: string; status: string; priority: string; dueAt: string | null; completedAt: string | null; notes: string
  assignedAgent: { id: string; name: string } | null; property: { id: string; title: string } | null; lead: { id: string; name: string } | null; deal: { id: string; title: string } | null
}
export type TaskOptions = { agents: Array<{ id: string; name: string }>; leads: Array<{ id: string; name: string }>; deals: Array<{ id: string; title: string }>; properties: Array<{ id: string; title: string }> }

const TASK_FIELDS = 'id title status priority dueAt completedAt notes assignedAgent { id name } property { id title } lead { id name } deal { id title }'

export async function getTasks(status: string) {
  const where = status === 'all' ? {} : { status: { equals: status } }
  const response = await keystoneClient<{ agentTasks: AgentTaskRow[]; open: number; inProgress: number; blocked: number; done: number }>(`
    query PlatformTasks($where: AgentTaskWhereInput!) {
      agentTasks(where: $where, orderBy: [{ dueAt: asc }, { createdAt: desc }], take: 200) { ${TASK_FIELDS} }
      open: agentTasksCount(where: { status: { equals: open } })
      inProgress: agentTasksCount(where: { status: { equals: in_progress } })
      blocked: agentTasksCount(where: { status: { equals: blocked } })
      done: agentTasksCount(where: { status: { equals: done } })
    }`, { where }, { cache: 'no-store' })
  if (!response.success) return { tasks: [] as AgentTaskRow[], counts: null, error: response.error }
  const { agentTasks, ...counts } = response.data
  return { tasks: agentTasks, counts, error: null }
}

export async function getTaskOptions(): Promise<TaskOptions> {
  const response = await keystoneClient<any>(`query TaskOptions {
    brokerageMemberships(where: { status: { equals: active } }, take: 200) { user { id name } }
    leads(where: { status: { notIn: [closed, lost] } }, orderBy: [{ createdAt: desc }], take: 200) { id name }
    deals(where: { stage: { notIn: [closed_won, closed_lost] } }, orderBy: [{ updatedAt: desc }], take: 200) { id title }
    properties(orderBy: [{ updatedAt: desc }], take: 200) { id title }
  }`, {}, { cache: 'no-store' })
  if (!response.success) return { agents: [], leads: [], deals: [], properties: [] }
  return {
    agents: (response.data.brokerageMemberships as Array<{ user: { id: string; name: string } | null }>).flatMap(m => m.user ? [m.user] : []),
    leads: response.data.leads, deals: response.data.deals, properties: response.data.properties,
  }
}
