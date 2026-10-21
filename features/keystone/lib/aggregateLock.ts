import type { Context } from '.keystone/types'

const direct = new Set(['Lead', 'Property', 'Showing', 'Deal', 'Offer', 'Commission', 'AgentTask', 'DealDocument', 'TransactionMilestone', 'SavedSearchAlert', 'SourceFeed', 'ListingSyndication', 'CommissionLedgerEntry', 'BrokerageMembership'])
const throughDeal = new Set(['Disclosure', 'PropertyInspection'])

/** Finite, scoped physical locks exclude ordinary generic/inverse PostgreSQL
 * writers from a controlled decision. Advisory locks alone cannot do that.
 * All identifiers are backend constants; values stay bound parameters. */
export async function lockAggregate(context: Context, list: string, id: string, brokerageId: string) {
  if (!id || !brokerageId) throw new Error('A scoped aggregate identity is required.')
  if (direct.has(list)) {
    await context.prisma.$executeRawUnsafe(`SELECT "id" FROM "${list}" WHERE "id"=$1 AND "brokerage"=$2 FOR NO KEY UPDATE`, id, brokerageId)
  } else if (throughDeal.has(list)) {
    await context.prisma.$executeRawUnsafe(`SELECT target."id" FROM "${list}" target JOIN "Deal" parent ON target."deal"=parent."id" WHERE target."id"=$1 AND parent."brokerage"=$2 FOR NO KEY UPDATE OF target`, id, brokerageId)
  } else if (list === 'OpenHouse') {
    await context.prisma.$executeRawUnsafe('SELECT target."id" FROM "OpenHouse" target JOIN "Property" parent ON target."property"=parent."id" WHERE target."id"=$1 AND parent."brokerage"=$2 FOR NO KEY UPDATE OF target', id, brokerageId)
  } else throw new Error('Unsupported controlled aggregate lock.')
}

const aggregateLists: Record<string, string> = {
  lead: 'Lead', property: 'Property', showing: 'Showing', deal: 'Deal', offer: 'Offer', commission: 'Commission', document: 'DealDocument',
  'agent-task': 'AgentTask', inspection: 'PropertyInspection', 'saved-search-alert': 'SavedSearchAlert', 'source-feed': 'SourceFeed', 'listing-syndication': 'ListingSyndication',
}
export async function lockCommandAggregate(context: Context, lockKey: string, brokerageId: string) {
  const parts = lockKey.split(':')
  let list: string | undefined, id: string | undefined
  if (parts[0] === 'aggregate' && parts.length === 3) { list = aggregateLists[parts[1]]; id = parts[2] }
  else if (parts[0] === 'ledger' && parts[1] === 'commission' && parts.length === 3) { list = 'Commission'; id = parts[2] }
  else if (parts[0] === 'ledger-entry' && parts.length === 2) { list = 'CommissionLedgerEntry'; id = parts[1] }
  else if (parts[0] === 'evidence' && parts[1] === 'document' && parts.length === 3) { list = 'DealDocument'; id = parts[2] }
  else if (parts[0] === 'authority' && parts[1] === 'listing' && parts.length === 3) { list = 'Property'; id = parts[2] }
  else if (parts[0] === 'authority' && parts[1] === 'representation' && parts.length === 3) { list = 'Lead'; id = parts[2] }
  else if (parts[0] === 'membership' && parts.length === 2) { list = 'BrokerageMembership'; id = parts[1] }
  if (list && id) await lockAggregate(context, list, id, brokerageId)
}
