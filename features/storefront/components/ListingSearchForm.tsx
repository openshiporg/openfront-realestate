'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition, type FormEvent } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import type { ListingSearchParams } from '@/features/storefront/lib/data/properties'

const propertyTypes = [
  ['any', 'Any type'],
  ['house', 'House'],
  ['condo', 'Condo'],
  ['townhome', 'Townhome'],
  ['multi_family', 'Multi-family'],
  ['land', 'Land'],
  ['commercial', 'Commercial'],
]

function searchHref(action: string, form: HTMLFormElement) {
  const query = new URLSearchParams()
  for (const [key, raw] of new FormData(form).entries()) {
    const value = String(raw).trim()
    if (!value || (key === 'propertyType' && value === 'any')) continue
    query.set(key, value)
  }
  const search = query.toString()
  return search ? `${action}?${search}` : action
}

/**
 * The metal search rail. A plain GET form (it works without script); with script, changing a
 * select reloads the results straight away and the rail's count reads "Updating" until they land.
 */
export function ListingSearchForm({ params, marketCity = '', action = '/listings', countLabel = '' }: { params: ListingSearchParams; marketCity?: string; action?: string; countLabel?: string }) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const extra = [params.minPrice, params.maxPrice, params.beds, params.baths, params.propertyType].filter(Boolean).length

  function go() {
    const form = formRef.current
    if (!form) return
    const href = searchHref(action, form)
    startTransition(() => router.push(href, { scroll: false }))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    go()
  }

  return (
    <div className="sf-rail" data-pending={pending || undefined}>
      <form ref={formRef} action={action} onSubmit={submit} className="sf-container sf-rail__form" role="search" aria-label="Search homes" data-open={open || undefined}>
        {params.type ? <input type="hidden" name="type" value={params.type} /> : null}
        {params.sort ? <input type="hidden" name="sort" value={params.sort} /> : null}
        <label className="sf-rail__field sf-rail__area">
          <span>Area</span>
          <input name="q" defaultValue={params.q || ''} className="sf-field" placeholder={marketCity ? `Neighborhood, street or ZIP in ${marketCity}` : 'Neighborhood, street or ZIP'} autoComplete="off" maxLength={120} />
        </label>
        <button type="button" className="sf-rail__more" aria-expanded={open} aria-controls="sf-rail-filters" onClick={() => setOpen(value => !value)}>
          <SlidersHorizontal aria-hidden /><span>Filters</span>{extra ? <b className="sf-num">{extra}</b> : null}
        </button>
        <div id="sf-rail-filters" className="sf-rail__filters">
          <label className="sf-rail__field sf-rail__price">
            <span>Min price</span>
            <input name="minPrice" type="text" inputMode="numeric" autoComplete="off" maxLength={16} defaultValue={params.minPrice || ''} className="sf-field sf-num" placeholder="No min" />
          </label>
          <label className="sf-rail__field sf-rail__price">
            <span>Max price</span>
            <input name="maxPrice" type="text" inputMode="numeric" autoComplete="off" maxLength={16} defaultValue={params.maxPrice || ''} className="sf-field sf-num" placeholder="No max" />
          </label>
          <label className="sf-rail__field">
            <span>Beds</span>
            <select name="beds" defaultValue={params.beds || ''} className="sf-field" onChange={go}><option value="">Any</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option><option value="4">4+</option></select>
          </label>
          <label className="sf-rail__field">
            <span>Baths</span>
            <select name="baths" defaultValue={params.baths || ''} className="sf-field" onChange={go}><option value="">Any</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option></select>
          </label>
          <label className="sf-rail__field">
            <span>Home type</span>
            <select name="propertyType" defaultValue={params.propertyType || 'any'} className="sf-field" onChange={go}>{propertyTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </label>
        </div>
        <div className="sf-rail__go">
          {countLabel ? <output className="sf-rail__count sf-num" aria-live="polite">{pending ? 'Updating' : countLabel}</output> : null}
          <button type="submit" className="sf-btn sf-btn--primary sf-rail__submit" aria-label="Search">
            <Search aria-hidden /><span>Search</span>
          </button>
        </div>
      </form>
    </div>
  )
}
