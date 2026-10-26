import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'
import { formatMoney } from '@/features/lib/money'
import { ErrorBanner, Meta, Panel, PlatformPage, TitleLine, Track, trackItemClass, type Tone } from '../../components/PlatformUI'
import { getViewerPermissions } from '../../lib/records'
import { label, leadIntentLabels, leadStatusColors, leadStatusLabels } from '../../leads/lib/labels'
import { LocalDateTime } from '../../showings/components/LocalDateTime'
import { showingStatusColors, showingStatusLabels, showingTypeLabels } from '../../showings/lib/labels'
import { ListingStatusTrack } from '../components/ListingStatusTrack'
import { AddMediaDrawer, EditListingDrawer, MediaActions, OpenHouseActions, ScheduleOpenHouseDrawer } from '../components/ListingRecordActions'
import { getAgentOptions, getListingDetail } from '../lib/listingDetail'
import { listingStatuses } from '../lib/listingStatus'

const openHouseTones: Record<string, Tone> = { scheduled: 'sky', completed: 'emerald', cancelled: 'zinc' }
const syndicationTones: Record<string, Tone> = { draft: 'zinc', published: 'emerald', error: 'rose', removed: 'zinc' }
const typeLabels: Record<string, string> = { house: 'House', condo: 'Condo', townhome: 'Townhome', multi_family: 'Multi-family', land: 'Land', commercial: 'Commercial' }

function mediaPreview(url: string, mediaType: string) {
  return mediaType === 'photo' || mediaType === 'floor_plan' ? url : ''
}

