import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/features/lib/money'
import { humanize } from '../../leads/lib/labels'
import { ErrorBanner, Panel, PlatformPage, Stats } from '../../components/PlatformUI'
import { getBrokerageReport } from '../actions/reports'

const sourceLabels: Record<string, string> = { website: 'Website', zillow: 'Zillow', referral: 'Referral', open_house: 'Open house', phone: 'Phone', import: 'Import', unknown: 'Unknown' }

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? Math.max(value > 0 ? 2 : 0, Math.round((value / max) * 100)) : 0
  return (
    <li className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3rem] items-center gap-3 text-sm">
      <span className="truncate text-foreground">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden><span className="block h-full rounded-full bg-foreground/80" style={{ width: `${width}%` }} /></span>
      <span className="text-right font-medium tabular-nums text-foreground">{value}</span>
    </li>
  )
}

export async function ReportsPage() {
  const report = await getBrokerageReport()
  const funnel: Array<[string, number]> = [
    ['Leads', report.leadsTotal],
    ['Qualified', report.qualifiedLeads],
    ['Showings scheduled', report.toursScheduled],
    ['Showings completed', report.showingsCompleted],
    ['Deals closed', report.closedDeals],
  ]
  const funnelMax = Math.max(0, ...funnel.map(([, value]) => value))
  const sources = Object.entries(report.sourceCounts).sort((a, b) => b[1] - a[1])
  const sourceMax = Math.max(0, ...sources.map(([, value]) => value))

  return (
    <PlatformPage
      crumbs={[{ label: 'Reports' }]}
      title="Reports"
      meta="Latest 250 leads, showings and deals"
      actions={<Button asChild variant="outline" className="rounded-full"><Link href="/dashboard/platform/pipeline">Pipeline</Link></Button>}
      toolbar={<Stats items={[
        ['Active listings', report.activeListings],
        ['Pending listings', report.pendingListings],
        ['New leads', report.newLeads],
        ['Projected commission', formatMoney(report.projectedCommission)],
      ]} />}
    >
      <div className="min-w-0 space-y-5">
        {report.error ? <ErrorBanner>Reports could not be loaded. {report.error}</ErrorBanner> : null}

        <div className="grid min-w-0 gap-5 lg:grid-cols-2">
          <Panel title="Funnel">
            <ol className="space-y-3">{funnel.map(([label, value]) => <Bar key={label} label={label} value={value} max={funnelMax} />)}</ol>
          </Panel>
          <Panel title="Lead sources">
            {sources.length ? (
              <ol className="space-y-3">{sources.map(([source, count]) => <Bar key={source} label={sourceLabels[source] || humanize(source)} value={count} max={sourceMax} />)}</ol>
            ) : <p className="text-sm text-muted-foreground">No leads</p>}
          </Panel>
        </div>

        <Panel title="By agent" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr><th className="px-4 py-2.5 font-medium">Agent</th><th className="px-4 py-2.5 text-right font-medium">Leads</th><th className="px-4 py-2.5 text-right font-medium">Showings</th><th className="px-4 py-2.5 text-right font-medium">Deals</th><th className="px-4 py-2.5 text-right font-medium">Commission</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.agentRows.map(row => (
                  <tr key={row.agent}>
                    <td className="px-4 py-2.5 font-medium text-foreground">{row.agent}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{row.leads}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{row.showings}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{row.deals}</td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums text-foreground">{formatMoney(row.projectedCommission)}</td>
                  </tr>
                ))}
                {report.agentRows.length ? null : <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No agent activity</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </PlatformPage>
  )
}
