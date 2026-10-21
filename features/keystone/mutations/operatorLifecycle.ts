import type { Context } from '.keystone/types'
import { lockPropertyForDecision } from '../lib/propertyLock'
import { lockAggregate } from '../lib/aggregateLock'

import { activeBrokerageIds } from '../access'
import { requireClosingEvidenceChain, requireListingAuthority, requireOfferEvidenceChain, requirePractitionerLicense, requireRepresentationAuthority } from '../lib/authorityEvidence'
import { domainPayloadHash, enqueueDomainEvent, normalizeDomainJson } from '../lib/domainEvents'
import { freshOperatorCommandContext } from '../lib/commandContext'
import { requireCurrentCommissionState } from '../lib/commissionState'
import { showingReviewRevision } from '../lib/showingReviewRevision'
import { sameShowingIdentity, scopedShowingIdentity } from '../lib/showingAssociations'
import { ownedShowingEventHeader, showingEventPayloadMatches, SHOWING_EVENT_HEADER_QUERY } from '../lib/showingEventScope'
import { showingTransitions, reconcileLeadStatusAfterShowing, requireAvailableShowingSlot, showingInterval } from '../lib/showingPolicy'

type Domain = 'lead' | 'property' | 'showing' | 'openHouse' | 'deal' | 'offer' | 'commission' | 'disclosure' | 'milestone'
type Role = Record<string, boolean | undefined>

type TransitionInput = {
  id: string
  status: string
  note?: string | null
  idempotencyKey?: string | null
  expectedStatus?: string | null
  expectedUpdatedAt?: string | null
  expectedRevision?: string | null
}

const transitions: Record<Domain, Record<string, readonly string[]>> = {
  lead: { new: ['attempted_contact', 'qualified', 'lost'], attempted_contact: ['qualified', 'lost'], qualified: ['offer', 'lost'], tour_scheduled: ['qualified', 'offer', 'lost'], offer: ['closed', 'lost'], closed: [], lost: ['qualified'] },
  property: { draft: ['coming_soon', 'active', 'off_market'], coming_soon: ['active', 'off_market'], active: ['pending', 'sold', 'rented', 'off_market'], pending: ['active', 'sold', 'rented', 'off_market'], sold: ['off_market'], rented: ['off_market'], off_market: ['draft', 'coming_soon', 'active'] },
  showing: showingTransitions,
  openHouse: { scheduled: ['completed', 'cancelled'], completed: [], cancelled: [] },
  deal: { prospecting: ['active_search', 'closed_lost'], active_search: ['offer_drafted', 'closed_lost'], offer_drafted: ['active_search', 'under_contract', 'closed_lost'], under_contract: ['inspection', 'financing', 'closed_won', 'closed_lost'], inspection: ['under_contract', 'financing', 'closed_won', 'closed_lost'], financing: ['under_contract', 'inspection', 'closed_won', 'closed_lost'], closed_won: [], closed_lost: [] },
  offer: { draft: ['submitted', 'withdrawn'], submitted: ['countered', 'accepted', 'rejected', 'withdrawn'], countered: ['submitted', 'accepted', 'rejected', 'withdrawn'], accepted: [], rejected: [], withdrawn: [] },
  commission: { projected: ['approved'], approved: ['paid', 'clawed_back'], paid: ['clawed_back'], clawed_back: [] },
  disclosure: { draft: ['sent', 'expired'], sent: ['acknowledged', 'expired'], acknowledged: [], expired: ['draft', 'sent'] },
  milestone: { not_started: ['in_progress', 'blocked', 'complete'], in_progress: ['blocked', 'complete'], blocked: ['in_progress', 'complete'], complete: ['in_progress'] },
}

