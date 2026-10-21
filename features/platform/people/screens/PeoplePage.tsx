import Link from 'next/link'
import { PageBreadcrumbs } from '@/features/dashboard/components/PageBreadcrumbs'
import { getAuthenticatedUser } from '@/features/dashboard/actions/auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { humanize } from '../../leads/lib/labels'
import { getPlatformPeople } from '../actions/people'
import { InviteMemberForm, SuspendMemberButton } from '../components/MemberForms'

const membershipLabels: Record<string, string> = { owner: 'Owner', admin: 'Administrator', team_lead: 'Team lead', agent: 'Agent', coordinator: 'Coordinator', analyst: 'Analyst' }

function initials(name: string) { return name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() }

async function currentUserId() {
  try {
    const response = await getAuthenticatedUser()
    const item = response.success ? (response.data as { authenticatedItem?: { id?: string } | null })?.authenticatedItem : null
    return item?.id || null
  } catch {
    return null
  }
}

export async function PeoplePage() {
  const [{ agents, teams, error }, viewerId] = await Promise.all([getPlatformPeople(), currentUserId()])
  const activeTeams = teams.filter(team => team.status === 'active').length
  const brokerageId = agents.flatMap(agent => agent.memberships).find(membership => membership.isPrimary)?.brokerage?.id || agents[0]?.memberships[0]?.brokerage?.id
  const licensedAgents = agents.filter(agent => agent.licenseNumber).length
  const summary: Array<[string, number]> = [['Agents', agents.length], ['Licensed', licensedAgents], ['Teams', teams.length], ['Active teams', activeTeams]]

  return (
    <section className="overflow-hidden flex flex-col">
      <PageBreadcrumbs
        items={[
          { type: 'link', label: 'Dashboard', href: '/' },
          { type: 'page', label: 'Platform' },
          { type: 'page', label: 'Agents & Teams' },
        ]}
      />
      <div className="flex flex-col gap-4 px-4 pt-4 md:px-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Agents & Teams</h1>
          <p className="text-muted-foreground">Manage agents, teams and workload</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href="/dashboard/users">Manage people</Link></Button>
          <Button asChild variant="outline"><Link href="/dashboard/agent-teams">Manage teams</Link></Button>
        </div>
      </div>

      <div className="space-y-6 px-4 py-4 md:px-6">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {summary.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border bg-card p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-xl font-semibold text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
        {error ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Agents could not be loaded. {error}</div> : null}
        {brokerageId ? <InviteMemberForm brokerageId={brokerageId} /> : null}

        <div>
          <h2 className="text-base font-semibold text-foreground">Agents</h2>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {agents.length ? agents.map(agent => {
              const membership = agent.memberships[0]
              const canSuspend = Boolean(membership?.id) && membership?.membershipRole !== 'owner' && agent.id !== viewerId
              return (
                <article key={agent.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold text-foreground">{initials(agent.name)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">{agent.name}</h3>
                          <p className="text-sm text-muted-foreground">{agent.brokerageTitle || agent.role?.name || 'Member'}</p>
                        </div>
                        <Badge variant="outline">{membershipLabels[membership?.membershipRole || ''] || humanize(membership?.membershipRole, 'Member')}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{agent.email}{agent.phone ? ` · ${agent.phone}` : ''}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{agent.licenseNumber ? `License ${agent.licenseNumber}` : 'No license on file'}</p>
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-4 gap-2 rounded-md bg-muted/50 p-2 text-center">
                    <div><dt className="text-xs text-muted-foreground">Listings</dt><dd className="font-semibold text-foreground">{agent.listingCount}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Leads</dt><dd className="font-semibold text-foreground">{agent.leadCount}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Showings</dt><dd className="font-semibold text-foreground">{agent.showingCount}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Deals</dt><dd className="font-semibold text-foreground">{agent.dealCount}</dd></div>
                  </dl>
                  {canSuspend ? <SuspendMemberButton membershipId={membership.id} memberName={agent.name} /> : null}
                </article>
              )
            }) : <p className="text-sm text-muted-foreground">No agents</p>}
          </div>
        </div>

        <div>
          <h2 className="text-base font-semibold text-foreground">Teams</h2>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {teams.length ? teams.map(team => (
              <article key={team.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{team.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{team.description || `${humanize(team.teamType)} team`}</p>
                  </div>
                  <Badge variant="outline">{humanize(team.status)}</Badge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">Team lead: <span className="font-medium text-foreground">{team.leadAgent?.name || 'Unassigned'}</span></p>
                <p className="mt-1 text-sm text-muted-foreground">{team.members.length ? team.members.map(member => member.name).join(', ') : 'No members'}</p>
                <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
                  <span><strong className="text-foreground">{team.leadCount}</strong> leads</span>
                  <span><strong className="text-foreground">{team.dealCount}</strong> deals</span>
                </div>
              </article>
            )) : <p className="text-sm text-muted-foreground">No teams</p>}
          </div>
        </div>
      </div>
    </section>
  )
}
