'use client'

import { Choice, Field, FormDrawer, RecordForm } from '../../components/RecordForm'
import { updateLeadDetails } from '../actions/leadRecords'
import { leadIntentLabels, leadSourceLabels } from '../lib/labels'

type Agent = { id: string; name: string }
type EditableLead = { id: string; name: string; email?: string | null; phone?: string | null; intent?: string | null; source?: string | null; assignedAgent?: { id: string } | null }

export function EditLeadDrawer({ lead, agents, canAssign }: { lead: EditableLead; agents: Agent[]; canAssign: boolean }) {
  return (
    <FormDrawer trigger="Edit" title="Edit lead">
      {close => (
        <RecordForm action={updateLeadDetails} submitLabel="Save lead" onDone={close}>
          <input type="hidden" name="id" value={lead.id} />
          <Field name="name" label="Name" required defaultValue={lead.name} wide />
          <Field name="email" label="Email" type="email" defaultValue={lead.email} />
          <Field name="phone" label="Phone" type="tel" defaultValue={lead.phone} />
          <Choice name="intent" label="Looking to" options={Object.entries(leadIntentLabels)} defaultValue={lead.intent || 'unknown'} />
          <Choice name="source" label="Came from" options={Object.entries(leadSourceLabels)} defaultValue={lead.source || 'website'} />
          {canAssign ? (
            <>
              <input type="hidden" name="currentAgentId" value={lead.assignedAgent?.id || ''} />
              <Choice name="assignedAgentId" label="Agent" options={agents.map(agent => [agent.id, agent.name])} defaultValue={lead.assignedAgent?.id || ''} emptyLabel="Unassigned" wide />
            </>
          ) : null}
        </RecordForm>
      )}
    </FormDrawer>
  )
}