const config = {
  lead: { list: 'Lead', field: 'status', read: 'id status brokerage { id } assignedAgent { id }' },
  property: { list: 'Property', field: 'status', read: 'id status state brokerage { id } assignedAgent { id }' },
  showing: { list: 'Showing', field: 'status', read: 'id status updatedAt showingType notes feedback scheduledStart scheduledEnd brokerage { id status } assignedAgent { id } lead { id status brokerage { id status } } property { id state brokerage { id status } }' },
  openHouse: { list: 'OpenHouse', field: 'status', read: 'id status property { id brokerage { id } assignedAgent { id } } hostAgent { id }' },
  deal: { list: 'Deal', field: 'stage', read: 'id title stage transactionType offerAmount commissionAmount expectedCloseDate closedAt closedSnapshot nextStep notes brokerage { id } assignedAgent { id name } lead { id name email } property { id title slug addressLine1 city state }' },
  offer: { list: 'Offer', field: 'status', read: 'id offerNumber version parentOffer { id offerNumber version } status amount earnestMoney financingType contingencies submittedAt responseDueAt acceptedAt acceptedSnapshot brokerage { id } assignedAgent { id name } lead { id name email } property { id title slug addressLine1 city state } deal { id title transactionType }' },
  commission: { list: 'Commission', field: 'status', read: 'id status grossCommission brokerage { id } agent { id } deal { id stage transactionType brokerage { id } lead { id } } property { id state brokerage { id } }' },
  disclosure: { list: 'Disclosure', field: 'status', read: 'id status deal { brokerage { id } assignedAgent { id } } property { brokerage { id } assignedAgent { id } }' },
  milestone: { list: 'TransactionMilestone', field: 'status', read: 'id status assignedTo { id } deal { brokerage { id } assignedAgent { id } }' },
} as const

function role(context: Context): Role {
  return (context.session as any)?.data?.role || {}
}

function sessionId(context: Context) {
  return (context.session as any)?.itemId as string | undefined
}

function hasDomainPermission(context: Context, domain: Domain) {
  const currentRole = role(context)
  return domain === 'lead'
    ? Boolean(currentRole.canManageLeads)
    : domain === 'property'
      ? Boolean(currentRole.canManageListings)
      : domain === 'showing'
        ? Boolean(currentRole.canManageShowings)
      : domain === 'openHouse'
        ? Boolean(currentRole.canManageShowings)
        : Boolean(currentRole.canManageDeals)
}

function itemBrokerageId(item: any) {
  return item.brokerage?.id || item.deal?.brokerage?.id || item.property?.brokerage?.id || null
}

function representationSide(transactionType?: string): 'buyer' | 'seller' {
  return ['seller', 'landlord'].includes(String(transactionType || '')) ? 'seller' : 'buyer'
}

function permitted(context: Context, domain: Domain, item: any) {
  const currentRole = role(context)
  const userId = sessionId(context)
  if (!userId || !hasDomainPermission(context, domain)) return false
  const brokerageId = itemBrokerageId(item)
  if (brokerageId && !activeBrokerageIds(context.session as any).includes(brokerageId)) return false
  if (currentRole.canManagePeople) return true
  const ownerId = item.assignedAgent?.id || item.agent?.id || item.assignedTo?.id || item.deal?.assignedAgent?.id || item.property?.assignedAgent?.id
  return ownerId === userId
}

function safeString(value?: string | null) {
  return String(value || '').trim()
}

