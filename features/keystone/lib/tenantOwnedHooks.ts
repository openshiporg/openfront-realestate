import { recordCrudDomainEvent } from './domainEvents'
import { normalizeMoneyRecord } from './money'

type HookConfig = {
  listKey: string
  parents?: Record<string, string>
  users?: string[]
  manyUsers?: string[]
  teams?: string[]
  required?: string[]
  requiredAny?: string[]
  coherentWith?: { field: string; listKey: string; matches: Record<string, string> }
  protectDelete?: boolean
  deriveOnly?: boolean
  /** Storefront customers (no memberships) count as belonging to the brokerage they registered with. */
  allowCustomers?: boolean
}

type RelationshipInput = { connect?: { id?: string } | null; disconnect?: boolean }

function relationshipId(data: any, field: string) {
  const value = data?.[field] as RelationshipInput | string | undefined
  if (typeof value === 'string') return value
  return value?.connect?.id || data?.[`${field}Id`] || null
}

function relationshipIds(data: any, field: string) {
  const connect = data?.[field]?.connect
  if (Array.isArray(connect)) return connect.map(item => item?.id).filter(Boolean)
  return connect?.id ? [connect.id] : []
}

async function relatedBrokerageIds(context: any, listKey: string, id: string, allowCustomers = false) {
  if (listKey === 'User') {
    const user = await context.sudo().query.User.findOne({
      where: { id },
      query: 'id activeBrokerage { id status } brokerageMemberships { status brokerage { id status } }',
    })
    const memberships = user?.brokerageMemberships || []
    if (allowCustomers && !memberships.length && user?.activeBrokerage?.status === 'active') return [user.activeBrokerage.id]
    return memberships
      .filter((membership: any) => membership.status === 'active' && membership.brokerage?.status === 'active')
      .map((membership: any) => membership.brokerage.id)
  }
  const item = await context.sudo().query[listKey].findOne({
    where: { id },
    query: 'id brokerage { id }',
  })
  return item?.brokerage?.id ? [item.brokerage.id] : []
}

async function deriveBrokerage(context: any, inputData: any, config: HookConfig) {
  for (const [field, listKey] of Object.entries(config.parents || {})) {
    const id = relationshipId(inputData, field)
    if (!id) continue
    const brokerageIds = await relatedBrokerageIds(context, listKey, id)
    if (brokerageIds.length === 1) return brokerageIds[0]
  }
  for (const field of config.users || []) {
    const id = relationshipId(inputData, field)
    if (!id) continue
    const brokerageIds = await relatedBrokerageIds(context, 'User', id, config.allowCustomers)
    if (brokerageIds.length === 1) return brokerageIds[0]
  }
  return null
}

export function createTenantOwnedHooks(config: HookConfig) {
  return {
    async resolveInput({ operation, inputData, resolvedData, context }: any) {
      if (operation !== 'create' || config.deriveOnly || relationshipId(inputData, 'brokerage')) return resolvedData
      const brokerageId = await deriveBrokerage(context, inputData, config)
      return brokerageId ? { ...resolvedData, brokerage: { connect: { id: brokerageId } } } : resolvedData
    },

    async validateInput({ operation, inputData, resolvedData, item, context, addValidationError }: any) {
      const relationshipData = { ...(item || {}), ...(resolvedData || {}), ...(inputData || {}) }
      const brokerageId = relationshipId(relationshipData, 'brokerage') || await deriveBrokerage(context, relationshipData, config)
      if (operation === 'create' && !brokerageId) {
        addValidationError(`${config.listKey} requires a brokerage.`)
        return
      }
      if (inputData?.brokerage?.disconnect) {
        addValidationError(`${config.listKey} brokerage cannot be disconnected.`)
        return
      }
      if (!brokerageId) return

      if (operation === 'create') {
        for (const field of config.required || []) {
          if (!relationshipId(inputData, field)) addValidationError(`${config.listKey} requires ${field}.`)
        }
        if (config.requiredAny?.length && !config.requiredAny.some(field => relationshipId(inputData, field))) {
          addValidationError(`${config.listKey} requires one of ${config.requiredAny.join(', ')}.`)
        }
      }

      if (config.coherentWith) {
        const rootId = relationshipId(relationshipData, config.coherentWith.field)
        if (rootId) {
          const selection = Object.values(config.coherentWith.matches).map(field => `${field} { id }`).join(' ')
          const root = await context.sudo().query[config.coherentWith.listKey].findOne({ where: { id: rootId }, query: `id ${selection}` })
          for (const [field, rootField] of Object.entries(config.coherentWith.matches)) {
            const connectedId = relationshipId(relationshipData, field)
            if (connectedId && root?.[rootField]?.id !== connectedId) {
              addValidationError(`${config.listKey} ${field} must match ${config.coherentWith.field}.${rootField}.`)
            }
          }
        }
      }

      for (const [field, listKey] of Object.entries(config.parents || {})) {
        const id = relationshipId(relationshipData, field)
        if (!id) continue
        const brokerageIds = await relatedBrokerageIds(context, listKey, id)
        if (!brokerageIds.includes(brokerageId)) {
          addValidationError(`${config.listKey} ${field} must belong to the same brokerage.`)
        }
      }
      for (const field of config.users || []) {
        const id = relationshipId(relationshipData, field)
        if (!id) continue
        const brokerageIds = await relatedBrokerageIds(context, 'User', id, config.allowCustomers)
        if (!brokerageIds.includes(brokerageId)) {
          addValidationError(`${config.listKey} ${field} must have an active membership in the brokerage.`)
        }
      }
      for (const field of config.manyUsers || []) {
        for (const id of relationshipIds(relationshipData, field)) {
          const brokerageIds = await relatedBrokerageIds(context, 'User', id)
          if (!brokerageIds.includes(brokerageId)) {
            addValidationError(`${config.listKey} ${field} must contain only active brokerage members.`)
          }
        }
      }
      for (const field of config.teams || []) {
        const id = relationshipId(relationshipData, field)
        if (!id) continue
        const brokerageIds = await relatedBrokerageIds(context, 'AgentTeam', id)
        if (!brokerageIds.includes(brokerageId)) {
          addValidationError(`${config.listKey} ${field} must belong to the same brokerage.`)
        }
      }
    },

    beforeOperation({ operation }: any) {
      if (operation === 'delete' && config.protectDelete) {
        throw new Error(`${config.listKey} deletion requires a controlled domain operation.`)
      }
    },

    async afterOperation({ operation, item, originalItem, inputData, context }: any) {
      const actorId = context.session?.itemId
      const record = item || originalItem
      const brokerageId = record?.brokerageId || record?.brokerage || await deriveBrokerage(context, { ...(record || {}), ...(inputData || {}) }, config)
      if (!actorId || !record?.id || !brokerageId) return
      const aggregateType = config.listKey.charAt(0).toLowerCase() + config.listKey.slice(1)
      await recordCrudDomainEvent(context, {
        operation,
        brokerageId,
        aggregateType,
        aggregateId: record.id,
        actorId,
        request: inputData || { id: record.id },
        before: normalizeMoneyRecord(config.listKey, originalItem || null),
        after: normalizeMoneyRecord(config.listKey, item || null),
      })
    },
  }
}
