'use server'

import { revalidatePath } from 'next/cache'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { explicitDateTimeToIso } from '@/features/lib/date-time'
import { readLeadDuplicateGroups, readLeadListProjection } from '../lib/leadWorkspaceProjection'
import { PRIVATE_LEAD_DETAIL_QUERY, isOperatorViewer, readLeadPageInfo, readPrivateLeadDetail, type LeadPageInfo, type OperatorViewer, type PrivateLeadDetail } from '../lib/leadDetail'
import { parsePendingShowing } from '../lib/pendingShowing'
import { submitDuplicateLeadResolution } from '../lib/duplicateLeadResolution'
import { submitLeadStatusTransition } from '../lib/leadStatusTransitionAction'
import { submitScheduleShowingFromLead, verifyOwnedShowingSchedule, type ScheduleShowingRequest } from '../lib/scheduleShowingFromLeadAction'

export type PlatformLeadActivity = {
  id: string
  activityType: string
  direction?: string | null
  channel?: string | null
  subject?: string | null
  body?: string | null
  occurredAt?: string | null
  createdAt?: string | null
  agent?: {
    id: string
    name: string
    email: string
  } | null
}

export type PlatformLead = {
  activityAccess?: 'available' | 'restricted'
  id: string
  name: string
  email?: string | null
  phone?: string | null
  status: string
  intent?: string | null
  source?: string | null
  timeline?: string | null
  message?: string | null
  lastContactedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  property?: {
    id: string
    title: string
    slug: string | null
    city: string | null
    state: string | null
    price: string | null
    listingType: string | null
  } | null
  assignedAgent?: {
    id: string
    name: string
    email: string
  } | null
  showingsCount?: number | null
  activities?: PlatformLeadActivity[]
  activitiesCount?: number
}

export type LeadStats = {
  total: number
  new: number
  hot: number
  tourScheduled: number
  offer: number
  attemptedContact: number | null
  closed: number | null
  lost: number | null
  stale: number
}

export type GetLeadsResult = {
  pageInfo: LeadPageInfo | null
  viewer: OperatorViewer | null
  leads: PlatformLead[]
  stats: LeadStats | null
  error: string | null
}

export type LeadDuplicateCandidate = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  status: string
  source?: string | null
  createdAt?: string | null
  assignedAgent?: { id: string; name: string; email: string } | null
  property?: { id: string; title: string; city: string | null; state: string | null } | null
}

export type LeadDuplicateGroup = {
  key: string
  reason: string
  candidates: LeadDuplicateCandidate[]
}

export type LeadQuickActionState = {
  ok: boolean
  message: string
  uncertain?: boolean
  attempt?: ScheduleShowingRequest
}

const CONTACT_WORKSPACE_QUERY = `
  query PlatformContacts($status: String, $q: String, $after: String, $before: String) {
    platformContacts(status: $status, q: $q, after: $after, before: $before) {
      viewer { actorId brokerageId }
      pageInfo { hasNextPage hasPreviousPage nextCursor previousCursor }
      items {
        id name email phone status intent source message lastContactedAt createdAt activityAccess
        property { id title slug city state price listingType }
        assignedAgent { id name email }
        showingsCount
        activities { id activityType direction channel subject body occurredAt agent { id name email } }
      }
      stats { total new qualified tourScheduled offer }
      duplicateGroups {
        key reason
        candidates { id name email phone status source createdAt assignedAgent { id name email } property { id title city state } }
      }
    }
  }
`

/** The workspace projection counts five statuses; the other tabs read the same access-scoped Lead list. */
const LEAD_STATUS_COUNTS_QUERY = `
  query PlatformLeadStatusCounts {
    attemptedContact: leadsCount(where: { status: { equals: attempted_contact } })
    closed: leadsCount(where: { status: { equals: closed } })
    lost: leadsCount(where: { status: { equals: lost } })
  }
`

async function leadStatusCounts(): Promise<{ attemptedContact: number; closed: number; lost: number } | null> {
  const response = await keystoneClient<{ attemptedContact?: unknown; closed?: unknown; lost?: unknown }>(LEAD_STATUS_COUNTS_QUERY, {}, { cache: 'no-store' })
  if (!response.success) return null
  const data = response.data as { attemptedContact?: unknown; closed?: unknown; lost?: unknown } | null
  const read = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null)
  const attemptedContact = read(data?.attemptedContact), closed = read(data?.closed), lost = read(data?.lost)
  return attemptedContact === null || closed === null || lost === null ? null : { attemptedContact, closed, lost }
}

