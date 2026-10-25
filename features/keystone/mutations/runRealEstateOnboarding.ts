import type { Context } from '.keystone/types'

import { runRealEstateOnboarding } from '../onboarding/run-onboarding'
import { activeBrokerageIds } from '../access'
import { freshOperatorCommandContext } from '../lib/commandContext'
import type { SeedContext, SeedTarget } from '../onboarding/seed-runtime'

type SeedResult = {
  core: { created: number; skipped: number; total: number }
  expansion: { created: number; skipped: number; total: number }
}

type SeedRunner = (context: SeedContext, target: SeedTarget) => Promise<SeedResult>

/**
 * Setup applies to the session's active brokerage and requires an active
 * owner or administrator membership there plus the onboarding permission.
 */
function onboardingScope(context: Context) {
  const session = context.session as any
  const brokerageId = activeBrokerageIds(session)[0]
  const membership = brokerageId
    ? session?.data?.brokerageMemberships?.find((item: any) =>
      item.status === 'active' &&
      item.brokerage?.status === 'active' &&
      item.brokerage?.id === brokerageId &&
      ['owner', 'admin'].includes(item.membershipRole)
    )
    : null
  if (!session?.itemId || !session.data?.role?.canManageOnboarding || !membership?.brokerage?.slug) {
    throw new Error('Only a brokerage owner or administrator can run brokerage setup.')
  }
  return { session, target: { id: brokerageId, slug: membership.brokerage.slug } as SeedTarget }
}

export async function runRealEstateOnboardingTransaction(
  context: Context,
  seedRunner: SeedRunner | undefined = undefined,
  template: 'full' | 'minimal' = 'full'
) {
  const { session } = onboardingScope(context)

  return context.transaction(async transactionContext => {
    const sessionContext = await freshOperatorCommandContext(transactionContext.withSession(session))
    const { session: currentSession, target } = onboardingScope(sessionContext)
    // Seed data sets lifecycle fields (status, verification) that operators cannot
    // write directly, so setup runs elevated but only against the active brokerage.
    const sudo = sessionContext.sudo()

    // Join the brokerage-first command protocol before the narrower onboarding lock.
    await sudo.prisma.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `onboarding:${target.id}`)
    await sudo.db.User.updateOne({
      where: { id: currentSession.itemId },
      data: { onboardingStatus: 'in_progress' },
    })

    const result = await (seedRunner || ((seedContext: SeedContext, seedTarget: SeedTarget) => runRealEstateOnboarding(seedContext, seedTarget, template)))(sudo as unknown as SeedContext, target)

    // The tenancy migration inserts an empty "juniper-realty" brokerage marked primary,
    // even on a fresh install. The storefront serves the first active primary brokerage,
    // so that empty row would hide the brokerage set up here. Only primary brokerages
    // with no members, settings or listings are demoted; any real brokerage is untouched.
    const emptyPrimaries = await sudo.query.Brokerage.findMany({
      where: {
        id: { not: { equals: target.id } },
        isPrimary: { equals: true },
        memberships: { none: {} },
        settings: { none: {} },
        properties: { none: {} },
      },
      query: 'id',
    })
    for (const brokerage of emptyPrimaries) {
      await sudo.db.Brokerage.updateOne({ where: { id: String(brokerage.id) }, data: { isPrimary: false } })
    }

    await sudo.db.User.updateOne({
      where: { id: currentSession.itemId },
      data: { onboardingStatus: 'completed' },
    })

    return { completed: true, status: 'completed', ...result }
  }, { timeout: 120_000 })
}

export async function runRealEstateOnboardingMutation(
  _root: unknown,
  { template = 'full' }: { template?: string },
  context: Context
) {
  if (template !== 'full' && template !== 'minimal') throw new Error('Choose the basic or complete setup.')
  return runRealEstateOnboardingTransaction(context, undefined, template)
}

export async function dismissRealEstateOnboarding(
  _root: unknown,
  _args: Record<string, never>,
  context: Context
) {
  const { session } = onboardingScope(context)
  await context.sudo().db.User.updateOne({
    where: { id: session.itemId },
    data: { onboardingStatus: 'dismissed' },
  })
  return { completed: false, status: 'dismissed', core: null, expansion: null }
}
