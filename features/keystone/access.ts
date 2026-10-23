export type Session = {
  itemId: string
  listKey: string
  data: {
    name: string
    activeBrokerage?: { id: string; slug: string; status: 'active' | 'suspended' | 'archived' } | null
    brokerageMemberships?: Array<{
      id: string
      membershipRole: 'owner' | 'admin' | 'team_lead' | 'agent' | 'coordinator' | 'analyst'
      status: 'invited' | 'active' | 'suspended'
      isPrimary: boolean
      brokerage?: { id: string; slug: string; status: 'active' | 'suspended' | 'archived' } | null
    }>
    role: {
      id: string
      name: string
      canSeeOtherPeople: boolean
      canEditOtherPeople: boolean
      canManagePeople: boolean
      canManageRoles: boolean
      canAccessDashboard: boolean
      canManageListings: boolean
      canManageLeads: boolean
      canManageShowings: boolean
      canManageDeals: boolean
      canViewReports: boolean
      canManageOnboarding: boolean
    }
  }
}

export type AccessArgs = {
  session?: Session
}

export function hasActiveBrokerageSession({ session }: AccessArgs) {
  return Boolean(session?.itemId && activeBrokerageIds(session).length)
}

/** Any signed-in identity, including storefront customers. */
export function isSignedIn({ session }: AccessArgs) {
  return Boolean(session?.itemId)
}

/** A signed-in operator with exactly one active membership in the selected brokerage. */
export function isOperator(args: AccessArgs) {
  return hasActiveBrokerageSession(args)
}

const hasRoleFlag = (session: Session | undefined, flag: keyof Session['data']['role']) =>
  Boolean(session?.data.role?.[flag])

export function activeBrokerageIds(session?: Session) {
  const memberships = session?.data.brokerageMemberships || []
  const liveMemberships = memberships.filter(membership => membership.status === 'active' && membership.brokerage?.status === 'active')
  // With no brokerage selected, a single live membership is unambiguous.
  const selected = session?.data.activeBrokerage || (liveMemberships.length === 1 ? liveMemberships[0].brokerage : null)
  if (!selected || selected.status !== 'active') return []
  const selectedMemberships = memberships.filter(membership =>
    membership.status === 'active' &&
    membership.brokerage?.status === 'active' &&
    membership.brokerage.id === selected.id
  )
  return selectedMemberships.length === 1 ? [selected.id] : []
}

type RelationshipInput = {
  connect?: { id?: string } | null
  disconnect?: boolean
}

type BrokerageInputArgs = AccessArgs & {
  inputData?: Record<string, unknown>
  context?: any
}

function relationshipInput(inputData: Record<string, unknown> | undefined, field: string) {
  const value = inputData?.[field]
  return value && typeof value === 'object' ? value as RelationshipInput : undefined
}

export function canCreateInActiveBrokerage({ session, inputData }: BrokerageInputArgs) {
  const brokerageId = relationshipInput(inputData, 'brokerage')?.connect?.id
  return Boolean(brokerageId && activeBrokerageIds(session).includes(brokerageId))
}

async function canCreateForActiveParent({ session, inputData, context }: BrokerageInputArgs, field: string, listKey: string) {
  const parentId = relationshipInput(inputData, field)?.connect?.id
  if (!parentId || !context) return false
  const parent = await context.sudo().query[listKey].findOne({ where: { id: parentId }, query: 'id brokerage { id status }' })
  return Boolean(parent?.brokerage?.status === 'active' && activeBrokerageIds(session).includes(parent.brokerage.id))
}

export const canCreateForActiveDeal = (args: BrokerageInputArgs) => canCreateForActiveParent(args, 'deal', 'Deal')
export const canCreateForActiveProperty = (args: BrokerageInputArgs) => canCreateForActiveParent(args, 'property', 'Property')
export const canCreateForActiveSubjectProperty = (args: BrokerageInputArgs) => canCreateForActiveParent(args, 'subjectProperty', 'Property')
export const canCreateForActiveShowing = (args: BrokerageInputArgs) => canCreateForActiveParent(args, 'showing', 'Showing')
export const canCreateForActiveSavedSearch = (args: BrokerageInputArgs) => canCreateForActiveParent(args, 'savedSearch', 'SavedSearch')

