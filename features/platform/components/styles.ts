import { cn } from '@/lib/utils'

/** Recessed track; children are raised pills (links, buttons or button forms). */
export const trackClass = 'inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-muted p-1 shadow-[inset_0_1px_2px_rgb(0_0_0/0.08)] [scrollbar-width:none] dark:shadow-[inset_0_1px_2px_rgb(0_0_0/0.4)]'

export function trackItemClass(active: boolean) {
  return cn(
    'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-medium transition-[background-color,color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
    active ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/10' : 'text-muted-foreground hover:text-foreground',
  )
}

/** Raised pill for in-page buttons that sit in a recessed track. */
export const pillClass = 'h-8 rounded-full border-0 bg-background px-3.5 text-foreground shadow-sm ring-1 ring-black/5 hover:bg-background hover:text-foreground hover:ring-black/15 dark:bg-zinc-800 dark:ring-white/10 dark:hover:bg-zinc-700'
export const pillPrimaryClass = 'h-8 rounded-full border-0 bg-foreground px-3.5 text-background shadow-sm hover:bg-foreground/90 hover:text-background'
