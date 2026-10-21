import crypto from 'node:crypto'
import type { Context } from '.keystone/types'
import { lockAndRefreshProperty } from '../lib/propertyLock'

import { activeBrokerageIds } from '../access'
import { requireListingAuthority, requireRepresentationAuthority } from '../lib/authorityEvidence'
import { runControlledEvidenceCommand } from './controlledEvidenceCommand'

import { commandText as clean } from '../../lib/date-time'
function actorId(context: Context) { return (context.session as any)?.itemId as string | undefined }
function role(context: Context) { return (context.session as any)?.data?.role || {} }
function validKey(value: string) { return Boolean(value && value.length <= 120) }
function validMoney(value: string) { return /^\d{1,10}(\.\d{1,2})?$/.test(value) }

function authorized(context: Context, brokerageId: string, permission: string, ownerId?: string | null) {
  return Boolean(actorId(context) && role(context)[permission] && activeBrokerageIds(context.session as any).includes(brokerageId) && (role(context).canManagePeople || !ownerId || ownerId === actorId(context)))
}

async function runCommand(context: Context, options: {
  eventKey: string
  lockKey: string
  permission: string
  request: Record<string, unknown>
  execute: (scoped: Context) => Promise<{ result: any; event: any }>
}) {
  return runControlledEvidenceCommand(context, options)
}

export async function createOfferCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const dealId = clean(data.dealId), amount = clean(data.amount), earnestMoney = clean(data.earnestMoney), financingType = clean(data.financingType) || 'conventional', contingencies = clean(data.contingencies), responseDueAt = clean(data.responseDueAt), key = clean(data.idempotencyKey)
  if (!dealId || !validMoney(amount) || !['cash', 'conventional', 'fha', 'va', 'other'].includes(financingType) || contingencies.length > 10_000 || (responseDueAt && !Number.isFinite(new Date(responseDueAt).getTime())) || !validKey(key)) return { ok: false, message: 'Deal, valid amount, and bounded idempotency key are required.', itemId: null, replayed: false }
  if (earnestMoney && !validMoney(earnestMoney)) return { ok: false, message: 'Earnest money must be a valid amount.', itemId: null, replayed: false }
  const request = { dealId, amount, earnestMoney, financingType, contingencies, responseDueAt }
  return runCommand(context, {
    eventKey: `command:deal:${dealId}:create-offer:${key}`, lockKey: `aggregate:deal:${dealId}`, permission: 'canManageDeals', request,
    execute: async scoped => {
      const sudo = scoped.sudo() as any
      const deal = await sudo.query.Deal.findOne({ where: { id: dealId }, query: 'id title stage brokerage { id } property { id } lead { id } assignedAgent { id }' })
      if (!deal || !authorized(scoped, deal.brokerage?.id, 'canManageDeals', deal.assignedAgent?.id)) return { result: { ok: false, message: 'Deal not found or access denied.', itemId: null }, event: null as never }
      if (['closed_won', 'closed_lost'].includes(deal.stage)) return { result: { ok: false, message: 'Closed transactions cannot receive new offers.', itemId: null }, event: null as never }
      const suffix = crypto.createHash('sha256').update(`${dealId}:${key}`).digest('hex').slice(0, 16).toUpperCase()
      const offer = await sudo.query.Offer.createOne({ data: { brokerage: { connect: { id: deal.brokerage.id } }, offerNumber: `OFF-${suffix}`, status: 'draft', amount, earnestMoney: earnestMoney || null, financingType, contingencies, responseDueAt: responseDueAt || null, deal: { connect: { id: dealId } }, property: { connect: { id: deal.property.id } }, lead: { connect: { id: deal.lead.id } }, ...(deal.assignedAgent?.id ? { assignedAgent: { connect: { id: deal.assignedAgent.id } } } : {}) }, query: 'id offerNumber status' })
      const result = { ok: true, message: 'Offer draft created.', itemId: offer.id }
      return { result, event: { eventType: 'offer.draft_created', brokerageId: deal.brokerage.id, aggregateType: 'offer', aggregateId: offer.id, actorId: actorId(scoped), action: 'create_draft', before: null, after: { ...result, offerNumber: offer.offerNumber } } }
    },
  })
}

