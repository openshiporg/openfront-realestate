'use client'

import { useActionState, useEffect, useId, useRef, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  appendDocumentEvidence,
  approveCommissionAllocation,
  assignFileRetention,
  createExportManifest,
  proposeCommissionAllocation,
  reconcileCommissionLedger,
  recordCommissionReceipt,
  recordLegalHold,
  recordListingEngagement,
  recordListingPublication,
  recordPractitionerLicense,
  recordRepresentation,
  recordRetentionPolicy,
  reverseCommissionEntry,
  transitionSyndicationAuthority,
} from '../actions/operations'
import type { OperationsOptions } from '../lib/options'
import { CheckboxField, DateTimeField, MoneyField, RecordField, RowsField, SelectField, TextField } from './FormFields'

type State = { ok: boolean; message: string; uncertain?: boolean }
const initial: State = { ok: false, message: '' }

function CommandForm({ action, title, submitLabel = 'Save', children }: { action: (state: State, form: FormData) => Promise<State>; title: string; submitLabel?: string; children: ReactNode }) {
  const [state, formAction, pending] = useActionState(action, initial)
  const id = useId()
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (!state.message) return
    if (state.ok) toast.success(state.message)
    else toast.error(state.message)
  }, [state])
  return (
    <details className="rounded-xl border border-border bg-card shadow-xs">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">{title}</summary>
      <form ref={formRef} action={formAction} className="grid gap-3 border-t border-border p-4 sm:grid-cols-2">
        {children}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`${id}-reason`}>Note</Label>
          <Textarea id={`${id}-reason`} required name="reason" rows={2} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" size="sm" className="rounded-full" disabled={pending}>{pending ? 'Saving…' : submitLabel}</Button>
        </div>
      </form>
    </details>
  )
}

const licenseTypes: Array<[string, string]> = [['sales_agent', 'Sales agent'], ['associate_broker', 'Associate broker'], ['broker', 'Broker']]
const licenseStatuses: Array<[string, string]> = [['verified_active', 'Active'], ['restricted', 'Restricted'], ['inactive', 'Inactive'], ['expired', 'Expired'], ['suspended', 'Suspended'], ['revoked', 'Revoked']]

export function PractitionerLicenseForm({ options }: { options: OperationsOptions }) {
  return (
    <CommandForm action={recordPractitionerLicense} title="Add agent license">
      <RecordField name="practitionerId" label="Agent" options={options.practitioners} />
      <TextField name="licenseNumber" label="License number" />
      <SelectField name="licenseType" label="License type" options={licenseTypes} />
      <TextField name="jurisdictionCode" label="State or jurisdiction" placeholder="TX" />
      <SelectField name="status" label="Status" options={licenseStatuses} />
      <TextField name="verificationSource" label="Verified with" />
      <DateTimeField name="effectiveFrom" label="Valid from" />
      <DateTimeField name="effectiveThrough" label="Valid until" />
      <DateTimeField name="verifiedAt" label="Verified on" />
      <TextField name="restrictions" label="Restrictions" required={false} />
    </CommandForm>
  )
}

export function ListingEngagementForm({ options }: { options: OperationsOptions }) {
  return (
    <CommandForm action={recordListingEngagement} title="Add listing agreement">
      <RecordField name="propertyId" label="Listing" options={options.properties} />
      <RecordField name="practitionerId" label="Listing agent" options={options.practitioners} />
      <TextField name="jurisdictionCode" label="State or jurisdiction" />
      <SelectField name="status" label="Status" options={[['executed', 'Signed'], ['revoked', 'Revoked'], ['expired', 'Expired']]} />
      <DateTimeField name="effectiveFrom" label="Starts" />
      <DateTimeField name="effectiveThrough" label="Ends" />
      <TextField name="signatoryCapacity" label="Seller signing as" placeholder="Owner" />
      <TextField name="documentSha256" label="Signed document checksum (SHA-256)" />
      <TextField name="providerReference" label="Document reference" required={false} />
      <RowsField name="sellerPartySummary" label="Sellers" addLabel="Add seller" columns={[{ key: 'name', label: 'Name' }, { key: 'capacity', label: 'Signing as' }]} />
      <div className="flex flex-wrap gap-4 sm:col-span-2">
        <CheckboxField name="exclusive" label="Exclusive" />
        <CheckboxField name="marketingAuthorized" label="Marketing allowed" />
        <CheckboxField name="showingAuthorized" label="Showings allowed" />
      </div>
    </CommandForm>
  )
}

