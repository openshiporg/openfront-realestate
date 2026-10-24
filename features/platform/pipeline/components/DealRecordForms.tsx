'use client'

import { ActionButton, Choice, Field, FormDrawer, RecordForm, Toggle } from '../../components/RecordForm'
import { addCommission, addDealDocument, addEscrow, addInspection, addMortgage, addTitleOrder, createDeal, setClosingRecordStatus } from '../actions/dealRecords'
import type { DealOptions } from '../lib/dealWorkspace'

const transactionTypes: Array<[string, string]> = [['buyer', 'Buyer'], ['seller', 'Seller'], ['tenant', 'Tenant'], ['landlord', 'Landlord']]

export function NewDealDrawer({ options }: { options: DealOptions }) {
  return (
    <FormDrawer trigger="New deal" title="New deal" primary>
      {close => (
        <RecordForm action={createDeal} submitLabel="Create deal" onDone={close} redirectTo={id => `/dashboard/platform/pipeline/${id}`}>
          <Field name="title" label="Title" required wide placeholder="Client — address" />
          <Choice name="transactionType" label="Side" options={transactionTypes} defaultValue="buyer" />
          <Field name="expectedCloseDate" label="Expected close" type="datetime-local" />
          <Choice name="propertyId" label="Listing" options={options.properties.map(p => [p.id, p.title])} emptyLabel="No listing" wide />
          <Choice name="leadId" label="Client (lead)" options={options.leads.map(l => [l.id, l.name])} emptyLabel="No client" wide />
          <Choice name="assignedAgentId" label="Agent" options={options.agents.map(a => [a.id, a.name])} emptyLabel="Unassigned" wide />
          <Field name="nextStep" label="Next step" wide />
        </RecordForm>
      )}
    </FormDrawer>
  )
}

type Parents = { dealId: string; propertyId: string }
function Hidden({ dealId, propertyId }: Parents) {
  return <><input type="hidden" name="dealId" value={dealId} /><input type="hidden" name="propertyId" value={propertyId} /></>
}

export function InspectionDrawer(props: Parents) {
  return (
    <FormDrawer trigger="Add inspection" title="Add inspection">
      {close => (
        <RecordForm action={addInspection} submitLabel="Add inspection" onDone={close}>
          <Hidden {...props} />
          <Field name="title" label="Title" required defaultValue="General inspection" wide />
          <Choice name="inspectionType" label="Type" options={[['general', 'General'], ['pest', 'Pest'], ['roof', 'Roof'], ['appraisal', 'Appraisal'], ['walkthrough', 'Final walkthrough']]} defaultValue="general" />
          <Field name="scheduledAt" label="Scheduled" type="datetime-local" />
          <Field name="inspectorName" label="Inspector" />
          <Field name="inspectorEmail" label="Inspector email" type="email" />
          <Field name="estimatedCost" label="Estimated cost" inputMode="decimal" />
        </RecordForm>
      )}
    </FormDrawer>
  )
}

export function EscrowDrawer(props: Parents) {
  return (
    <FormDrawer trigger="Open escrow" title="Open escrow">
      {close => (
        <RecordForm action={addEscrow} submitLabel="Open escrow" onDone={close}>
          <Hidden {...props} />
          <Field name="escrowNumber" label="Escrow number" required />
          <Field name="escrowCompany" label="Company" required />
          <Field name="officerName" label="Officer" />
          <Field name="officerEmail" label="Officer email" type="email" />
          <Field name="scheduledCloseAt" label="Scheduled close" type="datetime-local" />
          <Field name="depositAmount" label="Earnest deposit" inputMode="decimal" />
        </RecordForm>
      )}
    </FormDrawer>
  )
}

export function TitleDrawer(props: Parents) {
  return (
    <FormDrawer trigger="Order title" title="Order title">
      {close => (
        <RecordForm action={addTitleOrder} submitLabel="Order title" onDone={close}>
          <Hidden {...props} />
          <Field name="orderNumber" label="Order number" required />
          <Field name="titleCompany" label="Title company" required />
        </RecordForm>
      )}
    </FormDrawer>
  )
}

export function MortgageDrawer({ dealId, leadId }: { dealId: string; leadId: string }) {
  return (
    <FormDrawer trigger="Add financing" title="Add financing">
      {close => (
        <RecordForm action={addMortgage} submitLabel="Add financing" onDone={close}>
          <input type="hidden" name="dealId" value={dealId} />
          <input type="hidden" name="leadId" value={leadId} />
          <Field name="applicationNumber" label="Application number" required />
          <Field name="lenderName" label="Lender" required />
          <Field name="loanAmount" label="Loan amount" inputMode="decimal" />
          <Field name="interestRate" label="Rate (%)" inputMode="decimal" />
        </RecordForm>
      )}
    </FormDrawer>
  )
}

export function CommissionDrawer({ agents, ...props }: Parents & { agents: DealOptions['agents'] }) {
  return (
    <FormDrawer trigger="Project commission" title="Project commission">
      {close => (
        <RecordForm action={addCommission} submitLabel="Project commission" onDone={close}>
          <Hidden {...props} />
          <Field name="title" label="Title" required defaultValue="Commission" wide />
          <Choice name="side" label="Side" options={[['buyer', 'Buyer'], ['listing', 'Listing'], ['referral', 'Referral']]} defaultValue="buyer" />
          <Field name="grossCommission" label="Gross" required inputMode="decimal" />
          <Field name="brokerageSplitPercent" label="Brokerage split %" inputMode="decimal" />
          <Field name="agentSplitPercent" label="Agent split %" inputMode="decimal" />
          <Choice name="agentId" label="Agent" options={agents.map(a => [a.id, a.name])} emptyLabel="No agent" wide />
        </RecordForm>
      )}
    </FormDrawer>
  )
}

export function DocumentDrawer(props: Parents) {
  return (
    <FormDrawer trigger="Add document" title="Add document">
      {close => (
        <RecordForm action={addDealDocument} submitLabel="Add document" onDone={close}>
          <Hidden {...props} />
          <Field name="title" label="Title" required wide />
          <Choice name="documentType" label="Type" options={[['listing_agreement', 'Listing agreement'], ['offer', 'Offer'], ['disclosure', 'Disclosure'], ['inspection_report', 'Inspection report'], ['closing_statement', 'Closing statement'], ['other', 'Other']]} defaultValue="other" />
          <Field name="expiresAt" label="Expires" type="datetime-local" />
          <Field name="fileUrl" label="File URL" type="url" wide />
          <Toggle name="requiresSignature" label="Needs signature" />
        </RecordForm>
      )}
    </FormDrawer>
  )
}

/** Status pills for escrow, title and financing records, which have no transition command. */
export function ClosingStatusTrack({ kind, recordId, dealId, current, options }: { kind: 'escrow' | 'title' | 'mortgage'; recordId: string; dealId: string; current: string; options: Array<[string, string]> }) {
  return <>{options.filter(([value]) => value !== current).map(([value, label]) => <ActionButton key={value} action={setClosingRecordStatus} fields={{ kind, recordId, dealId, status: value }} label={label} />)}</>
}
