import { randomBytes } from 'node:crypto'

import { DEFAULT_STORE_LOGO_COLOR, DEFAULT_STORE_LOGO_ICON } from '../../lib/store-logo'
import { lockSavedDiscoveryIdentity } from '../lib/savedDiscoveryIdentity'

type SeedItem = {
  key: string
  templates?: string[]
  data: Record<string, unknown>
}

type SeedSection = {
  listKey: string
  items: SeedItem[]
}

export type CoreSeed = {
  dependencyOrder: string[]
  sections: Record<string, SeedSection>
}

type AnchorName = 'brokerage' | 'agent' | 'property' | 'lead' | 'deal' | 'showing'

type ExpansionRecord = {
  listKey: string
  id: string
  lookup?: Record<string, unknown>
  data: Record<string, unknown>
}

export type ExpansionSeed = {
  anchors: {
    agentEmail: string
    propertySlug: string
    leadEmail: string
    dealTitle: string
    showingNotes: string
  }
  records: ExpansionRecord[]
}

type SeedListOperations = {
  findMany: (args: { where: Record<string, unknown>; take?: number; query: string; orderBy?: unknown }) => Promise<readonly { id: string }[]>
  createOne: (args: { data: Record<string, unknown>; query: string }) => Promise<{ id: string }>
  updateOne?: (args: { where: { id: string }; data: Record<string, unknown>; query: string }) => Promise<{ id: string }>
}

export type SeedContext = {
  query: Record<string, SeedListOperations | undefined>
  prisma?: { $executeRawUnsafe: (query: string, value: string) => Promise<unknown> }
}

type SeedResult = {
  created: number
  skipped: number
  total: number
}

/** The brokerage the seed is applied to: always the signed-in owner's active brokerage. */
export type SeedTarget = { id: string; slug: string }

const UNIQUE_LOOKUP_FIELDS: Record<string, string[]> = {
  brokerages: ['slug'],
  brokerageSettings: ['brokerage'],
  roles: ['name'],
  agents: ['email'],
  brokerageMemberships: ['membershipKey'],
  properties: ['slug'],
  routingRules: ['name'],
  leads: ['email'],
  leadActivities: ['lead', 'subject', 'occurredAt'],
  showings: ['lead', 'property', 'scheduledStart'],
  deals: ['title'],
}

/**
 * Bind static seed data to the target brokerage: membership and settings keys
 * are unique per brokerage, and settings carry the default storefront logo.
 */
function scopeCoreSeed(seed: CoreSeed, target: SeedTarget): CoreSeed {
  const sections = Object.fromEntries(Object.entries(seed.sections).map(([name, section]) => [name, {
    ...section,
    items: section.items.map(item => {
      const data = { ...item.data }
      if (name === 'brokerageMemberships' && typeof data.membershipKey === 'string') {
        data.membershipKey = `${target.slug}:${data.membershipKey}`
      }
      if (name === 'brokerageSettings') {
        data.key = `${target.slug}:primary`
        if (data.logoIcon === undefined) data.logoIcon = DEFAULT_STORE_LOGO_ICON
        if (data.logoColor === undefined) data.logoColor = DEFAULT_STORE_LOGO_COLOR
      }
      return { ...item, data }
    }),
  }]))
  return { ...seed, sections }
}

function getCoreRef(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const ref = (value as { connect?: { $ref?: unknown } }).connect?.$ref
  return typeof ref === 'string' ? ref : null
}

function resolveCoreRefs(value: unknown, ids: Map<string, string>): unknown {
  const ref = getCoreRef(value)
  if (ref) {
    const id = ids.get(ref)
    if (!id) throw new Error(`Cannot resolve core seed reference ${ref}`)
    return { connect: { id } }
  }
  if (Array.isArray(value)) return value.map(item => resolveCoreRefs(item, ids))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, resolveCoreRefs(child, ids)]))
  }
  return value
}

function equalsFilter(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'connect' in value) {
    const id = (value as { connect?: { id?: unknown } }).connect?.id
    if (typeof id === 'string') return { id: { equals: id } }
  }
  return { equals: value }
}

function requiredConnectId(data: Record<string, unknown>, field: string) {
  const value = data[field] as { connect?: { id?: unknown } } | undefined
  const id = value?.connect?.id
  if (typeof id !== 'string' || !id) throw new Error(`Core seed ${field} requires an explicit resolved connection`)
  return id
}

function buildCoreLookup(sectionName: string, data: Record<string, unknown>) {
  const fields = UNIQUE_LOOKUP_FIELDS[sectionName]
  if (!fields?.length) throw new Error(`No idempotent lookup configured for core seed section ${sectionName}`)
  return Object.fromEntries(fields.map(field => {
    const value = data[field]
    if (value === undefined || value === null || value === '') {
      throw new Error(`Cannot build core seed lookup for ${sectionName}: missing ${field}`)
    }
    return [field, equalsFilter(value)]
  }))
}

