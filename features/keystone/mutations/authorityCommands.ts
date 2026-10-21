import crypto from 'node:crypto'
import type { Context } from '.keystone/types'

import { boundedIdempotencyKey, boundedReason, isSha256, requirePractitionerLicense } from '../lib/authorityEvidence'
import { normalizeDomainJson } from '../lib/domainEvents'
import { evidenceActorId, evidenceBrokerageId, runControlledEvidenceCommand } from './controlledEvidenceCommand'

function clean(value: unknown) { return String(value || '').trim() }
function timestamp(value: unknown, label: string) {
  const date = new Date(clean(value))
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} must be a valid timestamp.`)
  return date.toISOString()
}
function effectiveRange(fromValue: unknown, throughValue: unknown) {
  const effectiveFrom = timestamp(fromValue, 'Effective from')
  const effectiveThrough = timestamp(throughValue, 'Effective through')
  if (new Date(effectiveFrom) >= new Date(effectiveThrough)) throw new Error('Effective through must be after effective from.')
  return { effectiveFrom, effectiveThrough }
}
function suffix(key: string) { return crypto.createHash('sha256').update(key).digest('hex').slice(0, 12).toUpperCase() }

export async function recordPractitionerLicenseAuthorityCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const practitionerId = clean(data.practitionerId), licenseNumber = clean(data.licenseNumber), licenseType = clean(data.licenseType), jurisdictionCode = clean(data.jurisdictionCode).toUpperCase(), status = clean(data.status), verificationSource = clean(data.verificationSource), restrictions = clean(data.restrictions), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey)
  const range = effectiveRange(data.effectiveFrom, data.effectiveThrough)
  const verifiedAt = timestamp(data.verifiedAt, 'Verified at')
  if (new Date(verifiedAt) > new Date()) throw new Error('License verification time cannot be in the future.')
  if (!practitionerId || !licenseNumber || licenseNumber.length > 120 || !['broker', 'associate_broker', 'sales_agent'].includes(licenseType) || !/^[A-Z]{2}(?:-[A-Z0-9-]{1,20})?$/.test(jurisdictionCode) || !['verified_active', 'restricted', 'inactive', 'expired', 'suspended', 'revoked'].includes(status) || !verificationSource || verificationSource.length > 500 || restrictions.length > 5000) throw new Error('Valid bounded practitioner-license evidence is required.')
  const brokerageId = evidenceBrokerageId(context) || ''
  const request = { practitionerId, licenseNumber, licenseType, jurisdictionCode, status, ...range, verifiedAt, verificationSource, restrictions, reason }
  return runControlledEvidenceCommand(context, {
    eventKey: `command:license:${practitionerId}:${jurisdictionCode}:${key}`, lockKey: `authority:license:${practitionerId}:${jurisdictionCode}`, permission: 'canManagePeople', managerRequired: true, request,
    execute: async scoped => {
      const sudo = scoped.sudo() as any
      const [practitioner, prior] = await Promise.all([
        sudo.query.User.findOne({ where: { id: practitionerId }, query: 'id brokerageMemberships(where: { status: { equals: active } }) { brokerage { id status } }' }),
        sudo.query.PractitionerLicenseAuthority.findMany({ where: { brokerage: { id: { equals: brokerageId } }, practitioner: { id: { equals: practitionerId } }, jurisdictionCode: { equals: jurisdictionCode } }, orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }], take: 1, query: 'id' }),
      ])
      if (!(practitioner?.brokerageMemberships || []).some((membership: any) => membership.brokerage?.id === brokerageId && membership.brokerage?.status === 'active')) return { result: { ok: false, message: 'Practitioner is not an active brokerage member.', itemId: null }, event: null as never }
      const item = await sudo.query.PractitionerLicenseAuthority.createOne({ data: { brokerage: { connect: { id: brokerageId } }, practitioner: { connect: { id: practitionerId } }, licenseNumber, licenseType, jurisdictionCode, status, ...range, verifiedAt, verificationSource, restrictions, ...(prior[0]?.id ? { supersedes: { connect: { id: prior[0].id } } } : {}), reason, verifiedBy: { connect: { id: evidenceActorId(scoped)! } } }, query: 'id' })
      const result = { ok: true, message: 'Practitioner license authority evidence appended.', itemId: item.id }
      return { result, event: { eventType: 'authority.practitioner_license_recorded', brokerageId, aggregateType: 'practitionerLicenseAuthority', aggregateId: item.id, actorId: evidenceActorId(scoped), action: 'record', before: prior[0] || null, after: { ...result, practitionerId, jurisdictionCode, status } } }
    },
  })
}

export async function recordListingEngagementAuthorityCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const propertyId = clean(data.propertyId), practitionerId = clean(data.practitionerId), status = clean(data.status), jurisdictionCode = clean(data.jurisdictionCode).toUpperCase(), signatoryCapacity = clean(data.signatoryCapacity), documentSha256 = clean(data.documentSha256).toLowerCase(), providerReference = clean(data.providerReference), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey)
  const range = effectiveRange(data.effectiveFrom, data.effectiveThrough)
  if (!propertyId || !practitionerId || !['executed', 'revoked', 'expired'].includes(status) || !jurisdictionCode || !signatoryCapacity || signatoryCapacity.length > 500 || !isSha256(documentSha256) || providerReference.length > 500) throw new Error('Valid listing-engagement authority evidence is required.')
  const brokerageId = evidenceBrokerageId(context) || ''
  const sellerPartySummary = normalizeDomainJson(data.sellerPartySummary || null)
  const request = { propertyId, practitionerId, status, jurisdictionCode, ...range, exclusive: Boolean(data.exclusive), marketingAuthorized: Boolean(data.marketingAuthorized), showingAuthorized: Boolean(data.showingAuthorized), sellerPartySummary, signatoryCapacity, documentSha256, providerReference, reason }
  return runControlledEvidenceCommand(context, {
    eventKey: `command:listing-engagement:${propertyId}:${key}`, lockKey: `authority:listing:${propertyId}`, permission: 'canManageListings', managerRequired: true, request,
    execute: async scoped => {
      const sudo = scoped.sudo() as any
      const [property, prior] = await Promise.all([
        sudo.query.Property.findOne({ where: { id: propertyId }, query: 'id state brokerage { id } assignedAgent { id }' }),
        sudo.query.ListingEngagementAuthority.findMany({ where: { brokerage: { id: { equals: brokerageId } }, property: { id: { equals: propertyId } } }, orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }], take: 1, query: 'id' }),
      ])
      if (!property || property.brokerage?.id !== brokerageId || property.assignedAgent?.id !== practitionerId || property.state.toUpperCase() !== jurisdictionCode) return { result: { ok: false, message: 'Property, practitioner, and jurisdiction authority do not align.', itemId: null }, event: null as never }
      if (status === 'executed') await requirePractitionerLicense(scoped, { brokerageId, practitionerId, jurisdictionCode })
      const item = await sudo.query.ListingEngagementAuthority.createOne({ data: { brokerage: { connect: { id: brokerageId } }, authorityNumber: `LE-${suffix(key)}`, property: { connect: { id: propertyId } }, assignedPractitioner: { connect: { id: practitionerId } }, status, jurisdictionCode, ...range, exclusive: request.exclusive, marketingAuthorized: request.marketingAuthorized, showingAuthorized: request.showingAuthorized, sellerPartySummary: request.sellerPartySummary, signatoryCapacity, documentSha256, documentProviderReference: providerReference, ...(prior[0]?.id ? { supersedes: { connect: { id: prior[0].id } } } : {}), reason, recordedBy: { connect: { id: evidenceActorId(scoped)! } }, recordedAt: new Date().toISOString() }, query: 'id' })
      const result = { ok: true, message: 'Listing engagement authority evidence appended.', itemId: item.id }
      return { result, event: { eventType: 'authority.listing_engagement_recorded', brokerageId, aggregateType: 'listingEngagementAuthority', aggregateId: item.id, actorId: evidenceActorId(scoped), action: 'record', before: prior[0] || null, after: { ...result, propertyId, status } } }
    },
  })
}

export async function recordListingPublicationAuthorityCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const propertyId = clean(data.propertyId), engagementId = clean(data.engagementId), destination = clean(data.destination), status = clean(data.status), authorityBasis = clean(data.authorityBasis), localRuleReference = clean(data.localRuleReference), dataUseGrantReference = clean(data.dataUseGrantReference), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey)
  const range = effectiveRange(data.effectiveFrom, data.effectiveThrough)
  if (!propertyId || !engagementId || !['public_site', 'mls', 'idx', 'syndication'].includes(destination) || !['authorized', 'revoked', 'expired'].includes(status) || !authorityBasis || authorityBasis.length > 1000 || localRuleReference.length > 500 || dataUseGrantReference.length > 500) throw new Error('Valid publication-authority evidence is required.')
  const brokerageId = evidenceBrokerageId(context) || ''
  const request = { propertyId, engagementId, destination, status, ...range, authorityBasis, localRuleReference, dataUseGrantReference, reason }
  return runControlledEvidenceCommand(context, {
    eventKey: `command:listing-publication:${propertyId}:${destination}:${key}`, lockKey: `authority:listing:${propertyId}`, permission: 'canManageListings', managerRequired: true, request,
    execute: async scoped => {
      const sudo = scoped.sudo() as any
      const [property, engagement, prior] = await Promise.all([
        sudo.query.Property.findOne({ where: { id: propertyId }, query: 'id brokerage { id }' }),
        sudo.query.ListingEngagementAuthority.findOne({ where: { id: engagementId }, query: 'id status effectiveFrom effectiveThrough marketingAuthorized brokerage { id } property { id }' }),
        sudo.query.ListingPublicationAuthority.findMany({ where: { brokerage: { id: { equals: brokerageId } }, property: { id: { equals: propertyId } }, destination: { equals: destination } }, orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }], take: 1, query: 'id' }),
      ])
      if (!property || property.brokerage?.id !== brokerageId || !engagement || engagement.brokerage?.id !== brokerageId || engagement.property?.id !== propertyId || new Date(range.effectiveFrom) < new Date(engagement.effectiveFrom) || new Date(range.effectiveThrough) > new Date(engagement.effectiveThrough) || (status === 'authorized' && (engagement.status !== 'executed' || !engagement.marketingAuthorized))) return { result: { ok: false, message: 'An aligned executed listing engagement is required.', itemId: null }, event: null as never }
      const item = await sudo.query.ListingPublicationAuthority.createOne({ data: { brokerage: { connect: { id: brokerageId } }, authorityNumber: `PA-${suffix(key)}`, property: { connect: { id: propertyId } }, engagement: { connect: { id: engagementId } }, destination, status, ...range, authorityBasis, localRuleReference, dataUseGrantReference, ...(prior[0]?.id ? { supersedes: { connect: { id: prior[0].id } } } : {}), reason, recordedBy: { connect: { id: evidenceActorId(scoped)! } }, recordedAt: new Date().toISOString() }, query: 'id' })
      const result = { ok: true, message: 'Listing publication authority evidence appended.', itemId: item.id }
      return { result, event: { eventType: 'authority.listing_publication_recorded', brokerageId, aggregateType: 'listingPublicationAuthority', aggregateId: item.id, actorId: evidenceActorId(scoped), action: 'record', before: prior[0] || null, after: { ...result, propertyId, destination, status } } }
    },
  })
}

export async function recordRepresentationAuthorityCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const leadId = clean(data.leadId), propertyId = clean(data.propertyId), dealId = clean(data.dealId), practitionerId = clean(data.practitionerId), side = clean(data.side), relationshipType = clean(data.relationshipType), jurisdictionCode = clean(data.jurisdictionCode).toUpperCase(), status = clean(data.status), scopeSummary = clean(data.scopeSummary), documentSha256 = clean(data.documentSha256).toLowerCase(), disclosureVersion = clean(data.disclosureVersion), reason = boundedReason(data.reason), key = boundedIdempotencyKey(data.idempotencyKey)
  const range = effectiveRange(data.effectiveFrom, data.effectiveThrough)
  const consentRecordedAt = timestamp(data.consentRecordedAt, 'Consent recorded at')
  if (!leadId || !practitionerId || !['buyer', 'seller'].includes(side) || !['exclusive_agency', 'nonexclusive_agency', 'transaction_brokerage', 'customer_assistance'].includes(relationshipType) || !['executed', 'terminated', 'expired'].includes(status) || !jurisdictionCode || !scopeSummary || scopeSummary.length > 5000 || !isSha256(documentSha256) || !disclosureVersion || disclosureVersion.length > 300) throw new Error('Valid representation-authority evidence is required.')
  const brokerageId = evidenceBrokerageId(context) || ''
  const request = { leadId, propertyId, dealId, practitionerId, side, relationshipType, jurisdictionCode, status, ...range, scopeSummary, documentSha256, disclosureVersion, consentRecordedAt, reason }
  return runControlledEvidenceCommand(context, {
    eventKey: `command:representation:${leadId}:${key}`, lockKey: `authority:representation:${leadId}`, permission: 'canManageDeals', managerRequired: true, request,
    execute: async scoped => {
      const sudo = scoped.sudo() as any
      const [lead, property, deal, prior] = await Promise.all([
        sudo.query.Lead.findOne({ where: { id: leadId }, query: 'id brokerage { id }' }),
        propertyId ? sudo.query.Property.findOne({ where: { id: propertyId }, query: 'id state brokerage { id }' }) : null,
        dealId ? sudo.query.Deal.findOne({ where: { id: dealId }, query: 'id transactionType brokerage { id } lead { id } property { id }' }) : null,
        sudo.query.RepresentationAuthority.findMany({ where: { brokerage: { id: { equals: brokerageId } }, lead: { id: { equals: leadId } }, practitioner: { id: { equals: practitionerId } }, side: { equals: side } }, orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }], take: 1, query: 'id' }),
      ])
      if (!lead || lead.brokerage?.id !== brokerageId || (propertyId && (!property || property.brokerage?.id !== brokerageId || property.state.toUpperCase() !== jurisdictionCode)) || (dealId && (!deal || deal.brokerage?.id !== brokerageId || deal.lead?.id !== leadId || (propertyId && deal.property?.id !== propertyId)))) return { result: { ok: false, message: 'Representation parties and scope do not align within the brokerage.', itemId: null }, event: null as never }
      if (status === 'executed') await requirePractitionerLicense(scoped, { brokerageId, practitionerId, jurisdictionCode })
      const item = await sudo.query.RepresentationAuthority.createOne({ data: { brokerage: { connect: { id: brokerageId } }, authorityNumber: `RA-${suffix(key)}`, lead: { connect: { id: leadId } }, ...(propertyId ? { property: { connect: { id: propertyId } } } : {}), ...(dealId ? { deal: { connect: { id: dealId } } } : {}), practitioner: { connect: { id: practitionerId } }, side, relationshipType, jurisdictionCode, status, ...range, scopeSummary, documentSha256, disclosureVersion, consentRecordedAt, ...(prior[0]?.id ? { supersedes: { connect: { id: prior[0].id } } } : {}), reason, recordedBy: { connect: { id: evidenceActorId(scoped)! } }, recordedAt: new Date().toISOString() }, query: 'id' })
      const result = { ok: true, message: 'Representation authority evidence appended.', itemId: item.id }
      return { result, event: { eventType: 'authority.representation_recorded', brokerageId, aggregateType: 'representationAuthority', aggregateId: item.id, actorId: evidenceActorId(scoped), action: 'record', before: prior[0] || null, after: { ...result, leadId, side, status } } }
    },
  })
}
