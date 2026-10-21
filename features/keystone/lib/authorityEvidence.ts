import type { Context } from '.keystone/types'

import { decisionRows } from './commandContext'

const SHA256 = /^[a-f0-9]{64}$/i

export class ListingAuthorityDeniedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ListingAuthorityDeniedError'
  }
}

export function isSha256(value: unknown) {
  return SHA256.test(String(value || '').trim())
}

export function boundedReason(value: unknown) {
  const reason = String(value || '').trim()
  if (!reason || reason.length > 5000) throw new Error('A bounded reason is required.')
  return reason
}

export function boundedIdempotencyKey(value: unknown) {
  const key = String(value || '').trim()
  if (!key || key.length > 120) throw new Error('A bounded idempotency key is required.')
  return key
}

export function authorityIsEffective(item: any, at = new Date()) {
  const from = new Date(item?.effectiveFrom || 0)
  const through = new Date(item?.effectiveThrough || 0)
  return Number.isFinite(from.getTime()) && Number.isFinite(through.getTime()) && from <= at && through >= at
}

export async function requirePractitionerLicense(
  context: Context,
  input: { brokerageId: string; practitionerId: string; jurisdictionCode: string; at?: Date }
) {
  const rows = await (context.sudo() as any).query.PractitionerLicenseAuthority.findMany({
    where: {
      brokerage: { id: { equals: input.brokerageId } },
      practitioner: { id: { equals: input.practitionerId } },
      jurisdictionCode: { equals: input.jurisdictionCode.toUpperCase() },
    },
    orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    take: 1,
    query: 'id status effectiveFrom effectiveThrough verifiedAt verificationSource restrictions',
  })
  const latest = rows[0]
  const evaluatedAt = input.at || new Date()
  if (!latest || latest.status !== 'verified_active' || !authorityIsEffective(latest, evaluatedAt) || !latest.verifiedAt || new Date(latest.verifiedAt) > evaluatedAt || !latest.verificationSource) {
    throw new ListingAuthorityDeniedError('A current verified practitioner license is required for this jurisdictional action.')
  }
  return latest
}

export async function requireListingAuthority(
  context: Context,
  input: { brokerageId: string; propertyId: string; practitionerId: string; jurisdictionCode: string; destination: 'public_site' | 'mls' | 'idx' | 'syndication'; showingRequired?: boolean; at?: Date }
) {
  await requirePractitionerLicense(context, input)
  const engagements = await (context.sudo() as any).query.ListingEngagementAuthority.findMany({
    where: { brokerage: { id: { equals: input.brokerageId } }, property: { id: { equals: input.propertyId } } },
    orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    take: 1,
    query: 'id status effectiveFrom effectiveThrough marketingAuthorized showingAuthorized documentSha256 assignedPractitioner { id }',
  })
  const engagement = engagements[0]
  if (!engagement || engagement.status !== 'executed' || !authorityIsEffective(engagement, input.at) || !engagement.marketingAuthorized || (input.showingRequired && !engagement.showingAuthorized) || !isSha256(engagement.documentSha256) || engagement.assignedPractitioner?.id !== input.practitionerId) {
    throw new ListingAuthorityDeniedError('An effective signed listing engagement with marketing authority is required.')
  }
  const publications = await (context.sudo() as any).query.ListingPublicationAuthority.findMany({
    where: {
      brokerage: { id: { equals: input.brokerageId } },
      property: { id: { equals: input.propertyId } },
      destination: { equals: input.destination },
    },
    orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    take: 1,
    query: 'id status effectiveFrom effectiveThrough authorityBasis engagement { id }',
  })
  const publication = publications[0]
  if (!publication || publication.status !== 'authorized' || !authorityIsEffective(publication, input.at) || publication.engagement?.id !== engagement.id || !publication.authorityBasis) {
    throw new ListingAuthorityDeniedError(`Effective ${input.destination} publication authority is required.`)
  }
  return { engagement, publication }
}

export async function requireRepresentationAuthority(
  context: Context,
  input: { brokerageId: string; leadId: string; practitionerId: string; jurisdictionCode: string; side: 'buyer' | 'seller'; propertyId?: string | null; dealId?: string | null; allowCustomerAssistance?: boolean; at?: Date }
) {
  await requirePractitionerLicense(context, input)
  const rows = await (context.sudo() as any).query.RepresentationAuthority.findMany({
    where: {
      brokerage: { id: { equals: input.brokerageId } },
      lead: { id: { equals: input.leadId } },
      practitioner: { id: { equals: input.practitionerId } },
      jurisdictionCode: { equals: input.jurisdictionCode.toUpperCase() },
      side: { equals: input.side },
      ...(input.propertyId ? { property: { id: { equals: input.propertyId } } } : {}),
    },
    orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    take: 1,
    query: 'id status relationshipType effectiveFrom effectiveThrough documentSha256 consentRecordedAt property { id } deal { id }',
  })
  const authority = rows[0]
  const permittedRelationship = input.allowCustomerAssistance
    ? ['exclusive_agency', 'nonexclusive_agency', 'transaction_brokerage', 'customer_assistance'].includes(authority?.relationshipType)
    : ['exclusive_agency', 'nonexclusive_agency', 'transaction_brokerage'].includes(authority?.relationshipType)
  if (!authority || authority.status !== 'executed' || !authorityIsEffective(authority, input.at) || !permittedRelationship || !isSha256(authority.documentSha256) || !authority.consentRecordedAt || (input.dealId && authority.deal?.id && authority.deal.id !== input.dealId)) {
    throw new Error('An effective jurisdiction-specific representation authority is required for this action.')
  }
  return authority
}

