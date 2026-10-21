import type { Context } from '.keystone/types'
import { sumMoney } from '../../lib/money'

import { activeBrokerageIds } from '../access'
import { leadWorkspace } from './leadJourney'
import { freshOperatorCommandContext } from '../lib/commandContext'
import { scopedShowingIdentity } from '../lib/showingAssociations'
import { scopedShowingPresentation } from './showingJourney'
import { INVALID_LISTING_CURSOR, decodeListingCursor, encodeListingCursor, listingCursorFingerprint } from '../lib/listingBoardCursor'
import { showingDateRange } from '../lib/showingDateRange'
import {
  decodeShowingCursor,
  encodeShowingCursor,
  INVALID_SHOWING_CURSOR,
  showingCursorFingerprint,
} from '../lib/showingBoardCursor'

function clean(value: unknown) { return String(value || '').trim() }
function role(context: Context) { return (context.session as any)?.data?.role || {} }
function actorId(context: Context) { return (context.session as any)?.itemId as string | undefined }

function scope(context: Context, permission: string) {
  const ids = activeBrokerageIds(context.session as any)
  if (!actorId(context) || !role(context)[permission] || !ids.length) throw new Error('Access denied.')
  return { ids, actor: actorId(context)!, managesAll: Boolean(role(context).canManagePeople) }
}

function assignmentWhere(context: Context, permission: string) {
  const current = scope(context, permission)
  return {
    current,
    where: current.managesAll
      ? { brokerage: { id: { in: current.ids } } }
      : { AND: [{ brokerage: { id: { in: current.ids } } }, { assignedAgent: { id: { equals: current.actor } } }] },
  }
}

function textFilter(term: string, fields: string[]) {
  if (!term) return null
  if (term.length > 120) throw new Error('Search term is too long.')
  return { OR: fields.map(field => {
    let filter: any = { contains: term, mode: 'insensitive' }
    for (const key of field.split('.').reverse()) filter = { [key]: filter }
    return filter
  }) }
}

export async function platformContacts(_root: unknown, args: Parameters<typeof leadWorkspace>[0], context: Context) {
  return leadWorkspace(args, context)
}

const LISTING_QUERY = `
  id title slug status listingType propertyType shortDescription addressLine1 city state postalCode price bedrooms bathrooms squareFeet isFeatured primaryImageUrl updatedAt
  assignedAgent { id name email }
  leadsCount showingsCount
`

export async function platformListings(_root: unknown, { status, q, take = 60, after, before }: any, context: Context) {
  const current = scope(context, 'canManageListings')
  const { ids } = current
  const pageSize = Math.min(Math.max(Number(take) || 60, 1), 100)
  const filters: any[] = [{ brokerage: { id: { in: ids } } }]
  const normalizedStatus = clean(status), term = clean(q)
  if (normalizedStatus && normalizedStatus !== 'all') filters.push({ status: { equals: normalizedStatus } })
  const search = textFilter(term, ['title', 'addressLine1', 'city', 'postalCode'])
  if (search) filters.push(search)

  const hasAfter = after !== undefined && after !== null
  const hasBefore = before !== undefined && before !== null
  if (hasAfter && hasBefore) throw new Error(INVALID_LISTING_CURSOR)

  const fingerprint = listingCursorFingerprint({
    actor: current.actor,
    brokerageIds: [...ids].sort(),
    permission: 'canManageListings',
    status: normalizedStatus && normalizedStatus !== 'all' ? normalizedStatus : 'all',
    search: term,
    pageSize,
  })
  const cursorValue = hasAfter ? after : hasBefore ? before : null
  const cursor = cursorValue === null ? null : decodeListingCursor(cursorValue, fingerprint)
  if (cursorValue !== null && !cursor) throw new Error(INVALID_LISTING_CURSOR)

  const sudo = context.sudo() as any
  if (cursor) {
    const anchor = await sudo.query.Property.findMany({
      where: { AND: [...filters, { id: { equals: cursor.id } }, { updatedAt: { equals: cursor.updatedAt } }] },
      take: 1,
      query: 'id updatedAt',
    })
    if (!anchor.length) throw new Error(INVALID_LISTING_CURSOR)
  }

  const boundary = cursor
    ? hasAfter
      ? { OR: [
        { updatedAt: { lt: cursor.updatedAt } },
        { AND: [{ updatedAt: { equals: cursor.updatedAt } }, { id: { lt: cursor.id } }] },
      ] }
      : { OR: [
        { updatedAt: { gt: cursor.updatedAt } },
        { AND: [{ updatedAt: { equals: cursor.updatedAt } }, { id: { gt: cursor.id } }] },
      ] }
    : null
  const orderBy = hasBefore ? [{ updatedAt: 'asc' }, { id: 'asc' }] : [{ updatedAt: 'desc' }, { id: 'desc' }]
  const found = await sudo.query.Property.findMany({
    where: { AND: boundary ? [...filters, boundary] : filters },
    orderBy,
    take: pageSize + 1,
    query: LISTING_QUERY,
  })
  const hasMoreInDirection = found.length > pageSize
  const pageRows = found.slice(0, pageSize)
  if (cursor && !pageRows.length) throw new Error(INVALID_LISTING_CURSOR)
  const items = hasBefore ? pageRows.reverse() : pageRows
  const pageInfo = {
    hasNextPage: hasBefore ? items.length > 0 : hasMoreInDirection,
    hasPreviousPage: hasBefore ? hasMoreInDirection : hasAfter && items.length > 0,
    nextCursor: null as string | null,
    previousCursor: null as string | null,
  }
  pageInfo.nextCursor = pageInfo.hasNextPage && items.length ? encodeListingCursor(items[items.length - 1], fingerprint) : null
  pageInfo.previousCursor = pageInfo.hasPreviousPage && items.length ? encodeListingCursor(items[0], fingerprint) : null

  const scoped = await sudo.query.Property.findMany({ where: { brokerage: { id: { in: ids } } }, take: 500, query: 'id status price listingType' })
  const count = (value: string) => scoped.filter((item: any) => item.status === value).length
  return { items, pageInfo, stats: { total: scoped.length, active: count('active'), comingSoon: count('coming_soon'), pending: count('pending'), sold: count('sold'), offMarket: count('off_market') } }
}

