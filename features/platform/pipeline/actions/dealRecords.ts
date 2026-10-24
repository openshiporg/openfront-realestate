'use server'

import { connect, getActiveBrokerageId, isoOrNull, money, runRecordMutation, text, type RecordResult } from '../../lib/records'

const PIPELINE = '/dashboard/platform/pipeline'
const dealPath = (id: string) => `${PIPELINE}/${id}`

export async function createDeal(_state: RecordResult, form: FormData): Promise<RecordResult> {
  const title = text(form, 'title')
  if (!title) return { ok: false, message: 'Enter a deal title.' }
  const brokerageId = await getActiveBrokerageId()
  if (!brokerageId) return { ok: false, message: 'Select a brokerage before adding deals.' }
  const propertyId = text(form, 'propertyId'), leadId = text(form, 'leadId'), agentId = text(form, 'assignedAgentId')
  return runRecordMutation('mutation CreateDeal($data: DealCreateInput!) { createDeal(data: $data) { id } }', {
    data: {
      title, transactionType: text(form, 'transactionType') || 'buyer', nextStep: text(form, 'nextStep'),
      expectedCloseDate: isoOrNull(form, 'expectedCloseDate'),
      brokerage: { connect: { id: brokerageId } },
      ...(propertyId ? { property: connect(propertyId) } : {}), ...(leadId ? { lead: connect(leadId) } : {}), ...(agentId ? { assignedAgent: connect(agentId) } : {}),
    },
  }, 'createDeal', 'Deal created.', [PIPELINE])
}

/** Deal children (inspection, escrow, title, financing, commission) carry the deal and its property. */
function parents(form: FormData) {
  const dealId = text(form, 'dealId'), propertyId = text(form, 'propertyId')
  return dealId && propertyId ? { dealId, propertyId, data: { deal: connect(dealId), property: connect(propertyId) } } : null
}

export async function addInspection(_state: RecordResult, form: FormData): Promise<RecordResult> {
  const p = parents(form)
  if (!p) return { ok: false, message: 'Link a listing to this deal first.' }
  return runRecordMutation('mutation AddInspection($data: PropertyInspectionCreateInput!) { createPropertyInspection(data: $data) { id } }', {
    data: { ...p.data, title: text(form, 'title') || 'Inspection', inspectionType: text(form, 'inspectionType') || 'general', scheduledAt: isoOrNull(form, 'scheduledAt'), inspectorName: text(form, 'inspectorName'), inspectorEmail: text(form, 'inspectorEmail'), estimatedCost: money(form, 'estimatedCost') },
  }, 'createPropertyInspection', 'Inspection scheduled.', [dealPath(p.dealId)])
}

export async function addEscrow(_state: RecordResult, form: FormData): Promise<RecordResult> {
  const p = parents(form)
  if (!p) return { ok: false, message: 'Link a listing to this deal first.' }
  return runRecordMutation('mutation AddEscrow($data: EscrowCreateInput!) { createEscrow(data: $data) { id } }', {
    data: { ...p.data, escrowNumber: text(form, 'escrowNumber'), escrowCompany: text(form, 'escrowCompany'), officerName: text(form, 'officerName'), officerEmail: text(form, 'officerEmail'), openedAt: new Date().toISOString(), scheduledCloseAt: isoOrNull(form, 'scheduledCloseAt'), depositAmount: money(form, 'depositAmount') },
  }, 'createEscrow', 'Escrow opened.', [dealPath(p.dealId)])
}

export async function addTitleOrder(_state: RecordResult, form: FormData): Promise<RecordResult> {
  const p = parents(form)
  if (!p) return { ok: false, message: 'Link a listing to this deal first.' }
  return runRecordMutation('mutation AddTitleOrder($data: TitleOrderCreateInput!) { createTitleOrder(data: $data) { id } }', {
    data: { ...p.data, orderNumber: text(form, 'orderNumber'), titleCompany: text(form, 'titleCompany'), orderedAt: new Date().toISOString() },
  }, 'createTitleOrder', 'Title ordered.', [dealPath(p.dealId)])
}

