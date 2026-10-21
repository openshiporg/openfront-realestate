import Link from 'next/link'
import { PageBreadcrumbs } from '@/features/dashboard/components/PageBreadcrumbs'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/features/lib/money'
import { humanize } from '../../leads/lib/labels'
import { getBrokerageReport } from '../actions/reports'

const sourceLabels: Record<string, string> = { website: 'Website', zillow: 'Zillow', referral: 'Referral', open_house: 'Open house', phone: 'Phone', import: 'Import', unknown: 'Unknown' }

export async function ReportsPage() {
  const report = await getBrokerageReport()
  const listingMetrics: Array<[string, string | number]> = [
    ['Active listings', report.activeListings],
    ['Pending listings', report.pendingListings],
  ]
  const activityMetrics: Array<[string, string | number]> = [
    ['Leads', report.leadsTotal],
    ['New leads', report.newLeads],
    ['Qualified leads', report.qualifiedLeads],
    ['Showings scheduled', report.toursScheduled],
    ['Showings completed', report.showingsCompleted],
    ['Deals closed', report.closedDeals],
    ['Projected commission', formatMoney(report.projectedCommission)],
  ]
  const sources = Object.entries(report.sourceCounts).sort((a, b) => b[1] - a[1])

  return (
    <section className="overflow-hidden flex flex-col">
      <PageBreadcrumbs
        items={[
          { type: 'link', label: 'Dashboard', href: '/' },
          { type: 'page', label: 'Platform' },
          { type: 'page', label: 'Reports' },
        ]}
      />
      <div className="flex flex-col gap-4 px-4 pt-4 md:px-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reports</h1>
          <p className="text-muted-foreground">Latest 250 leads, showings and deals</p>
        </div>
        <Button asChild variant="outline"><Link href="/dashboard/platform/pipeline">Pipeline</Link></Button>
      </div>

      <div className="min-w-0 space-y-6 px-4 py-4 md:px-6">
        {report.error ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Reports could not be loaded. {report.error}</div> : null}

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...listingMetrics, ...activityMetrics].map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-lg border border-border bg-card p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words text-xl font-semibold text-foreground">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="grid min-w-0 gap-6 lg:grid-cols-[1fr_2fr]">
          <section className="min-w-0 rounded-lg border border-border bg-card p-4">
            <h2 className="text-base font-semibold text-foreground">Lead sources</h2>
            <table className="mt-3 w-full text-left text-sm">
              <thead><tr className="text-muted-foreground"><th className="py-2 font-medium">Source</th><th className="py-2 text-right font-medium">Leads</th></tr></thead>
              <tbody className="divide-y divide-border">
                {sources.map(([source, count]) => <tr key={source}><td className="py-2 text-foreground">{sourceLabels[source] || humanize(source)}</td><td className="py-2 text-right tabular-nums text-foreground">{count}</td></tr>)}
                {sources.length ? null : <tr><td colSpan={2} className="py-3 text-muted-foreground">No leads</td></tr>}
              </tbody>
            </table>
          </section>

          <section className="min-w-0 rounded-lg border border-border bg-card p-4">
            <h2 className="text-base font-semibold text-foreground">By agent</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="text-muted-foreground"><tr><th className="py-2 pr-3 font-medium">Agent</th><th className="py-2 pr-3 font-medium">Leads</th><th className="py-2 pr-3 font-medium">Showings</th><th className="py-2 pr-3 font-medium">Deals</th><th className="py-2 font-medium">Commission</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {report.agentRows.map(row => <tr key={row.agent}><td className="py-2 pr-3 font-medium text-foreground">{row.agent}</td><td className="py-2 pr-3 tabular-nums">{row.leads}</td><td className="py-2 pr-3 tabular-nums">{row.showings}</td><td className="py-2 pr-3 tabular-nums">{row.deals}</td><td className="py-2 font-medium text-foreground">{formatMoney(row.projectedCommission)}</td></tr>)}
                  {report.agentRows.length ? null : <tr><td colSpan={5} className="py-3 text-muted-foreground">No agent activity</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </section>
  )
}
