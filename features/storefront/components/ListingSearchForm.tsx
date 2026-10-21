import { Search } from 'lucide-react'
import type { ListingSearchParams } from '@/features/storefront/lib/data/properties'

const propertyTypes = [
  ['any', 'Any home'],
  ['house', 'House'],
  ['condo', 'Condo'],
  ['townhome', 'Townhome'],
  ['multi_family', 'Multi-family'],
  ['land', 'Land'],
  ['commercial', 'Commercial'],
]

export function ListingSearchForm({ params, count, hasMore = false, marketCity = 'your area', compact = false, action = '/' }: { params: ListingSearchParams; count: number; hasMore?: boolean; marketCity?: string; compact?: boolean; action?: string }) {
  return (
    <form action={action} className={compact ? 'sf-search sf-search--compact' : 'sf-search'}>
      <label className="sf-search__location"><span>Where in {marketCity}?</span><input name="q" defaultValue={params.q || ''} className="sf-field" placeholder="Neighborhood or address" /></label>
      <label><span>Looking to</span><select name="type" defaultValue={params.type || ''} className="sf-field"><option value="">Buy or rent</option><option value="sale">Buy</option><option value="rent">Rent</option></select></label>
      <label><span>Home type</span><select name="propertyType" defaultValue={params.propertyType || 'any'} className="sf-field">{propertyTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label><span>Bedrooms</span><select name="beds" defaultValue={params.beds || ''} className="sf-field"><option value="">Any</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option><option value="4">4+</option></select></label>
      <label><span>Minimum price ($)</span><input name="minPrice" type="text" inputMode="decimal" pattern="[0-9]{1,10}([.][0-9]{1,2})?" defaultValue={params.minPrice || ''} className="sf-field" placeholder="No minimum" /></label>
      <label><span>Maximum price ($)</span><input name="maxPrice" type="text" inputMode="decimal" pattern="[0-9]{1,10}([.][0-9]{1,2})?" defaultValue={params.maxPrice || ''} className="sf-field" placeholder="No maximum" /></label>
      <button type="submit" className="sf-btn sf-btn--dark"><Search aria-hidden /> Search <span className="sf-search__count" aria-label={`${count}${hasMore ? "+" : ""} homes`}>{count}{hasMore ? '+' : ''}</span></button>
    </form>
  )
}
