import { activeBrokerageIds, type AccessArgs, type Session } from '../access'

type RoleFlags = Partial<Session['data']['role']>

/**
 * Command receipts and audit events copy the record they describe into their
 * payload (lead and payer contacts, offers, mortgage data). A role may only read
 * a receipt or event when it can read that record type across the brokerage;
 * assignment-scoped reads (an agent's own leads) are not enough, because the
 * receipt list is not assignment scoped. Unknown types are people managers only.
 */
const leads = (r: RoleFlags) => Boolean(r.canManageLeads && r.canManagePeople)
const showings = (r: RoleFlags) => Boolean(r.canManageShowings && r.canManagePeople)
const deals = (r: RoleFlags) => Boolean(r.canManageDeals && r.canManagePeople)
const listings = (r: RoleFlags) => Boolean(r.canManageListings)
const market = (r: RoleFlags) => Boolean(r.canManageListings || r.canViewReports)
const payments = (r: RoleFlags) => Boolean(r.canManageLeads || r.canManageDeals || r.canManagePeople)
const people = (r: RoleFlags) => Boolean(r.canManagePeople)
const settings = (r: RoleFlags) => Boolean(r.canManagePeople && r.canAccessDashboard)

export const AUDIT_AGGREGATE_READERS: Record<string, (role: RoleFlags) => boolean> = {
  lead: leads, leadActivity: leads, leadRoutingRule: leads, agentTask: leads, savedSearch: leads, savedSearchAlert: leads, savedProperty: leads,
  showing: showings, showingFeedback: showings, openHouse: showings,
  deal: deals, transactionMilestone: deals, disclosure: deals, propertyInspection: deals, offer: deals, commission: deals,
  commissionLedgerEntry: deals, dealDocument: deals, documentEvidenceEvent: deals, escrow: deals, mortgageApplication: deals,
  titleOrder: deals, representationAuthority: deals, transactionFileEvent: deals,
  property: listings, propertyMedia: listings, listingEngagementAuthority: listings, listingPublicationAuthority: listings,
  listingSyndication: listings, sourceFeed: listings,
  marketComp: market, propertyValuation: market, neighborhood: market,
  payment: payments, paymentProvider: payments,
  agentTeam: people, practitionerLicenseAuthority: people, brokerageMembership: people, user: people,
  brokerageSettings: settings, retentionPolicy: settings,
}

export function readableAggregateTypes(session?: Session) {
  const role: RoleFlags = session?.data.role || {}
  return Object.keys(AUDIT_AGGREGATE_READERS).filter(type => AUDIT_AGGREGATE_READERS[type](role))
}

export function canReadAggregateType(session: Session | undefined, aggregateType: unknown) {
  const type = String(aggregateType || '')
  const reader = AUDIT_AGGREGATE_READERS[type]
  const role: RoleFlags = session?.data.role || {}
  return reader ? reader(role) : Boolean(role.canManagePeople)
}

/** Row filter: the active brokerage, and only record types the role can read brokerage-wide. */
export function auditRowFilter({ session }: AccessArgs) {
  const brokerageIds = activeBrokerageIds(session)
  if (!brokerageIds.length) return false
  const brokerage = { brokerage: { id: { in: brokerageIds } } }
  // People managers keep every type, including any not mapped above.
  if (session?.data.role?.canManagePeople) return brokerage
  return { AND: [brokerage, { aggregateType: { in: readableAggregateTypes(session) } }] }
}

/** Field read for the copied record (payload, before and after state). */
export function canReadAuditPayload({ session, item }: AccessArgs & { item: { aggregateType?: unknown } }) {
  return canReadAggregateType(session, item?.aggregateType)
}

/** A payload gated for reading is never a filter or sort key either. */
export const gatedPayloadField = {
  access: { read: canReadAuditPayload as any, create: () => false, update: () => false },
  isFilterable: false,
  isOrderable: false,
} as const
