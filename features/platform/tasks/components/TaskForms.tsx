'use client'

import { Choice, Field, FormDrawer, RecordForm, TextArea, toLocalInput } from '../../components/RecordForm'
import { priorityOptions } from '../lib/options'
import { saveTask } from '../actions/tasks'
import type { AgentTaskRow, TaskOptions } from '../lib/tasks'


export function TaskDrawer({ task, options }: { task?: AgentTaskRow; options: TaskOptions }) {
  return (
    <FormDrawer trigger={task ? 'Edit' : 'New task'} title={task ? 'Edit task' : 'New task'} primary={!task}>
      {close => (
        <RecordForm action={saveTask} submitLabel={task ? 'Save task' : 'Add task'} onDone={close}>
          {task ? <input type="hidden" name="id" value={task.id} /> : null}
          <Field name="title" label="Task" required wide defaultValue={task?.title} />
          <Choice name="priority" label="Priority" options={priorityOptions} defaultValue={task?.priority || 'normal'} />
          <Field name="dueAt" label="Due" type="datetime-local" defaultValue={toLocalInput(task?.dueAt)} />
          <Choice name="assignedAgentId" label="Agent" options={options.agents.map(a => [a.id, a.name])} defaultValue={task?.assignedAgent?.id} emptyLabel="Unassigned" wide />
          <Choice name="leadId" label="Lead" options={options.leads.map(l => [l.id, l.name])} defaultValue={task?.lead?.id} emptyLabel="None" />
          <Choice name="dealId" label="Deal" options={options.deals.map(d => [d.id, d.title])} defaultValue={task?.deal?.id} emptyLabel="None" />
          <Choice name="propertyId" label="Listing" options={options.properties.map(p => [p.id, p.title])} defaultValue={task?.property?.id} emptyLabel="None" wide />
          <TextArea name="notes" label="Notes" defaultValue={task?.notes} />
        </RecordForm>
      )}
    </FormDrawer>
  )
}
