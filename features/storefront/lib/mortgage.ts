/** Monthly principal and interest on a fixed-rate loan. */
export function monthlyPayment(principal: number, annualRate: number, years: number) {
  const monthly = annualRate / 100 / 12
  const count = years * 12
  if (principal <= 0) return 0
  if (monthly === 0) return principal / count
  return (principal * monthly) / (1 - Math.pow(1 + monthly, -count))
}

export const DEFAULT_DOWN_PERCENT = 20
export const DEFAULT_RATE = 6.5

/** The "Est. $4,120/mo" figure: the estimate panel's default terms plus the listing's HOA fee. */
export function estimatedMonthly(price: number, hoaMonthly: number) {
  return Math.round(monthlyPayment(price * (1 - DEFAULT_DOWN_PERCENT / 100), DEFAULT_RATE, 30) + hoaMonthly)
}
