'use client'

import { useRouter } from 'next/navigation'
import { LISTING_SORTS, listingPageHref } from '../lib/data/listingPagination'
import type { ListingSearchParams } from '../lib/data/properties'

export function SortSelect({ params }: { params: ListingSearchParams }) {
  const router = useRouter()
  return (
    <label className="sf-label">
      <span className="sr-only">Sort</span>
      <select className="sf-field" value={params.sort || ''} onChange={event => router.push(listingPageHref({ ...params, sort: event.target.value }, 0))}>
        {LISTING_SORTS.map(([value, label]) => <option key={value || 'default'} value={value}>{label}</option>)}
      </select>
    </label>
  )
}
