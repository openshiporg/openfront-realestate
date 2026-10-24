'use client'

import { Choice, Field, FormDrawer, RecordForm, TextArea } from '../../components/RecordForm'
import { createManualLead } from '../actions/leadRecords'

type Option = { id: string; name?: string; title?: string }

export function NewLeadDrawer({ properties, agents }: { properties: Option[]; agents: Option[] }) {
  return (
    <FormDrawer trigger="New lead" title="New lead" primary>
      {close => (
        <RecordForm action={createManualLead} submitLabel="Add lead" onDone={close} redirectTo={id => `/dashboard/platform/leads/${id}`}>
          <Field name="name" label="Name" required wide />
          <Field name="email" label="Email" type="email" />
          <Field name="phone" label="Phone" type="tel" />
          <Choice name="intent" label="Intent" options={[['buy', 'Buying'], ['rent', 'Renting'], ['sell', 'Selling'], ['invest', 'Investing'], ['unknown', 'Unknown']]} defaultValue="buy" />
          <Choice name="source" label="Source" options={[['phone', 'Phone'], ['referral', 'Referral'], ['open_house', 'Open house'], ['zillow', 'Zillow'], ['import', 'Import']]} defaultValue="phone" />
          <Field name="budgetMin" label="Budget from" inputMode="decimal" />
          <Field name="budgetMax" label="Budget to" inputMode="decimal" />
          <Field name="preferredLocation" label="Area" />
          <Field name="timeline" label="Timeline" placeholder="3–6 months" />
          <Choice name="propertyId" label="Listing" options={properties.map(p => [p.id, p.title || ''])} emptyLabel="None" wide />
          <Choice name="assignedAgentId" label="Agent" options={agents.map(a => [a.id, a.name || ''])} emptyLabel="Unassigned" wide />
          <TextArea name="message" label="Notes" />
        </RecordForm>
      )}
    </FormDrawer>
  )
}