function transitionUpdate(domain: Domain, next: string, item: any, now: string, evidenceVersion: any = null) {
  const definition = config[domain]
  const update: Record<string, unknown> = { [definition.field]: next }
  if (domain === 'lead') update.lastContactedAt = now
  if (domain === 'deal' && ['closed_won', 'closed_lost'].includes(next)) {
    update.closedAt = now
    if (!item.closedSnapshot) {
      update.closedSnapshot = normalizeDomainJson({
        version: 1, capturedAt: now, outcome: next, title: item.title,
        transactionType: item.transactionType, offerAmount: item.offerAmount,
        commissionAmount: item.commissionAmount, expectedCloseDate: item.expectedCloseDate,
        nextStep: item.nextStep, notes: item.notes, property: item.property || null,
        lead: item.lead || null, assignedAgent: item.assignedAgent || null,
        evidenceVersion,
      })
    }
  }
  if (domain === 'offer') {
    if (next === 'submitted') update.submittedAt = now
    if (next === 'accepted') {
      update.acceptedAt = now
      if (!item.acceptedSnapshot) {
        update.acceptedSnapshot = normalizeDomainJson({
          version: item.version || 1, parentOffer: item.parentOffer || null, capturedAt: now, offerNumber: item.offerNumber, amount: item.amount,
          earnestMoney: item.earnestMoney, financingType: item.financingType,
          contingencies: item.contingencies, submittedAt: item.submittedAt,
          responseDueAt: item.responseDueAt, property: item.property || null,
          deal: item.deal || null, lead: item.lead || null,
          assignedAgent: item.assignedAgent || null,
          evidenceVersion,
        })
      }
    }
  }
  if (domain === 'commission') update.paidAt = next === 'paid' ? now : null
  if (domain === 'disclosure') {
    if (next === 'sent') update.sentAt = now
    if (next === 'acknowledged') update.acknowledgedAt = now
  }
  if (domain === 'milestone') update.completedAt = next === 'complete' ? now : null
  return update
}

