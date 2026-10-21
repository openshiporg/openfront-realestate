import { bigInt, decimal } from '@keystone-6/core/fields'
import type { BaseListTypeInfo, FieldTypeFunc } from '@keystone-6/core/types'

import { moneyToMinor, minorToMoney } from '../../lib/money'
export { moneyToMinor, minorToMoney } from '../../lib/money'

/** Exact USD minor units in PostgreSQL; Decimal API/UI remain major units. */
function minorFilter(value: unknown): unknown {
  if (value === null || value === undefined || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.map(minorFilter)
  if (typeof value === 'object' && value.constructor === Object) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, minorFilter(item)]))
  }
  return moneyToMinor(value)
}
type MoneyConfig = NonNullable<Parameters<typeof decimal<BaseListTypeInfo>>[0]> & { legacyText?: boolean }
const legacyColumns = new Map<string, Map<string, string>>()

/** Retained, ignored historical columns make conversion additive. Only *Minor
 * columns are authoritative after migration; original values remain untouched. */
export function normalizeMoneyRecord(listKey: string, record: Record<string, unknown> | null) {
  if (!record) return record
  const next = { ...record }
  for (const field of legacyColumns.get(listKey)?.keys() || []) {
    if (typeof next[field] === 'bigint') next[field] = minorToMoney(next[field])
  }
  return next
}

export function preserveLegacyMoneyColumns(schema: string) {
  let next = schema
  for (const [list, columns] of legacyColumns) {
    const pattern = new RegExp(`(model ${list} \\{[\\s\\S]*?)(\\n\\})`)
    if (!pattern.test(next)) throw new Error(`Missing money model ${list}`)
    next = next.replace(pattern, `$1\n${[...columns.values()].join('\n')}$2`)
  }
  return next
}
export function money(config: MoneyConfig = {}): FieldTypeFunc<BaseListTypeInfo> {
  return meta => {
    const base = decimal({ ...config, scale: 2 })(meta)
    if (base.dbField.kind !== 'scalar' || base.dbField.scalar !== 'Decimal') throw new Error('Unsupported money storage metadata.')
    const legacyName = `legacy${meta.fieldKey[0].toUpperCase()}${meta.fieldKey.slice(1)}`
    const legacyType = config.legacyText ? 'String @default("")' : `Decimal${base.dbField.mode === 'optional' ? '?' : ''}${config.defaultValue === undefined ? '' : ` @default("${config.defaultValue}")`} @postgresql.Decimal(${config.precision || 18}, 2)`
    const columns = legacyColumns.get(meta.listKey) || new Map<string, string>()
    columns.set(meta.fieldKey, `  ${legacyName} ${legacyType} @map("${meta.fieldKey}") @ignore`)
    legacyColumns.set(meta.listKey, columns)
    const storage = bigInt({
      db: { ...config.db, map: `${meta.fieldKey}Minor` }, isIndexed: config.isIndexed,
      validation: { isRequired: config.validation?.isRequired },
      ...(config.defaultValue === undefined ? {} : { defaultValue: moneyToMinor(config.defaultValue) }),
    })(meta)
    const convert = (value: unknown) => {
      const minor = moneyToMinor(value)
      const maximum = 10n ** BigInt(config.precision || 18) - 1n
      if (minor > maximum || minor < -maximum) throw new Error('Money exceeds the field precision.')
      return minor
    }
    const validate = base.hooks?.validate
    const input = base.input
    if (!input?.create?.resolve || !input.update || !base.output.resolve) throw new Error('Unsupported Keystone money field contract.')
    const create = input.create
    const output = base.output.resolve
    return {
      ...base,
      dbField: storage.dbField,
      hooks: {
        ...base.hooks,
        validate: typeof validate === 'function' ? args => {
          if (args.operation === 'delete') return validate(args)
          const value = args.resolvedData[meta.fieldKey]
          return validate({ ...args, resolvedData: { ...args.resolvedData,
            [meta.fieldKey]: typeof value === 'bigint' ? minorToMoney(value) : value,
          } })
        } : validate,
      },
      input: {
        ...input,
        create: { ...create, resolve: (value: unknown) => {
          const normalized = value === undefined ? config.defaultValue : value
          return normalized == null ? normalized : convert(normalized)
        } },
        update: { ...input.update, resolve: value => value == null ? value : convert(value) },
        where: input.where ? { ...input.where, resolve: value => value == null ? null : minorFilter(value) as Record<string, unknown> } : undefined,
        uniqueWhere: input.uniqueWhere ? { ...input.uniqueWhere, resolve: value => moneyToMinor(value) } : undefined,
      },
      output: { ...base.output, resolve: (source, args, context, info) => output({
        ...source, value: source.value == null ? source.value : minorToMoney(BigInt(String(source.value))),
      }, args, context, info) },
    }
  }
}
