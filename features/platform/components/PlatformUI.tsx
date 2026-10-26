import Link from 'next/link'
import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import { PageBreadcrumbs } from '@/features/dashboard/components/PageBreadcrumbs'
import { cn } from '@/lib/utils'
import { tableWrapClass, tdClass, thClass, trackClass, trackItemClass } from './styles'

export { pillClass, pillPrimaryClass, trackClass, trackItemClass, tabClass, tableWrapClass, thClass, tdClass } from './styles'

export type Tone = 'emerald' | 'sky' | 'blue' | 'amber' | 'indigo' | 'violet' | 'fuchsia' | 'rose' | 'zinc'

const dotTones: Record<Tone, string> = {
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  fuchsia: 'bg-fuchsia-500',
  rose: 'bg-rose-500',
  zinc: 'bg-zinc-400',
}

export function Track({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return <div role={label ? 'group' : undefined} aria-label={label} className={cn(trackClass, className)}>{children}</div>
}

export function StatusDot({ tone, className }: { tone: Tone; className?: string }) {
  return <span aria-hidden className={cn('inline-block size-2 shrink-0 rounded-full align-middle ring-2 ring-background', dotTones[tone], className)} />
}

/** Title with its status dot on the same line; the status text follows the title. */
export function TitleLine({ as: Heading = 'h2', tone, status, children, className, headingClassName }: { as?: 'h1' | 'h2' | 'h3'; tone?: Tone; status?: ReactNode; children: ReactNode; className?: string; headingClassName?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5', className)}>
      <Heading className={cn('min-w-0 break-words font-semibold text-foreground', headingClassName)}>
        {tone ? <StatusDot tone={tone} className="mr-2 -translate-y-px" /> : null}
        {children}
      </Heading>
      {status ? <span className="text-xs font-medium text-muted-foreground">{status}</span> : null}
    </div>
  )
}

export function PlatformPage({ crumbs, title, meta, actions, children, toolbar }: { crumbs: Array<{ label: string; href?: string }>; title: ReactNode; meta?: ReactNode; actions?: ReactNode; toolbar?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col overflow-hidden">
      <PageBreadcrumbs
        items={[
          { type: 'link', label: 'Dashboard', href: '/' },
          { type: 'page', label: 'Platform' },
          ...crumbs.map(crumb => crumb.href ? { type: 'link' as const, label: crumb.label, href: crumb.href } : { type: 'page' as const, label: crumb.label }),
        ]}
      />
      <header className="flex flex-col gap-3 px-4 pt-5 md:px-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {typeof title === 'string' ? <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-[1.375rem]">{title}</h1> : title}
          {meta ? <div className="mt-1 text-sm text-muted-foreground">{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </header>
      {toolbar ? <div className="flex flex-col gap-3 px-4 pt-4 md:px-6">{toolbar}</div> : null}
      <div className="min-w-0 px-4 py-5 md:px-6">{children}</div>
    </section>
  )
}

export function SearchField({ action, defaultValue, placeholder, label, hidden = {} }: { action: string; defaultValue: string; placeholder: string; label: string; hidden?: Record<string, string | undefined> }) {
  return (
    <form action={action} role="search" className="relative w-full sm:max-w-sm">
      {Object.entries(hidden).map(([name, value]) => value ? <input key={name} type="hidden" name={name} value={value} /> : null)}
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        name="q"
        type="search"
        defaultValue={defaultValue}
        aria-label={label}
        placeholder={placeholder}
        className="h-9 w-full rounded-[6px] border border-input bg-background pl-9 pr-3 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
    </form>
  )
}

export function Panel({ title, actions, children, className, bodyClassName }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn('min-w-0 overflow-hidden rounded-[6px] border border-border bg-card', className)}>
      {title || actions ? (
        <header className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-1.5">
          {typeof title === 'string' ? <h2 className="text-[13px] font-semibold text-foreground">{title}</h2> : title}
          {actions}
        </header>
      ) : null}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-[6px] border border-dashed border-border px-5 py-6 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      {children}
    </div>
  )
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return <div role="alert" className="rounded-[6px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{children}</div>
}

export function Stats({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-[6px] border border-border bg-card sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0 border-b border-r border-border px-4 py-2.5 last:border-r-0 sm:border-b-0">
          <dt className="truncate text-xs font-medium text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 truncate text-lg font-semibold leading-tight tabular-nums text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Pager({ label, previous, next }: { label: string; previous?: string | null; next?: string | null }) {
  if (!previous && !next) return null
  return (
    <nav aria-label={label} className="mt-6 flex items-center justify-between gap-3">
      {previous ? <Link href={previous} className={cn(trackItemClass(false), 'h-9 px-4')}>Previous</Link> : <span />}
      {next ? <Link href={next} className={cn(trackItemClass(false), 'h-9 px-4')}>Next</Link> : <span />}
    </nav>
  )
}

export function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-foreground">{children}</dd>
    </div>
  )
}

/** Dense operator table. Rows are plain <tr>s using `Td`. */
export function DataTable({ label, head, children, className }: { label: string; head: Array<{ label: ReactNode; className?: string }>; children: ReactNode; className?: string }) {
  return (
    <div className={cn(tableWrapClass, className)}>
      <table className="w-full border-collapse text-sm" aria-label={label}>
        <thead><tr>{head.map((column, index) => <th key={index} scope="col" className={cn(thClass, column.className)}>{column.label}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn(tdClass, className)}>{children}</td>
}

/** Status in a table cell: dot + word, never a coloured pill. */
export function StatusCell({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium"><StatusDot tone={tone} />{children}</span>
}
