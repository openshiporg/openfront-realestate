import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { DataTable, EmptyState, ErrorBanner, PlatformPage, StatusCell, Td, rowActionLineClass, rowActionsBlockClass, type Tone } from '../../components/PlatformUI'
import { cn } from '@/lib/utils'
import { RoutingRuleActions, RoutingRuleDrawer } from '../components/RoutingForms'
import { intentOptions, sourceOptions } from '../lib/options'
import { getRoutingOptions, getRoutingRules, type RoutingRule } from '../lib/rules'

const optionLabel = (options: Array<[string, string]>, value: string) => options.find(([key]) => key === value)?.[1] || value

const assignee = (rule: RoutingRule) => [rule.assignedAgent?.name, rule.assignedTeam?.name].filter(Boolean).join(' · ')
const area = (rule: RoutingRule) => [rule.city, rule.state, rule.postalCode].filter(Boolean).join(' ')
const isBroad = (rule: RoutingRule) => ['any', 'website'].includes(rule.source || 'any') && !area(rule)

type Coverage = { intent: string; label: string; tone: Tone; state: string; detail: ReactNode }

/** "Rule name, then who it assigns to" with a drawn connector, not a text arrow. */
function RouteTo({ from, to }: { from: string; to: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="truncate">{from}</span>
      <ArrowRight aria-label="assigns to" className="size-3.5 shrink-0" />
      <span className="truncate">{to || 'nobody'}</span>
    </span>
  )
}

/*
 * Mirrors lead capture (submitListingInquiry): active rules are tried in priority order and only
 * a rule with an agent can match; with no match the lead goes to the listing's agent, then to the
 * fallback rule's agent.
 */
function coverage(routable: RoutingRule[], fallback: RoutingRule | undefined): Coverage[] {
  const after = fallback ? `listing's agent, then ${fallback.name}` : "listing's agent"
  return intentOptions.filter(([value]) => value !== 'any').map(([intent, label]) => {
    const matching = routable.filter(rule => rule.intent === intent || rule.intent === 'any')
    const broad = matching.find(isBroad)
    if (broad) return { intent, label, tone: 'emerald', state: 'Covered', detail: <RouteTo from={broad.name} to={assignee(broad)} /> }
    if (matching.length) return { intent, label, tone: 'amber', state: 'Partly covered', detail: `${matching.length} ${matching.length === 1 ? 'rule limited' : 'rules limited'} by source or area; otherwise the ${after}` }
    return { intent, label, tone: fallback ? 'amber' : 'rose', state: 'No rule', detail: `Goes to the ${after}` }
  })
}

