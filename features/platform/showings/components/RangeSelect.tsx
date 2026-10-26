'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Compact date-range filter; each option is a real URL so the view stays shareable. */
export function RangeSelect({ value, options }: { value: string; options: Array<{ value: string; label: string; href: string }> }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <label className="relative flex w-full shrink-0 items-center sm:inline-flex sm:w-auto">
      <span className="sr-only">Date range</span>
      <select
        value={value}
        disabled={pending}
        onChange={event => {
          const next = options.find(option => option.value === event.target.value)
          if (next) startTransition(() => router.push(next.href))
        }}
        className={cn(
          'h-9 w-full appearance-none rounded-[6px] border border-input bg-background pl-3 pr-8 text-sm font-medium text-foreground outline-none transition-[border-color,box-shadow] hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60',
        )}
      >
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-2.5 size-4 text-muted-foreground" />
    </label>
  )
}
