import Link from 'next/link'
import { Fragment } from 'react'
import { cn } from '@/lib/utils'
import { tabClass } from '../../components/styles'

export type FilterTab = {
  label: string
  href: string
  active: boolean
  count?: number | null
  /** Draw a short divider before this tab (a second group on the same rule, e.g. scope then status). */
  divider?: boolean
  /** `page` for the view tab; `true` for a choice inside a second group on the same row. */
  current?: 'page' | 'true'
}

/**
 * Status filters as flat underline tabs on one rule.
 * Phones: the row scrolls sideways with a visible thin scrollbar and an edge fade as the cue.
 * md and up: the row wraps to a second line instead of clipping, so every tab stays visible.
 */
export function FilterTabs({ label, items, className }: { label: string; items: FilterTab[]; className?: string }) {
  return (
    <div className={cn('relative -mx-4 md:mx-0', className)}>
      <nav aria-label={label} className="relative overflow-x-auto px-4 pb-1 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] md:overflow-visible md:px-0 md:pb-0">
        <div className="flex min-w-max items-end gap-x-5 border-b md:min-w-0 md:flex-wrap">
          {items.map((item) => (
            <Fragment key={`${item.label}:${item.href}`}>
              {item.divider ? <span aria-hidden className="mb-2 h-4 w-px shrink-0 self-end bg-border" /> : null}
              <Link href={item.href} aria-current={item.active ? item.current || 'page' : undefined} className={tabClass(item.active)}>
                {item.label}
                {typeof item.count === 'number' ? <span className={item.active ? 'tabular-nums text-xs text-foreground/70' : 'tabular-nums text-xs text-muted-foreground'}>{item.count}</span> : null}
              </Link>
            </Fragment>
          ))}
        </div>
      </nav>
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent md:hidden" />
    </div>
  )
}
