'use client'

import { ActionButton, Choice, Field, FormDrawer, RecordForm, Toggle } from '../../components/RecordForm'
import { deleteRoutingRule, saveRoutingRule, setRoutingRuleStatus } from '../actions/routing'
import type { RoutingOptions, RoutingRule } from '../lib/rules'

export const intentOptions: Array<[string, string]> = [['any', 'Any intent'], ['buy', 'Buying'], ['rent', 'Renting'], ['sell', 'Selling'], ['invest', 'Investing']]
export const sourceOptions: Array<[string, string]> = [['any', 'Any source'], ['website', 'Website'], ['zillow', 'Zillow'], ['referral', 'Referral'], ['open_house', 'Open house'], ['phone', 'Phone'], ['import', 'Import']]

export function RoutingRuleDrawer({ rule, options, nextPriority }: { rule?: RoutingRule; options: RoutingOptions; nextPriority?: number }) {
  return (
    <FormDrawer trigger={rule ? 'Edit' : 'New rule'} title={rule ? 'Edit rule' : 'New rule'} primary={!rule}>
      {close => (
        <RecordForm action={saveRoutingRule} submitLabel={rule ? 'Save rule' : 'Add rule'} onDone={close}>
          {rule ? <input type="hidden" name="id" value={rule.id} /> : null}
          <Field name="name" label="Name" required wide defaultValue={rule?.name} />
          <Field name="priority" label="Priority (lower runs first)" type="number" min={0} defaultValue={rule?.priority ?? nextPriority ?? 100} />
          <Toggle name="isFallback" label="Fallback when no rule matches" defaultChecked={rule?.isFallback} />
          <Choice name="intent" label="Intent" options={intentOptions} defaultValue={rule?.intent || 'any'} />
          <Choice name="source" label="Source" options={sourceOptions} defaultValue={rule?.source || 'any'} />
          <Field name="city" label="City" defaultValue={rule?.city} />
          <div className="grid grid-cols-2 gap-3">
            <Field name="state" label="State" placeholder="TX" defaultValue={rule?.state} />
            <Field name="postalCode" label="ZIP" defaultValue={rule?.postalCode} />
          </div>
          <Choice name="assignedAgentId" label="Agent" options={options.agents.map(a => [a.id, a.name])} defaultValue={rule?.assignedAgent?.id} emptyLabel="No agent" />
          <Choice name="assignedTeamId" label="Team" options={options.teams.map(t => [t.id, t.name])} defaultValue={rule?.assignedTeam?.id} emptyLabel="No team" />
        </RecordForm>
      )}
    </FormDrawer>
  )
}

export function RoutingRuleActions({ rule }: { rule: RoutingRule }) {
  return <>
    <ActionButton action={setRoutingRuleStatus} fields={{ id: rule.id, status: rule.status === 'active' ? 'paused' : 'active' }} label={rule.status === 'active' ? 'Pause' : 'Activate'} />
    <ActionButton action={deleteRoutingRule} fields={{ id: rule.id }} label="Delete" confirm={`Delete "${rule.name}"?`} />
  </>
}
