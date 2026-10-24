'use server'

import { revalidatePath } from 'next/cache'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { classifyCommissionTransitionFeedback } from '../lib/commissionTransitionFeedback'

export type OperationsWorkspace = {
  offers: any[]; transactions: any[]; commissions: any[]; savedSearches: any[]; alerts: any[]; feeds: any[]; queue: any[]
  inspections: any[]; openHouses: any[]; disclosures: any[]; mortgages: any[]; titleOrders: any[]; escrows: any[]; comps: any[]; valuations: any[]; syndications: any[]; tasks: any[]
  listingEngagementAuthorities: any[]; listingPublicationAuthorities: any[]; practitionerLicenses: any[]; representationAuthorities: any[]; documentEvidenceEvents: any[]; commissionLedgerEntries: any[]; retentionPolicies: any[]; transactionFileEvents: any[]
}

const OPERATIONS_QUERY = `
  query PlatformOperations {
    platformOperations {
      offers { id offerNumber version parentOffer { id offerNumber } status amount earnestMoney financingType contingencies submittedAt responseDueAt createdAt deal { id title } property { id title } lead { id name } assignedAgent { id name } }
      transactions { id title stage expectedCloseDate property { id title } lead { id name } assignedAgent { id name } milestones { id name status dueAt completedAt sortOrder notes assignedTo { id name } } documents { id title documentType status requiresSignature sentAt signedAt expiresAt } }
      commissions { id title status side grossCommission brokerageSplitPercent agentSplitPercent netCommission paidAt deal { id title } agent { id name } }
      savedSearches { id name city state propertyType minPrice maxPrice minBedrooms alertsEnabled lastNotifiedAt user { id name email } }
      alerts { id status cadence lastSentAt sentCount savedSearch { id name } user { id name email } }
      feeds { id name provider feedType status lastImportedAt recordsImported }
      queue { id eventKey eventType aggregateType aggregateId status attempts replayCount availableAt occurredAt lastError }
      inspections { id title inspectionType status scheduledAt completedAt inspectorName estimatedCost summary findings property { id title } deal { id title } }
      openHouses { id title status startsAt endsAt attendeeCount notes property { id title } hostAgent { id name } }
      disclosures { id title disclosureType status documentUrl sentAt acknowledgedAt deal { id title } property { id title } }
      mortgages { id applicationNumber lenderName status loanAmount interestRate submittedAt decisionAt deal { id title } lead { id name } }
      titleOrders { id orderNumber titleCompany status orderedAt clearedAt exceptions deal { id title } property { id title } }
      escrows { id escrowNumber status escrowCompany officerName openedAt scheduledCloseAt closedAt depositAmount deal { id title } property { id title } }
      comps { id addressLine1 city state status listPrice salePrice soldAt bedrooms bathrooms squareFeet distanceMiles subjectProperty { id title } neighborhood { id name } }
      valuations { id valuationNumber valuationType lowValue estimatedValue highValue valuedAt notes property { id title } performedBy { id name } }
      syndications { id channel status externalListingId listingUrl errorMessage property { id title slug } }
      tasks { id title status priority dueAt completedAt notes assignedAgent { id name } property { id title } lead { id name } deal { id title } }
      listingEngagementAuthorities { id authorityNumber status jurisdictionCode effectiveFrom effectiveThrough marketingAuthorized showingAuthorized documentSha256 property { id title } practitioner { id name } }
      listingPublicationAuthorities { id authorityNumber destination status effectiveFrom effectiveThrough authorityBasis property { id title } engagementId }
      practitionerLicenses { id licenseNumber licenseType jurisdictionCode status effectiveFrom effectiveThrough verifiedAt verificationSource practitioner { id name } }
      representationAuthorities { id authorityNumber side relationshipType jurisdictionCode status effectiveFrom effectiveThrough disclosureVersion lead { id name } property { id title } deal { id title } practitioner { id name } }
      documentEvidenceEvents { id eventKey eventType documentSha256 templateSha256 channel provider providerReference occurredAt acknowledgedAt document { id title } offer { id offerNumber } }
      commissionLedgerEntries { id entryKey batchKey entryType allocationType amountCents currencyCode payeeLabel externalReference occurredAt commissionId preparedBy { id name } approvedBy { id name } }
      retentionPolicies { id policyKey retentionClass jurisdictionCode triggerType retentionDays disposition effectiveFrom effectiveThrough }
      transactionFileEvents { id eventKey eventType triggerAt disposeAfter holdKey manifestKey manifestSha256 documentSha256 externalDeletionReference reason occurredAt deal { id title } document { id title } }
    }
  }
`