export async function createCounterOfferCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const offerId = clean(data.offerId), amount = clean(data.amount), responseDueAt = clean(data.responseDueAt), contingencies = clean(data.contingencies), key = clean(data.idempotencyKey)
  if (!offerId || !validMoney(amount) || contingencies.length > 10_000 || (responseDueAt && !Number.isFinite(new Date(responseDueAt).getTime())) || !validKey(key)) return { ok: false, message: 'Offer, valid amount, and bounded idempotency key are required.', itemId: null, replayed: false }
  const request = { offerId, amount, responseDueAt, contingencies }
  return runCommand(context, {
    eventKey: `command:offer:${offerId}:counter:${key}`, lockKey: `aggregate:offer:${offerId}`, permission: 'canManageDeals', request,
    execute: async scoped => {
      const sudo = scoped.sudo() as any
      const source = await sudo.query.Offer.findOne({ where: { id: offerId }, query: 'id offerNumber version status earnestMoney financingType brokerage { id } deal { id transactionType } property { id state } lead { id } assignedAgent { id }' })
      if (!source || !authorized(scoped, source.brokerage?.id, 'canManageDeals', source.assignedAgent?.id)) return { result: { ok: false, message: 'Offer not found or access denied.', itemId: null }, event: null as never }
      source.property = await lockAndRefreshProperty(scoped, source.property.id, source.brokerage.id)
      try {
        await requireRepresentationAuthority(scoped, { brokerageId: source.brokerage.id, leadId: source.lead.id, propertyId: source.property.id, dealId: source.deal.id, practitionerId: source.assignedAgent?.id || actorId(scoped)!, jurisdictionCode: source.property.state, side: ['seller', 'landlord'].includes(source.deal.transactionType) ? 'seller' : 'buyer' })
      } catch (error) {
        return { result: { ok: false, message: error instanceof Error ? error.message : 'Negotiation authority is required.', itemId: source.id }, event: null as never }
      }
      if (!['submitted', 'countered'].includes(source.status)) return { result: { ok: false, message: `Cannot counter an offer from ${source.status}.`, itemId: source.id }, event: null as never }
      const suffix = crypto.createHash('sha256').update(key).digest('hex').slice(0, 6).toUpperCase()
      const counter = await sudo.query.Offer.createOne({ data: { brokerage: { connect: { id: source.brokerage.id } }, offerNumber: `${source.offerNumber}-C${suffix}`, version: Number(source.version || 1) + 1, parentOffer: { connect: { id: source.id } }, status: 'draft', amount, earnestMoney: source.earnestMoney, financingType: source.financingType, contingencies, responseDueAt: responseDueAt || null, deal: { connect: { id: source.deal.id } }, property: { connect: { id: source.property.id } }, lead: { connect: { id: source.lead.id } }, ...(source.assignedAgent?.id ? { assignedAgent: { connect: { id: source.assignedAgent.id } } } : {}) }, query: 'id offerNumber' })
      await sudo.query.Offer.updateOne({ where: { id: source.id }, data: { status: 'countered' }, query: 'id' })
      const result = { ok: true, message: 'Counteroffer draft created.', itemId: counter.id }
      return { result, event: { eventType: 'offer.counter_created', brokerageId: source.brokerage.id, aggregateType: 'offer', aggregateId: counter.id, actorId: actorId(scoped), action: 'counter', before: { sourceOfferId: source.id, sourceStatus: source.status }, after: { ...result, offerNumber: counter.offerNumber } } }
    },
  })
}