export function ListingPublicationForm({ options }: { options: OperationsOptions }) {
  return (
    <CommandForm action={recordListingPublication} title="Add publishing permission">
      <RecordField name="propertyId" label="Listing" options={options.properties} />
      <RecordField name="engagementId" label="Listing agreement" options={options.engagements} />
      <SelectField name="destination" label="Publish to" options={[['public_site', 'Website'], ['mls', 'MLS'], ['idx', 'IDX'], ['syndication', 'Syndication']]} />
      <SelectField name="status" label="Status" options={[['authorized', 'Allowed'], ['revoked', 'Revoked'], ['expired', 'Expired']]} />
      <DateTimeField name="effectiveFrom" label="Starts" />
      <DateTimeField name="effectiveThrough" label="Ends" />
      <TextField name="authorityBasis" label="Based on" />
      <TextField name="localRuleReference" label="Local rule reference" required={false} />
      <TextField name="dataUseGrantReference" label="Data-use agreement reference" required={false} />
    </CommandForm>
  )
}

export function RepresentationForm({ options }: { options: OperationsOptions }) {
  return (
    <CommandForm action={recordRepresentation} title="Add representation agreement">
      <RecordField name="leadId" label="Client" options={options.leads} />
      <RecordField name="practitionerId" label="Agent" options={options.practitioners} />
      <RecordField name="propertyId" label="Listing" options={options.properties} required={false} />
      <RecordField name="dealId" label="Deal" options={options.deals} required={false} />
      <SelectField name="side" label="Side" options={[['buyer', 'Buyer'], ['seller', 'Seller']]} />
      <SelectField name="relationshipType" label="Relationship" options={[['exclusive_agency', 'Exclusive agency'], ['nonexclusive_agency', 'Non-exclusive agency'], ['transaction_brokerage', 'Transaction broker'], ['customer_assistance', 'Customer only']]} />
      <TextField name="jurisdictionCode" label="State or jurisdiction" />
      <SelectField name="status" label="Status" options={[['executed', 'Signed'], ['terminated', 'Terminated'], ['expired', 'Expired']]} />
      <DateTimeField name="effectiveFrom" label="Starts" />
      <DateTimeField name="effectiveThrough" label="Ends" />
      <DateTimeField name="consentRecordedAt" label="Client consent on" />
      <TextField name="documentSha256" label="Agreement checksum (SHA-256)" />
      <TextField name="disclosureVersion" label="Disclosure form version" />
      <TextField name="scopeSummary" label="Scope" />
    </CommandForm>
  )
}

export function DocumentEvidenceForm({ options }: { options: OperationsOptions }) {
  return (
    <CommandForm action={appendDocumentEvidence} title="Add document event">
      <RecordField name="documentId" label="Document" options={options.documents} />
      <RecordField name="offerId" label="Offer" options={options.offers} required={false} />
      <SelectField name="eventType" label="Event" options={[['generated', 'Generated'], ['signed', 'Signed'], ['delivered', 'Delivered'], ['received', 'Received'], ['presented', 'Presented'], ['acknowledged', 'Acknowledged'], ['voided', 'Voided']]} />
      <SelectField name="channel" label="Sent by" options={[['esign', 'E-signature'], ['email', 'Email'], ['portal', 'Client portal'], ['in_person', 'In person'], ['other', 'Other']]} />
      <TextField name="documentSha256" label="Document checksum (SHA-256)" />
      <TextField name="templateSha256" label="Template checksum (SHA-256)" />
      <TextField name="certificateSha256" label="Certificate checksum (SHA-256)" required={false} />
      <TextField name="provider" label="Provider" />
      <TextField name="providerReference" label="Provider reference" />
      <DateTimeField name="occurredAt" label="Happened on" />
      <DateTimeField name="providerReportedAt" label="Reported on" required={false} />
      <DateTimeField name="acknowledgedAt" label="Acknowledged on" required={false} />
      <TextField name="acknowledgementReference" label="Acknowledgement reference" required={false} />
      <RowsField name="recipients" label="Recipients" addLabel="Add recipient" columns={[{ key: 'name', label: 'Name' }, { key: 'address', label: 'Email or address' }, { key: 'role', label: 'Role' }]} />
    </CommandForm>
  )
}

const allocationTypes: Array<[string, string]> = [['brokerage', 'Brokerage'], ['agent', 'Agent'], ['team', 'Team'], ['referral', 'Referral'], ['fee', 'Fee'], ['unallocated', 'Unallocated']]

