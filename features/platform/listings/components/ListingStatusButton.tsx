'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { pillClass, pillPrimaryClass } from '../../components/styles'
import { transitionListingStatus } from '../actions/listings'

export function ListingStatusButton({ propertyId, status, label, primary = false }: { propertyId: string; status: string; label: string; primary?: boolean }) {
  const [state, action, pending] = useActionState(transitionListingStatus, { ok: false, message: '' })
  useEffect(() => {
    if (!state.message) return
    if (state.ok) toast.success(state.message)
    else toast.error(state.message)
  }, [state])
  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant="ghost" size="sm" className={primary ? pillPrimaryClass : pillClass} disabled={pending}>{pending ? 'Updating…' : label}</Button>
    </form>
  )
}