type ShowingWorkspaceArgs = { status?: string; range?: string; q?: string; take?: number; after?: string | null; before?: string | null }
export async function platformShowings(_root: unknown, { status, range, q, take, after, before }: ShowingWorkspaceArgs, context: Context) {
  return context.transaction(async tx => showingWorkspace({ status, range, q, take, after, before }, await freshOperatorCommandContext(tx.withSession(context.session))), { timeout: 30_000 })
}

async function showingWorkspace({ status, range, q, take = 80, after, before }: ShowingWorkspaceArgs, context: Context) {
  const { where: brokerageWhere, current } = assignmentWhere(context, 'canManageShowings')
  const filters: any[] = [brokerageWhere]
  const normalizedStatus = clean(status), normalizedRange = clean(range) || 'upcoming', term = clean(q)
  const pageSize = Math.min(Math.max(Number(take) || 80, 1), 100)
  const date = showingDateRange(normalizedRange)
  if (normalizedStatus && normalizedStatus !== 'all') filters.push({ status: { equals: normalizedStatus } })
  if (date) filters.push({ scheduledStart: date })
  const search = textFilter(term, ['property.title', 'property.addressLine1', 'property.city', 'lead.name', 'lead.email', 'assignedAgent.name'])
  if (search) filters.push(search)

  const hasAfter = after !== undefined && after !== null
  const hasBefore = before !== undefined && before !== null
  if (hasAfter && hasBefore) throw new Error(INVALID_SHOWING_CURSOR)

  const fingerprint = showingCursorFingerprint({
    actor: current.actor,
    brokerageIds: [...current.ids].sort(),
    managesAll: current.managesAll,
    permission: 'canManageShowings',
    status: normalizedStatus && normalizedStatus !== 'all' ? normalizedStatus : 'all',
    range: normalizedRange,
    search: term,
    pageSize,
  })
  const cursorValue = hasAfter ? after : hasBefore ? before : null
  const cursor = cursorValue === null ? null : decodeShowingCursor(cursorValue, fingerprint)
  if (cursorValue !== null && !cursor) throw new Error(INVALID_SHOWING_CURSOR)

  const sudo = context.sudo() as any
  if (cursor) {
    const anchor = await sudo.query.Showing.findMany({
      where: { AND: [...filters, { id: { equals: cursor.id } }, { scheduledStart: { equals: cursor.scheduledStart } }] },
      take: 1,
      query: 'id scheduledStart',
    })
    if (!anchor.length || !await scopedShowingIdentity(context, cursor.id)) throw new Error(INVALID_SHOWING_CURSOR)
  }

  const boundary = cursor
    ? hasAfter
      ? { OR: [
        { scheduledStart: { gt: cursor.scheduledStart } },
        { AND: [{ scheduledStart: { equals: cursor.scheduledStart } }, { id: { gt: cursor.id } }] },
      ] }
      : { OR: [
        { scheduledStart: { lt: cursor.scheduledStart } },
        { AND: [{ scheduledStart: { equals: cursor.scheduledStart } }, { id: { lt: cursor.id } }] },
      ] }
    : null
  const orderBy = hasBefore ? [{ scheduledStart: 'desc' }, { id: 'desc' }] : [{ scheduledStart: 'asc' }, { id: 'asc' }]
  const found = await sudo.query.Showing.findMany({
    where: { AND: boundary ? [...filters, boundary] : filters },
    orderBy,
    take: pageSize + 1,
    query: 'id scheduledStart brokerage { id }',
  })
  const hasMoreInDirection = found.length > pageSize
  const pageRows = found.slice(0, pageSize)
  if (cursor && !pageRows.length) throw new Error(INVALID_SHOWING_CURSOR)
  const orderedRows = hasBefore ? pageRows.reverse() : pageRows
  const items = []
  for (const candidate of orderedRows) {
    const view = await scopedShowingPresentation(context, candidate.id)
    if (!view || view.showing.scheduledStart !== candidate.scheduledStart) throw new Error('Showing workspace unavailable.')
    items.push(view.showing)
  }
  const hasPreviousPage = hasBefore ? hasMoreInDirection : hasAfter
  const hasNextPage = hasBefore ? true : hasMoreInDirection
  const pageInfo = {
    hasNextPage,
    hasPreviousPage,
    nextCursor: hasNextPage && items.length ? encodeShowingCursor(items[items.length - 1], fingerprint) : null,
    previousCursor: hasPreviousPage && items.length ? encodeShowingCursor(items[0], fingerprint) : null,
  }

  const scoped = await sudo.query.Showing.findMany({ where: brokerageWhere, take: 500, query: 'id status' })
  const count = (value: string) => scoped.filter((item: any) => item.status === value).length
  return { items, pageInfo, stats: { total: scoped.length, requested: count('requested'), scheduled: count('scheduled'), completed: count('completed'), noShow: count('no_show'), cancelled: count('cancelled') } }
}

