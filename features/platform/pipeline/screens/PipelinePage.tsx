import Link from 'next/link'
import { PageBreadcrumbs } from '@/features/dashboard/components/PageBreadcrumbs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatMoney as money } from '@/features/lib/money'
import { LocalDateTime } from '../../showings/components/LocalDateTime'
import { getPipelineDeals, type PlatformDeal } from '../actions/deals'
import { DealFinancialTermsForm, DealNextStepForm, DealStageButton } from '../components/DealActionForms'

const stages: Array<[string, string]> = [
  ['prospecting', 'Prospecting'],
  ['active_search', 'Active search'],
  ['offer_drafted', 'Offer drafted'],
  ['under_contract', 'Under contract'],
  ['inspection', 'Inspection'],
  ['financing', 'Financing'],
  ['closed_won', 'Closed won'],
  ['closed_lost', 'Closed lost'],
]

const transactionTypeLabels: Record<string, string> = { buyer: 'Buyer', seller: 'Seller', tenant: 'Tenant', landlord: 'Landlord' }

function DealCard({ deal }: { deal: PlatformDeal }) {
  const stageIndex = Math.max(0, stages.findIndex(([stage]) => stage === deal.stage))
  const nextStage = stages[Math.min(stageIndex + 1, stages.length - 1)]
  const open = !['closed_won', 'closed_lost'].includes(deal.stage)
  return (
    <article className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 text-sm font-semibold text-foreground">{deal.title}</h3>
        <Badge variant="outline" className="shrink-0">{transactionTypeLabels[deal.transactionType || ''] || 'Buyer'}</Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{deal.lead?.name || 'No client'} · {deal.assignedAgent?.name || 'Unassigned'}</p>
      {deal.property ? <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{deal.property.title} · {deal.property.city}, {deal.property.state}</p> : null}
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div><dt className="text-muted-foreground">Offer</dt><dd className="font-medium text-foreground">{money(deal.offerAmount)}</dd></div>
        <div><dt className="text-muted-foreground">Commission</dt><dd className="font-medium text-foreground">{money(deal.commissionAmount)}</dd></div>
        <div className="col-span-2"><dt className="text-muted-foreground">Expected close</dt><dd className="font-medium text-foreground">{deal.expectedCloseDate ? <LocalDateTime value={deal.expectedCloseDate} options={{ dateStyle: 'medium' }} /> : 'Not set'}</dd></div>
      </dl>
      {deal.nextStep ? <p className="mt-2 rounded-md bg-muted p-2 text-xs text-foreground">Next: {deal.nextStep}</p> : null}
      {open ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <DealStageButton dealId={deal.id} stage={nextStage[0]} label={`Move to ${nextStage[1]}`} />
          <DealStageButton
            dealId={deal.id}
            stage="closed_lost"
            label="Mark lost"
            confirm={{ title: 'Mark this deal as lost?', description: `${deal.title} will move to Closed lost.` }}
          />
        </div>
      ) : null}
      <details className="group mt-3 border-t border-border pt-2">
        <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-foreground">Edit details</summary>
        <div className="mt-3 space-y-4">
          <DealFinancialTermsForm dealId={deal.id} offerAmount={deal.offerAmount} commissionAmount={deal.commissionAmount} />
          <DealNextStepForm dealId={deal.id} nextStep={deal.nextStep} notes={deal.notes} />
        </div>
      </details>
    </article>
  )
}

export async function PipelinePage() {
  const { deals, stats, error } = await getPipelineDeals()
  const grouped = stages.map(([stage, label]) => ({ stage, label, deals: deals.filter((deal) => deal.stage === stage) }))

  return (
    <section className="overflow-hidden flex flex-col">
      <PageBreadcrumbs
        items={[
          { type: 'link', label: 'Dashboard', href: '/' },
          { type: 'page', label: 'Platform' },
          { type: 'page', label: 'Pipeline' },
        ]}
      />
      <div className="flex flex-col gap-4 px-4 pt-4 md:px-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pipeline</h1>
          <p className="text-muted-foreground">Track deals from first contact to close</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/platform/reports">Reports</Link>
        </Button>
      </div>
      {!error && deals.length ? (
        <dl className="flex flex-wrap gap-x-8 gap-y-2 px-4 pt-4 text-sm md:px-6">
          <div><dt className="text-muted-foreground">Open</dt><dd className="font-semibold text-foreground">{stats.open}</dd></div>
          <div><dt className="text-muted-foreground">Under contract</dt><dd className="font-semibold text-foreground">{stats.underContract}</dd></div>
          <div><dt className="text-muted-foreground">Closed won</dt><dd className="font-semibold text-foreground">{stats.closedWon}</dd></div>
          <div><dt className="text-muted-foreground">Projected commission</dt><dd className="font-semibold text-foreground">{money(stats.projectedCommission)}</dd></div>
        </dl>
      ) : null}

      <div className="py-4">
        {error ? (
          <div className="px-4 md:px-6"><div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Pipeline could not be loaded. {error}</div></div>
        ) : deals.length ? (
          <div className="flex gap-3 overflow-x-auto px-4 pb-4 md:px-6" role="list" aria-label="Deal stages">
            {grouped.map((column) => (
              <section key={column.stage} role="listitem" aria-label={column.label} className="flex w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/40 p-2">
                <div className="mb-2 flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold text-foreground">{column.label}</h2>
                  <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">{column.deals.length}</span>
                </div>
                <div className="space-y-2">
                  {column.deals.length ? column.deals.map((deal) => <DealCard key={deal.id} deal={deal} />) : <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">No deals</p>}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="px-4 md:px-6">
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <h2 className="text-base font-semibold text-foreground">No deals</h2>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
