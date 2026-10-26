import Link from 'next/link'
import { Fragment } from 'react'
import { formatMoney as money, moneyToMinor } from '@/features/lib/money'
import { cn } from '@/lib/utils'
import { LocalDateTime } from '../../showings/components/LocalDateTime'
import { DataTable, EmptyState, ErrorBanner, PlatformPage, StatusDot, Td, trackItemClass } from '../../components/PlatformUI'
import { FilterTabs } from '../../listings/components/FilterTabs'
import { getPipelineDeals, type PlatformDeal } from '../actions/deals'
import { dealStages as stages } from '../lib/stages'
import { getDealOptions } from '../lib/dealWorkspace'
import { NewDealDrawer } from '../components/DealRecordForms'
import { DealRowActions } from '../components/DealRowActions'

const DAY = 864e5
const CLOSING_WINDOW_DAYS = 14
const IDLE_DAYS = 14
const transactionTypeLabels: Record<string, string> = { buyer: 'Buyer', seller: 'Seller', tenant: 'Tenant', landlord: 'Landlord' }

const views = [
  { value: 'open', label: 'Open' },
  { value: 'closed_won', label: 'Closed won' },
  { value: 'closed_lost', label: 'Closed lost' },
  { value: 'all', label: 'All' },
] as const

function daysSince(iso?: string | null, now = Date.now()) {
  const time = Date.parse(iso || '')
  return Number.isFinite(time) ? Math.max(0, Math.floor((now - time) / DAY)) : null
}

function daysUntil(iso?: string | null, now = Date.now()) {
  const time = Date.parse(iso || '')
  return Number.isFinite(time) ? Math.ceil((time - now) / DAY) : null
}

const isOpen = (deal: PlatformDeal) => !['closed_won', 'closed_lost'].includes(deal.stage)

/** Days since the deal last changed; heavier the longer an open deal sits. */
function Idle({ deal, className }: { deal: PlatformDeal; className?: string }) {
  const days = daysSince(deal.updatedAt || deal.createdAt)
  if (days === null) return <span className={cn('text-muted-foreground', className)}>—</span>
  const tone = !isOpen(deal) ? 'font-normal text-muted-foreground'
    : days >= 30 ? 'font-bold text-destructive'
    : days >= IDLE_DAYS ? 'font-semibold text-amber-700 dark:text-amber-400'
    : days >= 7 ? 'font-medium text-foreground'
    : 'font-normal text-muted-foreground'
  return <span className={cn('whitespace-nowrap text-[13px] tabular-nums', tone, className)}>{days === 0 ? 'Today' : `${days}d`}</span>
}

