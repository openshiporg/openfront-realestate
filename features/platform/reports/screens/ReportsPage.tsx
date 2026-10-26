import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { formatMoney } from '@/features/lib/money'
import { humanize } from '../../leads/lib/labels'
import { DataTable, ErrorBanner, Panel, PlatformPage, Stats, Td, trackItemClass } from '../../components/PlatformUI'
import { getBrokerageReport } from '../actions/reports'

const sourceLabels: Record<string, string> = { website: 'Website', zillow: 'Zillow', referral: 'Referral', open_house: 'Open house', phone: 'Phone', import: 'Import', unknown: 'Unknown' }

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? Math.max(value > 0 ? 2 : 0, Math.round((value / max) * 100)) : 0
  return (
    <li className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3rem] items-center gap-3 text-sm">
      <span className="truncate text-foreground">{label}</span>
      <span className="h-2 overflow-hidden bg-muted" aria-hidden><span className="block h-full bg-foreground/80" style={{ width: `${width}%` }} /></span>
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
      meta={<span className="text-foreground/80">Latest 250 leads, 250 showings and 250 deals · listing counts are current</span>}
      actions={<Link href="/dashboard/platform/pipeline" className={trackItemClass(false)}>Pipeline <ArrowUpRight aria-hidden className="size-3.5" /></Link>}
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

        <section aria-labelledby="report-agents" className="space-y-2 pb-16">
          <h2 id="report-agents" className="text-sm font-semibold text-foreground">By agent</h2>
          <DataTable
            label="By agent"
            className="[&_table]:min-w-[34rem]"
            head={[
              { label: 'Agent' },
              { label: 'Leads', className: 'text-right' },
              { label: 'Showings', className: 'text-right' },
              { label: 'Deals', className: 'text-right' },
              { label: 'Projected commission', className: 'text-right' },
            ]}
          >
            {report.agentRows.map(row => (
              <tr key={row.agent} className="transition-colors hover:bg-muted/30">
                <Td className={row.agent === 'Unassigned' ? 'font-medium text-amber-700 dark:text-amber-400' : 'font-medium text-foreground'}>{row.agent}</Td>
                <Td className="text-right tabular-nums">{row.leads}</Td>
                <Td className="text-right tabular-nums">{row.showings}</Td>
                <Td className="text-right tabular-nums">{row.deals}</Td>
                <Td className="text-right font-medium tabular-nums text-foreground">{formatMoney(row.projectedCommission)}</Td>
              </tr>
            ))}
            {report.agentRows.length ? null : <tr><Td colSpan={5} className="py-6 text-center text-muted-foreground">No agent activity</Td></tr>}
          </DataTable>
        </section>
      </div>
    </PlatformPage>
  )
}
