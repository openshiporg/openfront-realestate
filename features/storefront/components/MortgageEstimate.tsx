'use client'

import { useId, useState } from 'react'
import { DEFAULT_DOWN_PERCENT, DEFAULT_RATE, monthlyPayment } from '../lib/mortgage'

const usd = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)

/**
 * Principal and interest from the list price, plus the listing's own HOA fee. The buyer can change the
 * down payment and rate; nothing is shown that the listing does not carry (no guessed taxes or insurance).
 */
export function MortgageEstimate({ price, hoaMonthly }: { price: number; hoaMonthly: number }) {
  const id = useId()
  const [downPercent, setDownPercent] = useState(DEFAULT_DOWN_PERCENT)
  const [rate, setRate] = useState(DEFAULT_RATE)
  const principalInterest = monthlyPayment(price * (1 - downPercent / 100), rate, 30)
  const total = principalInterest + hoaMonthly
  const parts: Array<[string, number]> = [['Principal & Interest', principalInterest], ...(hoaMonthly > 0 ? [['HOA Fees', hoaMonthly] as [string, number]] : [])]
  const circumference = 2 * Math.PI * 52
  const share = total > 0 ? principalInterest / total : 1

  return (
    <section className="sf-mortgage" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>Mortgage Estimate</h2>
      <div className="sf-mortgage__body">
        <div className="sf-mortgage__ring">
          <svg viewBox="0 0 120 120" aria-hidden>
            <circle cx="60" cy="60" r="52" className="sf-mortgage__track" />
            <circle cx="60" cy="60" r="52" className="sf-mortgage__arc" strokeDasharray={`${circumference * share} ${circumference}`} transform="rotate(-90 60 60)" />
            {hoaMonthly > 0 ? <circle cx="60" cy="60" r="52" className="sf-mortgage__arc sf-mortgage__arc--hoa" strokeDasharray={`${circumference * (1 - share)} ${circumference}`} strokeDashoffset={-circumference * share} transform="rotate(-90 60 60)" /> : null}
          </svg>
          <p><strong className="sf-num">{usd(total)}</strong><span>Estimated monthly payment</span></p>
        </div>
        <dl className="sf-mortgage__lines">
          {parts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="sf-num">{usd(value)}</dd></div>)}
        </dl>
      </div>
      <div className="sf-mortgage__inputs">
        <label><span>Down payment</span>
          <select value={downPercent} onChange={event => setDownPercent(Number(event.target.value))} className="sf-field">
            {[3.5, 5, 10, 15, 20, 25, 30, 40, 50].map(value => <option key={value} value={value}>{value}% · {usd(price * value / 100)}</option>)}
          </select>
        </label>
        <label><span>Interest rate</span>
          <select value={rate} onChange={event => setRate(Number(event.target.value))} className="sf-field">
            {[5, 5.5, 6, 6.25, 6.5, 6.75, 7, 7.5, 8].map(value => <option key={value} value={value}>{value}%</option>)}
          </select>
        </label>
      </div>
      <p className="sf-mortgage__note">Estimates based on a {downPercent}% down payment and a {rate}% interest rate on a 30-year fixed loan. Taxes and insurance not included.</p>
    </section>
  )
}

