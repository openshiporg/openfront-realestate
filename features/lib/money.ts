/** Shared exact-dollar arithmetic extracted from the Keystone BIGINT adapter.
 * Adapted to the family's integer-ledger pattern; no floating-point sums. */
export function moneyToMinor(value: unknown): bigint {
  const text = String(value).trim()
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('Money must have at most two decimal places.')
  const negative = text.startsWith('-')
  const [whole, fraction = ''] = text.replace(/^-/, '').split('.')
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
  const result = negative ? -cents : cents
  if (result < -9223372036854775808n || result > 9223372036854775807n) throw new Error('Money exceeds supported storage range.')
  return result
}
export function minorToMoney(value: bigint): string {
  const absolute = value < 0n ? -value : value
  return `${value < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`
}
export function sumMoney(values: readonly unknown[]): string {
  return minorToMoney(values.reduce<bigint>((sum, value) => sum + moneyToMinor(value ?? '0'), 0n))
}
const wholeDollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
export function formatMoney(value?: string | number | null): string {
  const cents = moneyToMinor(value ?? '0')
  const absolute = cents < 0n ? -cents : cents
  const fraction = absolute % 100n
  return `${cents < 0n ? '-' : ''}${wholeDollars.format(absolute / 100n)}${fraction ? '.' + String(fraction).padStart(2, '0') : ''}`
}
