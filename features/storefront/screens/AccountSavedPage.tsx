import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCustomer } from '../lib/data/account'
import { deleteSavedSearch, getSavedHomes, getSavedPropertyIds, getSavedSearches, type SavedSearch } from '../lib/data/saved'
import { listingPageHref } from '../lib/data/listingPagination'
import { storefrontTitle } from '../lib/metadata'
import { ListingCard } from './ListingCard'

export async function generateMetadata(): Promise<Metadata> {
  return { title: await storefrontTitle('Saved homes') }
}

function searchHref(search: SavedSearch) {
  return listingPageHref({
    q: search.keywords || undefined,
    type: search.listingType === 'sale' || search.listingType === 'rent' ? search.listingType : undefined,
    propertyType: search.propertyType || undefined,
    minPrice: search.minPrice ? String(Number(search.minPrice)) : undefined,
    maxPrice: search.maxPrice ? String(Number(search.maxPrice)) : undefined,
    beds: search.minBedrooms ? String(search.minBedrooms) : undefined,
    baths: search.minBathrooms ? String(Math.floor(Number(search.minBathrooms))) : undefined,
  }, 0)
}

export default async function AccountSavedPage() {
  const customer = await getCustomer()
  if (!customer) notFound()
  const [homes, searches, savedIds] = await Promise.all([getSavedHomes(), getSavedSearches(customer.id), getSavedPropertyIds()])

  return <>
    <header className="sf-account__head">
      <h1>Saved homes</h1>
    </header>

    <section className="sf-account__section" aria-labelledby="saved-homes">
      <h2 id="saved-homes" className="sr-only">Homes</h2>
      {homes.error ? <p className="sf-message" role="alert">{homes.error}</p> : homes.items.length ? (
        <div className="sf-modules" style={{ '--sf-count': homes.items.length } as CSSProperties}>
          {homes.items.map(listing => <ListingCard key={listing.id} listing={listing} save={{ signedIn: true, savedIds }} />)}
        </div>
      ) : (
        <div className="sf-state">
          <h3>No saved homes yet</h3>
          <p>Use the heart on any home to keep it here.</p>
          <Link className="sf-btn sf-btn--primary" href="/listings">Browse homes</Link>
        </div>
      )}
    </section>

    <section className="sf-account__section" aria-labelledby="saved-searches">
      <h2 id="saved-searches">Saved searches</h2>
      {searches.error ? <p className="sf-message" role="alert">{searches.error}</p> : searches.items.length ? (
        <ul className="sf-trips">
          {searches.items.map(search => (
            <li key={search.id} className="sf-trip">
              <h3 className="sf-trip__title">{search.name}</h3>
              <div className="sf-results-head__actions">
                <Link className="sf-link" href={searchHref(search)}>View homes</Link>
                <form action={deleteSavedSearch}>
                  <input type="hidden" name="savedSearchId" value={search.id} />
                  <button type="submit" className="sf-btn sf-btn--quiet">Delete</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="sf-account__note">No saved searches. Filter the results, then choose Save search.</p>
      )}
    </section>
  </>
}
