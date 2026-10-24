'use client'

import { ActionButton, Choice, Field, FormDrawer, RecordForm, TextArea } from '../../components/RecordForm'
import { transitionOpenHouse } from '../../operations/actions/operations'
import { addListingMedia, deleteListingMedia, scheduleOpenHouse, updateListingMedia } from '../actions/listingRecords'
import type { AgentOption, ListingDetail } from '../lib/listingDetail'
import { ListingForm } from './ListingForm'

export function EditListingDrawer({ listing, agents, canAssign }: { listing: ListingDetail; agents: AgentOption[]; canAssign: boolean }) {
  return <FormDrawer trigger="Edit" title="Edit listing">{close => <ListingForm listing={listing} agents={agents} canAssign={canAssign} onDone={close} />}</FormDrawer>
}

const mediaTypes: Array<[string, string]> = [['photo', 'Photo'], ['floor_plan', 'Floor plan'], ['virtual_tour', 'Virtual tour'], ['video', 'Video'], ['document', 'Document']]

export function AddMediaDrawer({ propertyId, nextSort }: { propertyId: string; nextSort: number }) {
  return (
    <FormDrawer trigger="Add media" title="Add media">
      {close => (
        <RecordForm action={addListingMedia} submitLabel="Add media" onDone={close}>
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="sortOrder" value={nextSort} />
          <Field name="url" label="URL" required wide placeholder="https://… or /images/…" />
          <Field name="title" label="Title" required />
          <Choice name="mediaType" label="Type" options={mediaTypes} defaultValue="photo" />
          <Field name="altText" label="Alt text" wide />
          <TextArea name="caption" label="Caption" rows={2} />
        </RecordForm>
      )}
    </FormDrawer>
  )
}

export function MediaActions({ mediaId, propertyId, sortOrder, isHero }: { mediaId: string; propertyId: string; sortOrder: number; isHero: boolean }) {
  const base = { mediaId, propertyId, sortOrder: String(sortOrder) }
  return <>
    <ActionButton action={updateListingMedia} fields={{ ...base, change: isHero ? 'unhero' : 'hero' }} label={isHero ? 'Unset cover' : 'Set cover'} />
    <ActionButton action={updateListingMedia} fields={{ ...base, change: 'up' }} label="Earlier" />
    <ActionButton action={updateListingMedia} fields={{ ...base, change: 'down' }} label="Later" />
    <ActionButton action={deleteListingMedia} fields={base} label="Remove" confirm="Remove this media?" />
  </>
}

export function ScheduleOpenHouseDrawer({ propertyId, agents }: { propertyId: string; agents: AgentOption[] }) {
  return (
    <FormDrawer trigger="Schedule open house" title="Schedule open house">
      {close => (
        <RecordForm action={scheduleOpenHouse} submitLabel="Schedule" onDone={close}>
          <input type="hidden" name="propertyId" value={propertyId} />
          <Field name="title" label="Title" defaultValue="Open house" wide />
          <Field name="startsAt" label="Starts" type="datetime-local" required />
          <Field name="endsAt" label="Ends" type="datetime-local" required />
          <Choice name="hostAgentId" label="Host" options={agents.map(agent => [agent.id, agent.name])} emptyLabel="No host" wide />
          <TextArea name="notes" label="Notes" rows={2} />
        </RecordForm>
      )}
    </FormDrawer>
  )
}

export function OpenHouseActions({ openHouseId }: { openHouseId: string }) {
  return <>
    <ActionButton action={transitionOpenHouse} fields={{ openHouseId, status: 'completed' }} label="Complete" />
    <ActionButton action={transitionOpenHouse} fields={{ openHouseId, status: 'cancelled' }} label="Cancel" confirm="Cancel this open house?" />
  </>
}
