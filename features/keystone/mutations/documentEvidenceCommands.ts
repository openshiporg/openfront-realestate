import crypto from 'node:crypto'
import type { Context } from '.keystone/types'

import { boundedIdempotencyKey, boundedReason, isSha256 } from '../lib/authorityEvidence'
import { decisionRows } from '../lib/commandContext'
import { commandText } from '../../lib/date-time'
import { evidenceActorId, evidenceBrokerageId, evidenceRole, runControlledEvidenceCommand } from './controlledEvidenceCommand'

function clean(value: unknown) { return commandText(value) }
function validTimestamp(value: unknown, required = true) {
  const raw = clean(value)
  if (!raw && !required) return ''
  const date = new Date(raw)
  if (!Number.isFinite(date.getTime())) throw new Error('A valid evidence timestamp is required.')
  return date.toISOString()
}
function validateRecipients(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 25) throw new Error('One to 25 bounded evidence recipients are required.')
  return value.map((recipient: any) => {
    const name = clean(recipient?.name), address = clean(recipient?.address), role = clean(recipient?.role)
    if (!name || name.length > 160 || !address || address.length > 320 || !role || role.length > 100) throw new Error('Each evidence recipient requires bounded name, address, and role values.')
    return { name, address, role }
  })
}

export async function appendDocumentEvidenceEventCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const documentId = clean(data.documentId), offerId = clean(data.offerId), eventType = clean(data.eventType), documentSha256 = clean(data.documentSha256).toLowerCase(), templateSha256 = clean(data.templateSha256).toLowerCase(), certificateSha256 = clean(data.certificateSha256).toLowerCase(), channel = clean(data.channel), provider = clean(data.provider), providerReference = clean(data.providerReference), acknowledgementReference = clean(data.acknowledgementReference), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey)
  const occurredAt = validTimestamp(data.occurredAt)
  const providerReportedAt = validTimestamp(data.providerReportedAt, false)
  const acknowledgedAt = validTimestamp(data.acknowledgedAt, false)
  const recipients = validateRecipients(data.recipients)
  const allowedEvents = ['generated', 'signed', 'delivered', 'received', 'presented', 'acknowledged', 'voided']
  const allowedChannels = ['esign', 'email', 'portal', 'in_person', 'other']
  if (!documentId || !allowedEvents.includes(eventType) || !isSha256(documentSha256) || !isSha256(templateSha256) || (eventType === 'signed' && !isSha256(certificateSha256)) || !allowedChannels.includes(channel) || !provider || provider.length > 160 || !providerReference || providerReference.length > 500 || (eventType === 'acknowledged' && (!acknowledgedAt || !acknowledgementReference))) throw new Error('Complete immutable document evidence is required.')
  const brokerageId = evidenceBrokerageId(context) || ''
  const request = { documentId, offerId, eventType, documentSha256, templateSha256, certificateSha256, recipients, channel, provider, providerReference, occurredAt, providerReportedAt, acknowledgedAt, acknowledgementReference, reason }
  return runControlledEvidenceCommand(context, {
    eventKey: `command:document-evidence:${documentId}:${key}`, lockKey: `evidence:document:${documentId}`, permission: 'canManageDeals', request,
    execute: async scoped => {
      const sudo = scoped.sudo() as any
      const [document, offer, prior] = await Promise.all([
        sudo.query.DealDocument.findOne({ where: { id: documentId }, query: 'id documentType brokerage { id } deal { id assignedAgent { id } }' }),
        offerId ? sudo.query.Offer.findOne({ where: { id: offerId }, query: 'id deal { id } brokerage { id }' }) : null,
        decisionRows(sudo.query.DocumentEvidenceEvent, { where: { document: { id: { equals: documentId } } }, orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }], query: 'id eventType documentSha256 templateSha256 occurredAt' }),
      ])
      const actor = evidenceActorId(scoped)
      if (!document || document.brokerage?.id !== brokerageId || (!evidenceRole(scoped).canManagePeople && document.deal?.assignedAgent?.id !== actor) || (offerId && (!offer || offer.brokerage?.id !== brokerageId || offer.deal?.id !== document.deal?.id))) return { result: { ok: false, message: 'Document, offer, or assignment scope is invalid.', itemId: null }, event: null as never }
      if (prior.some((event: any) => event.eventType !== 'voided' && (event.documentSha256 !== documentSha256 || event.templateSha256 !== templateSha256))) return { result: { ok: false, message: 'Evidence hashes do not match the immutable document version.', itemId: null }, event: null as never }
      const eventTypes = new Set(prior.map((event: any) => event.eventType))
      const predecessor: Record<string, string | undefined> = { signed: 'generated', delivered: 'signed', received: 'delivered', presented: 'received', acknowledged: 'presented' }
      if (predecessor[eventType] && !eventTypes.has(predecessor[eventType])) return { result: { ok: false, message: `${eventType} evidence requires prior ${predecessor[eventType]} evidence.`, itemId: null }, event: null as never }
      if (eventTypes.has('voided') && eventType !== 'voided') return { result: { ok: false, message: 'Voided document evidence cannot be extended.', itemId: null }, event: null as never }
      if (prior.length && new Date(occurredAt) < new Date(prior[prior.length - 1].occurredAt)) return { result: { ok: false, message: 'Evidence chronology cannot move backward.', itemId: null }, event: null as never }
      const eventKey = `DE-${crypto.createHash('sha256').update(`${documentId}:${key}`).digest('hex').slice(0, 24)}`
      const item = await sudo.query.DocumentEvidenceEvent.createOne({ data: { brokerage: { connect: { id: brokerageId } }, eventKey, document: { connect: { id: documentId } }, deal: { connect: { id: document.deal.id } }, ...(offerId ? { offer: { connect: { id: offerId } } } : {}), eventType, documentSha256, templateSha256, certificateSha256: certificateSha256 || null, recipients, channel, provider, providerReference, occurredAt, providerReportedAt: providerReportedAt || null, acknowledgedAt: acknowledgedAt || null, acknowledgementReference: acknowledgementReference || null, reason, actor: { connect: { id: actor! } } }, query: 'id' })
      if (eventType === 'signed') await sudo.query.DealDocument.updateOne({ where: { id: documentId }, data: { status: 'signed', signedAt: occurredAt }, query: 'id' })
      if (eventType === 'delivered') await sudo.query.DealDocument.updateOne({ where: { id: documentId }, data: { sentAt: occurredAt }, query: 'id' })
      if (eventType === 'voided') await sudo.query.DealDocument.updateOne({ where: { id: documentId }, data: { status: 'archived' }, query: 'id' })
      const result = { ok: true, message: 'Immutable document evidence appended; provider and legal effect remain externally authoritative.', itemId: item.id }
      return { result, event: { eventType: `document_evidence.${eventType}`, brokerageId, aggregateType: 'dealDocument', aggregateId: documentId, actorId: actor, action: eventType, before: prior[prior.length - 1] || null, after: { ...result, documentSha256, templateSha256, providerReference } } }
    },
  })
}
