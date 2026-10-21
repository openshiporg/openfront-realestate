import type { Context } from '.keystone/types'

import { activeBrokerageIds } from '../access'

/**
 * Conservative single-brokerage write serialization. Acquire this BEFORE any
 * narrower aggregate lock. Participating controlled commands/public intake join
 * this protocol. Property row locks separately exclude generic edits at decision
 * entry points; the actor row is held here so generic global-role assignment
 * cannot change authority before this command commits. Physical lock lifetime
 * must be verified separately from SDK handle tracing.
 * No network/provider work belongs inside the transaction.
 */
export async function lockBrokerageCommand(context: Context, brokerageId: string) {
  if (!brokerageId || brokerageId.length > 200) throw new Error('An active brokerage is required.')
  await context.prisma.$executeRawUnsafe(
    'SELECT pg_advisory_xact_lock(hashtext($1))',
    `brokerage-command:${brokerageId}`,
  )
}

/** Recheck authority AFTER waiting for the lock, including suspension and replay. */
export async function freshOperatorCommandContext(context: Context) {
  const session = context.session as any
  const brokerageId = activeBrokerageIds(session)[0]
  if (!session?.itemId || !brokerageId) throw new Error('An active brokerage membership is required.')
  await lockBrokerageCommand(context, brokerageId)
  await context.prisma.$executeRawUnsafe('SELECT "id" FROM "User" WHERE "id" = $1 FOR NO KEY UPDATE', session.itemId)
  // Narrow elevation: current actor only; never trust an input user/tenant/role.
  const current = await context.sudo().query.User.findOne({
    where: { id: session.itemId },
    query: `id name email activeBrokerage { id slug status }
      brokerageMemberships(where: { brokerage: { id: { equals: ${JSON.stringify(brokerageId)} } } }, take: 100) { id status membershipRole isPrimary brokerage { id slug status } }
      role { id name canAccessDashboard canSeeOtherPeople canEditOtherPeople
        canManagePeople canManageRoles canManageListings canManageLeads
        canManageShowings canManageDeals canViewReports canManageOnboarding }`,
  })
  const nextSession = { ...session, data: current }
  if (!current || current.id !== session.itemId || activeBrokerageIds(nextSession)[0] !== brokerageId) {
    throw new Error('An active brokerage membership is required.')
  }
  return context.withSession(nextSession)
}

/**
 * Complete decision history, not a first-N display projection. Large histories
 * fail closed rather than silently dropping revocation/hold/reversal events.
 * Call under the owning brokerage's transaction lock for a stable decision.
 */
export async function decisionRows(list: any, args: { where: any; query: string; orderBy?: any }) {
  const rows: any[] = []
  const pageSize = 200
  const maxRows = 10_000
  for (let skip = 0; skip <= maxRows; skip += pageSize) {
    const page = await list.findMany({
      ...args,
      orderBy: args.orderBy || [{ createdAt: 'asc' }, { id: 'asc' }],
      take: pageSize,
      skip,
    })
    if (rows.length + page.length > maxRows) throw new Error('Evidence history requires offline review before this action.')
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
  throw new Error('Evidence history requires offline review before this action.')
}