export async function getPlatformOperations(): Promise<{ workspace: OperationsWorkspace; error: string | null }> {
  const response = await keystoneClient<any>(OPERATIONS_QUERY, {}, { cache: 'no-store' })
  return response.success ? { workspace: response.data.platformOperations, error: null } : { workspace: { offers: [], transactions: [], commissions: [], savedSearches: [], alerts: [], feeds: [], queue: [], inspections: [], openHouses: [], disclosures: [], mortgages: [], titleOrders: [], escrows: [], comps: [], valuations: [], syndications: [], tasks: [], listingEngagementAuthorities: [], listingPublicationAuthorities: [], practitionerLicenses: [], representationAuthorities: [], documentEvidenceEvents: [], commissionLedgerEntries: [], retentionPolicies: [], transactionFileEvents: [] }, error: response.error }
}

type State = { ok: boolean; message: string; uncertain?: boolean }
async function submit(mutation: string, field: string, data: Record<string, unknown>): Promise<State> {
  const response = await keystoneClient<any>(mutation, { data: { ...data, idempotencyKey: crypto.randomUUID() } }, { cache: 'no-store' })
  if (!response.success || !response.data[field].ok) return { ok: false, message: response.success ? response.data[field].message : 'Could not save. Please try again.' }
  revalidatePath('/dashboard/platform/operations'); revalidatePath('/dashboard/platform/pipeline', 'layout'); revalidatePath('/dashboard/platform/listings', 'layout')
  return { ok: true, message: response.data[field].message }
}

export async function transitionOfferWorkflow(_state: State, form: FormData) {
  return submit('mutation OfferStatus($data: OperatorTransitionInput!) { transitionOfferStatus(data: $data) { ok message itemId replayed } }', 'transitionOfferStatus', { id: String(form.get('offerId') || ''), status: String(form.get('status') || '') })
}
export async function transitionMilestoneWorkflow(_state: State, form: FormData) {
  return submit('mutation MilestoneStatus($data: OperatorTransitionInput!) { transitionTransactionMilestoneStatus(data: $data) { ok message itemId replayed } }', 'transitionTransactionMilestoneStatus', { id: String(form.get('milestoneId') || ''), status: String(form.get('status') || '') })
}
export async function transitionDisclosureWorkflow(_state: State, form: FormData) {
  return submit('mutation DisclosureStatus($data: OperatorTransitionInput!) { transitionDisclosureStatus(data: $data) { ok message itemId replayed } }', 'transitionDisclosureStatus', { id: String(form.get('disclosureId') || ''), status: String(form.get('status') || '') })
}
export async function transitionCommissionWorkflow(_state: State, form: FormData): Promise<State> {
  const id = String(form.get('commissionId') || ''), status = String(form.get('status') || '')
  const response = await keystoneClient<any>('mutation CommissionStatus($data: OperatorTransitionInput!) { transitionCommissionStatus(data: $data) { ok message itemId status replayed } }', { data: { id, status, idempotencyKey: crypto.randomUUID() } }, { cache: 'no-store' })
  const feedback = classifyCommissionTransitionFeedback(response, id, status)
  if (feedback.kind === 'confirmed') {
    revalidatePath('/dashboard/platform/operations'); revalidatePath('/dashboard/platform/pipeline', 'layout'); revalidatePath('/dashboard/platform/listings', 'layout')
    return { ok: true, message: feedback.message }
  }
  return { ok: false, message: feedback.message, ...(feedback.kind === 'unconfirmed' ? { uncertain: true } : {}) }
}