const DEAL_QUERY = `
  id title stage transactionType offerAmount commissionAmount expectedCloseDate closedAt nextStep notes createdAt updatedAt
  property { id title city state price listingType }
  lead { id name email phone status }
  assignedAgent { id name email }
  assignedTeam { id name }
`

export async function platformPipeline(_root: unknown, _args: unknown, context: Context) {
  const { where } = assignmentWhere(context, 'canManageDeals')
  const sudo = context.sudo() as any
  const items = await sudo.query.Deal.findMany({ where, orderBy: [{ updatedAt: 'desc' }], take: 200, query: DEAL_QUERY })
  const count = (value: string) => items.filter((item: any) => item.stage === value).length
  const projectedCommission = sumMoney(items.filter((item: any) => item.stage !== 'closed_lost').map((item: any) => item.commissionAmount || '0'))
  return { items, stats: { total: items.length, open: items.filter((item: any) => !['closed_won', 'closed_lost'].includes(item.stage)).length, underContract: count('under_contract'), closedWon: count('closed_won'), closedLost: count('closed_lost'), projectedCommission: String(projectedCommission) } }
}

export async function platformReports(_root: unknown, _args: unknown, context: Context) {
  const current = scope(context, 'canViewReports')
  if (!current.managesAll) throw new Error('Access denied.')
  const where = { brokerage: { id: { in: current.ids } } }
  const sudo = context.sudo() as any
  const [leads, showings, deals, activeListings, pendingListings] = await Promise.all([
    sudo.query.Lead.findMany({ where, orderBy: [{ createdAt: 'desc' }], take: 250, query: 'id source status assignedAgent { id name }' }),
    sudo.query.Showing.findMany({ where, orderBy: [{ scheduledStart: 'desc' }], take: 250, query: 'id status assignedAgent { id name }' }),
    sudo.query.Deal.findMany({ where, orderBy: [{ updatedAt: 'desc' }], take: 250, query: 'id stage commissionAmount assignedAgent { id name }' }),
    sudo.query.Property.count({ where: { AND: [where, { status: { equals: 'active' } }] } }),
    sudo.query.Property.count({ where: { AND: [where, { status: { equals: 'pending' } }] } }),
  ])
  return { leads, showings, deals, activeListings, pendingListings }
}