export async function addMortgage(_state: RecordResult, form: FormData): Promise<RecordResult> {
  const dealId = text(form, 'dealId'), leadId = text(form, 'leadId')
  if (!dealId) return { ok: false, message: 'Deal not found.' }
  return runRecordMutation('mutation AddMortgage($data: MortgageApplicationCreateInput!) { createMortgageApplication(data: $data) { id } }', {
    data: { deal: connect(dealId), ...(leadId ? { lead: connect(leadId) } : {}), applicationNumber: text(form, 'applicationNumber'), lenderName: text(form, 'lenderName'), loanAmount: money(form, 'loanAmount'), interestRate: text(form, 'interestRate') || null, submittedAt: new Date().toISOString() },
  }, 'createMortgageApplication', 'Financing added.', [dealPath(dealId)])
}

export async function addCommission(_state: RecordResult, form: FormData): Promise<RecordResult> {
  const p = parents(form)
  if (!p) return { ok: false, message: 'Link a listing to this deal first.' }
  const gross = money(form, 'grossCommission')
  if (!gross) return { ok: false, message: 'Enter the gross commission.' }
  const agentId = text(form, 'agentId')
  return runRecordMutation('mutation AddCommission($data: CommissionCreateInput!) { createCommission(data: $data) { id } }', {
    data: { ...p.data, title: text(form, 'title') || 'Commission', side: text(form, 'side') || 'buyer', grossCommission: gross, brokerageSplitPercent: text(form, 'brokerageSplitPercent') || null, agentSplitPercent: text(form, 'agentSplitPercent') || null, ...(agentId ? { agent: connect(agentId) } : {}) },
  }, 'createCommission', 'Commission projected.', [dealPath(p.dealId)])
}

export async function addDealDocument(_state: RecordResult, form: FormData): Promise<RecordResult> {
  const dealId = text(form, 'dealId'), propertyId = text(form, 'propertyId'), title = text(form, 'title')
  if (!dealId || !title) return { ok: false, message: 'Enter a document title.' }
  const brokerageId = await getActiveBrokerageId()
  if (!brokerageId) return { ok: false, message: 'Select a brokerage first.' }
  return runRecordMutation('mutation AddDocument($data: DealDocumentCreateInput!) { createDealDocument(data: $data) { id } }', {
    data: { brokerage: { connect: { id: brokerageId } }, deal: connect(dealId), ...(propertyId ? { property: connect(propertyId) } : {}), title, documentType: text(form, 'documentType') || 'other', fileUrl: text(form, 'fileUrl'), requiresSignature: form.get('requiresSignature') === 'true', expiresAt: isoOrNull(form, 'expiresAt') },
  }, 'createDealDocument', 'Document added.', [dealPath(dealId)])
}

const statusLists: Record<string, { mutation: string; field: string; allowed: string[] }> = {
  escrow: { mutation: 'mutation($id: ID!, $status: EscrowStatusType) { updateEscrow(where: { id: $id }, data: { status: $status }) { id } }', field: 'updateEscrow', allowed: ['opened', 'pending', 'closed', 'cancelled'] },
  title: { mutation: 'mutation($id: ID!, $status: TitleOrderStatusType) { updateTitleOrder(where: { id: $id }, data: { status: $status }) { id } }', field: 'updateTitleOrder', allowed: ['ordered', 'in_review', 'clear', 'exception'] },
  mortgage: { mutation: 'mutation($id: ID!, $status: MortgageApplicationStatusType) { updateMortgageApplication(where: { id: $id }, data: { status: $status }) { id } }', field: 'updateMortgageApplication', allowed: ['started', 'preapproved', 'underwriting', 'approved', 'denied'] },
}

export async function setClosingRecordStatus(_state: RecordResult, form: FormData): Promise<RecordResult> {
  const kind = statusLists[text(form, 'kind')], id = text(form, 'recordId'), status = text(form, 'status'), dealId = text(form, 'dealId')
  if (!kind || !id || !kind.allowed.includes(status)) return { ok: false, message: 'Choose a valid status.' }
  return runRecordMutation(kind.mutation, { id, status }, kind.field, 'Status updated.', [dealPath(dealId)])
}
