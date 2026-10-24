'use server'

import { getActiveBrokerageId, optionalInt, runRecordMutation, text, type RecordResult } from '../../lib/records'

const ROUTING = '/dashboard/platform/routing'

function ruleData(form: FormData) {
  const agentId = text(form, 'assignedAgentId'), teamId = text(form, 'assignedTeamId')
  return {
    name: text(form, 'name'),
    priority: optionalInt(form, 'priority') ?? 100,
    intent: text(form, 'intent') || 'any',
    source: text(form, 'source') || 'any',
    city: text(form, 'city'),
    state: text(form, 'state').toUpperCase(),
    postalCode: text(form, 'postalCode'),
    isFallback: form.get('isFallback') === 'true',
    agentId, teamId,
  }
}

export async function saveRoutingRule(_state: RecordResult, form: FormData): Promise<RecordResult> {
  const { agentId, teamId, ...data } = ruleData(form)
  if (!data.name) return { ok: false, message: 'Name the rule.' }
  if (!agentId && !teamId) return { ok: false, message: 'Choose an agent or a team.' }
  const id = text(form, 'id')
  const assignment = id
    ? { assignedAgent: agentId ? { connect: { id: agentId } } : { disconnect: true }, assignedTeam: teamId ? { connect: { id: teamId } } : { disconnect: true } }
    : { ...(agentId ? { assignedAgent: { connect: { id: agentId } } } : {}), ...(teamId ? { assignedTeam: { connect: { id: teamId } } } : {}) }
  if (id) {
    return runRecordMutation('mutation UpdateRule($id: ID!, $data: LeadRoutingRuleUpdateInput!) { updateLeadRoutingRule(where: { id: $id }, data: $data) { id } }', { id, data: { ...data, ...assignment } }, 'updateLeadRoutingRule', 'Rule saved.', [ROUTING])
  }
  const brokerageId = await getActiveBrokerageId()
  if (!brokerageId) return { ok: false, message: 'Select a brokerage first.' }
  return runRecordMutation('mutation CreateRule($data: LeadRoutingRuleCreateInput!) { createLeadRoutingRule(data: $data) { id } }', { data: { ...data, status: 'active', ...assignment, brokerage: { connect: { id: brokerageId } } } }, 'createLeadRoutingRule', 'Rule added.', [ROUTING])
}

export async function setRoutingRuleStatus(_state: RecordResult, form: FormData): Promise<RecordResult> {
  const id = text(form, 'id'), status = text(form, 'status')
  if (!id || !['active', 'paused'].includes(status)) return { ok: false, message: 'Rule not found.' }
  return runRecordMutation('mutation RuleStatus($id: ID!, $status: LeadRoutingRuleStatusType) { updateLeadRoutingRule(where: { id: $id }, data: { status: $status }) { id } }', { id, status }, 'updateLeadRoutingRule', status === 'active' ? 'Rule activated.' : 'Rule paused.', [ROUTING])
}

export async function deleteRoutingRule(_state: RecordResult, form: FormData): Promise<RecordResult> {
  const id = text(form, 'id')
  if (!id) return { ok: false, message: 'Rule not found.' }
  return runRecordMutation('mutation DeleteRule($id: ID!) { deleteLeadRoutingRule(where: { id: $id }) { id } }', { id }, 'deleteLeadRoutingRule', 'Rule deleted.', [ROUTING])
}
