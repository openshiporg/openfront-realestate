import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Fragment, type ReactNode } from 'react'
import { formatMoney } from '@/features/lib/money'
import { cn } from '@/lib/utils'
import { ErrorBanner, Meta, Panel, PlatformPage, StatusDot, TitleLine, type Tone } from '../../components/PlatformUI'
import { ChecklistDrawer, CommissionAction, CounterOfferDrawer, DealOfferDrawer, DisclosureAction, DocumentAction, InspectionAction, MilestoneAction, OfferAction } from '../../operations/components/TaskForms'
import { LocalDateTime } from '../../showings/components/LocalDateTime'
import { DealFinancialTermsForm, DealNextStepForm } from '../components/DealActionForms'
import { DealRowActions } from '../components/DealRowActions'
import { ClosingStatusTrack, CommissionDrawer, DocumentDrawer, EscrowDrawer, InspectionDrawer, MortgageDrawer, TitleDrawer } from '../components/DealRecordForms'
import { getDealOptions, getDealWorkspace } from '../lib/dealWorkspace'
import { dealStages } from '../lib/stages'

const offerNext: Record<string, Array<[string, string]>> = {
  draft: [['submitted', 'Submit'], ['withdrawn', 'Withdraw']],
  submitted: [['accepted', 'Accept'], ['rejected', 'Reject'], ['withdrawn', 'Withdraw']],
  countered: [['submitted', 'Resubmit'], ['accepted', 'Accept'], ['rejected', 'Reject'], ['withdrawn', 'Withdraw']],
}
const milestoneNext: Record<string, Array<[string, string]>> = {
  not_started: [['in_progress', 'Start'], ['complete', 'Complete'], ['blocked', 'Blocked']], in_progress: [['complete', 'Complete'], ['blocked', 'Blocked']],
  blocked: [['in_progress', 'Resume'], ['complete', 'Complete']], complete: [['in_progress', 'Reopen']],
}
const inspectionNext: Record<string, Array<[string, string]>> = {
  scheduled: [['completed', 'Complete'], ['needs_follow_up', 'Needs follow-up'], ['waived', 'Waive']], needs_follow_up: [['completed', 'Complete'], ['waived', 'Waive']], completed: [['needs_follow_up', 'Needs follow-up']],
}
const disclosureNext: Record<string, Array<[string, string]>> = { draft: [['sent', 'Mark sent'], ['expired', 'Expire']], sent: [['acknowledged', 'Acknowledged'], ['expired', 'Expire']], expired: [['draft', 'Redraft'], ['sent', 'Resend']] }
const commissionNext: Record<string, Array<[string, string]>> = { projected: [['approved', 'Approve']], approved: [['paid', 'Mark paid'], ['clawed_back', 'Claw back']], paid: [['clawed_back', 'Claw back']] }

const tones: Record<string, Tone> = {
  draft: 'zinc', submitted: 'sky', countered: 'amber', accepted: 'emerald', rejected: 'rose', withdrawn: 'zinc',
  not_started: 'zinc', in_progress: 'sky', complete: 'emerald', blocked: 'rose', sent: 'sky', signed: 'emerald', archived: 'zinc', acknowledged: 'emerald', expired: 'rose',
  scheduled: 'sky', completed: 'emerald', needs_follow_up: 'amber', waived: 'zinc', opened: 'sky', pending: 'amber', closed: 'emerald', cancelled: 'zinc',
  ordered: 'sky', in_review: 'amber', clear: 'emerald', exception: 'rose', started: 'zinc', preapproved: 'sky', underwriting: 'amber', approved: 'emerald', denied: 'rose',
  projected: 'zinc', paid: 'emerald', clawed_back: 'rose',
}
const trackStages = dealStages.filter(([value]) => value !== 'closed_lost')
const human = (value?: string | null) => (value || '').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
const amount = (value?: string | null) => (value && Number(value) ? formatMoney(value) : '—')

