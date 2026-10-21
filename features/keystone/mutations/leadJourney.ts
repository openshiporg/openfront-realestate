import type { Context } from '.keystone/types'
import { activeBrokerageIds, type Session } from '../access'
import { freshOperatorCommandContext } from '../lib/commandContext'
import { tenantIdentity, type TenantIdentity } from '../lib/showingAssociations'
import { decodeLeadCursor, encodeLeadCursor, INVALID_LEAD_CURSOR, leadCursorBinding } from '../lib/leadBoardCursor'

type LeadHeader = TenantIdentity & {
  createdAt: string; status: string
  assignedAgent: { id: string } | null; property: TenantIdentity | null
}
type LeadWhere = NonNullable<Parameters<Context['query']['Lead']['findMany']>[0]>['where']
type LeadStatus = 'new' | 'attempted_contact' | 'qualified' | 'tour_scheduled' | 'offer' | 'closed' | 'lost'
type Args = { status?: string; q?: string; take?: number; after?: string | null; before?: string | null }
const HEADER = 'id brokerage { id status } assignedAgent { id } property { id brokerage { id status } } createdAt status'
function record(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)) }
function actorScope(context: Context) {
  const session = context.session as Session | undefined
  const brokerageId = activeBrokerageIds(session)[0]
  if (!session?.itemId || !brokerageId || !session.data.role?.canManageLeads) throw new Error('Lead workspace unavailable.')
  return { session, brokerageId, actorId: session.itemId, managesAll: Boolean(session.data.role.canManagePeople) }
}
function leadWhere(context: Context): NonNullable<LeadWhere> {
  const scope = actorScope(context)
  return { brokerage: { id: { equals: scope.brokerageId }, status: { equals: 'active' } },
    ...(!scope.managesAll ? { assignedAgent: { id: { equals: scope.actorId } } } : {}) }
}
async function validHeader(context: Context, value: unknown): Promise<LeadHeader | null> {
  const scope = actorScope(context)
  if (!tenantIdentity(value, scope.brokerageId) || !record(value) || typeof value.createdAt !== 'string'
    || !Number.isFinite(new Date(value.createdAt).getTime()) || typeof value.status !== 'string'
    || !(value.property === null || tenantIdentity(value.property, scope.brokerageId))
    || !(value.assignedAgent === null || (record(value.assignedAgent) && typeof value.assignedAgent.id === 'string' && value.assignedAgent.id))) return null
  const header = value as LeadHeader
  if (!scope.managesAll && header.assignedAgent?.id !== scope.actorId) return null
  if (header.assignedAgent) {
    // Native Lead READ policy allows managers to triage suspended-assignee Leads.
    // Verify current tenant association, not new-appointment active-agent authority;
    // the ordinary User query still withholds an unauthorized/inactive profile.
    const agent = await context.sudo().query.User.findOne({ where: { id: header.assignedAgent.id }, query: `id
      brokerageMemberships(where: { brokerage: { id: { equals: ${JSON.stringify(scope.brokerageId)} } } }, take: 1) { brokerage { id status } }` })
    if (agent?.id !== header.assignedAgent.id || !Array.isArray(agent.brokerageMemberships)
      || agent.brokerageMemberships.length !== 1 || agent.brokerageMemberships[0]?.brokerage?.id !== scope.brokerageId
      || agent.brokerageMemberships[0]?.brokerage?.status !== 'active') return null
  }
  return header
}
export async function scopedLeadHeader(context: Context, id: string) {
  if (!id || id.length > 200) return null
  const row = (await context.sudo().query.Lead.findMany({ where: { AND: [leadWhere(context), { id: { equals: id } }] }, take: 1, query: HEADER }))[0]
  if (row?.id !== id) return null
  return validHeader(context, row)
}

async function privateLead(context: Context, header: LeadHeader) {
  // Ordinary List/related field access stays authoritative for private profiles.
  const row = await context.query.Lead.findOne({ where: { id: header.id }, query: `id brokerage { id }
    name email phone status intent source message lastContactedAt createdAt updatedAt
    property { id title slug city state price listingType } assignedAgent { id name email } showingsCount` })
  if (!row || row.id !== header.id || row.brokerage?.id !== header.brokerage.id) throw new Error('Lead detail unavailable.')
  if (row.property && row.property.id !== header.property?.id) throw new Error('Lead detail unavailable.')
  if (row.assignedAgent && row.assignedAgent.id !== header.assignedAgent?.id) throw new Error('Lead detail unavailable.')
  return {
    id: row.id, name: row.name, email: row.email, phone: row.phone, status: row.status, intent: row.intent, source: row.source,
    message: row.message, lastContactedAt: row.lastContactedAt, createdAt: row.createdAt, updatedAt: row.updatedAt,
    property: row.property ? { id: row.property.id, title: row.property.title, slug: row.property.slug, city: row.property.city,
      state: row.property.state, price: row.property.price, listingType: row.property.listingType }
      : header.property ? { id: header.property.id, title: '', slug: null, city: null, state: null, price: null, listingType: null } : null,
    assignedAgent: row.assignedAgent ? { id: row.assignedAgent.id, name: row.assignedAgent.name, email: row.assignedAgent.email }
      : header.assignedAgent ? { id: header.assignedAgent.id, name: '', email: '' } : null,
    showingsCount: row.showingsCount, activities: [],
    activityAccess: actorScope(context).managesAll ? 'available' : 'restricted',
  }
}