export async function platformPeople(_root: unknown, _args: unknown, context: Context) {
  const { ids } = scope(context, 'canManagePeople')
  const sudo = context.sudo() as any
  const [agents, teams] = await Promise.all([
    sudo.query.User.findMany({
      where: { brokerageMemberships: { some: { status: { equals: 'active' }, brokerage: { id: { in: ids } } } } },
      orderBy: [{ name: 'asc' }],
      take: 100,
      query: 'id name email phone licenseNumber brokerageTitle avatarUrl onboardingStatus role { id name } brokerageMemberships(where: { status: { equals: active } }) { id membershipRole isPrimary brokerage { id name slug } } assignedPropertiesCount assignedLeadsCount assignedShowingsCount assignedDealsCount',
    }),
    sudo.query.AgentTeam.findMany({
      where: { brokerage: { id: { in: ids } } },
      orderBy: [{ name: 'asc' }],
      take: 100,
      query: 'id name slug teamType status description leadAgent { id name email } members { id name email } leadsCount dealsCount',
    }),
  ])
  return {
    agents: agents.map((agent: any) => ({
      ...agent,
      memberships: (agent.brokerageMemberships || []).filter((membership: any) => ids.includes(membership.brokerage?.id)),
      listingCount: agent.assignedPropertiesCount || 0,
      leadCount: agent.assignedLeadsCount || 0,
      showingCount: agent.assignedShowingsCount || 0,
      dealCount: agent.assignedDealsCount || 0,
    })),
    teams: teams.map((team: any) => ({ ...team, leadCount: team.leadsCount || 0, dealCount: team.dealsCount || 0 })),
  }
}