export async function createOffer(_state: State, form: FormData) {
  return submit('mutation CreateOffer($data: CreateOfferCommandInput!) { createOfferCommand(data: $data) { ok message itemId replayed } }', 'createOfferCommand', { dealId: String(form.get('dealId') || ''), amount: String(form.get('amount') || ''), earnestMoney: String(form.get('earnestMoney') || ''), financingType: String(form.get('financingType') || 'conventional'), contingencies: String(form.get('contingencies') || '') })
}
export async function createCounterOffer(_state: State, form: FormData) {
  return submit('mutation Counter($data: CreateCounterOfferCommandInput!) { createCounterOfferCommand(data: $data) { ok message itemId replayed } }', 'createCounterOfferCommand', { offerId: String(form.get('offerId') || ''), amount: String(form.get('amount') || ''), contingencies: String(form.get('contingencies') || '') })
}
export async function addChecklistItem(_state: State, form: FormData) {
  return submit('mutation Checklist($data: CreateChecklistItemCommandInput!) { createChecklistItemCommand(data: $data) { ok message itemId replayed } }', 'createChecklistItemCommand', { dealId: String(form.get('dealId') || ''), name: String(form.get('name') || ''), dueAt: String(form.get('dueAt') || '') || null, notes: String(form.get('notes') || '') })
}
export async function transitionDocument(_state: State, form: FormData) {
  return submit('mutation Document($data: TransitionDocumentCommandInput!) { transitionDocumentCommand(data: $data) { ok message itemId replayed } }', 'transitionDocumentCommand', { documentId: String(form.get('documentId') || ''), status: String(form.get('status') || '') })
}
export async function transitionTask(_state: State, form: FormData) {
  return submit('mutation TaskStatus($data: TransitionAgentTaskCommandInput!) { transitionAgentTaskCommand(data: $data) { ok message itemId replayed } }', 'transitionAgentTaskCommand', { taskId: String(form.get('taskId') || ''), status: String(form.get('status') || '') })
}
export async function transitionOpenHouse(_state: State, form: FormData) {
  return submit('mutation OpenHouseStatus($data: OperatorTransitionInput!) { transitionOpenHouseStatus(data: $data) { ok message itemId replayed } }', 'transitionOpenHouseStatus', { id: String(form.get('openHouseId') || ''), status: String(form.get('status') || '') })
}
export async function transitionInspection(_state: State, form: FormData) {
  return submit('mutation InspectionStatus($data: TransitionInspectionCommandInput!) { transitionInspectionCommand(data: $data) { ok message itemId replayed } }', 'transitionInspectionCommand', { inspectionId: String(form.get('inspectionId') || ''), status: String(form.get('status') || '') })
}
export async function updateAlert(_state: State, form: FormData) {
  return submit('mutation Alert($data: UpdateSavedSearchAlertCommandInput!) { updateSavedSearchAlertCommand(data: $data) { ok message itemId replayed } }', 'updateSavedSearchAlertCommand', { alertId: String(form.get('alertId') || ''), status: String(form.get('status') || ''), cadence: String(form.get('cadence') || '') })
}
export async function queueAlert(_state: State, form: FormData) {
  return submit('mutation QueueAlert($data: QueueSavedSearchAlertCommandInput!) { queueSavedSearchAlertCommand(data: $data) { ok message itemId replayed } }', 'queueSavedSearchAlertCommand', { alertId: String(form.get('alertId') || '') })
}
export async function queueImport(_state: State, form: FormData) {
  return submit('mutation QueueImport($data: QueueSourceImportCommandInput!) { queueSourceImportCommand(data: $data) { ok message itemId replayed } }', 'queueSourceImportCommand', { sourceFeedId: String(form.get('sourceFeedId') || ''), mode: String(form.get('mode') || 'incremental') })
}

function parseJsonField(form: FormData, name: string, fallback: unknown) {
  const raw = String(form.get(name) || '').trim()
  if (!raw) return fallback
  try { return JSON.parse(raw) } catch { throw new Error(`${name} must be valid JSON.`) }
}
const value = (form: FormData, name: string) => String(form.get(name) || '').trim()

