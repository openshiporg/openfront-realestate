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
