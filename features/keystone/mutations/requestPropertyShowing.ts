import type { Context } from '.keystone/types'

import { requireListingAuthority } from '../lib/authorityEvidence'
import { lockBrokerageCommand } from '../lib/commandContext'
import { lockPropertyForDecision } from '../lib/propertyLock'
import { explicitDateTimeToIso, SHOWING_HOURS, stateTimeZone, timeZoneLabel, withinShowingHours } from '../../lib/date-time'
import { domainPayloadHash, enqueueDomainEvent } from '../lib/domainEvents'
import { showingSnapshot } from './showingJourney'
import { capturePublicLead, firstActiveBrokerageAgent } from './leadCapture'

export type RequestPropertyShowingInput = {
  brokerageSlug: string
  propertyId: string
  name: string
  email?: string | null
  phone?: string | null
  requestedStart: string
  showingType?: 'in_person' | 'virtual' | null
  message?: string | null
  idempotencyKey?: string | null
}

function clean(value?: string | null) {
  const trimmed = String(value || '').trim()
  return trimmed.length ? trimmed : ''
}

function validContact(email: string, phone: string) {
  const emailValid = !email || (email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  const phoneDigits = phone.replace(/\D/g, '')
  const phoneValid = !phone || (phone.length <= 40 && phoneDigits.length >= 7 && phoneDigits.length <= 15)
  return emailValid && phoneValid && Boolean(email || phone)
}

function validDate(value: string) {
  const iso = explicitDateTimeToIso(value)
  return iso ? new Date(iso) : null
}

async function findRoutingAgentId(context: Context, property: any) {
  const rules = await context.sudo().query.LeadRoutingRule.findMany({
    where: { status: { equals: 'active' }, brokerage: { id: { equals: property.brokerage.id } } },
    orderBy: [{ priority: 'asc' }],
    take: 50,
    query: 'intent source city state postalCode isFallback assignedAgent { id }',
  })
  const matching = rules.find((rule: any) =>
    rule.assignedAgent?.id &&
    (!rule.intent || rule.intent === 'any' || rule.intent === (property.listingType === 'rent' ? 'rent' : 'buy')) &&
    (!rule.source || rule.source === 'any' || rule.source === 'website') &&
    (!rule.city || rule.city.toLowerCase() === property.city.toLowerCase()) &&
    (!rule.state || rule.state.toLowerCase() === property.state.toLowerCase()) &&
    (!rule.postalCode || rule.postalCode === property.postalCode)
  )
  const fallback = rules.find((rule: any) => rule.isFallback && rule.assignedAgent?.id)
  return firstActiveBrokerageAgent(context, property.brokerage.id, [matching?.assignedAgent?.id, property.assignedAgent?.id, fallback?.assignedAgent?.id])
}

export async function requestPropertyShowing(
  _root: unknown,
  { data }: { data: RequestPropertyShowingInput },
  context: Context
) {
  const brokerageSlug = clean(data.brokerageSlug).toLowerCase()
  const propertyId = clean(data.propertyId)
  const name = clean(data.name)
  const email = clean(data.email)
  const phone = clean(data.phone)
  const requestedStart = validDate(clean(data.requestedStart))
  const message = clean(data.message)
  if (data.showingType && !['in_person', 'virtual'].includes(data.showingType)) {
    return { ok: false, message: 'Choose an in-person or virtual showing request.', leadId: null, showingId: null }
  }
  const showingType = data.showingType === 'virtual' ? 'virtual' : 'in_person'
  const key = clean(data.idempotencyKey)
  if (key && !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key)) {
    return { ok: false, message: 'A valid showing request key is required.', leadId: null, showingId: null }
  }

  if (!propertyId || propertyId.length > 200 || brokerageSlug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(brokerageSlug) || !name || name.length > 120 || message.length > 5000 || !validContact(email, phone) || !requestedStart) {
    return { ok: false, message: 'Add a listing, valid requested time, name, and email or phone.', leadId: null, showingId: null }
  }
  const brokerages = await context.sudo().query.Brokerage.findMany({ where: { slug: { equals: brokerageSlug }, status: { equals: 'active' } }, take: 1, query: 'id' })
  if (!brokerages[0]) return { ok: false, message: 'This listing is unavailable.', leadId: null, showingId: null }
  return context.transaction(async transactionContext => {
  const context = transactionContext
  await lockBrokerageCommand(context, brokerages[0].id)
  await lockPropertyForDecision(context, propertyId, brokerages[0].id)
  const customerId = context.session?.itemId || null
  if (customerId) {
    const customer = await context.sudo().query.User.findOne({ where: { id: customerId }, query: 'id activeBrokerage { id }' })
    if (customer?.activeBrokerage?.id !== brokerages[0].id) return { ok: false, message: 'Sign in with an account for this brokerage.', leadId: null, showingId: null }
  }
  const request = { propertyId, name, email: email.toLowerCase(), phone, requestedStart: requestedStart.toISOString(), showingType, message, ...(customerId ? { customerId } : {}) }
  const eventKey = key ? `public-showing-intent:${brokerages[0].id}:${domainPayloadHash(key)}` : null
  const requestReference = eventKey ? domainPayloadHash(eventKey) : null
  if (eventKey) {
    const existing = await context.sudo().query.DomainOutboxEvent.findOne({ where: { eventKey }, query: 'id requestHash brokerage { id }' })
    if (existing) {
      if (existing.brokerage?.id !== brokerages[0].id || existing.requestHash !== domainPayloadHash(request)) {
        return { ok: false, message: 'This request key was already used with different details. Contact the brokerage about the original request.', leadId: null, showingId: null }
      }
      return { ok: true, message: 'Showing request already received. The advisor must still confirm availability.', leadId: null, showingId: null, requestReference }
    }
  }
  if (requestedStart.getTime() <= Date.now() || requestedStart.getTime() > Date.now() + 365 * 24 * 60 * 60_000) {
    return { ok: false, message: 'Choose a requested showing time in the future.', leadId: null, showingId: null }
  }
  const properties = await context.sudo().query.Property.findMany({
    where: {
      id: { equals: propertyId },
      brokerage: { slug: { equals: brokerageSlug }, status: { equals: 'active' } },
    },
    take: 1,
    query: 'id title slug status listingType addressLine1 city state postalCode price updatedAt brokerage { id } assignedAgent { id }',
  })
  const property = properties[0]
  if (!property || !['active', 'coming_soon'].includes(property.status)) {
    return { ok: false, message: 'This listing is no longer accepting showing requests.', leadId: null, showingId: null }
  }
  // Showing hours are read in the listing's own time zone, whatever zone the visitor's browser is in.
  const listingTimeZone = stateTimeZone(property.state)
  if (listingTimeZone && !withinShowingHours(requestedStart.getTime(), listingTimeZone)) {
    return { ok: false, message: `Choose a time between ${SHOWING_HOURS.first} AM and ${SHOWING_HOURS.last - 12} PM ${timeZoneLabel(listingTimeZone)}.`, leadId: null, showingId: null }
  }
  try {
    await requireListingAuthority(context, { brokerageId: property.brokerage.id, propertyId, practitionerId: property.assignedAgent?.id || '', jurisdictionCode: property.state, destination: 'public_site', showingRequired: true })
  } catch {
    return { ok: false, message: 'This listing is not currently authorized for public showing requests.', leadId: null, showingId: null }
  }

  const settings = await context.sudo().query.BrokerageSettings.findMany({
    where: { brokerage: { id: { equals: property.brokerage.id } } },
    orderBy: [{ createdAt: 'asc' }],
    take: 1,
    query: 'showingDurationMinutes',
  })
  const duration = Math.min(Math.max(settings[0]?.showingDurationMinutes || 60, 15), 240)
  const scheduledEnd = new Date(requestedStart.getTime() + duration * 60_000)
  const immutableContext = [
    `Public showing request for ${property.title} (${property.slug}).`,
    `Requested start: ${requestedStart.toISOString()}.`,
    message ? `Customer note: ${message}` : '',
  ].filter(Boolean).join('\n')

    const assignedAgentId = await findRoutingAgentId(transactionContext, property)
    const capture = await capturePublicLead(transactionContext, {
      name,
      email,
      phone,
      intent: property.listingType === 'rent' ? 'rent' : 'buy',
      source: 'website',
      status: 'new',
      message: immutableContext,
      propertyId: property.id,
      assignedAgentId,
    })

    const exact = await transactionContext.sudo().query.Showing.findMany({
      where: {
        lead: { id: { equals: capture.lead.id } }, property: { id: { equals: property.id } },
        scheduledStart: { equals: requestedStart.toISOString() }, status: { in: ['requested', 'scheduled'] },
        // Never attach or disclose another account's/guest's request by email.
        ...(customerId ? { customer: { id: { equals: customerId } } } : { customer: null }),
      },
      take: 1,
      query: 'id',
    })
    if (exact.length) {
      if (eventKey) await enqueueDomainEvent(transactionContext.sudo(), {
        eventKey, eventType: 'showing.request_intent_received', brokerageId: property.brokerage.id,
        aggregateType: 'showing', aggregateId: exact[0].id, action: 'request_receipt', request,
        after: { requestReference, receiptState: 'received', reusedShowing: true },
      })
      return { ok: true, message: 'Showing request already received. The assigned agent will confirm availability.', leadId: null, showingId: null, ...(eventKey ? { requestReference } : {}) }
    }
    const recent = await transactionContext.sudo().query.Showing.findMany({
      where: { lead: { id: { equals: capture.lead.id } }, createdAt: { gte: new Date(Date.now() - 60 * 60_000).toISOString() } },
      take: 5,
      query: 'id',
    })
    if (recent.length >= 5) return { ok: false, message: 'Unable to accept this request. Please contact the brokerage directly.', leadId: null, showingId: null }

    if (capture.reused) {
      await transactionContext.sudo().query.Lead.updateOne({
        where: { id: capture.lead.id },
        data: {
          ...(!capture.lead.assignedAgent?.id && assignedAgentId
            ? { assignedAgent: { connect: { id: assignedAgentId } } }
            : {}),
        },
        query: 'id',
      })
    }

    const showing = await transactionContext.sudo().query.Showing.createOne({
      data: {
        status: 'requested',
        showingType,
        scheduledStart: requestedStart.toISOString(),
        scheduledEnd: scheduledEnd.toISOString(),
        notes: immutableContext,
        ...(customerId ? { customer: { connect: { id: customerId } } } : {}),
        requestSnapshot: showingSnapshot(property, { leadId: capture.lead.id, assignedAgentId, scheduledStart: requestedStart.toISOString(), scheduledEnd: scheduledEnd.toISOString(), showingType, notes: message }, new Date().toISOString()),
        property: { connect: { id: property.id } },
        lead: { connect: { id: capture.lead.id } },
        ...(assignedAgentId ? { assignedAgent: { connect: { id: assignedAgentId } } } : {}),
      },
      query: 'id',
    })

    const activity = await transactionContext.sudo().query.LeadActivity.createOne({
      data: {
        activityType: 'showing_requested',
        direction: 'inbound',
        channel: 'website',
        subject: capture.reused ? 'Repeat contact showing request received' : 'Public showing request received',
        body: immutableContext,
        occurredAt: new Date().toISOString(),
        lead: { connect: { id: capture.lead.id } },
        property: { connect: { id: property.id } },
        showing: { connect: { id: showing.id } },
        ...(assignedAgentId ? { agent: { connect: { id: assignedAgentId } } } : {}),
      },
      query: 'id',
    })

    await enqueueDomainEvent(transactionContext.sudo(), {
      eventKey: `public-showing:${showing.id}`,
      eventType: 'showing.requested',
      brokerageId: property.brokerage.id,
      aggregateType: 'showing',
      aggregateId: showing.id,
      action: 'request',
      request: { propertyId, requestedStart: requestedStart.toISOString(), showingType, identityKey: capture.identityKey },
      before: null,
      after: {
        leadId: capture.lead.id, showingId: showing.id, activityId: activity.id, reusedLead: capture.reused, status: 'requested',
        snapshot: showingSnapshot(property, {
          leadId: capture.lead.id, assignedAgentId, scheduledStart: requestedStart.toISOString(), scheduledEnd: scheduledEnd.toISOString(), showingType, notes: message,
        }, new Date().toISOString()),
      },
    })

    if (eventKey) await enqueueDomainEvent(transactionContext.sudo(), {
      eventKey, eventType: 'showing.request_intent_received', brokerageId: property.brokerage.id,
      aggregateType: 'showing', aggregateId: showing.id, action: 'request_receipt', request,
      after: { requestReference, receiptState: 'received' },
    })
    return {
      ok: true,
      ...(eventKey ? { requestReference } : {}),
      message: 'Showing requested. The assigned agent will confirm the appointment.',
      leadId: null,
      showingId: null,
    }
  }, { timeout: 30_000 })
}
