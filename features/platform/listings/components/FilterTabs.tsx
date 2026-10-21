import Link from 'next/link'
import { cn } from '@/lib/utils'

export type FilterTab = { label: string; href: string; active: boolean; count?: number | null }

export function FilterTabs({ label, items }: { label: string; items: FilterTab[] }) {
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto border-b border-border px-4 md:px-6">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? 'page' : undefined}
          className={cn(
            '-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
            item.active ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {item.label}
          {typeof item.count === 'number' ? <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">{item.count}</span> : null}
        </Link>
      ))}
    </nav>
  )
}
