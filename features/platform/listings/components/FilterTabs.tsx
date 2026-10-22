import Link from 'next/link'
import { trackClass, trackItemClass } from '../../components/styles'

export type FilterTab = { label: string; href: string; active: boolean; count?: number | null }

export function FilterTabs({ label, items }: { label: string; items: FilterTab[] }) {
  return (
    <nav aria-label={label} className={trackClass}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} aria-current={item.active ? 'page' : undefined} className={trackItemClass(item.active)}>
          {item.label}
          {typeof item.count === 'number' ? <span className="tabular-nums text-xs text-muted-foreground">{item.count}</span> : null}
        </Link>
      ))}
    </nav>
  )
}
