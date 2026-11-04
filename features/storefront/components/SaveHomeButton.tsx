'use client'

import Link from 'next/link'
import { useActionState, useEffect, useOptimistic, useState } from 'react'
import { Heart } from 'lucide-react'
import { toggleSavedHome, type SaveHomeState } from '../lib/data/saved'
import { announceSaved, SAVED_EVENT, type SavedDetail } from '../lib/map-events'

/**
 * The heart on a home. Every heart for the same home stays in step (the card in the list, the map's
 * preview and the home's pin), so saving from one shows everywhere at once.
 */
export function SaveHomeButton({ propertyId, title, slug, savedId, signedIn, className = '' }: { propertyId: string; title: string; slug: string; savedId: string | null; signedIn: boolean; className?: string }) {
  const [current, setCurrent] = useState(savedId)
  const [given, setGiven] = useState(savedId)
  const listingPath = `/listings/${slug}`
  // A fresh answer from the server (the page reloaded its saved homes) wins over the last local change.
  if (given !== savedId) {
    setGiven(savedId)
    setCurrent(savedId)
  }

  useEffect(() => {
    const onSaved = (event: Event) => {
      const detail = (event as CustomEvent<SavedDetail>).detail
      if (detail.id === propertyId) setCurrent(detail.savedId)
    }
    window.addEventListener(SAVED_EVENT, onSaved)
    return () => window.removeEventListener(SAVED_EVENT, onSaved)
  }, [propertyId])

  if (!signedIn) {
    return <Link href={`/account?from=${encodeURIComponent(listingPath)}`} className={`sf-save ${className}`} aria-label={`Sign in to save ${title}`} title="Save"><Heart aria-hidden /></Link>
  }

  return <SignedInSaveButton key={current || 'none'} propertyId={propertyId} title={title} listingPath={listingPath} className={className} savedId={current} />
}

function SignedInSaveButton({ propertyId, title, listingPath, className, savedId }: { propertyId: string; title: string; listingPath: string; className: string; savedId: string | null }) {
  // The answer is announced as soon as it lands, before the page's refreshed saved homes remount this
  // button, so every other heart and the home's pin follow at once.
  const [state, action, pending] = useActionState(async (previous: SaveHomeState, form: FormData) => {
    const next = await toggleSavedHome(previous, form)
    if (next.savedId !== previous.savedId) announceSaved(propertyId, next.savedId)
    return next
  }, { savedId, message: '' } satisfies SaveHomeState)
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
