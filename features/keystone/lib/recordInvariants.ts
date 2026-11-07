// Cross-field rules every writer must respect (dashboard forms, commands, the Admin UI and raw GraphQL).
// Each rule reads the record as it will be after the write: the stored item overlaid with the resolved input.
// The matching database CHECK constraints (migration 20261107120000_real_estate_record_invariants) are the backstop.

type Row = Record<string, unknown>
export type InvariantRule = (row: Row, operation: 'create' | 'update') => string | null | undefined

function after(item: Row | undefined, resolvedData: Row | undefined): Row {
  return { ...(item || {}), ...(resolvedData || {}) }
}

/** Money is stored as bigint minor units; null/undefined mean "not set". */
function minor(value: unknown): bigint | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'bigint') return value
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.round(value))
  return null
}

function decimalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(String(value))
  return Number.isFinite(number) ? number : null
}

function time(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = value instanceof Date ? value.getTime() : Date.parse(String(value))
  return Number.isFinite(parsed) ? parsed : null
}

/** low ≤ high for two money fields, when both are set. */
export function moneyOrder(low: string, high: string, message: string): InvariantRule {
  return row => {
    const a = minor(row[low]), b = minor(row[high])
    return a !== null && b !== null && a > b ? message : null
  }
}

/** start < end for two timestamps, when both are set. */
export function timeOrder(start: string, end: string, message: string): InvariantRule {
  return row => {
    const a = time(row[start]), b = time(row[end])
    return a !== null && b !== null && b <= a ? message : null
  }
}

/** Commission percentages are each 0–100 and together never exceed 100; net never exceeds gross. */
export const commissionSplit: InvariantRule = row => {
  const brokerage = decimalNumber(row.brokerageSplitPercent), agent = decimalNumber(row.agentSplitPercent)
  for (const [label, value] of [['Brokerage split', brokerage], ['Agent split', agent]] as const) {
    if (value !== null && (value < 0 || value > 100)) return `${label} must be between 0 and 100 percent.`
  }
  if ((brokerage ?? 0) + (agent ?? 0) > 100) return 'Brokerage and agent splits cannot add up to more than 100 percent.'
  const gross = minor(row.grossCommission), net = minor(row.netCommission)
  if (gross !== null && net !== null && net > gross) return 'Net commission cannot be more than the gross commission.'
  return null
}

/** The agent's share of gross at the agent split, rounded half-up to the cent. */
export function agentNetMinor(grossMinor: bigint, agentSplitPercent: unknown): bigint | null {
  const text = String(agentSplitPercent ?? '').trim()
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(text)
  if (!match) return null
  const basisPoints = BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0') || '0')
  if (basisPoints > 10_000n || grossMinor < 0n) return null
  return (grossMinor * basisPoints + 5_000n) / 10_000n
}

/**
 * Adds rules to a list's hooks. Runs after the list's own validation so tenancy errors read first,
 * and only when the write touches one of the rule's fields (or on create).
 */
export function withRecordInvariants<H extends { validateInput?: (args: any) => unknown }>(hooks: H, rules: InvariantRule[]): H {
  const inner = hooks.validateInput
  return {
    ...hooks,
    async validateInput(args: any) {
      if (inner) await inner.call(hooks, args)
      const { operation, resolvedData, item, addValidationError } = args
      if (operation !== 'create' && operation !== 'update') return
      const row = after(item, resolvedData)
      for (const rule of rules) {
        const problem = rule(row, operation)
        if (problem) addValidationError(problem)
      }
    },
  } as H
}

/**
 * Commission net is the agent's share of gross. On create it is derived when the writer leaves it out
 * (the dashboard form never sends it), and a supplied net must agree with gross × agent split.
 */
export function withDerivedCommissionNet<H extends { resolveInput?: (args: any) => unknown; validateInput?: (args: any) => unknown }>(hooks: H): H {
  const resolve = hooks.resolveInput
  const validate = hooks.validateInput
  return {
    ...hooks,
    async resolveInput(args: any) {
      const resolved = resolve ? await resolve.call(hooks, args) : args.resolvedData
      if (args.operation !== 'create' || args.inputData?.netCommission !== undefined) return resolved
      const gross = minor(resolved?.grossCommission)
      const net = gross === null ? null : agentNetMinor(gross, resolved?.agentSplitPercent)
      return net === null ? resolved : { ...resolved, netCommission: net }
    },
    async validateInput(args: any) {
      if (validate) await validate.call(hooks, args)
      if (args.operation !== 'create' || args.inputData?.netCommission === undefined) return
      const row = after(args.item, args.resolvedData)
      const gross = minor(row.grossCommission), net = minor(row.netCommission)
      const expected = gross === null ? null : agentNetMinor(gross, row.agentSplitPercent)
      if (expected !== null && net !== null && expected > 0n && net !== expected) {
        args.addValidationError('Net commission must equal the gross commission times the agent split.')
      }
    },
  } as H
}

const OPEN_ESCROW = ['opened', 'pending']

/** A deal has at most one open (opened or pending) escrow; a partial unique index is the backstop. */
export function withSingleOpenEscrow<H extends { validateInput?: (args: any) => unknown }>(hooks: H): H {
  const inner = hooks.validateInput
  return {
    ...hooks,
    async validateInput(args: any) {
      if (inner) await inner.call(hooks, args)
      const { operation, resolvedData, item, inputData, context, addValidationError } = args
      if (operation !== 'create' && operation !== 'update') return
      const status = String(resolvedData?.status ?? item?.status ?? 'opened')
      if (!OPEN_ESCROW.includes(status)) return
      if (operation === 'update' && resolvedData?.status === undefined) return
      const dealId = item?.dealId || inputData?.deal?.connect?.id
      if (!dealId) return
      const open = await context.sudo().db.Escrow.count({
        where: { deal: { id: { equals: dealId } }, status: { in: OPEN_ESCROW }, ...(item?.id ? { id: { not: { equals: item.id } } } : {}) },
      })
      if (open) addValidationError('This deal already has an open escrow. Close or cancel it before opening another.')
    },
  } as H
}
