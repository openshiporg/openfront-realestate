import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { formatMoney } from '@/features/lib/money'
import { ErrorBanner, Meta, Panel, PlatformPage, TitleLine, Track, type Tone } from '../../components/PlatformUI'
import { CommissionAction, CounterOfferForm, ChecklistForm, DisclosureAction, DocumentAction, InspectionAction, MilestoneAction, OfferAction, OfferDraftForm } from '../../operations/components/TaskForms'
import { LocalDateTime } from '../../showings/components/LocalDateTime'
import { DealFinancialTermsForm, DealNextStepForm, DealStageButton } from '../components/DealActionForms'
import { ClosingStatusTrack, CommissionDrawer, DocumentDrawer, EscrowDrawer, InspectionDrawer, MortgageDrawer, TitleDrawer } from '../components/DealRecordForms'
import { getDealOptions, getDealWorkspace } from '../lib/dealWorkspace'
import { dealStages } from '../lib/stages'

const stageNext: Record<string, string[]> = {
  prospecting: ['active_search'], active_search: ['offer_drafted'], offer_drafted: ['active_search', 'under_contract'],
  under_contract: ['inspection', 'financing', 'closed_won'], inspection: ['under_contract', 'financing', 'closed_won'], financing: ['under_contract', 'inspection', 'closed_won'],
}
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
    {children ? <Track>{children}</Track> : null}
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

  return (
    <PlatformPage
      crumbs={[{ label: 'Pipeline', href: '/platform/pipeline' }, { label: deal.title }]}
      title={<TitleLine as="h1" tone={stage?.[2] || 'zinc'} status={stage?.[1] || human(deal.stage)} headingClassName="text-2xl tracking-tight">{deal.title}</TitleLine>}
      meta={<>{human(deal.transactionType)} · {deal.assignedAgent?.name || 'Unassigned'}{deal.expectedCloseDate ? <> · Close <LocalDateTime value={deal.expectedCloseDate} options={{ dateStyle: 'medium' }} /></> : null}</>}
      toolbar={open ? (
        <Track label="Deal stage">
          {(stageNext[deal.stage] || []).map(next => <DealStageButton key={next} dealId={deal.id} stage={next} label={dealStages.find(([value]) => value === next)?.[1] || human(next)} />)}
          <DealStageButton dealId={deal.id} stage="closed_lost" label="Lost" confirm={{ title: 'Mark this deal as lost?', description: `${deal.title} will move to Closed lost.` }} />
        </Track>
      ) : null}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0 space-y-5">
          <Panel title="Offers">
            <Rows items={workspace.offers} empty="No offers" render={offer => <>
              <Row title={`${offer.offerNumber}${offer.version > 1 ? ` v${offer.version}` : ''} · ${amount(offer.amount)}`} status={offer.status}
                meta={[human(offer.financingType), offer.earnestMoney ? `${amount(offer.earnestMoney)} earnest` : '', offer.contingencies, offer.parentOffer ? `Counter to ${offer.parentOffer.offerNumber}` : ''].filter(Boolean).join(' · ')}>
                {(offerNext[offer.status] || []).map(([status, text]) => <OfferAction key={status} offerId={offer.id} status={status} label={text} />)}
              </Row>
              {['submitted', 'countered'].includes(offer.status) ? <div className="w-full"><CounterOfferForm offerId={offer.id} /></div> : null}
            </>} />
            {open && workspace.offers ? <OfferDraftForm dealId={deal.id} /> : null}
          </Panel>

          <Panel title="Closing checklist">
            <Rows items={workspace.milestones} empty="No checklist items" render={item => (
              <Row title={item.name} status={item.status} meta={item.dueAt || item.assignedTo ? <>{item.dueAt ? <>Due <LocalDateTime value={item.dueAt} options={{ month: 'short', day: 'numeric' }} /></> : null}{item.dueAt && item.assignedTo ? ' · ' : ''}{item.assignedTo?.name}</> : undefined}>
                {(milestoneNext[item.status] || []).map(([status, text]) => <MilestoneAction key={status} milestoneId={item.id} status={status} label={text} />)}
              </Row>
            )} />
            {workspace.milestones ? <ChecklistForm dealId={deal.id} /> : null}
          </Panel>

          <Panel title="Documents" actions={parents ? <Track><DocumentDrawer {...parents} /></Track> : null}>
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

          <Panel title="Inspections" actions={parents ? <Track><InspectionDrawer {...parents} /></Track> : null}>
            {!parents ? noListing : null}
            <Rows items={workspace.inspections} empty="No inspections" render={item => (
              <Row title={item.title} status={item.status} meta={[human(item.inspectionType), item.inspectorName, item.estimatedCost ? amount(item.estimatedCost) : ''].filter(Boolean).join(' · ')}>
                {(inspectionNext[item.status] || []).map(([status, text]) => <InspectionAction key={status} inspectionId={item.id} status={status} label={text} />)}
              </Row>
            )} />
          </Panel>

          <Panel title="Financing, title and escrow" actions={<Track>
            <MortgageDrawer dealId={deal.id} leadId={deal.lead?.id || ''} />
            {parents ? <TitleDrawer {...parents} /> : null}
            {parents ? <EscrowDrawer {...parents} /> : null}
          </Track>}>
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

          <Panel title="Commissions" actions={parents ? <Track><CommissionDrawer {...parents} agents={options.agents} /></Track> : null}>
            <Rows items={workspace.commissions} empty="No commissions" render={item => (
              <Row title={`${item.title} · ${amount(item.grossCommission)}`} status={item.status} meta={[human(item.side), item.agent?.name, item.netCommission ? `${amount(item.netCommission)} net` : ''].filter(Boolean).join(' · ')}>
                {(commissionNext[item.status] || []).map(([status, text]) => <CommissionAction key={status} commissionId={item.id} status={status} label={text} />)}
              </Row>
            )} />
            <Link href="/dashboard/platform/operations#commissions" className="mt-3 inline-block text-xs font-medium text-muted-foreground hover:text-foreground">Ledger in Operations</Link>
          </Panel>
        </div>

        <aside className="min-w-0 space-y-5 lg:sticky lg:top-4">
          <Panel title="Deal">
            <dl className="grid grid-cols-2 gap-4">
              <Meta label="Offer">{amount(deal.offerAmount)}</Meta>
              <Meta label="Commission">{amount(deal.commissionAmount)}</Meta>
              <Meta label="Team">{deal.assignedTeam?.name || '—'}</Meta>
              <Meta label="Opened"><LocalDateTime value={deal.createdAt} options={{ dateStyle: 'medium' }} /></Meta>
            </dl>
            {deal.nextStep ? <p className="mt-4 border-t border-border pt-3 text-sm"><span className="text-muted-foreground">Next · </span>{deal.nextStep}</p> : null}
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
          <Panel title="Terms"><DealFinancialTermsForm dealId={deal.id} offerAmount={deal.offerAmount} commissionAmount={deal.commissionAmount} /></Panel>
          <Panel title="Next step"><DealNextStepForm dealId={deal.id} nextStep={deal.nextStep} notes={deal.notes} /></Panel>
        </aside>
      </div>
    </PlatformPage>
  )
}
