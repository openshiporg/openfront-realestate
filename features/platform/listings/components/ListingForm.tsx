'use client'

import type { ReactNode } from 'react'
import { Choice, Field, RecordForm, TextArea, Toggle, toLocalInput } from '../../components/RecordForm'
import { createListing, updateListing } from '../actions/listingRecords'
import type { AgentOption, ListingDetail } from '../lib/listingDetail'

const listingTypes: Array<[string, string]> = [['sale', 'For sale'], ['rent', 'For rent']]
const propertyTypes: Array<[string, string]> = [['house', 'House'], ['condo', 'Condo'], ['townhome', 'Townhome'], ['multi_family', 'Multi-family'], ['land', 'Land'], ['commercial', 'Commercial']]

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset className="grid gap-3 sm:col-span-2 sm:grid-cols-2"><legend className="mb-1 text-sm font-semibold text-foreground">{title}</legend>{children}</fieldset>
}

/** Create (no listing) or edit a listing. Agent assignment shows only when the viewer can manage people. */
export function ListingForm({ listing, agents, canAssign, onDone }: { listing?: ListingDetail; agents: AgentOption[]; canAssign: boolean; onDone?: () => void }) {
  return (
    <RecordForm
      action={listing ? updateListing : createListing}
      submitLabel={listing ? 'Save listing' : 'Create listing'}
      onDone={onDone}
      redirectTo={listing ? undefined : id => `/dashboard/platform/listings/${id}`}
      className="gap-5"
    >
      {listing ? <input type="hidden" name="id" value={listing.id} /> : null}
      {listing ? <input type="hidden" name="currentAgentId" value={listing.assignedAgent?.id || ''} /> : null}
      <Group title="Listing">
        <Field name="title" label="Title" required wide defaultValue={listing?.title} />
        <Choice name="listingType" label="Sale or rent" options={listingTypes} defaultValue={listing?.listingType || 'sale'} />
        <Choice name="propertyType" label="Home type" options={propertyTypes} defaultValue={listing?.propertyType || 'house'} />
        <Field name="price" label="Price (monthly for rentals)" required inputMode="decimal" defaultValue={listing?.price} />
        <Field name="hoaFee" label="HOA per month" inputMode="decimal" defaultValue={listing?.hoaFee} />
        {canAssign ? <Choice name="assignedAgentId" label="Listing agent" options={agents.map(agent => [agent.id, agent.name])} defaultValue={listing?.assignedAgent?.id || ''} emptyLabel="Unassigned" wide /> : null}
      </Group>
      <Group title="Address">
        <Field name="addressLine1" label="Street" required wide defaultValue={listing?.addressLine1} />
        <Field name="addressLine2" label="Unit" defaultValue={listing?.addressLine2} />
        <Field name="neighborhood" label="Neighborhood" defaultValue={listing?.neighborhood} />
        <Field name="city" label="City" required defaultValue={listing?.city} />
        <div className="grid grid-cols-2 gap-3">
          <Field name="state" label="State" required placeholder="TX" defaultValue={listing?.state} />
          <Field name="postalCode" label="ZIP" inputMode="numeric" defaultValue={listing?.postalCode} />
        </div>
      </Group>
      <Group title="Facts">
        <Field name="bedrooms" label="Beds" type="number" min={0} defaultValue={listing?.bedrooms} />
        <Field name="bathrooms" label="Baths" inputMode="decimal" defaultValue={listing?.bathrooms ? Number(listing.bathrooms) : ''} />
        <Field name="squareFeet" label="Sq ft" type="number" min={0} defaultValue={listing?.squareFeet} />
        <Field name="lotSizeSquareFeet" label="Lot sq ft" type="number" min={0} defaultValue={listing?.lotSizeSquareFeet} />
        <Field name="yearBuilt" label="Year built" type="number" min={1700} max={2100} defaultValue={listing?.yearBuilt} />
        <Field name="availableAt" label="Available" type="datetime-local" defaultValue={toLocalInput(listing?.availableAt)} />
      </Group>
      <Group title="Rental terms">
        <Field name="leaseTerm" label="Lease term" placeholder="12 months" defaultValue={listing?.leaseTerm} />
        <Field name="securityDeposit" label="Security deposit ($)" type="number" min={0} defaultValue={listing?.securityDeposit} />
        <Field name="petPolicy" label="Pets" wide defaultValue={listing?.petPolicy} />
      </Group>
      <Group title="Storefront">
        <Field name="shortDescription" label="Summary" wide defaultValue={listing?.shortDescription} />
        <TextArea name="description" label="Description" rows={5} defaultValue={listing?.description} />
        <Field name="primaryImageUrl" label="Main photo path" placeholder="/images/real-estate/photos/…" wide defaultValue={listing?.primaryImageUrl} />
        <Field name="virtualTourUrl" label="Virtual tour URL" type="url" wide defaultValue={listing?.virtualTourUrl} />
        <Toggle name="isFeatured" label="Feature on the home page" defaultChecked={listing?.isFeatured} />
      </Group>
    </RecordForm>
  )
}