export async function createChecklistItemCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const dealId = clean(data.dealId), name = clean(data.name), dueAt = clean(data.dueAt), assignedToId = clean(data.assignedToId), notes = clean(data.notes), key = clean(data.idempotencyKey)
  if (!dealId || !name || name.length > 160 || notes.length > 5000 || (dueAt && !Number.isFinite(new Date(dueAt).getTime())) || !validKey(key)) return { ok: false, message: 'Deal, bounded checklist name, and idempotency key are required.', itemId: null, replayed: false }
  const request = { dealId, name, dueAt, assignedToId, notes }
  return runCommand(context, {
    eventKey: `command:deal:${dealId}:checklist:${key}`, lockKey: `aggregate:deal:${dealId}`, permission: 'canManageDeals', request,
    execute: async scoped => {
      const sudo = scoped.sudo() as any
      const deal = await sudo.query.Deal.findOne({ where: { id: dealId }, query: 'id brokerage { id } assignedAgent { id }' })
      if (!deal || !authorized(scoped, deal.brokerage?.id, 'canManageDeals', deal.assignedAgent?.id)) return { result: { ok: false, message: 'Deal not found or access denied.', itemId: null }, event: null as never }
      const item = await sudo.query.TransactionMilestone.createOne({ data: { brokerage: { connect: { id: deal.brokerage.id } }, deal: { connect: { id: deal.id } }, name, status: 'not_started', dueAt: dueAt || null, notes, ...(assignedToId ? { assignedTo: { connect: { id: assignedToId } } } : {}) }, query: 'id' })
      const result = { ok: true, message: 'Checklist item added.', itemId: item.id }
      return { result, event: { eventType: 'transaction.checklist_item_created', brokerageId: deal.brokerage.id, aggregateType: 'deal', aggregateId: deal.id, actorId: actorId(scoped), action: 'create_checklist_item', before: null, after: result } }
    },
  })
}

export async function transitionDocumentCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const documentId = clean(data.documentId), status = clean(data.status), key = clean(data.idempotencyKey)
  // Delivery/signature states are projections of immutable evidence, never
  // manually asserted through a convenience status toggle.
  const allowed: Record<string, string[]> = { draft: ['archived'], sent: ['archived'], signed: ['archived'], archived: [] }
  if (!documentId || !status || !validKey(key)) return { ok: false, message: 'Document, status, and idempotency key are required.', itemId: null, replayed: false }
  const request = { documentId, status }
  return runCommand(context, {
    eventKey: `command:document:${documentId}:status:${key}`, lockKey: `aggregate:document:${documentId}`, permission: 'canManageDeals', request,
    execute: async scoped => {
      const sudo = scoped.sudo() as any
      const document = await sudo.query.DealDocument.findOne({ where: { id: documentId }, query: 'id status brokerage { id } deal { id assignedAgent { id } }' })
      if (!document || !authorized(scoped, document.brokerage?.id, 'canManageDeals', document.deal?.assignedAgent?.id)) return { result: { ok: false, message: 'Document not found or access denied.', itemId: null }, event: null as never }
      if (!allowed[document.status]?.includes(status)) return { result: { ok: false, message: `Cannot transition document from ${document.status} to ${status}.`, itemId: document.id }, event: null as never }
      const now = new Date().toISOString()
      await sudo.query.DealDocument.updateOne({ where: { id: document.id }, data: { status, ...(status === 'sent' ? { sentAt: now } : {}), ...(status === 'signed' ? { signedAt: now } : {}) }, query: 'id' })
      const result = { ok: true, message: 'Document status updated.', itemId: document.id }
      return { result, event: { eventType: 'transaction.document_transitioned', brokerageId: document.brokerage.id, aggregateType: 'dealDocument', aggregateId: document.id, actorId: actorId(scoped), action: 'transition', before: { status: document.status }, after: { ...result, status } } }
    },
  })
}

