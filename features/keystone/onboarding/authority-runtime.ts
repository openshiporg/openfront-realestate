import crypto from 'node:crypto'

import type { SeedContext, SeedTarget } from './seed-runtime'

type AuthoritySeed = {
  recorderEmail: string
  jurisdictionCode: string
  effectiveFrom: string
  effectiveThrough: string
  verifiedAt: string
  practitioners: Array<{ key: string; email: string; licenseType: string; licenseNumber: string }>
  listings: Array<{ key: string; propertySlug: string; practitionerKey: string; engagementNumber: string; publicationNumber: string }>
}

type Result = { created: number; skipped: number; blocked: number; total: number }

function list(context: SeedContext, key: string) {
  const operations = context.query[key] as any
  if (!operations) throw new Error(`Brokerage setup requires the ${key} list.`)
  return operations
}

async function one(context: SeedContext, key: string, where: Record<string, unknown>, query: string, label: string) {
  const rows = await list(context, key).findMany({ where, take: 2, query })
  if (rows.length !== 1) throw new Error(`Brokerage setup could not find exactly one ${label}.`)
  return rows[0]
}

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function effective(item: any, status: string, evaluatedAt: Date) {
  return item?.status === status && new Date(item.effectiveFrom) <= evaluatedAt && new Date(item.effectiveThrough) >= evaluatedAt
}

/**
 * Records agent licenses, listing agreements and public-site publication
 * authority for the starter listings in the target brokerage.
 * Existing authority always wins: this never updates, supersedes, or revives a record.
 */