async function transitionInContext(context: Context, domain: Domain, data: TransitionInput) {
  const id = safeString(data.id)
  const next = safeString(data.status)
  const commandKey = safeString(data.idempotencyKey)
  const definition = config[domain]
  const request = { domain, id, status: next, note: safeString(data.note),
    ...(data.expectedStatus != null ? { expectedStatus: data.expectedStatus } : {}),
    ...(data.expectedUpdatedAt != null ? { expectedUpdatedAt: data.expectedUpdatedAt } : {}),
    ...(data.expectedRevision != null ? { expectedRevision: data.expectedRevision } : {}),
  }
  const eventKey = `command:${domain}:${id}:${commandKey}`
  const sudo = context.sudo() as any
  // Aggregate locks and outbox idempotency are mandatory; refuse before any read, lock, or write without them.
  const supportsEvents = typeof sudo.prisma?.$executeRawUnsafe === 'function'
    && typeof sudo.query?.DomainOutboxEvent?.findOne === 'function'
    && typeof sudo.query?.DomainOutboxEvent?.createOne === 'function'
    && typeof sudo.query?.DomainAuditEvent?.createOne === 'function'
  if (!supportsEvents) return { ok: false, message: 'Transitions are temporarily unavailable.', itemId: null, status: null, replayed: false }
  let showingReplay: any = null
  const showingHeader = domain === 'showing' ? await scopedShowingIdentity(context, id) : null
  if (domain === 'showing' && !showingHeader) return { ok: false, message: 'Showing not found or access denied.', itemId: null, status: null, replayed: false }

  if (supportsEvents) {
    await sudo.prisma.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `aggregate:${domain}:${id}`)
    const candidate = await sudo.query.DomainOutboxEvent.findOne({ where: { eventKey }, query: domain === 'showing' ? SHOWING_EVENT_HEADER_QUERY : 'id requestHash payload brokerage { id }' })
    if (candidate && domain === 'showing' && !await ownedShowingEventHeader(context, candidate, { eventKey, eventType: 'showing.status_changed', purpose: 'showing' })) return { ok: false, message: 'Showing not found or access denied.', itemId: null, status: null, replayed: false }
    if (candidate && domain === 'showing' && candidate.requestHash !== domainPayloadHash(request)) return { ok: false, message: 'This idempotency key was already used with different transition input.', itemId: null, status: null, replayed: false }
    const existing = candidate && domain === 'showing' ? await sudo.query.DomainOutboxEvent.findOne({ where: { eventKey }, query: 'id requestHash payloadHash payload brokerage { id }' }) : candidate
    if (candidate && (!existing || existing.id !== candidate.id || existing.requestHash !== candidate.requestHash
      || (domain === 'showing' && !showingEventPayloadMatches(candidate, existing)))) return { ok: false, message: 'Showing not found or access denied.', itemId: null, status: null, replayed: false }
    if (existing) {
      if (!activeBrokerageIds(context.session as any).includes(existing.brokerage?.id)) {
        return { ok: false, message: 'You are not authorized to transition this record.', itemId: null, status: null, replayed: false }
      }
      if (existing.requestHash !== domainPayloadHash(request)) {
        throw new Error('Domain command idempotency key was reused with different input')
      }
      if (domain === 'showing') showingReplay = existing
      else return { ...(existing.payload?.result || {}), replayed: true }
    }
  }

  await lockAggregate(context, definition.list, id, activeBrokerageIds(context.session as any)[0])
  if (domain === 'property') await lockPropertyForDecision(context, id, activeBrokerageIds(context.session as any)[0])
  let item = await (sudo.query as any)[definition.list].findOne({ where: { id }, query: definition.read })
  if (!item || (showingHeader && !sameShowingIdentity(item, showingHeader))) return { ok: false, message: 'The requested record was not found.', itemId: null, status: null, replayed: false }
  if (!permitted(context, domain, item)) return { ok: false, message: 'You are not authorized to transition this record.', itemId: null, status: null, replayed: false }
  if (domain !== 'property' && item.property?.id) {
    await lockPropertyForDecision(context, item.property.id, itemBrokerageId(item))
    // A generic Property edit may have completed while this command waited.
    // Re-read the entire decision projection under the physical row lock.
    item = await (sudo.query as any)[definition.list].findOne({ where: { id }, query: definition.read })
    if (!item || !permitted(context, domain, item) || (showingHeader && !sameShowingIdentity(item, showingHeader))) return { ok: false, message: 'The requested record changed or is unavailable.', itemId: null, status: null, replayed: false }
  }
  if (showingReplay) {
    if (showingReplay.payload?.actorId !== sessionId(context) || showingReplay.payload?.aggregate?.type !== 'showing'
      || showingReplay.payload.aggregate.id !== id || showingReplay.payload?.request?.id !== id
      || showingReplay.payload?.request?.domain !== 'showing' || showingReplay.payload?.result?.itemId !== id
      || showingReplay.payload?.result?.ok !== true || showingReplay.payload?.result?.status !== next
      || showingReplay.payload?.before?.lead?.id !== showingHeader?.lead.id || showingReplay.payload?.before?.property?.id !== showingHeader?.property.id) return { ok: false, message: 'You are not authorized to replay this command.', itemId: null, status: null, replayed: false }
    return { ...(showingReplay.payload?.result || {}), replayed: true }
  }
  if (domain === 'showing' && ((data.expectedStatus != null && item.status !== data.expectedStatus)
    || (data.expectedUpdatedAt != null && item.updatedAt !== data.expectedUpdatedAt)
    || (data.expectedRevision != null && await showingReviewRevision(context, item) !== data.expectedRevision))) {
    return { ok: false, message: 'The showing changed after review. Refresh before submitting a new decision.', itemId: id, status: item.status, replayed: false }
  }

  let evidenceVersion: any = null
  const bindEvidence = (chain: any) => ({ documentId: chain.document.id, documentSha256: chain.events[0]?.documentSha256, templateSha256: chain.events[0]?.templateSha256, eventIds: chain.events.map((event: any) => event.id) })
  const brokerageId = itemBrokerageId(item)
  const practitionerId = item.assignedAgent?.id || item.agent?.id || item.deal?.assignedAgent?.id || item.property?.assignedAgent?.id
  if (domain === 'property' && ['coming_soon', 'active'].includes(next)) {
    if (!brokerageId || !practitionerId || !item.state) return { ok: false, message: 'Listing publication requires assigned practitioner and jurisdiction authority.', itemId: id, status: item.status, replayed: false }
    try {
      await requireListingAuthority(context, { brokerageId, propertyId: id, practitionerId, jurisdictionCode: item.state, destination: 'public_site' })
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Listing publication authority is required.', itemId: id, status: item.status, replayed: false }
    }
  }
  if (domain === 'showing' && next === 'scheduled' && ['closed', 'lost'].includes(item.lead?.status)) {
    return { ok: false, message: 'Closed or lost leads cannot be scheduled. Reopen a lost lead before scheduling.', itemId: id, status: item.status, replayed: false }
  }
  if (domain === 'showing' && ['scheduled', 'completed'].includes(next)) {
    if (!brokerageId || !practitionerId || !item.lead?.id || !item.property?.id || !item.property?.state) return { ok: false, message: 'Showing confirmation requires practitioner, jurisdiction, and relationship authority.', itemId: id, status: item.status, replayed: false }
    try {
      await requireRepresentationAuthority(context, { brokerageId, leadId: item.lead.id, propertyId: item.property.id, practitionerId, jurisdictionCode: item.property.state, side: 'buyer', allowCustomerAssistance: true })
      if (next === 'scheduled') {
        const duration = item.scheduledEnd ? (new Date(item.scheduledEnd).getTime() - new Date(item.scheduledStart).getTime()) / 60_000 : 60
        const interval = showingInterval(item.scheduledStart, duration)
        await requireAvailableShowingSlot(context, { brokerageId, propertyId: item.property.id, agentId: practitionerId, ...interval, excludeId: id })
        item.scheduledEnd = interval.scheduledEnd
      }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Showing authority is required.', itemId: id, status: item.status, replayed: false }
    }
  }
  if (domain === 'offer' && ['submitted', 'accepted'].includes(next)) {
    if (!brokerageId || !practitionerId || !item.lead?.id || !item.property?.id || !item.property?.state) return { ok: false, message: 'Offer transition requires practitioner, jurisdiction, and representation authority.', itemId: id, status: item.status, replayed: false }
    try {
      await requireRepresentationAuthority(context, { brokerageId, leadId: item.lead.id, propertyId: item.property.id, dealId: item.deal?.id, practitionerId, jurisdictionCode: item.property.state, side: representationSide(item.deal?.transactionType) })
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Offer authority is required.', itemId: id, status: item.status, replayed: false }
    }
  }
  if (domain === 'deal' && ['under_contract', 'inspection', 'financing', 'closed_won'].includes(next)) {
    if (!brokerageId || !practitionerId || !item.lead?.id || !item.property?.id || !item.property?.state) return { ok: false, message: 'Deal transition requires practitioner, jurisdiction, and representation authority.', itemId: id, status: item.stage, replayed: false }
    try {
      await requireRepresentationAuthority(context, { brokerageId, leadId: item.lead.id, propertyId: item.property.id, dealId: id, practitionerId, jurisdictionCode: item.property.state, side: representationSide(item.transactionType) })
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Deal authority is required.', itemId: id, status: item.stage, replayed: false }
    }
  }
  if (domain === 'commission' && ['approved', 'paid'].includes(next)) {
    if (!brokerageId || !practitionerId || !item.property?.state) return { ok: false, message: 'Commission transition requires current practitioner authority.', itemId: id, status: item.status, replayed: false }
    try {
      await requirePractitionerLicense(context, { brokerageId, practitionerId, jurisdictionCode: item.property.state })
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Commission authority is required.', itemId: id, status: item.status, replayed: false }
    }
  }

  if (supportsEvents && domain === 'offer' && item.deal?.id) {
    await sudo.prisma.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `aggregate:deal:${item.deal.id}`)
  }
  if (domain === 'offer' && next === 'accepted' && item.deal?.id) {
    const accepted = await sudo.query.Offer.findMany({ where: { AND: [{ deal: { id: { equals: item.deal.id } } }, { status: { equals: 'accepted' } }, { id: { not: { equals: id } } }] }, take: 1, query: 'id offerNumber' })
    if (accepted.length) return { ok: false, message: `Deal already has accepted offer ${accepted[0].offerNumber}.`, itemId: id, status: item.status, replayed: false }
    try {
      evidenceVersion = bindEvidence(await requireOfferEvidenceChain(context, { dealId: item.deal.id, offerId: id }))
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Complete offer evidence is required.', itemId: id, status: item.status, replayed: false }
    }
  }
  if (domain === 'deal' && next === 'closed_won') {
    const acceptedOffers = await sudo.query.Offer.findMany({ where: { deal: { id: { equals: id } }, status: { equals: 'accepted' } }, take: 1, query: 'id offerNumber' })
    if (!acceptedOffers.length) return { ok: false, message: 'A closed-won deal requires an accepted offer.', itemId: id, status: item.stage, replayed: false }
    try {
      await requireOfferEvidenceChain(context, { dealId: id, offerId: acceptedOffers[0].id })
      evidenceVersion = bindEvidence(await requireClosingEvidenceChain(context, id))
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Complete closing evidence is required.', itemId: id, status: item.stage, replayed: false }
    }
  }
  if (domain === 'property' && next === 'sold') {
    const closedDeals = await sudo.query.Deal.findMany({ where: { property: { id: { equals: id } }, stage: { equals: 'closed_won' } }, take: 1, query: 'id' })
    if (!closedDeals.length) return { ok: false, message: 'A sold listing requires a closed-won deal.', itemId: id, status: item.status, replayed: false }
    try {
      await requireClosingEvidenceChain(context, closedDeals[0].id)
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Complete closing evidence is required.', itemId: id, status: item.status, replayed: false }
    }
  }
  if (domain === 'commission' && next === 'paid' && item.deal?.stage !== 'closed_won') return { ok: false, message: 'A paid commission requires a closed-won deal.', itemId: id, status: item.status, replayed: false }
  if (domain === 'commission' && ['approved', 'paid'].includes(next)) {
    try { await requireCurrentCommissionState(context, id, item.grossCommission, next === 'paid') }
    catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'Current commission evidence is required.', itemId: id, status: item.status, replayed: false } }
  }
  if (domain === 'commission' && next === 'paid') {
    try {
      await requireClosingEvidenceChain(context, item.deal.id)
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Complete closing evidence is required.', itemId: id, status: item.status, replayed: false }
    }
  }

  const current = item[definition.field]
  if (current === next) return { ok: true, message: 'The record is already in that status.', itemId: id, status: current, replayed: true }
  if (!transitions[domain][current]?.includes(next)) {
    return { ok: false, message: `Cannot transition ${domain} from ${current} to ${next}.`, itemId: id, status: current, replayed: false }
  }

  const nextLeadStatus = domain === 'showing' && item.lead?.id
    ? await reconcileLeadStatusAfterShowing(context, {
      currentLeadStatus: item.lead.status,
      nextShowingStatus: next,
      brokerageId,
      leadId: item.lead.id,
      showingId: id,
    })
    : null
  const now = new Date().toISOString()
  const update = transitionUpdate(domain, next, item, now, evidenceVersion)
  if (domain === 'showing' && next === 'scheduled') update.scheduledEnd = item.scheduledEnd
  await (sudo.query as any)[definition.list].updateOne({ where: { id }, data: update, query: `id ${definition.field}` })
  if (domain === 'showing' && item.lead?.id && nextLeadStatus !== null && nextLeadStatus !== item.lead.status) {
    await sudo.query.Lead.updateOne({ where: { id: item.lead.id }, data: { status: nextLeadStatus }, query: 'id' })
  }
  if (domain === 'offer' && next === 'accepted' && item.deal?.id) {
    await sudo.query.Deal.updateOne({ where: { id: item.deal.id }, data: { offerAmount: item.amount }, query: 'id' })
  }

  const leadId = domain === 'lead' ? id : item.lead?.id
  if (leadId) {
    await sudo.query.LeadActivity.createOne({
      data: {
        lead: { connect: { id: leadId } },
        ...(item.property?.id ? { property: { connect: { id: item.property.id } } } : {}),
        ...(domain === 'showing' ? { showing: { connect: { id } } } : {}),
        agent: { connect: { id: sessionId(context)! } }, activityType: 'status_change',
        direction: 'internal', channel: 'crm', subject: `${domain} status changed`,
        body: [data.note ? safeString(data.note) : '', `${current} → ${next}`].filter(Boolean).join('\n'),
        occurredAt: now,
      },
      query: 'id',
    })
  }

  const result = { ok: true, message: `${domain} transitioned to ${next}.`, itemId: id, status: next, replayed: false }
  if (supportsEvents && brokerageId) {
    await enqueueDomainEvent(sudo, {
      eventKey, eventType: `${domain}.status_changed`, brokerageId,
      aggregateType: domain, aggregateId: id, actorId: sessionId(context), action: 'transition',
      request, before: { ...item, [definition.field]: current }, after: result, occurredAt: now,
    })
  }
  return result
}

