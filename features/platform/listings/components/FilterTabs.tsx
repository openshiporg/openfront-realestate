import Link from 'next/link'
import { tabClass } from '../../components/styles'

export type FilterTab = { label: string; href: string; active: boolean; count?: number | null }

/** Status filters as flat underline tabs on one rule; the row scrolls on narrow screens. */
export function FilterTabs({ label, items }: { label: string; items: FilterTab[] }) {
  return (
    <nav aria-label={label} className="relative -mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
      <div className="flex min-w-max items-end gap-5 border-b">
        {items.map((item) => (
          <Link key={item.href} href={item.href} aria-current={item.active ? 'page' : undefined} className={tabClass(item.active)}>
            {item.label}
            {typeof item.count === 'number' ? <span className={item.active ? 'tabular-nums text-xs text-foreground/70' : 'tabular-nums text-xs text-muted-foreground/80'}>{item.count}</span> : null}
          </Link>
        ))}
      </div>
    </nav>
  )
}
