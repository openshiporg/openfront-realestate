import { EmptyState, ErrorBanner, PlatformPage, Stats, TitleLine, Track } from '../../components/PlatformUI'
import { RoutingRuleActions, RoutingRuleDrawer, intentOptions, sourceOptions } from '../components/RoutingForms'
import { getRoutingOptions, getRoutingRules } from '../lib/rules'

const optionLabel = (options: Array<[string, string]>, value: string) => options.find(([key]) => key === value)?.[1] || value

export async function RoutingPage() {
  const [{ rules, error }, options] = await Promise.all([getRoutingRules(), getRoutingOptions()])
  const active = rules.filter(rule => rule.status === 'active')
  const fallback = active.find(rule => rule.isFallback)
  const nextPriority = rules.reduce((max, rule) => Math.max(max, rule.priority ?? 0), 0) + 10

  return (
    <PlatformPage
      crumbs={[{ label: 'Lead Routing' }]}
      title="Lead Routing"
      actions={<Track><RoutingRuleDrawer options={options} nextPriority={nextPriority} /></Track>}
      toolbar={<Stats items={[['Rules', rules.length], ['Active', active.length], ['Paused', rules.length - active.length], ['Fallback', fallback ? (fallback.assignedAgent?.name || fallback.assignedTeam?.name || 'Set') : 'None']]} />}
    >
      {error ? <ErrorBanner>Rules could not be loaded. {error}</ErrorBanner> : rules.length ? (
        <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {rules.map(rule => {
            const where = [rule.city, rule.state, rule.postalCode].filter(Boolean).join(' ') || 'Any location'
            return (
              <li key={rule.id} className="grid gap-3 p-4 md:grid-cols-[3rem_minmax(0,1fr)_auto] md:items-center">
                <span className="text-sm font-semibold tabular-nums text-muted-foreground">{rule.priority ?? '—'}</span>
                <div className="min-w-0">
                  <TitleLine tone={rule.status === 'active' ? 'emerald' : 'zinc'} status={rule.status === 'active' ? (rule.isFallback ? 'Active · Fallback' : 'Active') : 'Paused'} headingClassName="text-sm">{rule.name}</TitleLine>
                  <p className="text-sm text-muted-foreground">{[optionLabel(intentOptions, rule.intent), optionLabel(sourceOptions, rule.source), where].join(' · ')}</p>
                  <p className="text-sm text-foreground"><span className="text-muted-foreground">Assigns to </span>{[rule.assignedAgent?.name, rule.assignedTeam?.name].filter(Boolean).join(' · ') || 'Nobody'}</p>
                </div>
                <Track label={`${rule.name} actions`}><RoutingRuleDrawer rule={rule} options={options} /><RoutingRuleActions rule={rule} /></Track>
              </li>
            )
          })}
        </ol>
      ) : <EmptyState title="No routing rules" />}
    </PlatformPage>
  )
}