async function transition(context: Context, domain: Domain, data: TransitionInput) {
  const id = safeString(data.id)
  const next = safeString(data.status)
  const key = safeString(data.idempotencyKey)
  if (!id || id.length > 200 || !next || next.length > 80 || safeString(data.note).length > 5000 || !key || key.length > 120) return { ok: false, message: 'A record, target status, and bounded idempotency key are required.', itemId: null, status: null, replayed: false }
  if (!sessionId(context) || !hasDomainPermission(context, domain)) {
    return { ok: false, message: 'You are not authorized to transition this record.', itemId: null, status: null, replayed: false }
  }
  // Advisory xact locks and idempotency checks are only effective on a transaction-bound client; fail closed.
  if (typeof context.transaction !== 'function') {
    return { ok: false, message: 'Transitions are temporarily unavailable.', itemId: null, status: null, replayed: false }
  }
  return context.transaction(async transactionContext => {
    const sessionContext = await freshOperatorCommandContext(context.session ? transactionContext.withSession(context.session) : transactionContext)
    if (!hasDomainPermission(sessionContext, domain)) return { ok: false, message: 'You are not authorized to transition this record.', itemId: null, status: null, replayed: false }
    return transitionInContext(sessionContext, domain, data)
  }, { timeout: 30_000 })
}

