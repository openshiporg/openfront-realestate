'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react'
import { ChevronDown, MapPin, Search, SlidersHorizontal } from 'lucide-react'
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

const SALE_CAPS = [300_000, 500_000, 750_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000]
const RENT_CAPS = [1500, 2000, 2500, 3000, 4000, 5000, 7500]

const short = (value: number) => value >= 1_000_000 ? `$${(value / 1_000_000).toString()}M` : value >= 10_000 ? `$${value / 1000}K` : `$${value.toLocaleString('en-US')}`

// The results reload as filters change and the form is remade with them; the panel stays open across that.
let panelStaysOpen = false

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
 * The search pill: area, price cap and beds, with the rest of the filters one tap away.
 * A plain GET form (it works without script); with script, changing a select reloads the results straight away.
 */
export function ListingSearchForm({ params, marketCity = '', action = '/listings', countLabel = '' }: { params: ListingSearchParams; marketCity?: string; action?: string; countLabel?: string }) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(() => panelStaysOpen)
  useEffect(() => { panelStaysOpen = false }, [])
  const extra = [params.minPrice, params.baths, params.propertyType, params.type].filter(Boolean).length
  const caps = params.type === 'rent' ? RENT_CAPS : SALE_CAPS
  const cap = params.maxPrice ? Number(params.maxPrice) : 0
  const capOptions = cap && !caps.includes(cap) ? [...caps, cap].sort((a, b) => a - b) : caps

  function go() {
    const form = formRef.current
    if (!form) return
    const href = searchHref(action, form)
    startTransition(() => router.push(href, { scroll: false }))
  }

  // A filter picked in the open panel applies straight away: the pins and the count update behind it.
  function goFromPanel() {
    panelStaysOpen = true
    go()
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOpen(false)
    go()
  }

  return (
    <form ref={formRef} action={action} onSubmit={submit} className="sf-search" role="search" aria-label="Search homes" data-open={open || undefined} data-pending={pending || undefined}>
      {params.sort ? <input type="hidden" name="sort" value={params.sort} /> : null}
      <div className="sf-search__pill">
        <label className="sf-search__area">
          <MapPin aria-hidden className="sf-search__pin" />
          <Search aria-hidden className="sf-search__lens" />
          <span className="sr-only">City, neighborhood, or ZIP</span>
          <input name="q" defaultValue={params.q || ''} type="search" enterKeyHint="search" placeholder="City, neighborhood, or ZIP" autoComplete="off" maxLength={120} />
        </label>
        <label className="sf-search__select">
          <span>Price</span>
          <select name="maxPrice" defaultValue={params.maxPrice || ''} onChange={go}>
            <option value="">Any Price</option>
            {capOptions.map(value => <option key={value} value={String(value)}>Up to {short(value)}{params.type === 'rent' ? '/mo' : ''}</option>)}
          </select>
          <ChevronDown aria-hidden />
        </label>
        <label className="sf-search__select">
          <span>Beds</span>
          <select name="beds" defaultValue={params.beds || ''} onChange={go}>
            <option value="">Any Beds</option>
            {[1, 2, 3, 4, 5].map(value => <option key={value} value={String(value)}>{value}+ beds</option>)}
          </select>
          <ChevronDown aria-hidden />
        </label>
        <button type="button" className="sf-search__more" aria-expanded={open} aria-controls="sf-search-filters" onClick={() => setOpen(value => !value)} aria-label={extra ? `More filters, ${extra} on` : 'More filters'}>
          <SlidersHorizontal aria-hidden />{extra ? <b className="sf-num">{extra}</b> : null}
        </button>
        <button type="submit" className="sf-search__go" aria-label="Search"><Search aria-hidden /></button>
      </div>
      <button type="button" className="sf-search__filters-btn" aria-expanded={open} aria-controls="sf-search-filters" onClick={() => setOpen(value => !value)}>
        <SlidersHorizontal aria-hidden /><span>Filters</span>{extra ? <b className="sf-num">{extra}</b> : null}
      </button>

      <div id="sf-search-filters" className="sf-search__panel" hidden={!open}>
        <label className="sf-search__field sf-search__phone-only">
          <span>Max price</span>
          <select defaultValue={params.maxPrice || ''} className="sf-field" onChange={event => {
            const main = formRef.current?.elements.namedItem('maxPrice') as HTMLSelectElement | null
            if (main) main.value = event.target.value
            goFromPanel()
          }}>
            <option value="">Any price</option>
            {capOptions.map(value => <option key={value} value={String(value)}>Up to {short(value)}{params.type === 'rent' ? '/mo' : ''}</option>)}
          </select>
        </label>
        <label className="sf-search__field sf-search__phone-only">
          <span>Beds</span>
          <select defaultValue={params.beds || ''} className="sf-field" onChange={event => {
            const main = formRef.current?.elements.namedItem('beds') as HTMLSelectElement | null
            if (main) main.value = event.target.value
            goFromPanel()
          }}>
            <option value="">Any</option>
            {[1, 2, 3, 4, 5].map(value => <option key={value} value={String(value)}>{value}+</option>)}
          </select>
        </label>
        <label className="sf-search__field">
          <span>For</span>
          <select name="type" defaultValue={params.type || ''} className="sf-field" onChange={goFromPanel}><option value="">Sale or rent</option><option value="sale">For sale</option><option value="rent">For rent</option></select>
        </label>
        <label className="sf-search__field">
          <span>Min price</span>
          <input name="minPrice" type="text" inputMode="numeric" autoComplete="off" maxLength={16} defaultValue={params.minPrice || ''} className="sf-field sf-num" placeholder="No min" onBlur={event => { if (event.target.value.trim() !== (params.minPrice || '')) goFromPanel() }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); goFromPanel() } }} />
        </label>
        <label className="sf-search__field">
          <span>Baths</span>
          <select name="baths" defaultValue={params.baths || ''} className="sf-field" onChange={goFromPanel}><option value="">Any</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option></select>
        </label>
        <label className="sf-search__field">
          <span>Home type</span>
          <select name="propertyType" defaultValue={params.propertyType || 'any'} className="sf-field" onChange={goFromPanel}>{propertyTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </label>
        <div className="sf-search__apply">
          {countLabel ? <output className="sf-search__count sf-num" aria-live="polite">{pending ? 'Updating' : countLabel}</output> : null}
          <button type="submit" className="sf-btn sf-btn--primary">{countLabel && !pending ? (countLabel === 'No homes' ? 'No homes match' : `Show ${countLabel}`) : 'Show homes'}</button>
        </div>
      </div>
    </form>
  )
}
