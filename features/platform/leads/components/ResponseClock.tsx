import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

const tiers = [
  { under: 60, className: 'font-normal text-muted-foreground', stroke: 1.5 },
  { under: 240, className: 'font-medium text-foreground', stroke: 2 },
  { under: 1440, className: 'font-semibold text-foreground', stroke: 2.5 },
  { under: 4320, className: 'font-bold text-amber-700 dark:text-amber-400', stroke: 2.75 },
  { under: Infinity, className: 'font-bold text-destructive', stroke: 3 },
]

export function elapsedLabel(minutes: number) {
  if (minutes < 60) return `${Math.max(1, minutes)}m`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`
  return `${Math.floor(minutes / 1440)}d`
}

export function minutesSince(iso?: string | null, now = Date.now()) {
  if (!iso) return null
  const time = Date.parse(iso)
  return Number.isFinite(time) ? Math.max(0, Math.floor((now - time) / 60000)) : null
}

/**
 * Lead response clock: time since the lead was received or last contacted.
 * While a lead waits for a response the clock gets heavier (weight, icon stroke, then colour past a day).
 */
export function ResponseClock({ since, waiting, className }: { since?: string | null; waiting: boolean; className?: string }) {
  const minutes = minutesSince(since)
  if (minutes === null) return <span className={cn('text-muted-foreground', className)}>—</span>
  const text = elapsedLabel(minutes)
  if (!waiting) return <span className={cn('whitespace-nowrap text-[13px] tabular-nums text-muted-foreground', className)} title="Age">{text}</span>
  const tier = tiers.find(entry => minutes < entry.under) || tiers[tiers.length - 1]
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap text-[13px] tabular-nums', tier.className, className)} title="Waiting for a response">
      <Clock aria-hidden strokeWidth={tier.stroke} className="size-3.5 shrink-0" />
      {text}
      <span className="sr-only"> waiting</span>
    </span>
  )
}