export async function transitionAgentTaskCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const taskId = clean(data.taskId), status = clean(data.status), key = clean(data.idempotencyKey)
  const allowed: Record<string, string[]> = { open: ['in_progress', 'blocked', 'done'], in_progress: ['open', 'blocked', 'done'], blocked: ['open', 'in_progress', 'done'], done: ['open'] }
  if (!taskId || !status || !validKey(key)) return { ok: false, message: 'Task, status, and idempotency key are required.', itemId: null, replayed: false }
  const request = { taskId, status }
  return runCommand(context, { eventKey: `command:agent-task:${taskId}:status:${key}`, lockKey: `aggregate:agent-task:${taskId}`, permission: 'canManageLeads', request, execute: async scoped => {
    const sudo = scoped.sudo() as any
    const task = await sudo.query.AgentTask.findOne({ where: { id: taskId }, query: 'id status brokerage { id } assignedAgent { id }' })
    if (!task || !authorized(scoped, task.brokerage?.id, 'canManageLeads', task.assignedAgent?.id)) return { result: { ok: false, message: 'Task not found or access denied.', itemId: null }, event: null as never }
    if (task.status === status) return { result: { ok: true, message: 'Task already has that status.', itemId: task.id }, event: { eventType: 'agent_task.transition_replayed', brokerageId: task.brokerage.id, aggregateType: 'agentTask', aggregateId: task.id, actorId: actorId(scoped), action: 'transition', before: { status }, after: { status } } }
    if (!allowed[task.status]?.includes(status)) return { result: { ok: false, message: `Cannot transition task from ${task.status} to ${status}.`, itemId: task.id }, event: null as never }
    const completedAt = status === 'done' ? new Date().toISOString() : null
    await sudo.query.AgentTask.updateOne({ where: { id: task.id }, data: { status, completedAt }, query: 'id' })
    const result = { ok: true, message: 'Task status updated.', itemId: task.id }
    return { result, event: { eventType: 'agent_task.transitioned', brokerageId: task.brokerage.id, aggregateType: 'agentTask', aggregateId: task.id, actorId: actorId(scoped), action: 'transition', before: { status: task.status }, after: { ...result, status, completedAt } } }
  } })
}

export async function transitionInspectionCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const inspectionId = clean(data.inspectionId), status = clean(data.status), key = clean(data.idempotencyKey)
  const allowed: Record<string, string[]> = { scheduled: ['completed', 'needs_follow_up', 'waived'], needs_follow_up: ['completed', 'waived'], completed: ['needs_follow_up'], waived: [] }
  if (!inspectionId || !status || !validKey(key)) return { ok: false, message: 'Inspection, status, and idempotency key are required.', itemId: null, replayed: false }
  const request = { inspectionId, status }
  return runCommand(context, { eventKey: `command:inspection:${inspectionId}:status:${key}`, lockKey: `aggregate:inspection:${inspectionId}`, permission: 'canManageDeals', request, execute: async scoped => {
    const sudo = scoped.sudo() as any
    const inspection = await sudo.query.PropertyInspection.findOne({ where: { id: inspectionId }, query: 'id status deal { id brokerage { id } assignedAgent { id } } property { id brokerage { id } assignedAgent { id } }' })
    const brokerageId = inspection?.deal?.brokerage?.id || inspection?.property?.brokerage?.id
    const ownerId = inspection?.deal?.assignedAgent?.id || inspection?.property?.assignedAgent?.id
    if (!inspection || !brokerageId || !authorized(scoped, brokerageId, 'canManageDeals', ownerId)) return { result: { ok: false, message: 'Inspection not found or access denied.', itemId: null }, event: null as never }
    if (inspection.status === status) return { result: { ok: true, message: 'Inspection already has that status.', itemId: inspection.id }, event: { eventType: 'inspection.transition_replayed', brokerageId, aggregateType: 'propertyInspection', aggregateId: inspection.id, actorId: actorId(scoped), action: 'transition', before: { status }, after: { status } } }
    if (!allowed[inspection.status]?.includes(status)) return { result: { ok: false, message: `Cannot transition inspection from ${inspection.status} to ${status}.`, itemId: inspection.id }, event: null as never }
    const completedAt = status === 'completed' ? new Date().toISOString() : null
    await sudo.query.PropertyInspection.updateOne({ where: { id: inspection.id }, data: { status, completedAt }, query: 'id' })
    const result = { ok: true, message: 'Inspection status updated.', itemId: inspection.id }
    return { result, event: { eventType: 'inspection.transitioned', brokerageId, aggregateType: 'propertyInspection', aggregateId: inspection.id, actorId: actorId(scoped), action: 'transition', before: { status: inspection.status }, after: { ...result, status, completedAt } } }
  } })
}

