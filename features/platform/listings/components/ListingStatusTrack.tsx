import type { ReactNode } from 'react'
import { Track } from '../../components/PlatformUI'
import { ListingStatusButton } from './ListingStatusButton'

/** The status transitions allowed from the listing's current status (mirrors transitionPropertyStatus). */
export function ListingStatusTrack({ id, title, status, listingType, children }: { id: string; title: string; status: string; listingType: string | null; children?: ReactNode }) {
  const isRental = listingType === 'rent'
  return (
    <Track label={`${title} actions`}>
      {['draft', 'coming_soon', 'off_market'].includes(status) ? <ListingStatusButton propertyId={id} status="active" label="Publish" primary /> : null}
      {['draft', 'off_market'].includes(status) ? <ListingStatusButton propertyId={id} status="coming_soon" label="Coming soon" /> : null}
      {status === 'active' ? <ListingStatusButton propertyId={id} status="pending" label="Mark pending" /> : null}
      {status === 'pending' ? <ListingStatusButton propertyId={id} status="active" label="Back to active" /> : null}
      {['active', 'pending'].includes(status) ? <ListingStatusButton propertyId={id} status={isRental ? 'rented' : 'sold'} label={isRental ? 'Mark rented' : 'Mark sold'} /> : null}
      {['draft', 'active', 'coming_soon', 'pending', 'sold', 'rented'].includes(status) ? <ListingStatusButton propertyId={id} status="off_market" label="Withdraw" /> : null}
      {children}
    </Track>
  )
}