export const transitionLeadStatus = (_root: unknown, { data }: { data: TransitionInput }, context: Context) => transition(context, 'lead', data)
export const transitionPropertyStatus = (_root: unknown, { data }: { data: TransitionInput }, context: Context) => transition(context, 'property', data)
export const transitionOpenHouseStatus = (_root: unknown, { data }: { data: TransitionInput }, context: Context) => transition(context, 'openHouse', data)
export const transitionShowingStatus = (_root: unknown, { data }: { data: TransitionInput }, context: Context) => transition(context, 'showing', data)

export async function reviewShowingCommand(_root: unknown, { data }: { data: TransitionInput }, context: Context) {
  if (!data.expectedStatus || !data.expectedUpdatedAt || !/^[a-f0-9]{64}$/.test(data.expectedRevision || '') || !Number.isFinite(new Date(data.expectedUpdatedAt).getTime())) {
    return { ok: false, message: 'Refresh the showing and review its current version before deciding.', itemId: null, status: null, replayed: false }
  }
  return transition(context, 'showing', data)
}
export const transitionOfferStatus = (_root: unknown, { data }: { data: TransitionInput }, context: Context) => transition(context, 'offer', data)
export const transitionDealStage = (_root: unknown, { data }: { data: TransitionInput }, context: Context) => transition(context, 'deal', data)
export const transitionCommissionStatus = (_root: unknown, { data }: { data: TransitionInput }, context: Context) => transition(context, 'commission', data)
export const transitionDisclosureStatus = (_root: unknown, { data }: { data: TransitionInput }, context: Context) => transition(context, 'disclosure', data)
export const transitionTransactionMilestoneStatus = (_root: unknown, { data }: { data: TransitionInput }, context: Context) => transition(context, 'milestone', data)
