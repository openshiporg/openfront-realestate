import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { formatMoney as money } from '@/features/lib/money'
import { LocalDateTime } from '../../showings/components/LocalDateTime'
import { EmptyState, ErrorBanner, PlatformPage, Stats, StatusDot, TitleLine, Track, type Tone } from '../../components/PlatformUI'
import { getPipelineDeals, type PlatformDeal } from '../actions/deals'
import { dealStages as stages } from '../lib/stages'
import { getDealOptions } from '../lib/dealWorkspace'
import { NewDealDrawer } from '../components/DealRecordForms'
import { DealFinancialTermsForm, DealNextStepForm, DealStageButton } from '../components/DealActionForms'


const transactionTypeLabels: Record<string, string> = { buyer: 'Buyer', seller: 'Seller', tenant: 'Tenant', landlord: 'Landlord' }

function DealCard({ deal, tone }: { deal: PlatformDeal; tone: Tone }) {
  const stageIndex = Math.max(0, stages.findIndex(([stage]) => stage === deal.stage))
  const nextStage = stages[Math.min(stageIndex + 1, stages.length - 1)]
  const open = !['closed_won', 'closed_lost'].includes(deal.stage)
  return (
    <article className="rounded-xl border border-border bg-card p-3 shadow-xs">
      <TitleLine as="h3" tone={tone} status={transactionTypeLabels[deal.transactionType || ''] || 'Buyer'} headingClassName="text-sm"><Link href={`/dashboard/platform/pipeline/${deal.id}`} className="hover:underline">{deal.title}</Link></TitleLine>
      <p className="mt-1 text-xs text-muted-foreground">{deal.lead?.name || 'No client'} · {deal.assignedAgent?.name || 'Unassigned'}</p>
      {deal.property ? <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{deal.property.title} · {[deal.property.city, deal.property.state].filter(Boolean).join(', ')}</p> : null}
      <dl className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-2 text-xs">
        <div><dt className="text-muted-foreground">Offer</dt><dd className="font-semibold tabular-nums text-foreground">{money(deal.offerAmount)}</dd></div>
        <div><dt className="text-muted-foreground">Commission</dt><dd className="font-semibold tabular-nums text-foreground">{money(deal.commissionAmount)}</dd></div>
        <div className="col-span-2"><dt className="text-muted-foreground">Expected close</dt><dd className="font-medium text-foreground">{deal.expectedCloseDate ? <LocalDateTime value={deal.expectedCloseDate} options={{ dateStyle: 'medium' }} /> : 'Not set'}</dd></div>
      </dl>
      {deal.nextStep ? <p className="mt-2 text-xs text-foreground"><span className="font-medium text-muted-foreground">Next · </span>{deal.nextStep}</p> : null}
      {open ? (
        <Track className="mt-3" label={`${deal.title} stage`}>
          <DealStageButton dealId={deal.id} stage={nextStage[0]} label={nextStage[1]} />
          <DealStageButton
            dealId={deal.id}
            stage="closed_lost"
            label="Lost"
            confirm={{ title: 'Mark this deal as lost?', description: `${deal.title} will move to Closed lost.` }}
          />
        </Track>
      ) : null}
      <details className="mt-3 border-t border-border pt-2">
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
  const [{ deals, stats, error }, options] = await Promise.all([getPipelineDeals(), getDealOptions()])
  const grouped = stages.map(([stage, label, tone]) => ({ stage, label, tone, deals: deals.filter((deal) => deal.stage === stage) }))

  return (
    <PlatformPage
      crumbs={[{ label: 'Pipeline' }]}
      title="Pipeline"
      actions={<>
        <Button asChild variant="outline" className="rounded-full"><Link href="/dashboard/platform/reports">Reports</Link></Button>
        <Track><NewDealDrawer options={options} /></Track>
      </>}
      toolbar={!error && deals.length ? (
        <Stats items={[
          ['Open', stats.open],
          ['Under contract', stats.underContract],
          ['Closed won', stats.closedWon],
          ['Projected commission', money(stats.projectedCommission)],
        ]} />
      ) : null}
    >
      {error ? (
        <ErrorBanner>Pipeline could not be loaded. {error}</ErrorBanner>
      ) : deals.length ? (
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:-mx-6 md:px-6" role="list" aria-label="Deal stages">
          {grouped.map((column) => (
            <section key={column.stage} role="listitem" aria-label={column.label} className="flex w-[85vw] max-w-80 shrink-0 snap-start flex-col rounded-xl bg-muted/50 p-2 shadow-[inset_0_1px_2px_rgb(0_0_0/0.06)] sm:w-72">
              <div className="mb-2 flex items-center justify-between px-1.5 pt-1">
                <h2 className="text-sm font-semibold text-foreground"><StatusDot tone={column.tone} className="mr-2 -translate-y-px ring-muted" />{column.label}</h2>
                <span className="text-xs font-medium tabular-nums text-muted-foreground">{column.deals.length}</span>
              </div>
              <div className="space-y-2">
                {column.deals.length ? column.deals.map((deal) => <DealCard key={deal.id} deal={deal} tone={column.tone} />) : <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">No deals</p>}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState title="No deals" />
      )}
    </PlatformPage>
  )
}
