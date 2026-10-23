'use client'

import Link from 'next/link'
import { useActionState, useOptimistic } from 'react'
import { Heart } from 'lucide-react'
import { toggleSavedHome, type SaveHomeState } from '../lib/data/saved'

export function SaveHomeButton({ propertyId, title, slug, savedId, signedIn, className = '' }: { propertyId: string; title: string; slug: string; savedId: string | null; signedIn: boolean; className?: string }) {
  const [state, action, pending] = useActionState(toggleSavedHome, { savedId, message: '' } satisfies SaveHomeState)
  const listingPath = `/listings/${slug}`

  if (!signedIn) {
    return <Link href={`/account?from=${encodeURIComponent(listingPath)}`} className={`sf-save ${className}`} aria-label={`Sign in to save ${title}`} title="Save"><Heart aria-hidden /></Link>
  }

  return <SignedInSaveButton propertyId={propertyId} title={title} listingPath={listingPath} className={className} state={state} action={action} pending={pending} />
}

function SignedInSaveButton({ propertyId, title, listingPath, className, state, action, pending }: { propertyId: string; title: string; listingPath: string; className: string; state: SaveHomeState; action: (formData: FormData) => void; pending: boolean }) {
  // The heart flips on click; the server answer then confirms or reverts it.
  const [saved, setSaved] = useOptimistic(Boolean(state.savedId))
  return (
    <form action={formData => { setSaved(!saved); action(formData) }} className={className}>
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="listingPath" value={listingPath} />
      <button type="submit" className="sf-save" aria-pressed={saved} aria-label={saved ? `Remove ${title} from saved homes` : `Save ${title}`} title={state.message || (saved ? 'Saved' : 'Save')} disabled={pending} aria-busy={pending} data-pending={pending || undefined}>
        <Heart aria-hidden />
      </button>
      {state.message ? <span className="sr-only" role="status">{state.message}</span> : null}
    </form>
  )
}
