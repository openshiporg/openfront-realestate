import Link from 'next/link'
import { getAuthenticatedUser } from '@/features/dashboard/actions/auth'
import { Button } from '@/components/ui/button'
import { upgradeLegacyImagePath } from '@/features/lib/real-estate-images'
import { humanize } from '../../leads/lib/labels'
import { EmptyState, ErrorBanner, PlatformPage, Stats, TitleLine, Track } from '../../components/PlatformUI'
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

  return (
    <PlatformPage
      crumbs={[{ label: 'Agents & Teams' }]}
      title="Agents & Teams"
      actions={<>
        <Button asChild variant="outline" className="rounded-full"><Link href="/dashboard/users">People</Link></Button>
        <Button asChild variant="outline" className="rounded-full"><Link href="/dashboard/agent-teams">Teams</Link></Button>
      </>}
      toolbar={<Stats items={[['Agents', agents.length], ['Licensed', licensedAgents], ['Teams', teams.length], ['Active teams', activeTeams]]} />}
    >
      <div className="space-y-8">
        {error ? <ErrorBanner>Agents could not be loaded. {error}</ErrorBanner> : null}

        {brokerageId ? (
          <details className="rounded-xl border border-border bg-card shadow-xs">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-foreground">Add member</summary>
            <div className="border-t border-border p-4"><InviteMemberForm brokerageId={brokerageId} /></div>
          </details>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Agents</h2>
          {agents.length ? (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              {agents.map(agent => {
                const membership = agent.memberships[0]
                const canSuspend = Boolean(membership?.id) && membership?.membershipRole !== 'owner' && agent.id !== viewerId
                return (
                  <li key={agent.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <div className="flex min-w-0 items-start gap-3">
                      {agent.avatarUrl
                        ? <img src={upgradeLegacyImagePath(agent.avatarUrl)} alt="" className="size-10 shrink-0 rounded-full object-cover" />
                        : <div className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold text-foreground">{initials(agent.name)}</div>}
                      <div className="min-w-0">
                        <TitleLine as="h3" status={membershipLabels[membership?.membershipRole || ''] || humanize(membership?.membershipRole, 'Member')} headingClassName="text-sm">{agent.name}</TitleLine>
                        <p className="truncate text-sm text-muted-foreground">{[agent.brokerageTitle || agent.role?.name, agent.email, agent.phone].filter(Boolean).join(' · ')}</p>
                        <p className="text-xs text-muted-foreground">{agent.licenseNumber ? `License ${agent.licenseNumber}` : 'No license on file'}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 md:justify-end">
                      <dl className="flex gap-4 text-center">
                        {([['Listings', agent.listingCount], ['Leads', agent.leadCount], ['Showings', agent.showingCount], ['Deals', agent.dealCount]] as Array<[string, number]>).map(([label, value]) => (
                          <div key={label} className="flex flex-col-reverse"><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="text-sm font-semibold tabular-nums text-foreground">{value}</dd></div>
                        ))}
                      </dl>
                      {canSuspend ? <Track><SuspendMemberButton membershipId={membership.id} memberName={agent.name} /></Track> : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : <EmptyState title="No agents" />}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Teams</h2>
          {teams.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {teams.map(team => (
                <article key={team.id} className="rounded-xl border border-border bg-card p-4 shadow-xs">
                  <TitleLine as="h3" tone={team.status === 'active' ? 'emerald' : 'zinc'} status={humanize(team.status)} headingClassName="text-sm">{team.name}</TitleLine>
                  <p className="mt-1 text-sm text-muted-foreground">{team.description || `${humanize(team.teamType)} team`}</p>
                  <dl className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-2 text-sm">
                    <div className="min-w-0"><dt className="text-xs text-muted-foreground">Lead</dt><dd className="truncate font-medium text-foreground">{team.leadAgent?.name || 'Unassigned'}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Leads</dt><dd className="font-semibold tabular-nums text-foreground">{team.leadCount}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Deals</dt><dd className="font-semibold tabular-nums text-foreground">{team.dealCount}</dd></div>
                  </dl>
                  <p className="mt-3 text-sm text-muted-foreground">{team.members.length ? team.members.map(member => member.name).join(', ') : 'No members'}</p>
                </article>
              ))}
            </div>
          ) : <EmptyState title="No teams" />}
        </section>
      </div>
    </PlatformPage>
  )
}