async function canCreateForAssignedParent({ session, inputData, context }: BrokerageInputArgs, field: string, listKey: string, permission: keyof Session['data']['role']) {
  const parentId = relationshipInput(inputData, field)?.connect?.id
  if (!parentId || !context || !session?.data.role?.[permission]) return false
  const parent = await context.sudo().query[listKey].findOne({ where: { id: parentId }, query: 'id brokerage { id status } assignedAgent { id }' })
  if (!parent?.brokerage?.id || parent.brokerage.status !== 'active' || !activeBrokerageIds(session).includes(parent.brokerage.id)) return false
  return Boolean(session.data.role.canManagePeople || parent.assignedAgent?.id === session.itemId)
}

export const canCreateForManagedProperty = (args: BrokerageInputArgs) => canCreateForAssignedParent(args, 'property', 'Property', 'canManageListings')
export const canCreateForManagedSubjectProperty = (args: BrokerageInputArgs) => canCreateForAssignedParent(args, 'subjectProperty', 'Property', 'canManageListings')

export function canMoveToActiveBrokerage({ session, inputData }: BrokerageInputArgs) {
  if (!inputData || !Object.prototype.hasOwnProperty.call(inputData, 'brokerage')) return true
  const relationship = relationshipInput(inputData, 'brokerage')
  if (relationship?.disconnect) return false
  const brokerageId = relationship?.connect?.id
  return Boolean(brokerageId && activeBrokerageIds(session).includes(brokerageId))
}

export function validateRequiredToOneRelationship({
  operation,
  inputData,
  field,
  addValidationError,
}: {
  operation: 'create' | 'update'
  inputData?: Record<string, unknown>
  field: string
  addValidationError: (message: string) => void
}) {
  const relationship = relationshipInput(inputData, field)
  const label = field.charAt(0).toUpperCase() + field.slice(1)

  if (operation === 'create' && !relationship?.connect) {
    addValidationError(`${label} is required.`)
  }
  if (operation === 'update' && relationship?.disconnect) {
    addValidationError(`${label} cannot be disconnected.`)
  }
}

export const permissions = {
  canAccessDashboard: ({ session }: AccessArgs) =>
    hasRoleFlag(session, 'canAccessDashboard') && activeBrokerageIds(session).length > 0,
  canManagePeople: ({ session }: AccessArgs) => hasRoleFlag(session, 'canManagePeople'),
  canManageRoles: ({ session }: AccessArgs) => hasRoleFlag(session, 'canManageRoles'),
  canManageListings: ({ session }: AccessArgs) => hasRoleFlag(session, 'canManageListings'),
  canManageLeads: ({ session }: AccessArgs) => hasRoleFlag(session, 'canManageLeads'),
  canManageShowings: ({ session }: AccessArgs) => hasRoleFlag(session, 'canManageShowings'),
  canManageDeals: ({ session }: AccessArgs) => hasRoleFlag(session, 'canManageDeals'),
  canViewReports: ({ session }: AccessArgs) => hasRoleFlag(session, 'canViewReports'),
  canViewMarketIntelligence: ({ session }: AccessArgs) =>
    hasRoleFlag(session, 'canManageListings') || hasRoleFlag(session, 'canViewReports'),
  canReadSensitiveDeals: ({ session }: AccessArgs) =>
    hasRoleFlag(session, 'canManageDeals') && hasRoleFlag(session, 'canManagePeople'),
  canReadLeadActivities: ({ session }: AccessArgs) =>
    hasRoleFlag(session, 'canManageLeads') && hasRoleFlag(session, 'canManagePeople'),
  canManageOnboarding: ({ session }: AccessArgs) => hasRoleFlag(session, 'canManageOnboarding'),
  canManageBrokerageListings: ({ session }: AccessArgs) => hasRoleFlag(session, 'canManageListings') && hasRoleFlag(session, 'canManagePeople'),
  canManageBrokerageDeals: ({ session }: AccessArgs) => hasRoleFlag(session, 'canManageDeals') && hasRoleFlag(session, 'canManagePeople'),
  canManageBrokerageShowings: ({ session }: AccessArgs) => hasRoleFlag(session, 'canManageShowings') && hasRoleFlag(session, 'canManagePeople'),
  canManageBrokerageTasks: ({ session }: AccessArgs) => hasRoleFlag(session, 'canManageLeads') && hasRoleFlag(session, 'canManagePeople'),
  // Storefront/brokerage settings belong to brokerage administrators: people
  // managers with dashboard access. Onboarding is a separate, one-time grant.
  canManageBrokerageSettings: ({ session }: AccessArgs) =>
    hasRoleFlag(session, 'canManagePeople') && hasRoleFlag(session, 'canAccessDashboard') && activeBrokerageIds(session).length > 0,
  canReadLeads: ({ session }: AccessArgs) =>
    hasRoleFlag(session, 'canManageLeads'),
  canReadShowings: ({ session }: AccessArgs) =>
    hasRoleFlag(session, 'canManageShowings'),
  canReadDeals: ({ session }: AccessArgs) =>
    hasRoleFlag(session, 'canManageDeals'),
}