async function contactWorkspace(status = 'all', q = '', after?: string, before?: string) {
  return keystoneClient<unknown>(CONTACT_WORKSPACE_QUERY, { status, q, after, before }, { cache: 'no-store' })
}

export async function getPlatformLeads(status?: string, q?: string, after?: string, before?: string): Promise<GetLeadsResult> {
  const [response, extraCounts] = await Promise.all([contactWorkspace(status, q, after, before), leadStatusCounts()])
  if (!response.success) return { leads: [], stats: null, pageInfo: null, viewer: null, error: 'Leads could not be loaded. Please try again.' }
  const projection = readLeadListProjection(response.data)
  const page = readLeadPageInfo(response.data)
  if (!projection || !page || projection.items.some(item => !['available', 'restricted'].includes(String(item.activityAccess)))) return { leads: [], stats: null, error: 'Leads could not be loaded. Please refresh and try again.', pageInfo: null, viewer: null }
  return {
    leads: projection.items, ...page,
    // Every tab carries a count or none does: without the extra counts the tabs show no numbers.
    stats: { total: projection.stats.total, new: projection.stats.new, hot: projection.stats.qualified, tourScheduled: projection.stats.tourScheduled, offer: projection.stats.offer, attemptedContact: extraCounts?.attemptedContact ?? null, closed: extraCounts?.closed ?? null, lost: extraCounts?.lost ?? null, stale: 0 },
    error: null,
  }
}

export async function getShowingRequestViewer(): Promise<OperatorViewer | null> {
  const response = await keystoneClient<{ platformShowingRequestViewer: unknown }>(`query ShowingRequestViewer { platformShowingRequestViewer { actorId brokerageId } }`, {}, { cache: 'no-store' })
  return response.success && isOperatorViewer(response.data.platformShowingRequestViewer) ? response.data.platformShowingRequestViewer : null
}

export async function getPlatformLeadDetail(id: string, before?: string): Promise<{ detail: PrivateLeadDetail | null; error: string | null }> {
  const response = await keystoneClient<unknown>(PRIVATE_LEAD_DETAIL_QUERY, { id, before }, { cache: 'no-store' })
  if (!response.success) return { detail: null, error: 'This lead could not be loaded. Please try again.' }
  const detail = readPrivateLeadDetail(response.data, id)
  return detail ? { detail, error: null } : { detail: null, error: 'Lead not found.' }
}

export async function submitRetainedShowing(encoded: string): Promise<LeadQuickActionState> {
  const pending = parsePendingShowing(encoded)
  if (!pending) return { ok: false, uncertain: true, message: 'The earlier showing request could not be read. Nothing new was sent.' }
  return submitScheduleShowingFromLead(pending.request, {
    request: (query, variables) => keystoneClient<unknown>(query, variables, { cache: 'no-store' }), revalidate: revalidatePath,
  }, true)
}
export async function verifyRetainedShowing(encoded: string): Promise<LeadQuickActionState> {
  const pending = parsePendingShowing(encoded)
  if (!pending) return { ok: false, uncertain: true, message: 'The earlier showing request could not be read. Nothing new was sent.' }
  return verifyOwnedShowingSchedule(pending.request, {
    request: (query, variables) => keystoneClient<unknown>(query, variables, { cache: 'no-store' }), revalidate: revalidatePath,
  })
}

export async function getLeadDuplicateGroups(): Promise<{ groups: LeadDuplicateGroup[]; error: string | null }> {
  const response = await contactWorkspace()
  if (!response.success) return { groups: [], error: response.error || 'Duplicates could not be loaded.' }
  const groups = readLeadDuplicateGroups(response.data)
  if (!groups) return { groups: [], error: 'Duplicates could not be loaded. Please refresh and try again.' }
  return { groups, error: null }
}

export async function updateLeadStatus(_prevState: LeadQuickActionState, formData: FormData): Promise<LeadQuickActionState> {
  const id = String(formData.get('leadId') || '')
  const status = String(formData.get('status') || '')

  if (!id || !status) return { ok: false, message: 'Missing lead or status.' }

  return submitLeadStatusTransition({
    id,
    status,
    idempotencyKey: crypto.randomUUID(),
  }, {
    request: (query, variables) => keystoneClient<unknown>(query, variables, { cache: 'no-store' }),
    revalidate: revalidatePath,
  })
}