async function assertNoUnreviewedSeedMembershipLinks(context: SeedContext, seed: CoreSeed, template: 'minimal' | 'full') {
  const agents = seed.sections.agents
  const memberships = seed.sections.brokerageMemberships
  if (!agents || !memberships) return
  const usersList = context.query.User
  const membershipsList = context.query.BrokerageMembership
  if (!usersList || !membershipsList) throw new Error('Core seed requires User and BrokerageMembership lists for membership review.')
  const agentsByKey = new Map(agents.items.filter(item => item.templates?.includes(template) ?? true).map(item => [item.key, item]))

  for (const item of memberships.items.filter(item => item.templates?.includes(template) ?? true)) {
    const userConnection = item.data.user as { connect?: { $ref?: unknown } } | undefined
    const reference = userConnection?.connect?.$ref
    if (typeof reference !== 'string' || !reference.startsWith('agents:')) continue
    const agent = agentsByKey.get(reference.slice('agents:'.length))
    if (!agent) continue
    const email = agent.data.email
    const membershipKey = item.data.membershipKey
    if (typeof email !== 'string' || !email || typeof membershipKey !== 'string' || !membershipKey) {
      throw new Error('Core seed membership requires an explicit agent email and unique key.')
    }
    const existingUsers = await usersList.findMany({ where: { email: { equals: email } }, take: 1, query: 'id' })
    if (!existingUsers[0]?.id) continue
    const existingMemberships = await membershipsList.findMany({
      where: { membershipKey: { equals: membershipKey } },
      take: 1,
      query: 'id user { id }',
    })
    const existingMembership = existingMemberships[0] as ({
      id: string
      user?: { id?: string; connect?: { id?: string } }
    } | undefined)
    const linkedUserId = existingMembership?.user?.id || existingMembership?.user?.connect?.id
    if (linkedUserId !== existingUsers[0].id) {
      throw new Error('An agent in the setup data already has an account that is not a member of this brokerage. Remove or rename that account and try again.')
    }
  }
}

export async function applyCoreSeed(
  context: SeedContext,
  sourceSeed: CoreSeed,
  target: SeedTarget,
  template: 'minimal' | 'full' = 'full',
  log: (message: string) => void = () => undefined
): Promise<SeedResult> {
  const seed = scopeCoreSeed(sourceSeed, target)
  const ids = new Map<string, string>()
  const createdAgentIds = new Set<string>()
  await assertNoUnreviewedSeedMembershipLinks(context, seed, template)
  let created = 0
  let skipped = 0
  let total = 0

  for (const sectionName of seed.dependencyOrder) {
    const section = seed.sections[sectionName]
    if (!section) throw new Error(`Core dependencyOrder references missing section ${sectionName}`)
    const list = context.query[section.listKey]
    if (!list) throw new Error(`Keystone list ${section.listKey} is not available on context.query`)

    for (const item of section.items.filter(item => item.templates?.includes(template) ?? true)) {
      total += 1
      const refKey = `${sectionName}:${item.key}`
      if (sectionName === 'brokerages') {
        // Never create or look up another tenant: the seed names the target brokerage.
        const name = typeof item.data.name === 'string' ? item.data.name.trim() : ''
        if (name && list.updateOne) await list.updateOne({ where: { id: target.id }, data: { name }, query: 'id' })
        ids.set(refKey, target.id)
        skipped += 1
        log(`applied ${refKey} to brokerage ${target.slug}`)
        continue
      }
      const data = resolveCoreRefs(item.data, ids) as Record<string, unknown>
      const existing = await list.findMany({ where: buildCoreLookup(sectionName, data), take: 1, query: 'id' })
      if (existing[0]?.id) {
        // Replay is insert-only. Suspensions, role/tenant moves and other earned
        // state must never be repaired or reactivated by setup.
        ids.set(refKey, existing[0].id)
        skipped += 1
        log(`skip existing ${refKey}`)
        continue
      }
      if (sectionName === 'agents') {
        requiredConnectId(data, 'activeBrokerage')
        // Seeded agents never get a repository-known password; they sign in
        // after resetting their password by email.
        data.password = randomBytes(32).toString('base64url')
      }
      if (sectionName === 'brokerageMemberships') {
        requiredConnectId(data, 'brokerage')
        const userId = requiredConnectId(data, 'user')
        if (!createdAgentIds.has(userId)) {
          throw new Error('An agent in the setup data already has an account that is not a member of this brokerage. Remove or rename that account and try again.')
        }
      }
      const result = await list.createOne({ data, query: 'id' })
      ids.set(refKey, result.id)
      if (sectionName === 'agents') createdAgentIds.add(result.id)
      created += 1
      log(`created ${refKey} (${result.id})`)
    }
  }

  return { created, skipped, total }
}

async function findAnchor(context: SeedContext, listKey: string, where: Record<string, unknown>, label: string) {
  const list = context.query[listKey]
  if (!list) throw new Error(`Keystone list ${listKey} is not available on context.query`)
  const rows = await list.findMany({ where, take: 1, query: 'id' })
  if (!rows[0]?.id) throw new Error(`Missing core seed anchor: ${label}`)
  return rows[0].id
}

