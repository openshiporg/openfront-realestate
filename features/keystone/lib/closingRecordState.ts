// Escrow, title orders and financing applications are written by Keystone forms and the deal page buttons,
// so their lifecycle is enforced in the list hook: every writer goes through it.
export type TransitionMap = Readonly<Record<string, readonly string[]>>

export const ESCROW_TRANSITIONS = {
  opened: ['pending', 'closed', 'cancelled'],
  pending: ['opened', 'closed', 'cancelled'],
  closed: [],
  cancelled: [],
} as const satisfies TransitionMap

export const TITLE_ORDER_TRANSITIONS = {
  ordered: ['in_review', 'clear', 'exception'],
  in_review: ['clear', 'exception'],
  exception: ['in_review', 'clear'],
  clear: [],
} as const satisfies TransitionMap

export const MORTGAGE_TRANSITIONS = {
  started: ['preapproved', 'underwriting', 'denied'],
  preapproved: ['underwriting', 'denied'],
  underwriting: ['approved', 'denied'],
  approved: [],
  denied: ['started'],
} as const satisfies TransitionMap

/** Deal stages after which no offer may be submitted, countered or accepted. */
export const CLOSED_DEAL_STAGES = ['closed_won', 'closed_lost'] as const

export function canTransition(map: TransitionMap, from: string, to: string) {
  return from === to || Boolean(map[from]?.includes(to))
}

/** The statuses a record may move to from its current one (for UI buttons). */
export function nextStatuses(map: TransitionMap, from: string): readonly string[] {
  return map[from] || []
}

/** Wraps a list's validateInput so a status can only change along `map`. */
export function guardStatusField<H extends { validateInput?: (args: any) => unknown }>(hooks: H, map: TransitionMap, label: string, stamps: Readonly<Record<string, string>> = {}, field = 'status'): H {
  const inner = hooks.validateInput
  const resolve = (hooks as any).resolveInput
  return {
    ...hooks,
    async resolveInput(args: any) {
      const resolved = resolve ? await resolve.call(hooks, args) : args.resolvedData
      const to = resolved?.[field]
      const stampField = typeof to === 'string' ? stamps[to] : undefined
      if (!stampField) return resolved
      const existing = args.item?.[stampField]
      return existing || resolved[stampField] !== undefined ? resolved : { ...resolved, [stampField]: new Date() }
    },
    async validateInput(args: any) {
      if (inner) await inner.call(hooks, args)
      const { operation, resolvedData, item, addValidationError } = args
      if (operation !== 'update' || !item || resolvedData?.[field] === undefined) return
      const from = String(item[field] ?? '')
      const to = String(resolvedData[field])
      if (!canTransition(map, from, to)) addValidationError(`Cannot change ${label} from ${from.replaceAll('_', ' ')} to ${to.replaceAll('_', ' ')}.`)
    },
  } as H
}