export function CommissionLedgerForms({ options }: { options: OperationsOptions }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <CommandForm action={proposeCommissionAllocation} title="Split a commission">
        <RecordField name="commissionId" label="Commission" options={options.commissions} />
        <TextField name="currencyCode" label="Currency" placeholder="USD" />
        <RowsField name="lines" label="Splits" addLabel="Add split" columns={[{ key: 'allocationType', label: 'Type', options: allocationTypes }, { key: 'amountCents', label: 'Amount', money: true }, { key: 'payeeLabel', label: 'Paid to' }]} />
      </CommandForm>
      <CommandForm action={approveCommissionAllocation} title="Approve a split">
        <RecordField name="commissionId" label="Commission" options={options.commissions} />
        <RecordField name="batchKey" label="Split" options={options.batchKeys} />
      </CommandForm>
      <CommandForm action={recordCommissionReceipt} title="Record payment received">
        <RecordField name="commissionId" label="Commission" options={options.commissions} />
        <RecordField name="batchKey" label="Approved split" options={options.batchKeys} />
        <MoneyField name="amountCents" label="Amount" />
        <TextField name="currencyCode" label="Currency" placeholder="USD" />
        <TextField name="externalReference" label="Payment reference" />
        <TextField name="sourceDocumentSha256" label="Receipt checksum (SHA-256)" />
      </CommandForm>
      <CommandForm action={reverseCommissionEntry} title="Reverse an entry">
        <RecordField name="entryId" label="Entry" options={options.ledgerEntries} wide />
      </CommandForm>
      <CommandForm action={reconcileCommissionLedger} title="Reconcile a commission">
        <RecordField name="commissionId" label="Commission" options={options.commissions} />
        <RecordField name="batchKey" label="Split" options={options.batchKeys} />
        <TextField name="externalReference" label="Accounting reference" wide />
      </CommandForm>
    </div>
  )
}

export function RetentionForms({ options }: { options: OperationsOptions }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <CommandForm action={recordRetentionPolicy} title="Add retention policy">
        <SelectField name="retentionClass" label="Records" options={[['transaction_file', 'Transaction file'], ['listing_no_close', 'Listing without a sale'], ['consent_proof', 'Consent records'], ['security_incident', 'Security incident']]} />
        <TextField name="jurisdictionCode" label="State or jurisdiction" />
        <SelectField name="triggerType" label="Starts when" options={[['deal_closed', 'Deal closes'], ['document_signed', 'Document is signed'], ['manual_verified', 'Set manually']]} />
        <TextField name="retentionDays" label="Keep for (days)" inputMode="numeric" />
        <SelectField name="disposition" label="Afterwards" options={[['tombstone_delete', 'Request deletion'], ['archive', 'Archive'], ['review', 'Review']]} />
        <TextField name="legalBasis" label="Legal basis" />
        <DateTimeField name="effectiveFrom" label="Starts" />
        <DateTimeField name="effectiveThrough" label="Ends" required={false} />
      </CommandForm>
      <CommandForm action={assignFileRetention} title="Apply retention to a document">
        <RecordField name="dealId" label="Deal" options={options.deals} />
        <RecordField name="documentId" label="Document" options={options.documents} />
        <RecordField name="policyId" label="Policy" options={options.policies} />
        <TextField name="documentSha256" label="Document checksum (SHA-256)" />
        <DateTimeField name="triggerAt" label="Retention starts" />
      </CommandForm>
      <CommandForm action={recordLegalHold} title="Place or release a legal hold">
        <RecordField name="dealId" label="Deal" options={options.deals} />
        <RecordField name="documentId" label="Document" options={options.documents} required={false} />
        <TextField name="holdKey" label="Hold name" />
        <SelectField name="action" label="Action" options={[['place', 'Place hold'], ['release', 'Release hold']]} />
      </CommandForm>
      <CommandForm action={createExportManifest} title="Create export">
        <RecordField name="dealId" label="Deal" options={options.deals} />
        <TextField name="manifestKey" label="Export name" />
        <TextField name="manifestSha256" label="Export checksum (SHA-256)" wide />
        <RowsField name="items" label="Documents" addLabel="Add document" columns={[{ key: 'documentId', label: 'Document', options: options.documents.map((option) => [option.value, option.label] as [string, string]) }, { key: 'sha256', label: 'Checksum (SHA-256)' }]} />
      </CommandForm>
    </div>
  )
}

export function SyndicationAuthorityAction({ syndicationId, status }: { syndicationId: string; status: string }) {
  if (status === 'removed') return <span className="text-xs text-muted-foreground">—</span>
  const next = status === 'published' ? 'removed' : 'published'
  return (
    <CommandForm action={transitionSyndicationAuthority} title={next === 'published' ? 'Mark published' : 'Mark removed'}>
      <input type="hidden" name="syndicationId" value={syndicationId} />
      <input type="hidden" name="status" value={next} />
      <TextField name="providerReference" label="Provider reference" required={false} wide />
    </CommandForm>
  )
}
