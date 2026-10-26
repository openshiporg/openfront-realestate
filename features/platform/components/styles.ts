import { cn } from '@/lib/utils'

/*
 * Real-estate platform control classes. Names are kept from the earlier pill kit
 * so every screen keeps compiling; the shapes are now flat 6px controls with no
 * recessed track (owner rule, 2026-10-25: no pill or rounded tabs, radii at most
 * 6px). Radii are explicit pixels because the dashboard theme sets --radius to 10px.
 */

/** A plain row of related controls. Narrow rows wrap. */
export const trackClass = 'relative inline-flex max-w-full flex-wrap items-center gap-1.5'

/** A flat 6px link-button; `active` marks the current choice with an ink border. */
export function trackItemClass(active: boolean) {
  return cn(
    'inline-flex h-8 shrink-0 select-none items-center gap-1.5 whitespace-nowrap rounded-[6px] border px-3 text-sm font-medium transition-[background-color,color,border-color,transform] duration-150 ease-out outline-none active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring/50',
    active ? 'border-foreground bg-background text-foreground' : 'border-border bg-background text-muted-foreground hover:border-foreground/25 hover:text-foreground',
  )
}

/** Flat secondary and primary buttons (pass to shadcn Button className). */
export const pillClass = 'h-8 rounded-[6px] border border-border bg-background px-3 text-foreground shadow-none hover:border-foreground/25 hover:bg-muted/60 hover:text-foreground active:scale-[0.98]'
export const pillPrimaryClass = 'h-8 rounded-[6px] border-0 bg-foreground px-3 text-background shadow-none hover:bg-foreground/85 hover:text-background active:scale-[0.98]'

/** Underline view tabs. */
export function tabClass(active: boolean) {
  return cn(
    '-mb-px inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
    active ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
  )
}

/** Dense operator table parts. */
export const tableWrapClass = 'relative min-w-0 overflow-x-auto rounded-[6px] border bg-background'
export const thClass = 'h-9 whitespace-nowrap border-b bg-muted/40 px-3 text-left align-middle text-xs font-medium text-muted-foreground'
export const tdClass = 'border-b px-3 py-2.5 align-top [tr:last-child>&]:border-b-0'
