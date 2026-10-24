'use server'

import { connect, getActiveBrokerageId, isoOrNull, money, optionalInt, runRecordMutation, text, type RecordResult } from '../../lib/records'

const LISTINGS = '/dashboard/platform/listings'

function slugify(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60)
}

/** Fields shared by create and edit; status is changed only through the status track. */
function listingData(form: FormData) {
  const price = money(form, 'price')
  return {
    title: text(form, 'title'),
    listingType: text(form, 'listingType') || 'sale',
    propertyType: text(form, 'propertyType') || 'house',
    shortDescription: text(form, 'shortDescription'),
    description: text(form, 'description'),
    addressLine1: text(form, 'addressLine1'),
    addressLine2: text(form, 'addressLine2'),
    city: text(form, 'city'),
    state: text(form, 'state').toUpperCase(),
    postalCode: text(form, 'postalCode'),
    neighborhood: text(form, 'neighborhood'),
    ...(price ? { price } : {}),
    bedrooms: optionalInt(form, 'bedrooms'),
    bathrooms: text(form, 'bathrooms') || null,
    squareFeet: optionalInt(form, 'squareFeet'),
    lotSizeSquareFeet: optionalInt(form, 'lotSizeSquareFeet'),
    yearBuilt: optionalInt(form, 'yearBuilt'),
    hoaFee: money(form, 'hoaFee'),
    availableAt: isoOrNull(form, 'availableAt'),
    isFeatured: form.get('isFeatured') === 'true',
    virtualTourUrl: text(form, 'virtualTourUrl'),
    leaseTerm: text(form, 'leaseTerm'),
    securityDeposit: optionalInt(form, 'securityDeposit'),
    petPolicy: text(form, 'petPolicy'),
    primaryImageUrl: text(form, 'primaryImageUrl'),
  }
}

function validate(data: ReturnType<typeof listingData>, form: FormData) {
  if (!data.title) return 'Enter a title.'
  if (!data.addressLine1 || !data.city || !/^[A-Z]{2}$/.test(data.state)) return 'Enter the street address, city and two-letter state.'
  if (!money(form, 'price')) return 'Enter a price.'
  if (data.bathrooms && !/^\d{1,3}(\.\d)?$/.test(data.bathrooms)) return 'Enter baths as a number, e.g. 2.5.'
  return ''
}

export async function createListing(_state: RecordResult, form: FormData): Promise<RecordResult> {
  const data = listingData(form)
  const problem = validate(data, form)
  if (problem) return { ok: false, message: problem }
  const brokerageId = await getActiveBrokerageId()
  if (!brokerageId) return { ok: false, message: 'Select a brokerage before adding listings.' }
  const agentId = text(form, 'assignedAgentId')
  const slug = `${slugify(data.title) || 'listing'}-${crypto.randomUUID().slice(0, 6)}`
  return runRecordMutation(
    'mutation CreateListing($data: PropertyCreateInput!) { createProperty(data: $data) { id } }',
    { data: { ...data, slug, brokerage: { connect: { id: brokerageId } }, ...(agentId ? { assignedAgent: connect(agentId) } : {}) } },
    'createProperty', 'Listing created as a draft.', [LISTINGS],
  )
}

export async function updateListing(_state: RecordResult, form: FormData): Promise<RecordResult> {
  const id = text(form, 'id')
  const data = listingData(form)
  const problem = validate(data, form)
  if (!id || problem) return { ok: false, message: problem || 'Listing not found.' }
  const agentId = text(form, 'assignedAgentId'), currentAgentId = text(form, 'currentAgentId')
  // assignedAgent is writable only by people managers; send it only when it actually changed.
  const agent = form.has('assignedAgentId') && agentId !== currentAgentId ? { assignedAgent: agentId ? connect(agentId) : { disconnect: true } } : {}
  return runRecordMutation(
    'mutation UpdateListing($id: ID!, $data: PropertyUpdateInput!) { updateProperty(where: { id: $id }, data: $data) { id } }',
    { id, data: { ...data, ...agent } }, 'updateProperty', 'Listing saved.', [LISTINGS, `${LISTINGS}/${id}`],
  )
}

export async function addListingMedia(_state: RecordResult, form: FormData): Promise<RecordResult> {
  const propertyId = text(form, 'propertyId'), url = text(form, 'url')
  if (!propertyId || !url) return { ok: false, message: 'Enter the media URL.' }
  if (!/^(https:\/\/|\/images\/)/.test(url)) return { ok: false, message: 'Use an https:// URL or a /images/ path.' }
  return runRecordMutation(
    'mutation AddMedia($data: PropertyMediaCreateInput!) { createPropertyMedia(data: $data) { id } }',
    { data: { property: connect(propertyId), title: text(form, 'title') || 'Photo', mediaType: text(form, 'mediaType') || 'photo', url, altText: text(form, 'altText'), caption: text(form, 'caption'), sortOrder: optionalInt(form, 'sortOrder') ?? 0 } },
    'createPropertyMedia', 'Media added.', [`${LISTINGS}/${propertyId}`],
  )
}

export async function updateListingMedia(_state: RecordResult, form: FormData): Promise<RecordResult> {
  const id = text(form, 'mediaId'), propertyId = text(form, 'propertyId'), change = text(form, 'change')
  if (!id) return { ok: false, message: 'Media not found.' }
  const sortOrder = optionalInt(form, 'sortOrder') ?? 0
  const data = change === 'hero' ? { isHero: true } : change === 'unhero' ? { isHero: false } : change === 'up' ? { sortOrder: sortOrder - 1 } : { sortOrder: sortOrder + 1 }
  return runRecordMutation('mutation UpdateMedia($id: ID!, $data: PropertyMediaUpdateInput!) { updatePropertyMedia(where: { id: $id }, data: $data) { id } }', { id, data }, 'updatePropertyMedia', 'Media updated.', [`${LISTINGS}/${propertyId}`])
}

export async function deleteListingMedia(_state: RecordResult, form: FormData): Promise<RecordResult> {
  const id = text(form, 'mediaId'), propertyId = text(form, 'propertyId')
  if (!id) return { ok: false, message: 'Media not found.' }
  return runRecordMutation('mutation DeleteMedia($id: ID!) { deletePropertyMedia(where: { id: $id }) { id } }', { id }, 'deletePropertyMedia', 'Media removed.', [`${LISTINGS}/${propertyId}`])
}

export async function scheduleOpenHouse(_state: RecordResult, form: FormData): Promise<RecordResult> {
  const propertyId = text(form, 'propertyId')
  const startsAt = isoOrNull(form, 'startsAt'), endsAt = isoOrNull(form, 'endsAt')
  if (!propertyId || !startsAt || !endsAt) return { ok: false, message: 'Enter a start and end time.' }
  if (Date.parse(endsAt) <= Date.parse(startsAt)) return { ok: false, message: 'The end must be after the start.' }
  if (Date.parse(startsAt) <= Date.now()) return { ok: false, message: 'Choose a future start time.' }
  const hostId = text(form, 'hostAgentId')
  return runRecordMutation(
    'mutation ScheduleOpenHouse($data: OpenHouseCreateInput!) { createOpenHouse(data: $data) { id } }',
    { data: { property: connect(propertyId), title: text(form, 'title') || 'Open house', startsAt, endsAt, notes: text(form, 'notes'), ...(hostId ? { hostAgent: connect(hostId) } : {}) } },
    'createOpenHouse', 'Open house scheduled.', [`${LISTINGS}/${propertyId}`, '/dashboard/platform/operations'],
  )
}