export async function applyAuthoritySeed(
  context: SeedContext,
  seed: AuthoritySeed,
  target: SeedTarget,
  log: (message: string) => void = () => undefined,
  evaluatedAt = new Date()
): Promise<Result> {
  const from = new Date(seed.effectiveFrom), through = new Date(seed.effectiveThrough), verified = new Date(seed.verifiedAt)
  if (![from, through, verified, evaluatedAt].every(date => Number.isFinite(date.getTime())) || from >= through || verified < from || verified > evaluatedAt) {
    throw new Error('License setup requires a valid effective and verification period.')
  }

  const brokerage = await one(context, 'Brokerage', { id: { equals: target.id } }, 'id slug status', 'brokerage')
  const recorder = await one(context, 'User', { email: { equals: seed.recorderEmail } }, 'id email activeBrokerage { id } brokerageMemberships(where: { status: { equals: active } }) { brokerage { id status } }', 'managing broker')
  const recorderAuthorized = recorder.activeBrokerage?.id === brokerage.id && recorder.brokerageMemberships?.some((membership: any) => membership.brokerage?.id === brokerage.id && membership.brokerage?.status === 'active')
  if (brokerage.status !== 'active' || !recorderAuthorized) {
    // Earned suspensions/tenant moves block new authority, not replay.
    const total = seed.practitioners.length + seed.listings.length * 2
    log('managing broker is inactive or moved; no authority recorded')
    return { created: 0, skipped: 0, blocked: total, total }
  }

  let created = 0, skipped = 0, blocked = 0
  const practitioners = new Map<string, { user: any; license: any }>()

  for (const practitioner of seed.practitioners) {
    if (!['broker', 'associate_broker', 'sales_agent'].includes(practitioner.licenseType)) throw new Error(`Agent ${practitioner.key} has an invalid license type.`)
    const user = await one(context, 'User', { email: { equals: practitioner.email } }, 'id email activeBrokerage { id } brokerageMemberships(where: { status: { equals: active } }) { brokerage { id status } }', `agent ${practitioner.key}`)
    const member = user.activeBrokerage?.id === brokerage.id && user.brokerageMemberships?.some((membership: any) => membership.brokerage?.id === brokerage.id && membership.brokerage?.status === 'active')
    if (!member) {
      blocked += 1
      log(`agent ${practitioner.key} is suspended or moved; no license recorded`)
      continue
    }
    const licenseNumber = practitioner.licenseNumber
    const rows = await list(context, 'PractitionerLicenseAuthority').findMany({
      where: { brokerage: { id: { equals: brokerage.id } }, practitioner: { id: { equals: user.id } }, jurisdictionCode: { equals: seed.jurisdictionCode } },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }], take: 50,
      query: 'id licenseNumber status effectiveFrom effectiveThrough verificationSource',
    })
    let license = rows.find((row: any) => row.licenseNumber === licenseNumber)
    if (!license && rows.length) {
      blocked += 1
      log(`keep existing license for ${practitioner.key}`)
      continue
    }
    if (!license) {
      license = await list(context, 'PractitionerLicenseAuthority').createOne({ data: {
        brokerage: { connect: { id: brokerage.id } }, practitioner: { connect: { id: user.id } },
        licenseNumber, licenseType: practitioner.licenseType, jurisdictionCode: seed.jurisdictionCode,
        status: 'verified_active', effectiveFrom: seed.effectiveFrom, effectiveThrough: seed.effectiveThrough,
        verifiedAt: seed.verifiedAt,
        verificationSource: 'Texas Real Estate Commission license search',
        restrictions: '',
        reason: 'License recorded during brokerage setup.',
        verifiedBy: { connect: { id: recorder.id } },
      }, query: 'id licenseNumber status effectiveFrom effectiveThrough verificationSource' })
      created += 1
    } else {
      skipped += 1
    }
    const latest = rows[0] || license
    if (latest.id === license.id && effective(license, 'verified_active', evaluatedAt)) {
      practitioners.set(practitioner.key, { user, license })
    } else {
      blocked += 1
      log(`license for ${practitioner.key} is not current`)
    }
  }

  for (const listing of seed.listings) {
    const practitioner = practitioners.get(listing.practitionerKey)
    if (!practitioner) { blocked += 2; continue }
    const property = await one(context, 'Property', { slug: { equals: listing.propertySlug }, brokerage: { id: { equals: brokerage.id } } }, 'id slug title state assignedAgent { id } brokerage { id }', `listing ${listing.key}`)
    if (property.brokerage?.id !== brokerage.id || property.assignedAgent?.id !== practitioner.user.id || property.state !== seed.jurisdictionCode) {
      blocked += 2
      log(`listing ${listing.key} was reassigned or moved; no authority recorded`)
      continue
    }

    const engagementNumber = listing.engagementNumber
    const engagementRows = await list(context, 'ListingEngagementAuthority').findMany({
      where: { brokerage: { id: { equals: brokerage.id } }, property: { id: { equals: property.id } } },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }], take: 50,
      query: 'id authorityNumber status effectiveFrom effectiveThrough marketingAuthorized showingAuthorized assignedPractitioner { id }',
    })
    let engagement = engagementRows.find((row: any) => row.authorityNumber === engagementNumber)
    if (!engagement && engagementRows.length) {
      blocked += 2
      log(`keep existing listing agreement for ${listing.key}`)
      continue
    }
    if (!engagement) {
      const agreementSummary = `Owner authorizes the brokerage to market and show ${property.title} (${property.slug}) through ${through.toISOString().slice(0, 10)}.`
      engagement = await list(context, 'ListingEngagementAuthority').createOne({ data: {
        brokerage: { connect: { id: brokerage.id } }, authorityNumber: engagementNumber,
        property: { connect: { id: property.id } }, assignedPractitioner: { connect: { id: practitioner.user.id } },
        status: 'executed', jurisdictionCode: seed.jurisdictionCode, effectiveFrom: seed.effectiveFrom, effectiveThrough: seed.effectiveThrough,
        exclusive: false, marketingAuthorized: true, showingAuthorized: true,
        sellerPartySummary: { summary: agreementSummary },
        signatoryCapacity: 'Property owner',
        documentSha256: sha256(agreementSummary),
        reason: 'Listing agreement recorded during brokerage setup.',
        recordedBy: { connect: { id: recorder.id } }, recordedAt: seed.verifiedAt,
      }, query: 'id authorityNumber status effectiveFrom effectiveThrough marketingAuthorized showingAuthorized assignedPractitioner { id }' })
      created += 1
    } else {
      skipped += 1
    }
    const latestEngagement = engagementRows[0] || engagement
    if (latestEngagement.id !== engagement.id || !effective(engagement, 'executed', evaluatedAt) || !engagement.marketingAuthorized || !engagement.showingAuthorized || engagement.assignedPractitioner?.id !== practitioner.user.id) {
      blocked += 1
      log(`listing agreement for ${listing.key} is revoked, expired, or superseded`)
      continue
    }

    const publicationNumber = listing.publicationNumber
    const publicationRows = await list(context, 'ListingPublicationAuthority').findMany({
      where: { brokerage: { id: { equals: brokerage.id } }, property: { id: { equals: property.id } }, destination: { equals: 'public_site' } },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }], take: 50,
      query: 'id authorityNumber status effectiveFrom effectiveThrough authorityBasis engagement { id }',
    })
    let publication = publicationRows.find((row: any) => row.authorityNumber === publicationNumber)
    if (!publication && publicationRows.length) {
      blocked += 1
      log(`keep existing website publication for ${listing.key}`)
      continue
    }
    if (!publication) {
      publication = await list(context, 'ListingPublicationAuthority').createOne({ data: {
        brokerage: { connect: { id: brokerage.id } }, authorityNumber: publicationNumber,
        property: { connect: { id: property.id } }, engagement: { connect: { id: engagement.id } },
        destination: 'public_site', status: 'authorized', effectiveFrom: seed.effectiveFrom, effectiveThrough: seed.effectiveThrough,
        authorityBasis: `Listing agreement ${engagementNumber}`,
        localRuleReference: 'TREC advertising rules (22 TAC §535.155)',
        dataUseGrantReference: 'Brokerage-owned listing content',
        reason: 'Publish the listing on the brokerage website and accept showing requests.',
        recordedBy: { connect: { id: recorder.id } }, recordedAt: seed.verifiedAt,
      }, query: 'id authorityNumber status effectiveFrom effectiveThrough authorityBasis engagement { id }' })
      created += 1
    } else {
      skipped += 1
    }
    const latestPublication = publicationRows[0] || publication
    if (latestPublication.id !== publication.id || !effective(publication, 'authorized', evaluatedAt) || publication.engagement?.id !== engagement.id) {
      blocked += 1
      log(`website publication for ${listing.key} is revoked, expired, or superseded`)
    }
  }

  return { created, skipped, blocked, total: seed.practitioners.length + seed.listings.length * 2 }
}