function Rows<T extends { id: string }>({ items, empty, render }: { items: T[] | null; empty: string; render: (item: T) => ReactNode }) {
  if (!items) return <p className="text-sm text-muted-foreground">No access</p>
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>
  return <ul className="divide-y divide-border">{items.map(item => <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">{render(item)}</li>)}</ul>
}

function Row({ title, status, meta, children }: { title: ReactNode; status: string; meta?: ReactNode; children?: ReactNode }) {
  return <>
    <div className="min-w-0">
      <TitleLine as="h3" tone={tones[status] || 'zinc'} status={human(status)} headingClassName="text-sm">{title}</TitleLine>
      {meta ? <p className="text-xs text-muted-foreground">{meta}</p> : null}
    </div>
    {children ? <div className="flex flex-wrap items-start gap-1.5">{children}</div> : null}
  </>
}

export async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [{ workspace, error }, options] = await Promise.all([getDealWorkspace(id), getDealOptions()])
  if (!workspace && !error) notFound()
  if (!workspace) return <PlatformPage crumbs={[{ label: 'Pipeline', href: '/platform/pipeline' }, { label: 'Deal' }]} title="Deal"><ErrorBanner>This deal could not be loaded. {error}</ErrorBanner></PlatformPage>

  const { deal } = workspace
  const stage = dealStages.find(([value]) => value === deal.stage)
  const open = !['closed_won', 'closed_lost'].includes(deal.stage)
  const parents = deal.property ? { dealId: deal.id, propertyId: deal.property.id } : null
  const noListing = <p className="text-xs text-muted-foreground">Link a listing to this deal to add these records.</p>

  const filled = (...lists: Array<unknown[] | null>) => lists.some(list => Boolean(list?.length))
  // Sections with records come first; empty ones follow so the next step is never below blank panels.
  const sections: Array<{ key: string; filled: boolean; node: ReactNode }> = [
    { key: 'offers', filled: filled(workspace.offers), node: (
            <Panel title="Offers" actions={open && workspace.offers ? <div className="flex flex-wrap gap-1.5"><DealOfferDrawer dealId={deal.id} /></div> : null}>
              <Rows items={workspace.offers} empty="No offers" render={offer => (
                <Row title={`${offer.offerNumber}${offer.version > 1 ? ` v${offer.version}` : ''} · ${amount(offer.amount)}`} status={offer.status}
                  meta={[human(offer.financingType), offer.earnestMoney ? `${amount(offer.earnestMoney)} earnest` : '', offer.contingencies, offer.parentOffer ? `Counter to ${offer.parentOffer.offerNumber}` : ''].filter(Boolean).join(' · ')}>
                  {(offerNext[offer.status] || []).map(([status, text]) => <OfferAction key={status} offerId={offer.id} status={status} label={text} />)}
                  {['submitted', 'countered'].includes(offer.status) ? <CounterOfferDrawer offerId={offer.id} offerLabel={offer.offerNumber} /> : null}
                </Row>
              )} />
            </Panel>
    ) },
    { key: 'checklist', filled: filled(workspace.milestones), node: (
            <Panel title="Closing checklist" actions={workspace.milestones ? <div className="flex flex-wrap gap-1.5"><ChecklistDrawer dealId={deal.id} /></div> : null}>
              <Rows items={workspace.milestones} empty="No checklist items" render={item => (
                <Row title={item.name} status={item.status} meta={item.dueAt || item.assignedTo ? <>{item.dueAt ? <>Due <LocalDateTime value={item.dueAt} options={{ month: 'short', day: 'numeric' }} /></> : null}{item.dueAt && item.assignedTo ? ' · ' : ''}{item.assignedTo?.name}</> : undefined}>
                  {(milestoneNext[item.status] || []).map(([status, text]) => <MilestoneAction key={status} milestoneId={item.id} status={status} label={text} />)}
                </Row>
              )} />
            </Panel>
    ) },
    { key: 'documents', filled: filled(workspace.documents, workspace.disclosures), node: (
            <Panel title="Documents" actions={parents ? <div className="flex flex-wrap gap-1.5"><DocumentDrawer {...parents} /></div> : null}>
              <Rows items={workspace.documents} empty="No documents" render={doc => (
                <Row title={doc.fileUrl ? <a href={doc.fileUrl} className="hover:underline">{doc.title}</a> : doc.title} status={doc.status} meta={[human(doc.documentType), doc.requiresSignature ? 'Needs signature' : ''].filter(Boolean).join(' · ')}>
                  <DocumentAction documentId={doc.id} currentStatus={doc.status} />
                </Row>
              )} />
              {workspace.disclosures?.length ? (
                <div className="mt-4 border-t border-border pt-4">
                  <h3 className="mb-2 text-xs font-medium text-muted-foreground">Disclosures</h3>
                  <Rows items={workspace.disclosures} empty="" render={item => (
                    <Row title={item.title} status={item.status} meta={human(item.disclosureType)}>
                      {(disclosureNext[item.status] || []).map(([status, text]) => <DisclosureAction key={status} disclosureId={item.id} status={status} label={text} />)}
                    </Row>
                  )} />
                </div>
              ) : null}
            </Panel>
    ) },
    { key: 'inspections', filled: filled(workspace.inspections), node: (
            <Panel title="Inspections" actions={parents ? <div className="flex flex-wrap gap-1.5"><InspectionDrawer {...parents} /></div> : null}>
              {!parents ? noListing : null}
              <Rows items={workspace.inspections} empty="No inspections" render={item => (
                <Row title={item.title} status={item.status} meta={[human(item.inspectionType), item.inspectorName, item.estimatedCost ? amount(item.estimatedCost) : ''].filter(Boolean).join(' · ')}>
                  {(inspectionNext[item.status] || []).map(([status, text]) => <InspectionAction key={status} inspectionId={item.id} status={status} label={text} />)}
                </Row>
              )} />
            </Panel>
    ) },
    { key: 'financing', filled: filled(workspace.mortgages, workspace.titleOrders, workspace.escrows), node: (
            <Panel title="Financing, title and escrow" actions={<div className="flex flex-wrap gap-1.5">
              <MortgageDrawer dealId={deal.id} leadId={deal.lead?.id || ''} />
              {parents ? <TitleDrawer {...parents} /> : null}
              {parents ? <EscrowDrawer {...parents} /> : null}
            </div>}>
              {!parents ? noListing : null}
              <div className="space-y-4">
                <Rows items={workspace.mortgages} empty="No financing" render={item => (
                  <Row title={`${item.lenderName} · ${item.applicationNumber}`} status={item.status} meta={[amount(item.loanAmount), item.interestRate ? `${Number(item.interestRate)}%` : ''].filter(Boolean).join(' · ')}>
                    <ClosingStatusTrack kind="mortgage" recordId={item.id} dealId={deal.id} current={item.status} options={[['preapproved', 'Preapproved'], ['underwriting', 'Underwriting'], ['approved', 'Approved'], ['denied', 'Denied']]} />
                  </Row>
                )} />
                <Rows items={workspace.titleOrders} empty="No title order" render={item => (
                  <Row title={`${item.titleCompany} · ${item.orderNumber}`} status={item.status} meta={item.exceptions || undefined}>
                    <ClosingStatusTrack kind="title" recordId={item.id} dealId={deal.id} current={item.status} options={[['in_review', 'In review'], ['clear', 'Clear'], ['exception', 'Exception']]} />
                  </Row>
                )} />
                <Rows items={workspace.escrows} empty="No escrow" render={item => (
                  <Row title={`${item.escrowCompany} · ${item.escrowNumber}`} status={item.status} meta={[item.officerName, item.depositAmount ? `${amount(item.depositAmount)} deposit` : ''].filter(Boolean).join(' · ') || undefined}>
                    <ClosingStatusTrack kind="escrow" recordId={item.id} dealId={deal.id} current={item.status} options={[['pending', 'Pending'], ['closed', 'Closed'], ['cancelled', 'Cancelled']]} />
                  </Row>
                )} />
              </div>
            </Panel>
    ) },
    { key: 'commissions', filled: filled(workspace.commissions), node: (
            <Panel title="Commissions" actions={parents ? <div className="flex flex-wrap gap-1.5"><CommissionDrawer {...parents} agents={options.agents} /></div> : null}>
              <Rows items={workspace.commissions} empty="No commissions" render={item => (
                <Row title={`${item.title} · ${amount(item.grossCommission)}`} status={item.status} meta={[human(item.side), item.agent?.name, item.netCommission ? `${amount(item.netCommission)} net` : ''].filter(Boolean).join(' · ')}>
                  {(commissionNext[item.status] || []).map(([status, text]) => <CommissionAction key={status} commissionId={item.id} status={status} label={text} />)}
                </Row>
              )} />
              <Link href="/dashboard/platform/operations#commissions" className="mt-3 inline-block text-xs font-medium text-muted-foreground hover:text-foreground">Ledger in Operations</Link>
            </Panel>
    ) },
  ]
  const ordered = [...sections.filter(section => section.filled), ...sections.filter(section => !section.filled)]
  const stageIndex = trackStages.findIndex(([value]) => value === deal.stage)

  return (
    <PlatformPage
      crumbs={[{ label: 'Pipeline', href: '/platform/pipeline' }, { label: deal.title }]}
      title={<TitleLine as="h1" tone={stage?.[2] || 'zinc'} status={stage?.[1] || human(deal.stage)} headingClassName="text-2xl tracking-tight">{deal.title}</TitleLine>}
      meta={<>{human(deal.transactionType)} · {deal.assignedAgent?.name || 'Unassigned'}{deal.expectedCloseDate ? <> · Close <LocalDateTime value={deal.expectedCloseDate} options={{ dateStyle: 'medium' }} /></> : null}</>}
      actions={open ? <DealRowActions editInMenu={false} deal={{ id: deal.id, title: deal.title, stage: deal.stage }} /> : null}
      toolbar={deal.stage !== 'closed_lost' ? (
        <nav aria-label="Deal stages" className="relative -mx-4 overflow-x-auto px-4 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] md:mx-0 md:px-0">
          <ol className="flex min-w-max items-center gap-0 border-b border-border pb-2.5 text-[13px]">
            {trackStages.map(([value, label, tone], index) => {
              const current = index === stageIndex
              const done = stageIndex > index
              return (
                <li key={value} aria-current={current ? 'step' : undefined} className="flex items-center">
                  {index ? <span aria-hidden className={cn('mx-2 h-px w-5 sm:w-8', done || current ? 'bg-foreground/40' : 'bg-border')} /> : null}
                  <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', current ? 'font-semibold text-foreground' : done ? 'text-foreground/70' : 'text-muted-foreground')}>
                    {current ? <StatusDot tone={tone} /> : <span aria-hidden className={cn('inline-block size-1.5 rounded-full', done ? 'bg-foreground/50' : 'bg-border')} />}
                    {label}
                  </span>
                </li>
              )
            })}
          </ol>
        </nav>
      ) : null}
    >
      <div className="grid gap-5 pb-16 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0 space-y-5">
          <Panel title="Next step">
            <p className={cn('text-base', deal.nextStep ? 'font-medium text-foreground' : 'text-muted-foreground')}>{deal.nextStep || 'No next step set'}</p>
            {deal.notes ? <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{deal.notes}</p> : null}
            <details className="group mt-3 border-t border-border pt-3">
              <summary className="inline-flex min-h-8 cursor-pointer list-none items-center rounded-[6px] text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">{deal.nextStep ? 'Edit next step' : 'Set next step'}</summary>
              <div className="mt-3"><DealNextStepForm dealId={deal.id} nextStep={deal.nextStep} notes={deal.notes} /></div>
            </details>
          </Panel>
          {ordered.map(section => <Fragment key={section.key}>{section.node}</Fragment>)}
        </div>

        <aside className="min-w-0 space-y-5 lg:sticky lg:top-4">
          <Panel title="Deal">
            <dl className="grid grid-cols-2 gap-4">
              <Meta label="Offer"><span className="tabular-nums">{amount(deal.offerAmount)}</span></Meta>
              <Meta label="Commission"><span className="tabular-nums">{amount(deal.commissionAmount)}</span></Meta>
              <Meta label="Team">{deal.assignedTeam?.name || '—'}</Meta>
              <Meta label="Opened"><LocalDateTime value={deal.createdAt} options={{ dateStyle: 'medium' }} /></Meta>
            </dl>
            <details className="group mt-3 border-t border-border pt-3">
              <summary className="inline-flex min-h-8 cursor-pointer list-none items-center rounded-[6px] text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">Edit amounts</summary>
              <div className="mt-3"><DealFinancialTermsForm dealId={deal.id} offerAmount={deal.offerAmount} commissionAmount={deal.commissionAmount} /></div>
            </details>
          </Panel>
          <Panel title="Client">
            {deal.lead ? <div className="space-y-1 text-sm">
              <Link href={`/dashboard/platform/leads/${deal.lead.id}`} className="font-medium text-foreground hover:underline">{deal.lead.name}</Link>
              {deal.lead.phone ? <a className="block hover:underline" href={`tel:${deal.lead.phone.replace(/[^+\d]/g, '')}`}>{deal.lead.phone}</a> : null}
              {deal.lead.email ? <a className="block break-all hover:underline" href={`mailto:${deal.lead.email}`}>{deal.lead.email}</a> : null}
            </div> : <p className="text-sm text-muted-foreground">No client</p>}
          </Panel>
          <Panel title="Listing">
            {deal.property ? <div className="text-sm">
              <Link href={`/dashboard/platform/listings/${deal.property.id}`} className="font-medium text-foreground hover:underline">{deal.property.title}</Link>
              <p className="text-muted-foreground">{[deal.property.city, deal.property.state].filter(Boolean).join(', ')} · {formatMoney(deal.property.price)}{deal.property.listingType === 'rent' ? '/mo' : ''}</p>
            </div> : <p className="text-sm text-muted-foreground">No listing</p>}
          </Panel>
        </aside>
      </div>
    </PlatformPage>
  )
}