export async function updateSavedSearchAlertCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const alertId = clean(data.alertId), status = clean(data.status), cadence = clean(data.cadence), key = clean(data.idempotencyKey)
  if (!alertId || !['active', 'paused', 'unsubscribed'].includes(status) || !['instant', 'daily', 'weekly'].includes(cadence) || !validKey(key)) return { ok: false, message: 'Alert, valid preference, and idempotency key are required.', itemId: null, replayed: false }
  const request = { alertId, status, cadence }
  return runCommand(context, { eventKey: `command:saved-search-alert:${alertId}:preference:${key}`, lockKey: `aggregate:saved-search-alert:${alertId}`, permission: 'canManageLeads', request, execute: async scoped => {
    const sudo = scoped.sudo() as any
    const alert = await sudo.query.SavedSearchAlert.findOne({ where: { id: alertId }, query: 'id status cadence brokerage { id } user { id }' })
    if (!alert || !authorized(scoped, alert.brokerage?.id, 'canManageLeads', alert.user?.id)) return { result: { ok: false, message: 'Alert not found or access denied.', itemId: null }, event: null as never }
    await sudo.query.SavedSearchAlert.updateOne({ where: { id: alert.id }, data: { status, cadence }, query: 'id' })
    const result = { ok: true, message: 'Alert preference updated.', itemId: alert.id }
    return { result, event: { eventType: 'saved_search.preference_updated', brokerageId: alert.brokerage.id, aggregateType: 'savedSearchAlert', aggregateId: alert.id, actorId: actorId(scoped), action: 'update_preference', before: { status: alert.status, cadence: alert.cadence }, after: { ...result, status, cadence } } }
  } })
}

export async function queueSavedSearchAlertCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const alertId = clean(data.alertId), key = clean(data.idempotencyKey)
  if (!alertId || !validKey(key)) return { ok: false, message: 'Alert and idempotency key are required.', itemId: null, replayed: false }
  const request = { alertId }
  return runCommand(context, { eventKey: `command:saved-search-alert:${alertId}:queue:${key}`, lockKey: `aggregate:saved-search-alert:${alertId}`, permission: 'canManageLeads', request, execute: async scoped => {
    const sudo = scoped.sudo() as any
    const alert = await sudo.query.SavedSearchAlert.findOne({ where: { id: alertId }, query: 'id status brokerage { id } savedSearch { id } user { id }' })
    if (!alert || alert.status !== 'active' || !authorized(scoped, alert.brokerage?.id, 'canManageLeads', alert.user?.id)) return { result: { ok: false, message: 'Active alert not found or access denied.', itemId: null }, event: null as never }
    const result = { ok: true, message: 'Alert delivery recorded.', itemId: alert.id }
    return { result, event: { eventType: 'saved_search.alert_queued', brokerageId: alert.brokerage.id, aggregateType: 'savedSearchAlert', aggregateId: alert.id, actorId: actorId(scoped), action: 'queue_alert', before: null, after: result } }
  } })
}

