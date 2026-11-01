import { Search, SlidersHorizontal } from 'lucide-react'

/** The search box that floats on the map beside a home: a plain GET search back into the results. */
export function CompactSearch({ marketCity = '', type }: { marketCity?: string; type?: 'sale' | 'rent' }) {
  return (
    <form action="/listings" className="sf-compact-search" role="search" aria-label="Search homes">
      {type ? <input type="hidden" name="type" value={type} /> : null}
      <label className="sf-compact-search__field">
        <Search aria-hidden />
        <span className="sr-only">Search neighborhood, city, or ZIP</span>
        <input name="q" placeholder={marketCity ? `Search neighborhood, city, or ZIP` : 'Search neighborhood or ZIP'} autoComplete="off" maxLength={120} />
      </label>
      <a href={type ? `/listings?type=${type}` : '/listings'} className="sf-compact-search__filters"><SlidersHorizontal aria-hidden />Filters</a>
    </form>
  )
}
