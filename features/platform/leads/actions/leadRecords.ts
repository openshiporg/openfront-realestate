'use server'

import { connect, getActiveBrokerageId, money, runRecordMutation, text, type RecordResult } from '../../lib/records'

const INTENTS = ['buy', 'rent', 'sell', 'invest', 'unknown']
const SOURCES = ['phone', 'referral', 'open_house', 'zillow', 'website', 'import']

/** A lead taken by phone, referral or at an open house; storefront leads arrive through the public forms. */
export async function createManualLead(_state: RecordResult, form: FormData): Promise<RecordResult> {
  const name = text(form, 'name'), email = text(form, 'email').toLowerCase(), phone = text(form, 'phone')
  if (!name) return { ok: false, message: 'Enter the contact name.' }
  if (!email && !phone) return { ok: false, message: 'Add an email or phone number.' }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: 'Enter a valid email.' }
  const brokerageId = await getActiveBrokerageId()
  if (!brokerageId) return { ok: false, message: 'Select a brokerage first.' }
  const propertyId = text(form, 'propertyId'), agentId = text(form, 'assignedAgentId')
  return runRecordMutation('mutation CreateLead($data: LeadCreateInput!) { createLead(data: $data) { id } }', {
    data: {
      name, email, phone,
      intent: INTENTS.includes(text(form, 'intent')) ? text(form, 'intent') : 'unknown',
      source: SOURCES.includes(text(form, 'source')) ? text(form, 'source') : 'phone',
      budgetMin: money(form, 'budgetMin'), budgetMax: money(form, 'budgetMax'),
      preferredLocation: text(form, 'preferredLocation'), timeline: text(form, 'timeline'), message: text(form, 'message'),
      brokerage: { connect: { id: brokerageId } },
      ...(propertyId ? { property: connect(propertyId) } : {}), ...(agentId ? { assignedAgent: connect(agentId) } : {}),
    },
  }, 'createLead', 'Lead added.', ['/dashboard/platform/leads'])
}

/** Corrects a lead's contact details and, for people managers, who works it. Status moves through its own buttons. */
export async function updateLeadDetails(_state: RecordResult, form: FormData): Promise<RecordResult> {
  const id = text(form, 'id'), name = text(form, 'name'), email = text(form, 'email').toLowerCase(), phone = text(form, 'phone')
  if (!id) return { ok: false, message: 'Lead not found.' }
  if (!name) return { ok: false, message: 'Enter the contact name.' }
  if (!email && !phone) return { ok: false, message: 'Keep an email or phone number.' }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: 'Enter a valid email.' }
  const agentId = text(form, 'assignedAgentId'), currentAgentId = text(form, 'currentAgentId')
  // assignedAgent is writable only by people managers; send it only when it actually changed.
  const agent = form.has('assignedAgentId') && agentId !== currentAgentId ? { assignedAgent: agentId ? connect(agentId) : { disconnect: true } } : {}
  return runRecordMutation('mutation UpdateLead($id: ID!, $data: LeadUpdateInput!) { updateLead(where: { id: $id }, data: $data) { id } }', {
    id,
    data: {
      name, email, phone,
      intent: INTENTS.includes(text(form, 'intent')) ? text(form, 'intent') : 'unknown',
      source: SOURCES.includes(text(form, 'source')) ? text(form, 'source') : 'website',
      ...agent,
    },
  }, 'updateLead', 'Lead saved.', ['/dashboard/platform/leads', `/dashboard/platform/leads/${id}`])
}