export async function RoutingPage() {
  const [{ rules, error }, options] = await Promise.all([getRoutingRules(), getRoutingOptions()])
  const active = rules.filter(rule => rule.status === 'active')
  const routable = active.filter(rule => rule.assignedAgent)
  const fallback = routable.find(rule => rule.isFallback)
  const nextPriority = rules.reduce((max, rule) => Math.max(max, rule.priority ?? 0), 0) + 10
  const gaps = coverage(routable, fallback)
  const agentless = active.length - routable.length
  const paused = rules.length - active.length

  return (
    <PlatformPage
      crumbs={[{ label: 'Lead Routing' }]}
      title="Lead Routing"
      meta={!error && rules.length ? `${rules.length} ${rules.length === 1 ? 'rule' : 'rules'} · ${active.length} active${paused ? ` · ${paused} paused` : ''}` : null}
      actions={<RoutingRuleDrawer options={options} nextPriority={nextPriority} />}
    >
      {error ? <ErrorBanner>Rules could not be loaded. {error}</ErrorBanner> : (
        <div className="space-y-6 pb-16">
          <section aria-labelledby="routing-coverage" className="space-y-2">
            <h2 id="routing-coverage" className="text-sm font-semibold text-foreground">Will new leads reach an agent?</h2>
            <div className="overflow-hidden rounded-[6px] border bg-background">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-muted/30 px-3 py-2.5 text-sm">
                <StatusCell tone={fallback ? 'emerald' : 'rose'}>{fallback ? 'Fallback set' : 'No fallback'}</StatusCell>
                <span className="text-muted-foreground">{fallback ? <RouteTo from={fallback.name} to={assignee(fallback)} /> : "Unmatched leads go to the listing's agent only"}</span>
                {agentless ? <span className="text-amber-700 dark:text-amber-400">{agentless} active {agentless === 1 ? 'rule has' : 'rules have'} no agent and never match</span> : null}
              </div>
              <ul className="divide-y">
                {gaps.map(row => (
                  <li key={row.intent} className="grid gap-x-4 gap-y-0.5 px-3 py-2 text-sm sm:grid-cols-[7rem_9rem_minmax(0,1fr)] sm:items-center">
                    <span className="font-medium text-foreground">{row.label}</span>
                    <StatusCell tone={row.tone}>{row.state}</StatusCell>
                    <span className="min-w-0 truncate text-muted-foreground">{row.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section aria-labelledby="routing-rules" className="space-y-2">
            <h2 id="routing-rules" className="text-sm font-semibold text-foreground">Rules in priority order</h2>
            {rules.length ? (
              <DataTable
                label="Routing rules"
                head={[
                  { label: '#', className: 'w-12 text-right' },
                  { label: 'Rule' },
                  { label: 'Intent', className: 'hidden md:table-cell' },
                  { label: 'Source', className: 'hidden xl:table-cell' },
                  { label: 'Area', className: 'hidden xl:table-cell' },
                  { label: 'Assigns to', className: 'hidden md:table-cell' },
                  { label: 'Fallback', className: 'hidden lg:table-cell' },
                  { label: 'Status', className: 'hidden md:table-cell' },
                  { label: <span className="sr-only">Actions</span>, className: 'hidden text-right md:table-cell' },
                ]}
              >
                {rules.map(rule => {
                  const where = area(rule) || 'Any area'
                  const to = assignee(rule)
                  return (
                    <tr key={rule.id} className={rule.status === 'active' ? 'transition-colors hover:bg-muted/30' : 'text-muted-foreground transition-colors hover:bg-muted/30'}>
                      <Td className="text-right tabular-nums text-muted-foreground">{rule.priority ?? '—'}</Td>
                      <Td className="min-w-0">
                        <p className="max-w-[12rem] truncate font-medium text-foreground sm:max-w-[16rem]">{rule.name}</p>
                        <p className="max-w-[12rem] truncate text-xs text-muted-foreground sm:max-w-[16rem] xl:hidden">
                          <span className="md:hidden">{optionLabel(intentOptions, rule.intent)} · </span>{optionLabel(sourceOptions, rule.source)} · {where}
                          <span className="md:hidden"> · {to || 'Nobody'}</span>
                        </p>
                        <span className="mt-1 flex md:hidden"><StatusCell tone={rule.status === 'active' ? 'emerald' : 'zinc'}>{rule.status === 'active' ? 'Active' : 'Paused'}</StatusCell></span>
                        <div className={rowActionLineClass}>
                          <div className={cn('flex items-center gap-1.5', rowActionsBlockClass)}><RoutingRuleDrawer rule={rule} options={options} /><RoutingRuleActions rule={rule} /></div>
                        </div>
                      </Td>
                      <Td className="hidden whitespace-nowrap md:table-cell">{optionLabel(intentOptions, rule.intent)}</Td>
                      <Td className="hidden whitespace-nowrap xl:table-cell">{optionLabel(sourceOptions, rule.source)}</Td>
                      <Td className="hidden whitespace-nowrap xl:table-cell">{where}</Td>
                      <Td className="hidden max-w-[11rem] truncate md:table-cell">{to || <span className="text-amber-700 dark:text-amber-400">Nobody</span>}{!rule.assignedAgent && rule.assignedTeam ? <span className="block text-xs text-amber-700 dark:text-amber-400">No agent: never matches</span> : null}</Td>
                      <Td className="hidden lg:table-cell">{rule.isFallback ? 'Yes' : <span className="text-muted-foreground">—</span>}</Td>
                      <Td className="hidden whitespace-nowrap md:table-cell"><StatusCell tone={rule.status === 'active' ? 'emerald' : 'zinc'}>{rule.status === 'active' ? 'Active' : 'Paused'}</StatusCell></Td>
                      <Td className="hidden w-px whitespace-nowrap py-2 text-right md:table-cell">
                        <div className="flex justify-end gap-1.5"><RoutingRuleDrawer rule={rule} options={options} /><RoutingRuleActions rule={rule} /></div>
                      </Td>
                    </tr>
                  )
                })}
              </DataTable>
            ) : <EmptyState title="No routing rules" />}
          </section>
        </div>
      )}
    </PlatformPage>
  )
}