export async function transitionListingSyndicationCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const syndicationId = clean(data.syndicationId), status = clean(data.status), providerReference = clean(data.providerReference), reason = clean(data.reason), key = clean(data.idempotencyKey)
  const allowed: Record<string, string[]> = { draft: ['published', 'error', 'removed'], published: ['error', 'removed'], error: ['published', 'removed'], removed: [] }
  if (!syndicationId || !status || providerReference.length > 500 || !reason || reason.length > 5000 || !validKey(key)) return { ok: false, message: 'Syndication, status, reason, and bounded idempotency key are required.', itemId: null, replayed: false }
  const request = { syndicationId, status, providerReference, reason }
  return runCommand(context, { eventKey: `command:listing-syndication:${syndicationId}:status:${key}`, lockKey: `aggregate:listing-syndication:${syndicationId}`, permission: 'canManageListings', request, execute: async scoped => {
    const sudo = scoped.sudo() as any
    const item = await sudo.query.ListingSyndication.findOne({ where: { id: syndicationId }, query: 'id status channel brokerage { id } property { id state assignedAgent { id } }' })
    if (!item || !authorized(scoped, item.brokerage?.id, 'canManageListings', item.property?.assignedAgent?.id)) return { result: { ok: false, message: 'Syndication not found or access denied.', itemId: null }, event: null as never }
    item.property = await lockAndRefreshProperty(scoped, item.property.id, item.brokerage.id)
    if (!authorized(scoped, item.brokerage.id, 'canManageListings', item.property.assignedAgent?.id)) return { result: { ok: false, message: 'Syndication authority changed.', itemId: null }, event: null as never }
    if (!allowed[item.status]?.includes(status)) return { result: { ok: false, message: `Cannot transition syndication from ${item.status} to ${status}.`, itemId: item.id }, event: null as never }
    if (status === 'published') {
      const destination = item.channel === 'mls' ? 'mls' : item.channel === 'website' ? 'public_site' : 'syndication'
      try {
        await requireListingAuthority(scoped, { brokerageId: item.brokerage.id, propertyId: item.property.id, practitionerId: item.property.assignedAgent?.id || '', jurisdictionCode: item.property.state, destination })
      } catch (error) {
        return { result: { ok: false, message: error instanceof Error ? error.message : 'Publication authority is required.', itemId: item.id }, event: null as never }
      }
    }
    await sudo.query.ListingSyndication.updateOne({ where: { id: item.id }, data: { status, ...(status === 'published' || status === 'removed' ? { errorMessage: null } : {}), ...(status === 'error' ? { errorMessage: reason } : {}), metadata: { providerReference: providerReference || null, evidenceOnly: true } }, query: 'id' })
    const message = status === 'published'
      ? 'Listing marked as published.'
      : status === 'removed'
        ? 'Listing marked as removed.'
        : 'Syndication error recorded.'
    const result = { ok: true, message, itemId: item.id }
    return { result, event: { eventType: 'listing_syndication.local_status_reported', brokerageId: item.brokerage.id, aggregateType: 'listingSyndication', aggregateId: item.id, actorId: actorId(scoped), action: 'record_local_status', before: { status: item.status }, after: { ...result, status, providerReference, verification: 'unverified' } } }
  } })
}

export async function queueSourceImportCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const sourceFeedId = clean(data.sourceFeedId), mode = clean(data.mode) || 'incremental', key = clean(data.idempotencyKey)
  if (!sourceFeedId || !['incremental', 'full', 'dry_run'].includes(mode) || !validKey(key)) return { ok: false, message: 'Source feed, valid mode, and idempotency key are required.', itemId: null, replayed: false }
  const request = { sourceFeedId, mode }
  return runCommand(context, { eventKey: `command:source-feed:${sourceFeedId}:import:${key}`, lockKey: `aggregate:source-feed:${sourceFeedId}`, permission: 'canManageListings', request, execute: async scoped => {
    const sudo = scoped.sudo() as any
    const feed = await sudo.query.SourceFeed.findOne({ where: { id: sourceFeedId }, query: 'id name status brokerage { id }' })
    if (!feed || feed.status !== 'active' || !authorized(scoped, feed.brokerage?.id, 'canManageListings')) return { result: { ok: false, message: 'Active source feed not found or access denied.', itemId: null }, event: null as never }
    const result = { ok: true, message: `${mode === 'dry_run' ? 'Dry run' : mode === 'full' ? 'Full' : 'Incremental'} import queued.`, itemId: feed.id }
    return { result, event: { eventType: 'integration.import_queued', brokerageId: feed.brokerage.id, aggregateType: 'sourceFeed', aggregateId: feed.id, actorId: actorId(scoped), action: 'queue_import', before: null, after: { ...result, mode } } }
  } })
}