export async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [detail, agents, viewer] = await Promise.all([getListingDetail(id), getAgentOptions(), getViewerPermissions()])
  if (!detail.listing && !detail.error) notFound()
  if (!detail.listing) {
    return <PlatformPage crumbs={[{ label: 'Listings', href: '/platform/listings' }, { label: 'Listing' }]} title="Listing"><ErrorBanner>This listing could not be loaded. {detail.error}</ErrorBanner></PlatformPage>
  }
  const { listing, media = [], openHouses = [], leads, showings, syndications = [] } = detail
  const status = listingStatuses.find(entry => entry.value === listing.status)
  const rental = listing.listingType === 'rent'
  const price = `${formatMoney(listing.price)}${rental ? '/mo' : ''}`
  const address = [listing.addressLine1, listing.addressLine2, listing.city, [listing.state, listing.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const nextSort = media.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 1
  const upcoming = openHouses.filter(item => item.status === 'scheduled')

  return (
    <PlatformPage
      crumbs={[{ label: 'Listings', href: '/platform/listings' }, { label: listing.title }]}
      title={<TitleLine as="h1" tone={status?.tone || 'zinc'} status={status?.label || listing.status} headingClassName="text-2xl tracking-tight">{listing.title}</TitleLine>}
      meta={<>{address} · <span className="font-medium tabular-nums text-foreground">{price}</span></>}
      actions={<>
        {['active', 'coming_soon', 'pending'].includes(listing.status) ? <Link href={`/listings/${listing.slug}`} className={trackItemClass(false)}>Storefront <ArrowUpRight aria-hidden className="size-3.5" /></Link> : null}
        <EditListingDrawer listing={listing} agents={agents} canAssign={viewer.canManagePeople} />
        <span aria-hidden className="mx-0.5 hidden h-8 w-px bg-border sm:block" />
        <ListingStatusTrack id={listing.id} title={listing.title} status={listing.status} listingType={listing.listingType} />
      </>}
    >
      <div className="grid gap-5 pb-16 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0 space-y-5">
          <Panel title="Details">
            <dl className="grid gap-4 sm:grid-cols-3">
              <Meta label="Type">{rental ? 'Rental' : 'Sale'} · {typeLabels[listing.propertyType] || listing.propertyType}</Meta>
              <Meta label="Beds / baths">{[listing.bedrooms ? `${listing.bedrooms} bd` : '', Number(listing.bathrooms) ? `${Number(listing.bathrooms)} ba` : ''].filter(Boolean).join(' · ') || '—'}</Meta>
              <Meta label="Size">{listing.squareFeet ? `${listing.squareFeet.toLocaleString()} sq ft` : '—'}</Meta>
              <Meta label="Lot">{listing.lotSizeSquareFeet ? `${listing.lotSizeSquareFeet.toLocaleString()} sq ft` : '—'}</Meta>
              <Meta label="Year built">{listing.yearBuilt || '—'}</Meta>
              <Meta label="HOA">{listing.hoaFee && Number(listing.hoaFee) > 0 ? `${formatMoney(listing.hoaFee)}/mo` : '—'}</Meta>
              <Meta label="Available">{listing.availableAt ? <LocalDateTime value={listing.availableAt} options={{ dateStyle: 'medium' }} /> : '—'}</Meta>
              <Meta label="Neighborhood">{listing.neighborhood || '—'}</Meta>
              <Meta label="Featured">{listing.isFeatured ? 'Yes' : 'No'}</Meta>
              {rental ? <>
                <Meta label="Lease term">{listing.leaseTerm || '—'}</Meta>
                <Meta label="Deposit">{listing.securityDeposit ? formatMoney(String(listing.securityDeposit)) : '—'}</Meta>
                <Meta label="Pets">{listing.petPolicy || '—'}</Meta>
              </> : null}
            </dl>
            {listing.description || listing.shortDescription ? <p className="mt-4 whitespace-pre-line border-t border-border pt-4 text-sm text-foreground/90">{listing.description || listing.shortDescription}</p> : null}
          </Panel>

          <Panel title={`Media (${media.length})`} actions={<Track><AddMediaDrawer propertyId={listing.id} nextSort={nextSort} /></Track>}>
            {media.length ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {media.map(item => (
                  <li key={item.id} className="overflow-hidden rounded-[6px] border border-border">
                    {mediaPreview(item.url, item.mediaType)
                      ? <div className="aspect-[4/3] bg-muted bg-cover bg-center" style={{ backgroundImage: `url(${item.url})` }} role="img" aria-label={item.altText || item.title} />
                      : <a href={item.url} className="flex aspect-[4/3] items-center justify-center bg-muted text-sm text-muted-foreground hover:underline">{label({ virtual_tour: 'Virtual tour', video: 'Video', document: 'Document' }, item.mediaType)}</a>}
                    <div className="space-y-2 p-3">
                      <TitleLine as="h3" status={item.isHero ? 'Cover' : `#${item.sortOrder}`} headingClassName="text-sm">{item.title}</TitleLine>
                      <Track label={`${item.title} actions`}><MediaActions mediaId={item.id} propertyId={listing.id} sortOrder={item.sortOrder} isHero={item.isHero} /></Track>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No media</p>}
          </Panel>

          <Panel title="Open houses" actions={<Track><ScheduleOpenHouseDrawer propertyId={listing.id} agents={agents} /></Track>}>
            {openHouses.length ? (
              <ul className="divide-y divide-border">
                {openHouses.map(item => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <TitleLine as="h3" tone={openHouseTones[item.status] || 'zinc'} status={label({ scheduled: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled' }, item.status)} headingClassName="text-sm">{item.title}</TitleLine>
                      <p className="text-sm text-muted-foreground"><LocalDateTime value={item.startsAt} options={{ weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }} /> – <LocalDateTime value={item.endsAt} options={{ hour: 'numeric', minute: '2-digit' }} />{item.hostAgent ? ` · ${item.hostAgent.name}` : ''}</p>
                    </div>
                    {item.status === 'scheduled' ? <Track label={`${item.title} actions`}><OpenHouseActions openHouseId={item.id} /></Track> : null}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No open houses</p>}
          </Panel>
        </div>

        <aside className="min-w-0 space-y-5 lg:sticky lg:top-4">
          <Panel title="Agent">
            <p className="text-sm font-medium text-foreground">{listing.assignedAgent?.name || 'Unassigned'}</p>
            <p className="mt-1 text-xs text-muted-foreground">{upcoming.length} upcoming open {upcoming.length === 1 ? 'house' : 'houses'}</p>
          </Panel>

          <Panel title={`Leads${leads ? ` (${leads.length})` : ''}`}>
            {!leads ? <p className="text-sm text-muted-foreground">No access</p> : leads.length ? (
              <ul className="space-y-2.5">
                {leads.map(lead => (
                  <li key={lead.id}>
                    <TitleLine as="h3" tone={leadStatusColors[lead.status] || 'zinc'} status={label(leadStatusLabels, lead.status)} headingClassName="text-sm"><Link href={`/dashboard/platform/leads/${lead.id}`} className="hover:underline">{lead.name}</Link></TitleLine>
                    <p className="text-xs text-muted-foreground">{label(leadIntentLabels, lead.intent)} · <LocalDateTime value={lead.createdAt} options={{ dateStyle: 'medium' }} /></p>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No leads</p>}
          </Panel>

          <Panel title={`Showings${showings ? ` (${showings.length})` : ''}`}>
            {!showings ? <p className="text-sm text-muted-foreground">No access</p> : showings.length ? (
              <ul className="space-y-2.5">
                {showings.map(showing => (
                  <li key={showing.id}>
                    <TitleLine as="h3" tone={showingStatusColors[showing.status] || 'zinc'} status={label(showingStatusLabels, showing.status)} headingClassName="text-sm"><Link href={`/dashboard/platform/showings/${showing.id}`} className="hover:underline"><LocalDateTime value={showing.scheduledStart} options={{ month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }} /></Link></TitleLine>
                    <p className="text-xs text-muted-foreground">{showing.lead?.name || 'No client'} · {label(showingTypeLabels, showing.showingType)}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No showings</p>}
          </Panel>

          <Panel title="Syndication">
            {syndications.length ? (
              <ul className="space-y-2">
                {syndications.map(row => (
                  <li key={row.id}>
                    <TitleLine as="h3" tone={syndicationTones[row.status] || 'zinc'} status={row.status} headingClassName="text-sm">{row.channel.toUpperCase()}</TitleLine>
                    {row.errorMessage ? <p className="text-xs text-destructive">{row.errorMessage}</p> : null}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Not syndicated</p>}
            <Link href="/dashboard/platform/operations?section=syndication" className="mt-3 inline-block text-xs font-medium text-muted-foreground hover:text-foreground">Manage in Operations</Link>
          </Panel>
        </aside>
      </div>
    </PlatformPage>
  )
}
