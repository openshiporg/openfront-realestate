import type { BaseListTypeInfo, FieldTypeFunc } from '@keystone-6/core/types'

function deniesStatically(rule: unknown) {
  return rule === false || (typeof rule === 'function' && rule.length === 0 && rule() === false)
}

/** Match the generic editor to unconditional field locks. Dynamic access is
 * still checked by Keystone at the mutation boundary; this never grants access. */
export function staticFieldUi(field: FieldTypeFunc<BaseListTypeInfo>): FieldTypeFunc<BaseListTypeInfo> {
  return meta => {
    const config = field(meta)
    const access = config.access
    const createLocked = deniesStatically(typeof access === 'function' ? access : access?.create)
    const updateLocked = deniesStatically(typeof access === 'function' ? access : access?.update)
    if (!createLocked && !updateLocked) return config
    return { ...config, ui: { ...config.ui,
      ...(createLocked ? { createView: { ...config.ui?.createView, fieldMode: 'hidden' as const } } : {}),
      ...(updateLocked ? { itemView: { ...config.ui?.itemView, fieldMode: 'read' as const } } : {}),
    } }
  }
}