export async function transitionSyndicationAuthority(_state: State, form: FormData) {
  return submit('mutation Syndication($data: TransitionListingSyndicationCommandInput!) { transitionListingSyndicationCommand(data: $data) { ok message itemId replayed } }', 'transitionListingSyndicationCommand', { syndicationId: value(form, 'syndicationId'), status: value(form, 'status'), providerReference: value(form, 'providerReference'), reason: value(form, 'reason') })
}
export async function recordPractitionerLicense(_state: State, form: FormData) {
  return submit('mutation License($data: RecordPractitionerLicenseAuthorityInput!) { recordPractitionerLicenseAuthorityCommand(data: $data) { ok message itemId replayed } }', 'recordPractitionerLicenseAuthorityCommand', { practitionerId: value(form, 'practitionerId'), licenseNumber: value(form, 'licenseNumber'), licenseType: value(form, 'licenseType'), jurisdictionCode: value(form, 'jurisdictionCode'), status: value(form, 'status'), effectiveFrom: value(form, 'effectiveFrom'), effectiveThrough: value(form, 'effectiveThrough'), verifiedAt: value(form, 'verifiedAt'), verificationSource: value(form, 'verificationSource'), restrictions: value(form, 'restrictions'), reason: value(form, 'reason') })
}
export async function recordListingEngagement(_state: State, form: FormData) {
  return submit('mutation Engagement($data: RecordListingEngagementAuthorityInput!) { recordListingEngagementAuthorityCommand(data: $data) { ok message itemId replayed } }', 'recordListingEngagementAuthorityCommand', { propertyId: value(form, 'propertyId'), practitionerId: value(form, 'practitionerId'), status: value(form, 'status'), jurisdictionCode: value(form, 'jurisdictionCode'), effectiveFrom: value(form, 'effectiveFrom'), effectiveThrough: value(form, 'effectiveThrough'), exclusive: form.get('exclusive') === 'on', marketingAuthorized: form.get('marketingAuthorized') === 'on', showingAuthorized: form.get('showingAuthorized') === 'on', sellerPartySummary: parseJsonField(form, 'sellerPartySummary', []), signatoryCapacity: value(form, 'signatoryCapacity'), documentSha256: value(form, 'documentSha256'), providerReference: value(form, 'providerReference'), reason: value(form, 'reason') })
}
export async function recordListingPublication(_state: State, form: FormData) {
  return submit('mutation Publication($data: RecordListingPublicationAuthorityInput!) { recordListingPublicationAuthorityCommand(data: $data) { ok message itemId replayed } }', 'recordListingPublicationAuthorityCommand', { propertyId: value(form, 'propertyId'), engagementId: value(form, 'engagementId'), destination: value(form, 'destination'), status: value(form, 'status'), effectiveFrom: value(form, 'effectiveFrom'), effectiveThrough: value(form, 'effectiveThrough'), authorityBasis: value(form, 'authorityBasis'), localRuleReference: value(form, 'localRuleReference'), dataUseGrantReference: value(form, 'dataUseGrantReference'), reason: value(form, 'reason') })
}
export async function recordRepresentation(_state: State, form: FormData) {
  return submit('mutation Representation($data: RecordRepresentationAuthorityInput!) { recordRepresentationAuthorityCommand(data: $data) { ok message itemId replayed } }', 'recordRepresentationAuthorityCommand', { leadId: value(form, 'leadId'), propertyId: value(form, 'propertyId') || null, dealId: value(form, 'dealId') || null, practitionerId: value(form, 'practitionerId'), side: value(form, 'side'), relationshipType: value(form, 'relationshipType'), jurisdictionCode: value(form, 'jurisdictionCode'), status: value(form, 'status'), effectiveFrom: value(form, 'effectiveFrom'), effectiveThrough: value(form, 'effectiveThrough'), scopeSummary: value(form, 'scopeSummary'), documentSha256: value(form, 'documentSha256'), disclosureVersion: value(form, 'disclosureVersion'), consentRecordedAt: value(form, 'consentRecordedAt'), reason: value(form, 'reason') })
}
export async function appendDocumentEvidence(_state: State, form: FormData) {
  return submit('mutation Evidence($data: AppendDocumentEvidenceEventInput!) { appendDocumentEvidenceEventCommand(data: $data) { ok message itemId replayed } }', 'appendDocumentEvidenceEventCommand', { documentId: value(form, 'documentId'), offerId: value(form, 'offerId') || null, eventType: value(form, 'eventType'), documentSha256: value(form, 'documentSha256'), templateSha256: value(form, 'templateSha256'), certificateSha256: value(form, 'certificateSha256') || null, recipients: parseJsonField(form, 'recipients', []), channel: value(form, 'channel'), provider: value(form, 'provider'), providerReference: value(form, 'providerReference'), occurredAt: value(form, 'occurredAt'), providerReportedAt: value(form, 'providerReportedAt') || null, acknowledgedAt: value(form, 'acknowledgedAt') || null, acknowledgementReference: value(form, 'acknowledgementReference') || null, reason: value(form, 'reason') })
}
export async function proposeCommissionAllocation(_state: State, form: FormData) {
  return submit('mutation Allocation($data: ProposeCommissionAllocationInput!) { proposeCommissionAllocationCommand(data: $data) { ok message itemId replayed } }', 'proposeCommissionAllocationCommand', { commissionId: value(form, 'commissionId'), currencyCode: value(form, 'currencyCode'), lines: parseJsonField(form, 'lines', []), reason: value(form, 'reason') })
}
export async function approveCommissionAllocation(_state: State, form: FormData) {
  return submit('mutation ApproveAllocation($data: ApproveCommissionAllocationInput!) { approveCommissionAllocationCommand(data: $data) { ok message itemId replayed } }', 'approveCommissionAllocationCommand', { commissionId: value(form, 'commissionId'), batchKey: value(form, 'batchKey'), reason: value(form, 'reason') })
}
export async function recordCommissionReceipt(_state: State, form: FormData) {
  return submit('mutation Receipt($data: RecordCommissionReceiptInput!) { recordCommissionReceiptCommand(data: $data) { ok message itemId replayed } }', 'recordCommissionReceiptCommand', { commissionId: value(form, 'commissionId'), batchKey: value(form, 'batchKey'), amountCents: value(form, 'amountCents'), currencyCode: value(form, 'currencyCode'), externalReference: value(form, 'externalReference'), sourceDocumentSha256: value(form, 'sourceDocumentSha256'), reason: value(form, 'reason') })
}
export async function reverseCommissionEntry(_state: State, form: FormData) {
  return submit('mutation ReverseEntry($data: ReverseCommissionLedgerEntryInput!) { reverseCommissionLedgerEntryCommand(data: $data) { ok message itemId replayed } }', 'reverseCommissionLedgerEntryCommand', { entryId: value(form, 'entryId'), reason: value(form, 'reason') })
}
export async function reconcileCommissionLedger(_state: State, form: FormData) {
  return submit('mutation Reconcile($data: ReconcileCommissionLedgerInput!) { reconcileCommissionLedgerCommand(data: $data) { ok message itemId replayed } }', 'reconcileCommissionLedgerCommand', { commissionId: value(form, 'commissionId'), batchKey: value(form, 'batchKey'), externalReference: value(form, 'externalReference'), reason: value(form, 'reason') })
}
export async function recordRetentionPolicy(_state: State, form: FormData) {
  return submit('mutation RetentionPolicy($data: RecordRetentionPolicyInput!) { recordRetentionPolicyCommand(data: $data) { ok message itemId replayed } }', 'recordRetentionPolicyCommand', { retentionClass: value(form, 'retentionClass'), jurisdictionCode: value(form, 'jurisdictionCode'), triggerType: value(form, 'triggerType'), retentionDays: Number(value(form, 'retentionDays')), disposition: value(form, 'disposition'), legalBasis: value(form, 'legalBasis'), effectiveFrom: value(form, 'effectiveFrom'), effectiveThrough: value(form, 'effectiveThrough') || null, reason: value(form, 'reason') })
}
export async function assignFileRetention(_state: State, form: FormData) {
  return submit('mutation AssignRetention($data: AssignTransactionFileRetentionInput!) { assignTransactionFileRetentionCommand(data: $data) { ok message itemId replayed } }', 'assignTransactionFileRetentionCommand', { dealId: value(form, 'dealId'), documentId: value(form, 'documentId'), policyId: value(form, 'policyId'), documentSha256: value(form, 'documentSha256'), triggerAt: value(form, 'triggerAt'), reason: value(form, 'reason') })
}
export async function recordLegalHold(_state: State, form: FormData) {
  return submit('mutation LegalHold($data: RecordTransactionLegalHoldInput!) { recordTransactionLegalHoldCommand(data: $data) { ok message itemId replayed } }', 'recordTransactionLegalHoldCommand', { dealId: value(form, 'dealId'), documentId: value(form, 'documentId') || null, holdKey: value(form, 'holdKey'), action: value(form, 'action'), reason: value(form, 'reason') })
}
export async function createExportManifest(_state: State, form: FormData) {
  return submit('mutation Manifest($data: CreateTransactionExportManifestInput!) { createTransactionExportManifestCommand(data: $data) { ok message itemId replayed } }', 'createTransactionExportManifestCommand', { dealId: value(form, 'dealId'), manifestKey: value(form, 'manifestKey'), manifestSha256: value(form, 'manifestSha256'), items: parseJsonField(form, 'items', []), reason: value(form, 'reason') })
}
