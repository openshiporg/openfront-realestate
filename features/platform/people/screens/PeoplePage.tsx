import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { getAuthenticatedUser } from '@/features/dashboard/actions/auth'
import { upgradeLegacyImagePath } from '@/features/lib/real-estate-images'
import { humanize } from '../../leads/lib/labels'
import { DataTable, EmptyState, ErrorBanner, PlatformPage, Stats, StatusCell, Td, rowActionLineClass, rowActionsBlockClass } from '../../components/PlatformUI'
import { FilterTabs } from '../../listings/components/FilterTabs'
import { getPlatformPeople, type PlatformAgent } from '../actions/people'
import { AddMemberDrawer, MemberRowActions } from '../components/MemberForms'

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

function Count({ value }: { value: number }) {
  return <span className={value ? 'text-foreground' : 'text-muted-foreground'}>{value}</span>
}

/** Busiest first: open leads, then showings, then name. */
function byWorkload(a: PlatformAgent, b: PlatformAgent) {
  return b.leadCount - a.leadCount || b.showingCount - a.showingCount || a.name.localeCompare(b.name)
}

const quietLink = 'inline-flex h-8 items-center gap-1 rounded-[6px] px-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50'

export async function PeoplePage({ searchParams }: { searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = (await searchParams) || {}
  const view = params.view === 'teams' ? 'teams' : 'agents'
  const [{ agents, teams, error }, viewerId] = await Promise.all([getPlatformPeople(), currentUserId()])
  const activeTeams = teams.filter(team => team.status === 'active').length
  const brokerageId = agents.flatMap(agent => agent.memberships).find(membership => membership.isPrimary)?.brokerage?.id || agents[0]?.memberships[0]?.brokerage?.id
  const licensedAgents = agents.filter(agent => agent.licenseNumber).length
  const sorted = [...agents].sort(byWorkload)

  return (
    <PlatformPage
      crumbs={[{ label: 'Agents & Teams' }]}
      title="Agents & Teams"
      actions={<>
        <Link href="/dashboard/users" className={quietLink}>User records <ArrowUpRight aria-hidden className="size-3.5" /></Link>
        <Link href="/dashboard/agent-teams" className={quietLink}>Team records <ArrowUpRight aria-hidden className="size-3.5" /></Link>
        {brokerageId ? <AddMemberDrawer brokerageId={brokerageId} /> : null}
      </>}
      toolbar={<>
        <Stats items={[['Agents', agents.length], ['Licensed', licensedAgents], ['Teams', teams.length], ['Active teams', activeTeams]]} />
        <FilterTabs label="People views" items={[
          { label: 'Agent workload', href: '/dashboard/platform/people', active: view === 'agents', count: agents.length },
          { label: 'Teams', href: '/dashboard/platform/people?view=teams', active: view === 'teams', count: teams.length },
        ]} />
      </>}
    >
      <div className="space-y-5 pb-16">
        {error ? <ErrorBanner>Agents could not be loaded. {error}</ErrorBanner> : null}

        {view === 'agents' ? (
          sorted.length ? (
            <DataTable
              label="Agent workload"
              head={[
                { label: 'Agent' },
                { label: 'Position', className: 'hidden md:table-cell' },
                { label: 'License', className: 'hidden xl:table-cell' },
                { label: 'Listings', className: 'hidden text-right sm:table-cell' },
                { label: 'Leads', className: 'text-right' },
                { label: 'Showings', className: 'hidden text-right sm:table-cell' },
                { label: 'Deals', className: 'hidden text-right sm:table-cell' },
                { label: <span className="sr-only">Actions</span>, className: 'hidden text-right md:table-cell' },
              ]}
            >
              {sorted.map(agent => {
                const membership = agent.memberships[0]
                const canSuspend = Boolean(membership?.id) && membership?.membershipRole !== 'owner' && agent.id !== viewerId
                const position = membershipLabels[membership?.membershipRole || ''] || humanize(membership?.membershipRole, 'Member')
                const actions = (className?: string) => <MemberRowActions membershipId={membership?.id} memberName={agent.name} viewHref={`/dashboard/users/${encodeURIComponent(agent.id)}`} canSuspend={canSuspend} className={className} />
                return (
                  <tr key={agent.id} className="transition-colors hover:bg-muted/30">
                    <Td className="py-2">
                      <div className="flex min-w-0 items-center gap-3">
                        {agent.avatarUrl
                          ? <img src={upgradeLegacyImagePath(agent.avatarUrl)} alt="" className="size-8 shrink-0 rounded-full object-cover" />
                          : <div className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-foreground">{initials(agent.name)}</div>}
                        <div className="min-w-0">
                          <p className="max-w-[12rem] truncate font-medium text-foreground sm:max-w-[18rem]">{agent.name}</p>
                          <p className="max-w-[12rem] truncate text-xs text-muted-foreground sm:max-w-[18rem]">{[agent.brokerageTitle || agent.role?.name, agent.email].filter(Boolean).join(' · ')}</p>
                          <p className="text-xs text-muted-foreground sm:hidden">{agent.listingCount} listings · {agent.showingCount} showings · {agent.dealCount} deals</p>
                        </div>
                      </div>
                      <div className={rowActionLineClass}>{actions(rowActionsBlockClass)}</div>
                    </Td>
                    <Td className="hidden whitespace-nowrap md:table-cell">{position}</Td>
                    <Td className="hidden whitespace-nowrap xl:table-cell">{agent.licenseNumber ? <span className="tabular-nums">{agent.licenseNumber}</span> : <span className="text-amber-700 dark:text-amber-400">None on file</span>}</Td>
                    <Td className="hidden text-right tabular-nums sm:table-cell"><Count value={agent.listingCount} /></Td>
                    <Td className="text-right font-medium tabular-nums"><Count value={agent.leadCount} /></Td>
                    <Td className="hidden text-right tabular-nums sm:table-cell"><Count value={agent.showingCount} /></Td>
                    <Td className="hidden text-right tabular-nums sm:table-cell"><Count value={agent.dealCount} /></Td>
                    <Td className="hidden w-px whitespace-nowrap py-2 text-right md:table-cell">{actions()}</Td>
                  </tr>
                )
              })}
            </DataTable>
          ) : <EmptyState title="No agents" />
        ) : (
          teams.length ? (
            <DataTable
              label="Teams"
              head={[
                { label: 'Team' },
                { label: 'Status' },
                { label: 'Team lead', className: 'hidden md:table-cell' },
                { label: 'Leads', className: 'hidden text-right sm:table-cell' },
                { label: 'Deals', className: 'hidden text-right sm:table-cell' },
                { label: 'Members', className: 'hidden lg:table-cell' },
              ]}
            >
              {teams.map(team => (
                <tr key={team.id} className="transition-colors hover:bg-muted/30">
                  <Td>
                    <p className="font-medium text-foreground">{team.name}</p>
                    <p className="max-w-[16rem] truncate text-xs text-muted-foreground sm:max-w-[22rem]">{team.description || `${humanize(team.teamType)} team`}</p>
                  </Td>
                  <Td className="whitespace-nowrap"><StatusCell tone={team.status === 'active' ? 'emerald' : 'zinc'}>{humanize(team.status)}</StatusCell></Td>
                  <Td className="hidden whitespace-nowrap md:table-cell">{team.leadAgent?.name || <span className="text-amber-700 dark:text-amber-400">Unassigned</span>}</Td>
                  <Td className="hidden text-right tabular-nums sm:table-cell"><Count value={team.leadCount} /></Td>
                  <Td className="hidden text-right tabular-nums sm:table-cell"><Count value={team.dealCount} /></Td>
                  <Td className="hidden max-w-[20rem] text-muted-foreground lg:table-cell">{team.members.length ? team.members.map(member => member.name).join(', ') : 'No members'}</Td>
                </tr>
              ))}
            </DataTable>
          ) : <EmptyState title="No teams" />
        )}
      </div>
    </PlatformPage>
  )
}
