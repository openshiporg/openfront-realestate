import Link from 'next/link'
import { Fragment } from 'react'
import { formatMoney as money, moneyToMinor } from '@/features/lib/money'
import { cn } from '@/lib/utils'
import { LocalDateTime } from '../../showings/components/LocalDateTime'
import { DataTable, EmptyState, ErrorBanner, PlatformPage, StatusDot, Td, rowActionLineClass, rowActionsBlockClass, trackItemClass } from '../../components/PlatformUI'
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

const SINCE_UPDATE_TITLE = 'Days since the deal last changed'

/**
 * Days since the deal last changed. A fresh deal shows the date it changed (a column of
 * "Today" says nothing); from a week idle the day count appears and gets heavier the
 * longer an open deal sits.
 */
function Idle({ deal, className }: { deal: PlatformDeal; className?: string }) {
  const changed = deal.updatedAt || deal.createdAt
  const days = daysSince(changed)
  if (days === null) return <span className={cn('text-muted-foreground', className)}>—</span>
  const tone = !isOpen(deal) ? 'font-normal text-muted-foreground'
    : days >= 30 ? 'font-bold text-destructive'
    : days >= IDLE_DAYS ? 'font-semibold text-amber-700 dark:text-amber-400'
    : 'font-medium text-foreground'
  const title = `${SINCE_UPDATE_TITLE}: ${days === 0 ? 'changed today' : `${days} day${days === 1 ? '' : 's'}`}`
  return (
    <span title={title} className={cn('whitespace-nowrap text-[13px] tabular-nums', className)}>
      {days >= 7 ? <span className={cn('mr-1.5', tone)}>{days}d</span> : null}
      <LocalDateTime value={changed} options={{ month: 'short', day: 'numeric' }} className="text-muted-foreground" />
    </span>
  )
}

function Closing({ deal, inline = false }: { deal: PlatformDeal; inline?: boolean }) {
  if (!deal.expectedCloseDate) return <span className={cn('text-muted-foreground', inline ? 'text-xs' : 'text-[13px]')}>Not set</span>
  const days = daysUntil(deal.expectedCloseDate)
  const open = isOpen(deal)
  return (
    <span className={cn('whitespace-nowrap', inline ? 'inline-flex items-baseline gap-1.5 text-xs' : 'block text-[13px]')}>
      <LocalDateTime value={deal.expectedCloseDate} options={inline ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }} className="tabular-nums text-foreground" />
      {open && days !== null ? (
        <span className={cn(inline ? 'inline' : 'block', 'text-xs tabular-nums', days < 0 ? 'font-medium text-destructive' : days <= CLOSING_WINDOW_DAYS ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
          {days < 0 ? `${-days}d overdue` : days === 0 ? 'Today' : `in ${days}d`}
        </span>
      ) : null}
    </span>
  )
}

const head = [
  { label: 'Deal' },
  { label: <span title={SINCE_UPDATE_TITLE} className="cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-4">Since update</span>, className: 'hidden w-28 md:table-cell' },
  { label: 'Expected close', className: 'hidden w-32 md:table-cell' },
  { label: 'Offer', className: 'hidden w-32 lg:table-cell' },
  { label: <span className="sr-only">Actions</span>, className: 'hidden w-px md:table-cell' },
]

function DealRow({ deal }: { deal: PlatformDeal }) {
  const people = [deal.lead?.name || 'No client', deal.assignedAgent?.name || 'Unassigned'].join(' · ')
  const actionTarget = { id: deal.id, title: deal.title, stage: deal.stage, offerAmount: deal.offerAmount, commissionAmount: deal.commissionAmount, nextStep: deal.nextStep, notes: deal.notes }
  return (
    <tr className="transition-colors hover:bg-muted/30">
      <Td className="min-w-0 max-w-[26rem] py-2">
        <Link href={`/dashboard/platform/pipeline/${deal.id}`} className="block truncate font-medium text-foreground underline-offset-2 hover:underline">{deal.title}</Link>
        <span className="block truncate text-xs text-muted-foreground">{transactionTypeLabels[deal.transactionType || ''] || 'Buyer'} · {people}</span>
        {deal.nextStep ? <span className="block truncate text-xs text-foreground/80">Next: {deal.nextStep}</span> : null}
        {/* Phone: expected close (with overdue) and last change fold into the first cell. */}
        <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-xs md:hidden">
          <span className="flex items-baseline gap-1.5"><span className="text-muted-foreground">Close</span><Closing deal={deal} inline /></span>
          <span className="flex items-baseline gap-1.5"><span className="text-muted-foreground">Changed</span><Idle deal={deal} className="text-xs" /></span>
        </div>
        <div className={rowActionLineClass}>
          <DealRowActions deal={actionTarget} className={rowActionsBlockClass} />
        </div>
      </Td>
      <Td className="hidden py-2 md:table-cell"><Idle deal={deal} /></Td>
      <Td className="hidden py-2 md:table-cell"><Closing deal={deal} /></Td>
      <Td className="hidden whitespace-nowrap py-2 text-[13px] tabular-nums lg:table-cell">{moneyToMinor(deal.offerAmount || '0') > 0n ? money(deal.offerAmount) : <span className="text-muted-foreground">—</span>}</Td>
      <Td className="hidden py-2 md:table-cell">
        <DealRowActions deal={actionTarget} />
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
