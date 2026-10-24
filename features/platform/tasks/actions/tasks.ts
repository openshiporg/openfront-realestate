'use server'

import { connect, getActiveBrokerageId, isoOrNull, runRecordMutation, text, type RecordResult } from '../../lib/records'

const TASKS = '/dashboard/platform/tasks'
const PRIORITIES = ['low', 'normal', 'high', 'urgent']

export async function saveTask(_state: RecordResult, form: FormData): Promise<RecordResult> {
  const title = text(form, 'title'), id = text(form, 'id')
  if (!title) return { ok: false, message: 'Enter a task.' }
  const priority = PRIORITIES.includes(text(form, 'priority')) ? text(form, 'priority') : 'normal'
  const links = (['assignedAgent', 'lead', 'deal', 'property'] as const).reduce<Record<string, unknown>>((data, field) => {
    const value = text(form, `${field}Id`)
    if (value) data[field] = connect(value)
    else if (id && form.has(`${field}Id`)) data[field] = { disconnect: true }
    return data
  }, {})
  const data = { title, priority, dueAt: isoOrNull(form, 'dueAt'), notes: text(form, 'notes'), ...links }
  if (id) return runRecordMutation('mutation UpdateTask($id: ID!, $data: AgentTaskUpdateInput!) { updateAgentTask(where: { id: $id }, data: $data) { id } }', { id, data }, 'updateAgentTask', 'Task saved.', [TASKS])
  const brokerageId = await getActiveBrokerageId()
  if (!brokerageId) return { ok: false, message: 'Select a brokerage first.' }
  return runRecordMutation('mutation CreateTask($data: AgentTaskCreateInput!) { createAgentTask(data: $data) { id } }', { data: { ...data, brokerage: { connect: { id: brokerageId } } } }, 'createAgentTask', 'Task added.', [TASKS])
}