export function evidenceComplete(events: readonly any[], required: readonly string[]) {
  // A DealDocument is one immutable byte/template version. New bytes require a
  // new document, never a reset of the existing history. Invalidation wins.
  if (events.some(event => event.eventType === 'voided')) return false
  if (!required.every(type => events.some(event => event.eventType === type))) return false
  const hashes = new Set(events.map(event => event.documentSha256))
  const templates = new Set(events.map(event => event.templateSha256))
  return hashes.size === 1 && templates.size === 1 && [...hashes].every(isSha256) && [...templates].every(isSha256)
}

export async function requireOfferEvidenceChain(context: Context, input: { dealId: string; offerId: string }) {
  const documents = await decisionRows((context.sudo() as any).query.DealDocument, {
    where: { deal: { id: { equals: input.dealId } }, documentType: { equals: 'offer' } },
    orderBy: [{ id: 'asc' }],
    query: 'id status fileUrl sentAt signedAt createdAt',
  })
  const candidates = []
  for (const document of documents) {
    // Read the whole document, including void events without an offer link.
    const history = await decisionRows((context.sudo() as any).query.DocumentEvidenceEvent, {
      where: { document: { id: { equals: document.id } } },
      orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      query: 'id eventType documentSha256 templateSha256 offer { id } recipients channel provider providerReference occurredAt acknowledgedAt acknowledgementReference',
    })
    const events = history.filter(event => event.offer?.id === input.offerId)
    // Legacy unbound evidence is not silently promoted to a different offer.
    if (events.length) candidates.push({ document, history, events })
  }
  if (!candidates.length) throw new Error('Immutable signed, delivered, presented, and acknowledged offer evidence is required; legal effect remains subject to broker or counsel review.')
  if (candidates.length > 1) throw new Error('More than one current offer document was found. Archive the outdated version and try again.')
  const candidate = candidates[0]
  if (!candidate || candidate.document.status !== 'signed' || !candidate.document.fileUrl || !candidate.document.sentAt || !candidate.document.signedAt || !Number.isFinite(new Date(candidate.document.createdAt).getTime()) || !Number.isFinite(new Date(candidate.document.signedAt).getTime()) || candidate.history.some(event => event.eventType === 'voided')) {
    throw new Error('Immutable signed, delivered, presented, and acknowledged offer evidence is required; legal effect remains subject to broker or counsel review.')
  }
  const { document, events } = candidate
  const hasRecipients = events.filter(event => ['delivered', 'received', 'presented', 'acknowledged'].includes(event.eventType)).every(event => Array.isArray(event.recipients) && event.recipients.length > 0)
  const acknowledged = events.some(event => event.eventType === 'acknowledged' && event.acknowledgedAt && event.acknowledgementReference)
  if (evidenceComplete(events, ['signed', 'delivered', 'presented', 'acknowledged']) && hasRecipients && acknowledged && events.every(event => event.provider && event.providerReference)) return { document, events }
  throw new Error('Immutable signed, delivered, presented, and acknowledged offer evidence is required; legal effect remains subject to broker or counsel review.')
}

export async function requireClosingEvidenceChain(context: Context, dealId: string) {
  const documents = await decisionRows((context.sudo() as any).query.DealDocument, {
    where: { deal: { id: { equals: dealId } }, documentType: { equals: 'closing_statement' } },
    orderBy: [{ createdAt: 'desc' }, { signedAt: 'desc' }, { id: 'desc' }],
    query: 'id status fileUrl signedAt',
  })
  // DealDocument has no explicit supersedes/current-version relation. Never
  // guess which statement supersedes another or fall back to an older chain.
  const document = documents[0]
  if (documents.length !== 1 || document?.status !== 'signed' || !document.fileUrl || !document.signedAt || !Number.isFinite(new Date(document.signedAt).getTime())) {
    throw new Error('Immutable signed and acknowledged closing evidence is required; settlement and funds remain provider-authoritative.')
  }
  const events = await decisionRows((context.sudo() as any).query.DocumentEvidenceEvent, {
    where: { document: { id: { equals: document.id } }, deal: { id: { equals: dealId } } },
    orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    query: 'id eventType documentSha256 templateSha256 recipients channel provider providerReference occurredAt acknowledgedAt acknowledgementReference',
  })
  if (evidenceComplete(events, ['signed', 'acknowledged']) && events.some(event => event.eventType === 'acknowledged' && event.acknowledgedAt && event.acknowledgementReference)) return { document, events }
  throw new Error('Immutable signed and acknowledged closing evidence is required; settlement and funds remain provider-authoritative.')
}