function Closing({ deal }: { deal: PlatformDeal }) {
  if (!deal.expectedCloseDate) return <span className="text-[13px] text-muted-foreground">Not set</span>
  const days = daysUntil(deal.expectedCloseDate)
  const open = isOpen(deal)
  return (
    <span className="block whitespace-nowrap text-[13px]">
      <LocalDateTime value={deal.expectedCloseDate} options={{ month: 'short', day: 'numeric', year: 'numeric' }} className="tabular-nums text-foreground" />
      {open && days !== null ? (
        <span className={cn('block text-xs tabular-nums', days < 0 ? 'font-medium text-destructive' : days <= CLOSING_WINDOW_DAYS ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
          {days < 0 ? `${-days}d overdue` : days === 0 ? 'Today' : `in ${days}d`}
        </span>
      ) : null}
    </span>
  )
}

const head = [
  { label: 'Deal' },
  { label: 'Since update', className: 'hidden w-24 sm:table-cell' },
  { label: 'Expected close', className: 'hidden w-32 md:table-cell' },
  { label: 'Offer', className: 'hidden w-32 lg:table-cell' },
  { label: <span className="sr-only">Actions</span>, className: 'w-px' },
]

function DealRow({ deal }: { deal: PlatformDeal }) {
  const people = [deal.lead?.name || 'No client', deal.assignedAgent?.name || 'Unassigned'].join(' · ')
  return (
    <tr className="transition-colors hover:bg-muted/30">
      <Td className="min-w-0 max-w-[26rem] py-2">
        <Link href={`/dashboard/platform/pipeline/${deal.id}`} className="block truncate font-medium text-foreground underline-offset-2 hover:underline">{deal.title}</Link>
        <span className="block truncate text-xs text-muted-foreground">{transactionTypeLabels[deal.transactionType || ''] || 'Buyer'} · {people}</span>
        {deal.nextStep ? <span className="block truncate text-xs text-foreground/80">Next: {deal.nextStep}</span> : null}
        <span className="mt-0.5 flex gap-2 text-xs text-muted-foreground sm:hidden">Updated <Idle deal={deal} className="text-xs" /></span>
      </Td>
      <Td className="hidden py-2 sm:table-cell"><Idle deal={deal} /></Td>
      <Td className="hidden py-2 md:table-cell"><Closing deal={deal} /></Td>
      <Td className="hidden whitespace-nowrap py-2 text-[13px] tabular-nums lg:table-cell">{moneyToMinor(deal.offerAmount || '0') > 0n ? money(deal.offerAmount) : <span className="text-muted-foreground">—</span>}</Td>
      <Td className="py-2">
        <DealRowActions deal={{ id: deal.id, title: deal.title, stage: deal.stage, offerAmount: deal.offerAmount, commissionAmount: deal.commissionAmount, nextStep: deal.nextStep, notes: deal.notes }} />
      </Td>
    </tr>
  )
}

export async function PipelinePage({ searchParams }: { searchParams?: Promise<{ view?: string | string[] }> } = {}) {
  const params = searchParams ? await searchParams : {}
  const view = views.find(entry => entry.value === params.view)?.value || 'open'
  const [{ deals, stats, error }, options] = await Promise.all([getPipelineDeals(), getDealOptions()])

  const now = Date.now()
  const visible = deals.filter(deal => view === 'all' ? true : view === 'open' ? isOpen(deal) : deal.stage === view)
  // Stalest first inside each stage: the deal that has sat longest is the one to chase.
  const grouped = stages
    .map(([stage, label, tone]) => ({
      stage, label, tone,
      deals: visible.filter(deal => deal.stage === stage).sort((a, b) => (Date.parse(a.updatedAt || a.createdAt || '') || 0) - (Date.parse(b.updatedAt || b.createdAt || '') || 0)),
    }))
    .filter(group => group.deals.length)

  const openDeals = deals.filter(isOpen)
  const closingSoon = openDeals.filter(deal => { const days = daysUntil(deal.expectedCloseDate, now); return days !== null && days <= CLOSING_WINDOW_DAYS }).length
  const idle = openDeals.filter(deal => (daysSince(deal.updatedAt || deal.createdAt, now) ?? 0) >= IDLE_DAYS).length
  const meta = !error && deals.length
    ? [
        closingSoon ? `${closingSoon} closing within ${CLOSING_WINDOW_DAYS} days or overdue` : null,
        idle ? `${idle} not updated in ${IDLE_DAYS}+ days` : null,
        moneyToMinor(stats.projectedCommission || '0') > 0n ? `${money(stats.projectedCommission)} projected commission` : null,
      ].filter(Boolean).join(' · ') || null
    : null
  const counts: Record<string, number> = { open: stats.open, closed_won: stats.closedWon, closed_lost: stats.closedLost, all: stats.total }

  return (
    <PlatformPage
      crumbs={[{ label: 'Pipeline' }]}
      title="Pipeline"
      meta={meta}
      actions={<>
        <Link href="/dashboard/platform/reports" className={trackItemClass(false)}>Reports</Link>
        <NewDealDrawer options={options} />
      </>}
      toolbar={!error && deals.length ? (
        <FilterTabs label="Deal view" items={views.map(entry => ({ label: entry.label, href: entry.value === 'open' ? '/dashboard/platform/pipeline' : `/dashboard/platform/pipeline?view=${entry.value}`, active: view === entry.value, count: counts[entry.value] ?? null }))} />
      ) : null}
    >
      <div className="pb-16">
        {error ? (
          <ErrorBanner>Pipeline could not be loaded. {error}</ErrorBanner>
        ) : !deals.length ? (
          <EmptyState title="No deals" />
        ) : grouped.length ? (
          <DataTable label="Deals by stage" head={head}>
            {grouped.map(group => (
              <Fragment key={group.stage}>
                <tr>
                  <th scope="colgroup" colSpan={5} className="border-b bg-muted/20 px-3 py-1.5 text-left text-xs font-semibold text-foreground">
                    <StatusDot tone={group.tone} className="mr-2 -translate-y-px" />{group.label}
                    <span className="ml-2 font-medium tabular-nums text-muted-foreground">{group.deals.length}</span>
                  </th>
                </tr>
                {group.deals.map(deal => <DealRow key={deal.id} deal={deal} />)}
              </Fragment>
            ))}
          </DataTable>
        ) : (
          <EmptyState title={view === 'open' ? 'No open deals' : 'No deals in this view'} />
        )}
      </div>
    </PlatformPage>
  )
}