async function resolveAnchors(context: SeedContext, seed: ExpansionSeed, target: SeedTarget) {
  const anchors = new Map<AnchorName, string>()
  const inBrokerage = { brokerage: { id: { equals: target.id } } }
  anchors.set('brokerage', target.id)
  anchors.set('agent', await findAnchor(context, 'User', { email: { equals: seed.anchors.agentEmail } }, seed.anchors.agentEmail))
  anchors.set('property', await findAnchor(context, 'Property', { slug: { equals: seed.anchors.propertySlug }, ...inBrokerage }, seed.anchors.propertySlug))
  anchors.set('lead', await findAnchor(context, 'Lead', { email: { equals: seed.anchors.leadEmail }, ...inBrokerage }, seed.anchors.leadEmail))
  anchors.set('deal', await findAnchor(context, 'Deal', { title: { equals: seed.anchors.dealTitle }, ...inBrokerage }, seed.anchors.dealTitle))
  anchors.set('showing', await findAnchor(context, 'Showing', { notes: { equals: seed.anchors.showingNotes }, ...inBrokerage }, seed.anchors.showingNotes))
  return anchors
}

function resolveExpansionLinks(value: unknown, anchors: Map<AnchorName, string>, records: Map<string, string>): unknown {
  if (Array.isArray(value)) return value.map(item => resolveExpansionLinks(item, anchors, records))
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>
    if (typeof object.$anchor === 'string') {
      const id = anchors.get(object.$anchor as AnchorName)
      if (!id) throw new Error(`Unknown or unresolved expansion seed anchor ${object.$anchor}`)
      return { connect: { id } }
    }
    if (typeof object.$record === 'string') {
      const id = records.get(object.$record)
      if (!id) throw new Error(`Unknown or unresolved expansion seed record ${object.$record}`)
      return { connect: { id } }
    }
    return Object.fromEntries(Object.entries(object).map(([key, child]) => [key, resolveExpansionLinks(child, anchors, records)]))
  }
  return value
}

export async function applyExpansionSeed(
  context: SeedContext,
  seed: ExpansionSeed,
  target: SeedTarget,
  log: (message: string) => void = () => undefined
): Promise<SeedResult> {
  const anchors = await resolveAnchors(context, seed, target)
  const recordIds = new Map<string, string>()
  let created = 0
  let skipped = 0

  for (const record of seed.records) {
    const list = context.query[record.listKey]
    if (!list) throw new Error(`Keystone list ${record.listKey} is not available on context.query`)
    const data = resolveExpansionLinks(record.data, anchors, recordIds) as Record<string, unknown>
    let lookupWhere: Record<string, unknown>
    let take = 1
    if (record.listKey === 'SavedSearch') {
      const brokerageId = requiredConnectId(data, 'brokerage')
      const userId = requiredConnectId(data, 'user')
      const name = typeof data.name === 'string' ? data.name.trim() : ''
      if (!name) throw new Error(`Expansion record ${record.id} requires a saved-search name.`)
      if (!context.prisma) throw new Error('Saved-search seed requires a transaction-bound advisory lock client.')
      data.name = name
      await lockSavedDiscoveryIdentity(context.prisma, 'search', brokerageId, userId, name)
      lookupWhere = {
        brokerage: { id: { equals: brokerageId } },
        user: { id: { equals: userId } },
        name: { equals: name },
      }
      take = 2
    } else {
      const lookupData = resolveExpansionLinks(record.lookup || record.data, anchors, recordIds) as Record<string, unknown>
      lookupWhere = Object.fromEntries(
        Object.entries(lookupData)
          .filter(([field]) => record.lookup ? true : field === 'slug' || field.endsWith('Number'))
          .map(([field, value]) => [field, equalsFilter(value)])
      )
    }
    if (!Object.keys(lookupWhere).length) throw new Error(`Expansion record ${record.id} has no idempotent lookup`)

    const existing = await list.findMany({ where: lookupWhere, take, query: 'id' })
    if (record.listKey === 'SavedSearch' && existing.length > 1) {
      throw new Error('A saved search with this name exists more than once. Remove the duplicate and try again.')
    }
    if (existing[0]?.id) {
      recordIds.set(record.id, existing[0].id)
      skipped += 1
      log(`skip existing ${record.listKey}:${record.id}`)
      continue
    }
    if (record.listKey === 'Offer' && data.status === 'accepted') {
      const dealId = requiredConnectId(data, 'deal')
      const accepted = await list.findMany({
        where: { deal: { id: { equals: dealId } }, status: { equals: 'accepted' } },
        take: 2,
        query: 'id offerNumber',
      })
      if (accepted.length) {
        throw new Error('This deal already has an accepted offer, so setup will not add another one.')
      }
    }

    const result = await list.createOne({ data, query: 'id' })
    recordIds.set(record.id, result.id)
    created += 1
    log(`created ${record.listKey}:${record.id} (${result.id})`)
  }

  return { created, skipped, total: seed.records.length }
}
