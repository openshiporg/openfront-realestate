import type { Context } from '.keystone/types'

// Neutral first brokerage; the owner renames it during setup or in settings.
const BROKERAGE_NAME = 'My Brokerage'
const BROKERAGE_SLUG = 'my-brokerage'
const MEMBERSHIP_KEY = `${BROKERAGE_SLUG}:initial-owner`
const ROLE_NAME = 'Admin'

const roleData = {
  name: ROLE_NAME,
  canSeeOtherPeople: true,
  canEditOtherPeople: true,
  canManagePeople: true,
  canManageRoles: true,
  canAccessDashboard: true,
  canManageListings: true,
  canManageLeads: true,
  canManageShowings: true,
  canManageDeals: true,
  canViewReports: true,
  canManageOnboarding: true,
}

function exactlyOne(items: any[], label: string): any {
  if (items.length > 1) throw new Error(`Cannot create the first account: more than one ${label} already exists.`)
  return items[0]
}

/**
 * Owns the complete createInitialUser write in one database transaction.
 * The sudo context is transaction-scoped and is never returned or reused.
 */
export async function createInitialOwner(
  context: Context,
  data: { name: string; email: string; password: string }
) {
  return context.transaction(async transactionContext => {
    const sudo = transactionContext.sudo() as any
    await sudo.prisma.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      'bootstrap:initial-owner'
    )

    if (await sudo.db.User.count()) {
      throw new Error('Initial items can only be created when no users exist.')
    }

    const brokerageMatches = await sudo.query.Brokerage.findMany({
      where: { slug: { equals: BROKERAGE_SLUG } },
      take: 2,
      query: 'id name slug status isPrimary',
    })
    let brokerage = await exactlyOne(brokerageMatches, 'starter brokerage')
    if (brokerage) {
      brokerage = await sudo.db.Brokerage.updateOne({
        where: { id: brokerage.id },
        data: { status: 'active', isPrimary: true },
      })
    } else {
      brokerage = await sudo.db.Brokerage.createOne({
        data: { name: BROKERAGE_NAME, slug: BROKERAGE_SLUG, status: 'active', isPrimary: true },
      })
    }

    const roleMatches = await sudo.query.Role.findMany({
      where: { name: { equals: ROLE_NAME } },
      take: 2,
      query: 'id name',
    })
    let role = await exactlyOne(roleMatches, 'Admin role')
    role = role
      ? await sudo.db.Role.updateOne({ where: { id: role.id }, data: roleData })
      : await sudo.db.Role.createOne({ data: roleData })

    const existingMemberships = await sudo.query.BrokerageMembership.findMany({
      where: { membershipKey: { equals: MEMBERSHIP_KEY } },
      take: 2,
      query: 'id brokerage { id } user { id }',
    })
    if (existingMemberships.length) {
      throw new Error('Cannot create the first account: an owner membership already exists.')
    }

    const user = await sudo.db.User.createOne({
      data: {
        ...data,
        role: { connect: { id: role.id } },
        activeBrokerage: { connect: { id: brokerage.id } },
        onboardingStatus: 'not_started',
      },
    })
    const membership = await sudo.db.BrokerageMembership.createOne({
      data: {
        membershipKey: MEMBERSHIP_KEY,
        brokerage: { connect: { id: brokerage.id } },
        user: { connect: { id: user.id } },
        membershipRole: 'owner',
        status: 'active',
        isPrimary: true,
        joinedAt: new Date().toISOString(),
      },
    })

    const memberships = await sudo.query.BrokerageMembership.findMany({
      where: { user: { id: { equals: user.id } } },
      take: 2,
      query: 'id membershipRole status isPrimary brokerage { id } user { id }',
    })
    if (
      (await sudo.db.User.count()) !== 1 ||
      memberships.length !== 1 ||
      memberships[0].id !== membership.id ||
      memberships[0].brokerage?.id !== brokerage.id ||
      memberships[0].user?.id !== user.id ||
      memberships[0].membershipRole !== 'owner' ||
      memberships[0].status !== 'active' ||
      !memberships[0].isPrimary
    ) {
      throw new Error('Initial owner bootstrap invariant failed; the transaction was rolled back.')
    }

    return user
  }, { timeout: 30_000 })
}

export function installInitialOwnerResolver(schema: any) {
  const field = schema.getMutationType()?.getFields()?.createInitialUser
  if (!field) throw new Error('Keystone createInitialUser mutation is unavailable.')

  field.resolve = async (_root: unknown, { data }: { data: { name: string; email: string; password: string } }, context: Context) => {
    if (!context.sessionStrategy) throw new Error('No session implementation available on context.')
    const item = await createInitialOwner(context, data)
    const sessionToken = await context.sessionStrategy.start({
      data: { listKey: 'User', itemId: item.id.toString() },
      context,
    })
    if (typeof sessionToken !== 'string' || !sessionToken.length) throw new Error('Failed to start session.')
    return { item, sessionToken }
  }
  return schema
}