export async function platformOperations(_root: unknown, _args: unknown, context: Context) {
  if (!role(context).canManagePeople) throw new Error('Access denied.')
  const dealScope = assignmentWhere(context, 'canManageDeals')
  const listingScope = scope(context, 'canManageListings')
  const leadScope = scope(context, 'canManageLeads')
  const sudo = context.sudo() as any
  const [offers, transactions, commissions, savedSearches, alerts, feeds, queue, inspections, openHouses, disclosures, mortgages, titleOrders, escrows, comps, valuations, syndications, tasks, listingEngagementAuthorities, listingPublicationAuthorityRows, practitionerLicenses, representationAuthorities, documentEvidenceEvents, commissionLedgerRows, retentionPolicies, transactionFileEvents] = await Promise.all([
    sudo.query.Offer.findMany({ where: dealScope.where, orderBy: [{ createdAt: 'desc' }], take: 30, query: 'id offerNumber version status amount earnestMoney financingType contingencies submittedAt responseDueAt createdAt parentOffer { id offerNumber } deal { id title } property { id title } lead { id name } assignedAgent { id name }' }),
    sudo.query.Deal.findMany({ where: dealScope.where, orderBy: [{ updatedAt: 'desc' }], take: 30, query: 'id title stage expectedCloseDate property { id title } lead { id name } assignedAgent { id name }' }),
    sudo.query.Commission.findMany({ where: dealScope.current.managesAll ? { brokerage: { id: { in: dealScope.current.ids } } } : { AND: [{ brokerage: { id: { in: dealScope.current.ids } } }, { agent: { id: { equals: dealScope.current.actor } } }] }, orderBy: [{ createdAt: 'desc' }], take: 30, query: 'id title status side grossCommission brokerageSplitPercent agentSplitPercent netCommission paidAt deal { id title } agent { id name }' }),
    sudo.query.SavedSearch.findMany({ where: { brokerage: { id: { in: leadScope.ids } } }, orderBy: [{ createdAt: 'desc' }], take: 30, query: 'id name city state propertyType minPrice maxPrice minBedrooms alertsEnabled lastNotifiedAt user { id name email }' }),
    sudo.query.SavedSearchAlert.findMany({ where: { brokerage: { id: { in: leadScope.ids } } }, orderBy: [{ createdAt: 'desc' }], take: 30, query: 'id status cadence lastSentAt sentCount savedSearch { id name } user { id name email }' }),
    sudo.query.SourceFeed.findMany({ where: { brokerage: { id: { in: listingScope.ids } } }, orderBy: [{ createdAt: 'desc' }], take: 30, query: 'id name provider feedType status lastImportedAt recordsImported' }),
    sudo.query.DomainOutboxEvent.findMany({ where: { AND: [{ brokerage: { id: { in: [...new Set([...dealScope.current.ids, ...listingScope.ids, ...leadScope.ids])] } } }, { OR: [{ eventType: { startsWith: "integration." } }, { eventType: { startsWith: "saved_search." } }] }] }, orderBy: [{ occurredAt: 'desc' }], take: 30, query: 'id eventKey eventType aggregateType aggregateId status attempts replayCount availableAt occurredAt lastError' }),
    sudo.query.PropertyInspection.findMany({ where: { OR: [{ deal: { brokerage: { id: { in: dealScope.current.ids } } } }, { property: { brokerage: { id: { in: dealScope.current.ids } } } }] }, orderBy: [{ scheduledAt: 'asc' }], take: 50, query: 'id title inspectionType status scheduledAt completedAt inspectorName estimatedCost summary findings property { id title } deal { id title }' }),
    sudo.query.OpenHouse.findMany({ where: { property: { brokerage: { id: { in: listingScope.ids } } } }, orderBy: [{ startsAt: 'asc' }], take: 50, query: 'id title status startsAt endsAt attendeeCount notes property { id title } hostAgent { id name }' }),
    sudo.query.Disclosure.findMany({ where: { deal: { brokerage: { id: { in: dealScope.current.ids } } } }, orderBy: [{ createdAt: 'desc' }], take: 50, query: 'id title disclosureType status documentUrl sentAt acknowledgedAt deal { id title } property { id title }' }),
    sudo.query.MortgageApplication.findMany({ where: { deal: { brokerage: { id: { in: dealScope.current.ids } } } }, orderBy: [{ createdAt: 'desc' }], take: 50, query: 'id applicationNumber lenderName status loanAmount interestRate submittedAt decisionAt deal { id title } lead { id name }' }),
    sudo.query.TitleOrder.findMany({ where: { deal: { brokerage: { id: { in: dealScope.current.ids } } } }, orderBy: [{ createdAt: 'desc' }], take: 50, query: 'id orderNumber titleCompany status orderedAt clearedAt exceptions deal { id title } property { id title }' }),
    sudo.query.Escrow.findMany({ where: { deal: { brokerage: { id: { in: dealScope.current.ids } } } }, orderBy: [{ createdAt: 'desc' }], take: 50, query: 'id escrowNumber status escrowCompany officerName openedAt scheduledCloseAt closedAt depositAmount deal { id title } property { id title }' }),
    sudo.query.MarketComp.findMany({ where: { subjectProperty: { brokerage: { id: { in: listingScope.ids } } } }, orderBy: [{ soldAt: 'desc' }], take: 50, query: 'id addressLine1 city state status listPrice salePrice soldAt bedrooms bathrooms squareFeet distanceMiles subjectProperty { id title } neighborhood { id name }' }),
    sudo.query.PropertyValuation.findMany({ where: { property: { brokerage: { id: { in: listingScope.ids } } } }, orderBy: [{ valuedAt: 'desc' }], take: 50, query: 'id valuationNumber valuationType lowValue estimatedValue highValue valuedAt notes property { id title } performedBy { id name }' }),
    sudo.query.ListingSyndication.findMany({ where: { brokerage: { id: { in: listingScope.ids } } }, orderBy: [{ updatedAt: 'desc' }], take: 100, query: 'id channel status externalListingId listingUrl errorMessage property { id title slug }' }),
    sudo.query.AgentTask.findMany({ where: leadScope.ids.length ? { brokerage: { id: { in: leadScope.ids } } } : { id: { equals: "" } }, orderBy: [{ dueAt: 'asc' }], take: 100, query: 'id title status priority dueAt completedAt notes assignedAgent { id name } property { id title } lead { id name } deal { id title }' }),
    sudo.query.ListingEngagementAuthority.findMany({ where: { brokerage: { id: { in: listingScope.ids } } }, orderBy: [{ effectiveFrom: 'desc' }], take: 100, query: 'id authorityNumber status jurisdictionCode effectiveFrom effectiveThrough marketingAuthorized showingAuthorized documentSha256 property { id title } assignedPractitioner { id name email }' }),
    sudo.query.ListingPublicationAuthority.findMany({ where: { brokerage: { id: { in: listingScope.ids } } }, orderBy: [{ effectiveFrom: 'desc' }], take: 100, query: 'id authorityNumber destination status effectiveFrom effectiveThrough authorityBasis property { id title } engagement { id }' }),
    sudo.query.PractitionerLicenseAuthority.findMany({ where: { brokerage: { id: { in: listingScope.ids } } }, orderBy: [{ effectiveFrom: 'desc' }], take: 100, query: 'id licenseNumber licenseType jurisdictionCode status effectiveFrom effectiveThrough verifiedAt verificationSource practitioner { id name email }' }),
    sudo.query.RepresentationAuthority.findMany({ where: { brokerage: { id: { in: dealScope.current.ids } } }, orderBy: [{ effectiveFrom: 'desc' }], take: 100, query: 'id authorityNumber side relationshipType jurisdictionCode status effectiveFrom effectiveThrough disclosureVersion lead { id name } property { id title } deal { id title } practitioner { id name email }' }),
    sudo.query.DocumentEvidenceEvent.findMany({ where: { brokerage: { id: { in: dealScope.current.ids } } }, orderBy: [{ occurredAt: 'desc' }], take: 100, query: 'id eventKey eventType documentSha256 templateSha256 channel provider providerReference occurredAt acknowledgedAt document { id title } offer { id offerNumber }' }),
    sudo.query.CommissionLedgerEntry.findMany({ where: { brokerage: { id: { in: dealScope.current.ids } } }, orderBy: [{ occurredAt: 'desc' }], take: 150, query: 'id entryKey batchKey entryType allocationType amountCents currencyCode payeeLabel externalReference occurredAt commission { id } preparedBy { id name } approvedBy { id name }' }),
    sudo.query.RetentionPolicy.findMany({ where: { brokerage: { id: { in: dealScope.current.ids } } }, orderBy: [{ effectiveFrom: 'desc' }], take: 50, query: 'id policyKey retentionClass jurisdictionCode triggerType retentionDays disposition effectiveFrom effectiveThrough' }),
    sudo.query.TransactionFileEvent.findMany({ where: { brokerage: { id: { in: dealScope.current.ids } } }, orderBy: [{ occurredAt: 'desc' }], take: 150, query: 'id eventKey eventType triggerAt disposeAfter holdKey manifestKey manifestSha256 documentSha256 externalDeletionReference reason occurredAt deal { id title } document { id title }' }),
  ])
  const dealIds = transactions.map((deal: any) => deal.id)
  const [milestones, documents] = dealIds.length ? await Promise.all([
    sudo.query.TransactionMilestone.findMany({ where: { deal: { id: { in: dealIds } } }, orderBy: [{ sortOrder: 'asc' }], take: 500, query: 'id name status dueAt completedAt sortOrder notes deal { id } assignedTo { id name }' }),
    sudo.query.DealDocument.findMany({ where: { deal: { id: { in: dealIds } } }, orderBy: [{ createdAt: 'desc' }], take: 500, query: 'id title documentType status requiresSignature sentAt signedAt expiresAt deal { id }' }),
  ]) : [[], []]
  const transactionDetails = transactions.map((deal: any) => ({
    ...deal,
    milestones: milestones.filter((item: any) => item.deal?.id === deal.id).map(({ deal: _deal, ...item }: any) => item),
    documents: documents.filter((item: any) => item.deal?.id === deal.id).map(({ deal: _deal, ...item }: any) => item),
  }))
  const listingPublicationAuthorities = listingPublicationAuthorityRows.map((item: any) => ({ ...item, engagementId: item.engagement?.id || null }))
  const commissionLedgerEntries = commissionLedgerRows.map((item: any) => ({ ...item, amountCents: String(item.amountCents), commissionId: item.commission?.id }))
  return { offers, transactions: transactionDetails, commissions, savedSearches, alerts, feeds, queue, inspections, openHouses, disclosures, mortgages, titleOrders, escrows, comps, valuations, syndications, tasks, listingEngagementAuthorities, listingPublicationAuthorities, practitionerLicenses, representationAuthorities, documentEvidenceEvents, commissionLedgerEntries, retentionPolicies, transactionFileEvents }
}
