import type { ReactNode } from 'react'
import { Track } from '../../components/PlatformUI'
import { listingTransitions } from '../lib/listingStatus'
import { ListingStatusButton, ListingStatusMenu } from './ListingStatusButton'

/**
 * Status changes allowed from the listing's current status (mirrors transitionPropertyStatus).
 * The forward step (Publish) is the one filled button; every other change lives in the Status menu.
 * `children` render before the status controls (e.g. Edit on the detail page).
 */
export function ListingStatusTrack({ id, title, status, listingType, children, showPrimary = true }: { id: string; title: string; status: string; listingType: string | null; children?: ReactNode; showPrimary?: boolean }) {
  const moves = listingTransitions(status, listingType)
  const primary = showPrimary ? moves.find(move => move.kind === 'primary') : undefined
  const rest = moves.filter(move => move !== primary)
  return (
    <Track label={`${title} actions`} className="flex-nowrap">
      {children}
      {primary ? <ListingStatusButton propertyId={id} status={primary.status} label={primary.label} primary /> : null}
      <ListingStatusMenu propertyId={id} title={title} moves={rest} />
    </Track>
  )
}