const ACTIVITY_HEADER = 'id occurredAt brokerage { id } lead { id } property { id brokerage { id status } } showing { id brokerage { id status } lead { id brokerage { id status } } property { id brokerage { id status } } } agent { id }'
function validActivityHeader(row: unknown, header: LeadHeader, brokerageId: string) {
  return record(row) && typeof row.id === 'string' && Boolean(row.id) && typeof row.occurredAt === 'string' && Number.isFinite(new Date(row.occurredAt).getTime())
    && record(row.brokerage) && row.brokerage.id === brokerageId && record(row.lead) && row.lead.id === header.id
    && (row.property === null || tenantIdentity(row.property, brokerageId))
    && (row.showing === null || (tenantIdentity(row.showing, brokerageId) && record(row.showing) && tenantIdentity(row.showing.lead, brokerageId)
      && row.showing.lead.id === header.id && tenantIdentity(row.showing.property, brokerageId)
      && (row.property === null || (record(row.property) && row.showing.property.id === row.property.id))))
}

async function activities(context: Context, header: LeadHeader, take: number, before?: string) {
  const scope = actorScope(context)
  // Match the existing LeadActivity OPERATION gate, not its unreachable assigned-only filter branch.
  if (!scope.managesAll) return { items: [], nextCursor: null, access: 'restricted' }
  const where = { brokerage: { id: { equals: scope.brokerageId } }, lead: { id: { equals: header.id } } }
  const binding = leadCursorBinding({ purpose: 'lead_activity', actor: scope.actorId, brokerage: scope.brokerageId, leadId: header.id, take })
  const cursor = before === undefined ? null : decodeLeadCursor(before, binding)
  if (cursor) {
    const anchor = (await context.sudo().query.LeadActivity.findMany({ where: { AND: [where, { id: { equals: cursor.id }, occurredAt: { equals: cursor.at } }] }, take: 1, query: ACTIVITY_HEADER }))[0]
    if (anchor?.id !== cursor.id || !validActivityHeader(anchor, header, scope.brokerageId)) throw new Error(INVALID_LEAD_CURSOR)
  }
  const rows = await context.sudo().query.LeadActivity.findMany({ where: { AND: [where, ...(cursor ? [{ OR: [
    { occurredAt: { lt: cursor.at } }, { occurredAt: { equals: cursor.at }, id: { lt: cursor.id } },
  ] }] : [])] }, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: take + 1,
    query: ACTIVITY_HEADER })
  for (const row of rows) {
    if (!validActivityHeader(row, header, scope.brokerageId)) throw new Error('Lead history unavailable.')
  }
  const items = []
  for (const candidate of rows.slice(0, take)) {
    const row = await context.query.LeadActivity.findOne({ where: { id: candidate.id }, query: 'id activityType direction channel subject body occurredAt brokerage { id } lead { id } agent { id name email }' })
    if (!row || row.id !== candidate.id || row.lead?.id !== header.id || row.brokerage?.id !== scope.brokerageId || row.occurredAt !== candidate.occurredAt || (row.agent && row.agent.id !== candidate.agent?.id)) throw new Error('Lead history unavailable.')
    items.push({ id: row.id, activityType: row.activityType, direction: row.direction, channel: row.channel,
      subject: row.subject, body: row.body, occurredAt: row.occurredAt, agent: row.agent ? { id: row.agent.id, name: row.agent.name, email: row.agent.email } : null })
  }
  const last = rows[Math.min(take, rows.length) - 1]
  return { items, nextCursor: rows.length > take && last ? encodeLeadCursor({ id: last.id, at: last.occurredAt }, binding) : null, access: 'available' }
}

export async function platformShowingRequestViewer(_root: unknown, _args: unknown, context: Context) {
  return context.transaction(async tx => {
    const scoped = await freshOperatorCommandContext(tx.withSession(context.session))
    const session = scoped.session as Session
    const brokerageId = activeBrokerageIds(session)[0]
    return session?.itemId && brokerageId && session.data.role?.canManageShowings ? { actorId: session.itemId, brokerageId } : null
  }, { timeout: 30_000 })
}

export async function platformLeadDetail(_root: unknown, { id, before }: { id: string; before?: string }, context: Context) {
  return context.transaction(async tx => {
    const scoped = await freshOperatorCommandContext(tx.withSession(context.session))
    const scope = actorScope(scoped)
    const header = await scopedLeadHeader(scoped, id)
    if (!header) return null
    const lead = await privateLead(scoped, header)
    const history = await activities(scoped, header, 50, before ?? undefined)
    return { lead: { ...lead, activities: history.items }, activityAccess: history.access, nextActivityCursor: history.nextCursor,
      viewer: { actorId: scope.actorId, brokerageId: scope.brokerageId } }
  }, { timeout: 30_000 })
}