function brokerageOwnedFilter(session?: Session) {
  const brokerageIds = activeBrokerageIds(session)
  return brokerageIds.length ? { brokerage: { id: { in: brokerageIds } } } : false
}

function brokerageAndAssignment(session: Session | undefined, assignment: Record<string, unknown>) {
  const brokerage = brokerageOwnedFilter(session)
  return brokerage === false ? false : { AND: [brokerage, assignment] }
}

export const rules = {
  canReadBrokerages: ({ session }: AccessArgs) => {
    const brokerageIds = activeBrokerageIds(session)
    return brokerageIds.length ? { id: { in: brokerageIds } } : false
  },
  canReadBrokerageMemberships: ({ session }: AccessArgs) => {
    const brokerageIds = activeBrokerageIds(session)
    return brokerageIds.length ? { brokerage: { id: { in: brokerageIds } } } : false
  },
  canAccessBrokerageRecords: ({ session }: AccessArgs) => brokerageOwnedFilter(session),
  canReadPeople: ({ session }: AccessArgs) => {
    if (!session) return false

    if (session.data.role?.canSeeOtherPeople) {
      const brokerageIds = activeBrokerageIds(session)
      if (!brokerageIds.length) return { id: { equals: session.itemId } }
      return {
        OR: [
          { id: { equals: session.itemId } },
          {
            brokerageMemberships: {
              some: {
                status: { equals: 'active' },
                brokerage: { id: { in: brokerageIds } },
              },
            },
          },
        ],
      }
    }

    return { id: { equals: session.itemId } }
  },
  // Everyone may update themselves. People editors may also update members of
  // their active brokerage; credentials stay self-service (see User.password).
  canUpdatePeople: ({ session }: AccessArgs) => {
    if (!session?.itemId) return false
    const brokerageIds = activeBrokerageIds(session)
    if (!session.data.role?.canEditOtherPeople || !brokerageIds.length) return { id: { equals: session.itemId } }
    return {
      OR: [
        { id: { equals: session.itemId } },
        {
          brokerageMemberships: {
            some: {
              status: { equals: 'active' },
              brokerage: { id: { in: brokerageIds } },
            },
          },
        },
      ],
    }
  },
  canReadLeads: ({ session }: AccessArgs) => {
    if (!session?.data.role?.canManageLeads) return false
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session)
    return brokerageAndAssignment(session, { assignedAgent: { id: { equals: session.itemId } } })
  },
  canManageAssignedLeads: ({ session }: AccessArgs) => {
    if (!session?.data.role?.canManageLeads) return false
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session)
    return brokerageAndAssignment(session, { assignedAgent: { id: { equals: session.itemId } } })
  },
  canReadLeadActivities: ({ session }: AccessArgs) => {
    if (!session?.data.role?.canManageLeads) return false
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session)
    return brokerageAndAssignment(session, { lead: { assignedAgent: { id: { equals: session.itemId } } } })
  },
  canManageAssignedLeadActivities: ({ session }: AccessArgs) => {
    if (!session?.data.role?.canManageLeads) return false
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session)
    return brokerageAndAssignment(session, { lead: { assignedAgent: { id: { equals: session.itemId } } } })
  },
  canReadShowings: ({ session }: AccessArgs) => {
    if (!session?.data.role?.canManageShowings) return false
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session)
    return brokerageAndAssignment(session, { assignedAgent: { id: { equals: session.itemId } } })
  },
  canManageAssignedShowings: ({ session }: AccessArgs) => {
    if (!session?.data.role?.canManageShowings) return false
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session)
    return brokerageAndAssignment(session, { assignedAgent: { id: { equals: session.itemId } } })
  },
  canReadDeals: ({ session }: AccessArgs) => {
    if (!session?.data.role?.canManageDeals) return false
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session)
    return brokerageAndAssignment(session, { assignedAgent: { id: { equals: session.itemId } } })
  },
  canManageAssignedDeals: ({ session }: AccessArgs) => {
    if (!session?.data.role?.canManageDeals) return false
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session)
    return brokerageAndAssignment(session, { assignedAgent: { id: { equals: session.itemId } } })
  },
  canReadPropertyChildren: ({ session }: AccessArgs) => {
    const brokerageIds = activeBrokerageIds(session)
    return brokerageIds.length ? { property: { brokerage: { id: { in: brokerageIds } } } } : false
  },
  canManageAssignedProperties: ({ session }: AccessArgs) => {
    if (!session?.data.role?.canManageListings) return false
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session)
    return brokerageAndAssignment(session, { assignedAgent: { id: { equals: session.itemId } } })
  },
  canManagePropertyChildren: ({ session }: AccessArgs) => {
    if (!session?.data.role?.canManageListings) return false
    const brokerageIds = activeBrokerageIds(session)
    if (!brokerageIds.length) return false
    return session.data.role.canManagePeople
      ? { property: { brokerage: { id: { in: brokerageIds } } } }
      : { property: { AND: [{ brokerage: { id: { in: brokerageIds } } }, { assignedAgent: { id: { equals: session.itemId } } }] } }
  },
  canReadSubjectPropertyChildren: ({ session }: AccessArgs) => {
    const brokerageIds = activeBrokerageIds(session)
    return brokerageIds.length ? { subjectProperty: { brokerage: { id: { in: brokerageIds } } } } : false
  },
  canManageSubjectPropertyChildren: ({ session }: AccessArgs) => {
    if (!session?.data.role?.canManageListings) return false
    const brokerageIds = activeBrokerageIds(session)
    if (!brokerageIds.length) return false
    return session.data.role.canManagePeople
      ? { subjectProperty: { brokerage: { id: { in: brokerageIds } } } }
      : { subjectProperty: { AND: [{ brokerage: { id: { in: brokerageIds } } }, { assignedAgent: { id: { equals: session.itemId } } }] } }
  },
  canReadShowingChildren: ({ session }: AccessArgs) => {
    if (!session?.data.role?.canManageShowings) return false
    const brokerageIds = activeBrokerageIds(session)
    if (!brokerageIds.length) return false
    return session.data.role.canManagePeople
      ? { showing: { brokerage: { id: { in: brokerageIds } } } }
      : { showing: { AND: [{ brokerage: { id: { in: brokerageIds } } }, { assignedAgent: { id: { equals: session.itemId } } }] } }
  },
  canReadDealChildren: ({ session }: AccessArgs) => {
    if (!session?.data.role?.canManageDeals) return false
    const brokerageIds = activeBrokerageIds(session)
    if (!brokerageIds.length) return false
    return session.data.role.canManagePeople
      ? { deal: { brokerage: { id: { in: brokerageIds } } } }
      : { deal: { AND: [{ brokerage: { id: { in: brokerageIds } } }, { assignedAgent: { id: { equals: session.itemId } } }] } }
  },
  canReadSavedProperties: ({ session }: AccessArgs) => {
    if (!session?.itemId) return false
    const brokerageIds = activeBrokerageIds(session)
    if (brokerageIds.length && session.data.role?.canManageLeads && session.data.role?.canManagePeople) {
      return { property: { brokerage: { id: { in: brokerageIds } } } }
    }
    // Customers and operators alike always see their own saved properties.
    return { user: { id: { equals: session.itemId } } }
  },
  canReadAgentTasks: ({ session }: AccessArgs) => {
    if (!session?.data.role?.canManageLeads) return false
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session)
    return brokerageAndAssignment(session, { assignedAgent: { id: { equals: session.itemId } } })
  },
  canReadSavedSearchAlerts: ({ session }: AccessArgs) => {
    if (!session?.data.role?.canManageLeads) return false
    if (session.data.role.canManagePeople) return brokerageOwnedFilter(session)
    return brokerageAndAssignment(session, { user: { id: { equals: session.itemId } } })
  },
  canReadSavedSearches: ({ session }: AccessArgs) => {
    if (!session?.itemId) return false
    const brokerageIds = activeBrokerageIds(session)
    if (brokerageIds.length && session.data.role?.canManageLeads && session.data.role?.canManagePeople) return brokerageOwnedFilter(session)
    // Customers and operators alike always see their own saved searches.
    return { user: { id: { equals: session.itemId } } }
  },
}
