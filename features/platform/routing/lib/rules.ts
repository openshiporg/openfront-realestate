import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type RoutingRule = {
  id: string; name: string; status: string; priority: number | null; intent: string; source: string
  city: string; state: string; postalCode: string; isFallback: boolean
  assignedAgent: { id: string; name: string } | null; assignedTeam: { id: string; name: string } | null
}
export type RoutingOptions = { agents: Array<{ id: string; name: string }>; teams: Array<{ id: string; name: string }> }

export async function getRoutingRules() {
  const response = await keystoneClient<{ leadRoutingRules: RoutingRule[] }>(
    'query RoutingRules { leadRoutingRules(orderBy: [{ priority: asc }], take: 200) { id name status priority intent source city state postalCode isFallback assignedAgent { id name } assignedTeam { id name } } }',
    {}, { cache: 'no-store' },
  )
  return response.success ? { rules: response.data.leadRoutingRules, error: null } : { rules: [] as RoutingRule[], error: response.error }
}

export async function getRoutingOptions(): Promise<RoutingOptions> {
  const response = await keystoneClient<any>('query RoutingOptions { brokerageMemberships(where: { status: { equals: active } }, take: 200) { user { id name } } agentTeams(where: { status: { equals: active } }, take: 100) { id name } }', {}, { cache: 'no-store' })
  if (!response.success) return { agents: [], teams: [] }
  return { agents: (response.data.brokerageMemberships as Array<{ user: { id: string; name: string } | null }>).flatMap(m => m.user ? [m.user] : []), teams: response.data.agentTeams }
}