export async function leadWorkspace(args: Args, context: Context) {
  return context.transaction(async tx => {
    const scoped = await freshOperatorCommandContext(tx.withSession(context.session))
    const scope = actorScope(scoped), status = (args.status || 'all').trim(), term = (args.q || '').trim()
    if (!['all', 'new', 'attempted_contact', 'qualified', 'tour_scheduled', 'offer', 'closed', 'lost'].includes(status)) throw new Error('Lead workspace unavailable.')
    const after = args.after ?? undefined, before = args.before ?? undefined
    if (term.length > 120 || (after !== undefined && before !== undefined)) throw new Error(INVALID_LEAD_CURSOR)
    const take = Math.min(Math.max(Number(args.take) || 50, 1), 100)
    const filters: NonNullable<LeadWhere>[] = [leadWhere(scoped)]
    if (status !== 'all') filters.push({ status: { equals: status as LeadStatus } })
    if (term) filters.push({ OR: [
      { name: { contains: term, mode: 'insensitive' } }, { email: { contains: term, mode: 'insensitive' } },
      { phone: { contains: term, mode: 'insensitive' } }, { preferredLocation: { contains: term, mode: 'insensitive' } },
    ] })
    const binding = leadCursorBinding({ purpose: 'lead_board', actor: scope.actorId, brokerage: scope.brokerageId, managesAll: scope.managesAll, status, term, take })
    const backward = before !== undefined
    const encoded = after ?? before
    const cursor = encoded === undefined ? null : decodeLeadCursor(encoded, binding)
    if (cursor) {
      const anchor = (await scoped.sudo().query.Lead.findMany({ where: { AND: [...filters, { id: { equals: cursor.id }, createdAt: { equals: cursor.at } }] }, take: 1, query: HEADER }))[0]
      if (!anchor || !await validHeader(scoped, anchor)) throw new Error(INVALID_LEAD_CURSOR)
    }
    const boundary = cursor ? { OR: [
      { createdAt: { [backward ? 'gt' : 'lt']: cursor.at } },
      { createdAt: { equals: cursor.at }, id: { [backward ? 'gt' : 'lt']: cursor.id } },
    ] } : null
    const rows = await scoped.sudo().query.Lead.findMany({ where: { AND: [...filters, ...(boundary ? [boundary] : [])] },
      orderBy: [{ createdAt: backward ? 'asc' : 'desc' }, { id: backward ? 'asc' : 'desc' }], take: take + 1, query: HEADER })
    const selected = rows.slice(0, take)
    if (cursor && !selected.length) throw new Error(INVALID_LEAD_CURSOR)
    if (backward) selected.reverse()
    const items = []
    for (const row of selected) {
      const header = await validHeader(scoped, row)
      if (!header) throw new Error('Lead workspace unavailable.')
      const lead = await privateLead(scoped, header)
      const history = await activities(scoped, header, 5)
      items.push({ ...lead, activities: history.items })
    }
    const sample = await scoped.query.Lead.findMany({ where: leadWhere(scoped), orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 500, query: 'id status identityKey' })
    const buckets = new Map<string, string[]>()
    for (const row of sample) if (row.identityKey && !['lost', 'closed'].includes(row.status)) buckets.set(row.identityKey, [...(buckets.get(row.identityKey) || []), row.id])
    const duplicateGroups = []
    for (const [key, ids] of [...buckets].filter(([, ids]) => ids.length > 1).slice(0, 12)) {
      const candidates = []
      for (const id of ids) {
        const header = await scopedLeadHeader(scoped, id)
        if (!header) throw new Error('Duplicate scan unavailable.')
        const lead = await privateLead(scoped, header)
        candidates.push({ id: lead.id, name: lead.name, email: lead.email, phone: lead.phone, status: lead.status,
          source: lead.source, createdAt: lead.createdAt, assignedAgent: lead.assignedAgent, property: lead.property })
      }
      duplicateGroups.push({ key: `identity:${key.slice(0, 12)}`, reason: 'Matching normalized contact identity', candidates })
    }
    const count = (status: string) => sample.filter(row => row.status === status).length
    const first = selected[0], last = selected[selected.length - 1]
    const hasNextPage = backward ? selected.length > 0 : rows.length > take
    const hasPreviousPage = backward ? rows.length > take : Boolean(cursor && selected.length)
    return { items, duplicateGroups, stats: { total: sample.length, new: count('new'), qualified: count('qualified'), tourScheduled: count('tour_scheduled'), offer: count('offer') },
      viewer: { actorId: scope.actorId, brokerageId: scope.brokerageId }, pageInfo: { hasNextPage, hasPreviousPage,
        nextCursor: hasNextPage && last ? encodeLeadCursor({ id: last.id, at: last.createdAt }, binding) : null,
        previousCursor: hasPreviousPage && first ? encodeLeadCursor({ id: first.id, at: first.createdAt }, binding) : null } }
  }, { timeout: 30_000 })
}
