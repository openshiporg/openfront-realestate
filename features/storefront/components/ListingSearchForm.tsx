import { MapPin, Search } from 'lucide-react'
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

const intents = [
  ['', 'All'],
  ['sale', 'Buy'],
  ['rent', 'Rent'],
]

export function ListingSearchForm({ params, marketCity = '', action = '/' }: { params: ListingSearchParams; marketCity?: string; action?: string }) {
  const intent = params.type === 'sale' || params.type === 'rent' ? params.type : ''
  return (
    <form action={action} className="sf-search" role="search" aria-label="Search homes">
      <div className="sf-search__primary">
        <div className="sf-track" role="radiogroup" aria-label="Buy or rent">
          {intents.map(([value, label]) => (
            <label key={value || 'all'}>
              <input type="radio" name="type" value={value} defaultChecked={intent === value} />
              <span className="sf-track__item">{label}</span>
            </label>
          ))}
        </div>
        <label className="sf-search__where">
          <span className="sr-only">Location</span>
          <MapPin aria-hidden />
          <input name="q" defaultValue={params.q || ''} className="sf-field" placeholder={marketCity ? `Neighborhood or address in ${marketCity}` : 'Neighborhood or address'} />
        </label>
        <button type="submit" className="sf-btn sf-btn--primary sf-search__submit">
          <Search aria-hidden /> Search
        </button>
        {params.sort ? <input type="hidden" name="sort" value={params.sort} /> : null}
      </div>
      <div className="sf-search__filters">
        <label><span>Home type</span><select name="propertyType" defaultValue={params.propertyType || 'any'} className="sf-field">{propertyTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>Bedrooms</span><select name="beds" defaultValue={params.beds || ''} className="sf-field"><option value="">Any</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option><option value="4">4+</option></select></label>
        <label><span>Bathrooms</span><select name="baths" defaultValue={params.baths || ''} className="sf-field"><option value="">Any</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option></select></label>
        <label><span>Min price</span><input name="minPrice" type="text" inputMode="numeric" autoComplete="off" maxLength={16} defaultValue={params.minPrice || ''} className="sf-field" placeholder="No min" /></label>
        <label><span>Max price</span><input name="maxPrice" type="text" inputMode="numeric" autoComplete="off" maxLength={16} defaultValue={params.maxPrice || ''} className="sf-field" placeholder="No max" /></label>
      </div>
    </form>
  )
}
