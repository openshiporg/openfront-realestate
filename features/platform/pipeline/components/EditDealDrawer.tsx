'use client'

import { Choice, Field, FormDrawer, RecordForm, toLocalInput } from '../../components/RecordForm'
import { updateDealDetails } from '../actions/dealRecords'

type Agent = { id: string; name: string }
type EditableDeal = { id: string; title: string; transactionType?: string | null; expectedCloseDate?: string | null; assignedAgent?: { id: string } | null }
const dealTypes: Array<[string, string]> = [['buyer', 'Buyer'], ['seller', 'Seller'], ['tenant', 'Tenant'], ['landlord', 'Landlord']]

export function EditDealDrawer({ deal, agents, canAssign }: { deal: EditableDeal; agents: Agent[]; canAssign: boolean }) {
  return (
    <FormDrawer trigger="Edit" title="Edit deal">
      {close => (
        <RecordForm action={updateDealDetails} submitLabel="Save deal" onDone={close}>
          <input type="hidden" name="id" value={deal.id} />
          <Field name="title" label="Title" required defaultValue={deal.title} wide />
          <Choice name="transactionType" label="Representing" options={dealTypes} defaultValue={deal.transactionType || 'buyer'} />
          <Field name="expectedCloseDate" label="Expected close" type="datetime-local" defaultValue={toLocalInput(deal.expectedCloseDate)} />
          {canAssign ? (
            <>
              <input type="hidden" name="currentAgentId" value={deal.assignedAgent?.id || ''} />
              <Choice name="assignedAgentId" label="Agent" options={agents.map(agent => [agent.id, agent.name])} defaultValue={deal.assignedAgent?.id || ''} emptyLabel="Unassigned" wide />
            </>
          ) : null}
        </RecordForm>
      )}
    </FormDrawer>
  )
}