export async function createShowingFromLead(prevState: LeadQuickActionState, formData: FormData): Promise<LeadQuickActionState> {
  if (prevState.uncertain) return prevState
  const leadId = String(formData.get('leadId') || '')
  const propertyId = String(formData.get('propertyId') || '')
  const assignedAgentId = String(formData.get('assignedAgentId') || '')
  const scheduledStart = explicitDateTimeToIso(String(formData.get('scheduledStart') || ''))
  const notes = String(formData.get('notes') || '')

  if (!leadId || !propertyId || !scheduledStart) {
    return { ok: false, message: 'Choose a date and time.' }
  }

  return submitScheduleShowingFromLead({
    leadId,
    propertyId,
    assignedAgentId: assignedAgentId || null,
    scheduledStart,
    notes,
    idempotencyKey: crypto.randomUUID(),
  }, {
    request: (query, variables) => keystoneClient<unknown>(query, variables, { cache: 'no-store' }),
    revalidate: revalidatePath,
  }, true)
}

export async function verifyShowingFromLeadReceipt(_previous: LeadQuickActionState, formData: FormData): Promise<LeadQuickActionState> {
  const encoded = String(formData.get('attempt') || '')
  let attempt: ScheduleShowingRequest
  try {
    if (!encoded || encoded.length > 12_000) throw new Error('Invalid receipt request')
    attempt = JSON.parse(encoded)
  } catch {
    return { ok: false, uncertain: true, message: 'The earlier showing request could not be read. Check with the assigned agent before scheduling again.' }
  }
  return verifyOwnedShowingSchedule(attempt, {
    request: (query, variables) => keystoneClient<unknown>(query, variables, { cache: 'no-store' }),
    revalidate: revalidatePath,
  })
}

export async function resolveDuplicateLead(_prevState: LeadQuickActionState, formData: FormData): Promise<LeadQuickActionState> {
  const primaryLeadId = String(formData.get('primaryLeadId') || '')
  const duplicateLeadId = String(formData.get('duplicateLeadId') || '')
  const note = String(formData.get('note') || '').trim()

  if (!primaryLeadId || !duplicateLeadId || primaryLeadId === duplicateLeadId) {
    return { ok: false, message: 'Choose a primary lead and a different duplicate lead.' }
  }

  return submitDuplicateLeadResolution({
    primaryLeadId,
    duplicateLeadId,
    note,
    idempotencyKey: crypto.randomUUID(),
  }, {
    request: (query, variables) => keystoneClient<unknown>(query, variables, { cache: 'no-store' }),
    revalidate: revalidatePath,
  })
}

export async function addLeadActivity(_prevState: LeadQuickActionState, formData: FormData): Promise<LeadQuickActionState> {
  const leadId = String(formData.get('leadId') || '')
  const propertyId = String(formData.get('propertyId') || '')
  const activityType = String(formData.get('activityType') || 'note')
  const direction = String(formData.get('direction') || 'internal')
  const channel = String(formData.get('channel') || 'crm')
  const subject = String(formData.get('subject') || '').trim()
  const body = String(formData.get('body') || '').trim()

  if (!leadId || !body) return { ok: false, message: 'Add a note before saving.' }

  const mutation = `
    mutation AddLeadActivity($data: AddLeadActivityCommandInput!) {
      addLeadActivityCommand(data: $data) { ok message itemId replayed }
    }
  `

  const response = await keystoneClient<{ addLeadActivityCommand: LeadQuickActionState }>(mutation, {
    data: {
      leadId,
      propertyId: propertyId || null,
      activityType,
      direction,
      channel,
      subject: subject || (activityType === 'call' ? 'Call logged' : 'CRM note'),
      body,
      idempotencyKey: crypto.randomUUID(),
    },
  }, { cache: 'no-store' })

  if (!response.success || !response.data.addLeadActivityCommand.ok) {
    return { ok: false, message: response.success ? response.data.addLeadActivityCommand.message : 'Could not save activity.' }
  }

  revalidatePath('/dashboard/platform/leads')
  return { ok: true, message: 'Activity saved.' }
}
