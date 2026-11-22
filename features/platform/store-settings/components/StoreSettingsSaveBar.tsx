'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Store Settings save control. Below md it is pinned to the bottom of the
 * viewport (clear of the floating assistant button and the home indicator);
 * from md up it renders inline where the page places it.
 * Pass `button` to use the repo's own raised-pill save button (e.g. a form submit Pill).
 */
export function StoreSettingsSaveBar({
  onSave,
  isSaving,
  status,
  label = 'Save Settings',
  button,
  className,
}: {
  onSave?: () => void
  isSaving: boolean
  status?: string | null
  label?: string
  button?: ReactNode
  className?: string
}) {
  const control = button ?? (
    <Button onClick={onSave} disabled={isSaving} className="h-10 rounded-full px-5 text-sm" type="button">
      {isSaving ? 'Saving...' : label}
    </Button>
  )

  // One bar at the end of the form on every screen. A bar pinned to the bottom of a phone covered the field being typed in.
  return (
    <div className={cn('flex flex-col gap-3 md:flex-row md:items-center [&_[data-slot=button]]:max-md:w-full', className)}>
      {status ? <span className="text-xs text-muted-foreground">{status}</span> : null}
      {control}
    </div>
  )
}
