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

/**
 * Flat secondary and primary buttons (pass to shadcn Button className, any variant).
 * The shared Button's default/outline variants carry a gradient, a 2px bottom border,
 * an inset ring, a drop shadow and brightness filters; `flatReset` cancels every one of
 * them so the button reads as a flat 6px control whatever variant it was given.
 */
const flatReset = 'bg-none ring-0 ring-offset-0 inset-shadow-none shadow-none hover:brightness-100 active:brightness-100 dark:inset-shadow-none dark:ring-0'
export const pillClass = `${flatReset} h-8 rounded-[6px] border border-border bg-background px-3 text-foreground hover:border-foreground/25 hover:bg-muted/60 hover:text-foreground active:scale-[0.98] dark:border dark:border-border`
export const pillPrimaryClass = `${flatReset} h-8 rounded-[6px] border-0 bg-foreground px-3 text-background hover:bg-foreground/85 hover:text-background active:scale-[0.98] dark:border-0`
/** Flat destructive confirm (used inside confirmation dialogs only). */
export const pillDangerClass = `${flatReset} h-8 rounded-[6px] border-0 bg-destructive px-3 text-white hover:bg-destructive/90 hover:text-white active:scale-[0.98] dark:border-0`
/** A borderless icon/text button (row menus, close buttons). */
export const quietButtonClass = `${flatReset} h-8 rounded-[6px] border-0 bg-transparent px-2 text-muted-foreground hover:bg-muted hover:text-foreground dark:border-0`

/** Underline view tabs. */
export function tabClass(active: boolean) {
  return cn(
    '-mb-px inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
    active ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
  )
}

/**
 * Phone row layout (below md): the table collapses to its first cell, which carries the
 * status and, as a full-width line under the row content, the row's primary action.
 * `rowActionLineClass` wraps that line; `rowActionsBlockClass` goes on the actions
 * component so its primary button fills the line and the More menu sits at its end.
 */
export const rowActionLineClass = 'mt-2.5 md:hidden'
export const rowActionsBlockClass = 'w-full justify-start [&>[data-slot=button]:not([aria-label])]:flex-1 [&>form:not(:has([aria-label]))]:flex-1 [&>form>[data-slot=button]]:w-full'
/** A column that only exists from md up (the phone layout folds it into the first cell). */
/** Same line for a single action (a link or a one-button form) rather than an actions group. */
export const rowSingleActionLineClass = 'mt-2.5 md:hidden [&>a]:flex [&>a]:w-full [&>a]:justify-center [&>form]:flex [&>form]:w-full [&_[data-slot=button]]:w-full'
export const mdCellClass = 'hidden md:table-cell'

/** Dense operator table parts. */
export const tableWrapClass = 'relative min-w-0 overflow-x-auto rounded-[6px] border bg-background'
export const thClass = 'h-9 whitespace-nowrap border-b bg-muted/40 px-3 text-left align-middle text-xs font-medium text-muted-foreground'
export const tdClass = 'border-b px-3 py-2.5 align-top [tr:last-child>&]:border-b-0'
