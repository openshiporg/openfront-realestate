'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Heart } from 'lucide-react'
import { toggleSavedHome, type SaveHomeState } from '../lib/data/saved'

export function SaveHomeButton({ propertyId, title, slug, savedId, signedIn, className = '' }: { propertyId: string; title: string; slug: string; savedId: string | null; signedIn: boolean; className?: string }) {
  const [state, action, pending] = useActionState(toggleSavedHome, { savedId, message: '' } satisfies SaveHomeState)
  const listingPath = `/listings/${slug}`

  if (!signedIn) {
    return <Link href={`/account?from=${encodeURIComponent(listingPath)}`} className={`sf-save ${className}`} aria-label={`Sign in to save ${title}`} title="Save"><Heart aria-hidden /></Link>
  }

  const saved = Boolean(state.savedId)
  return (
    <form action={action} className={className}>
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="listingPath" value={listingPath} />
      <button type="submit" className="sf-save" aria-pressed={saved} aria-label={saved ? `Remove ${title} from saved homes` : `Save ${title}`} title={state.message || (saved ? 'Saved' : 'Save')} disabled={pending}>
        <Heart aria-hidden />
      </button>
      {state.message ? <span className="sr-only" role="status">{state.message}</span> : null}
    </form>
  )
}
