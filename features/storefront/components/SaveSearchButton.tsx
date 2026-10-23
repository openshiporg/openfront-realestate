'use client'

import { useActionState } from 'react'
import { saveCurrentSearch, type SaveSearchState } from '../lib/data/saved'
import type { ListingSearchParams } from '../lib/data/properties'

const FIELDS = ['q', 'type', 'propertyType', 'minPrice', 'maxPrice', 'beds', 'baths'] as const

export function SaveSearchButton({ params }: { params: ListingSearchParams }) {
  const [state, action, pending] = useActionState(saveCurrentSearch, { ok: false, message: '' } satisfies SaveSearchState)
  return (
    <form action={action}>
      {FIELDS.map(field => params[field] ? <input key={field} type="hidden" name={field} value={params[field]} /> : null)}
      <button type="submit" className="sf-btn sf-btn--quiet" disabled={pending || state.ok}>{pending ? 'Saving…' : state.ok ? 'Search saved' : 'Save search'}</button>
      {state.message && !state.ok ? <span className="sf-message" role="alert">{state.message}</span> : null}
    </form>
  )
}
