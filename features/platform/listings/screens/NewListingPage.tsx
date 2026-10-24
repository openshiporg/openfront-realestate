import { ErrorBanner, PlatformPage } from '../../components/PlatformUI'
import { getActiveBrokerageId, getViewerPermissions } from '../../lib/records'
import { ListingForm } from '../components/ListingForm'
import { getAgentOptions } from '../lib/listingDetail'

export async function NewListingPage() {
  const [viewer, agents, brokerageId] = await Promise.all([getViewerPermissions(), getAgentOptions(), getActiveBrokerageId()])
  return (
    <PlatformPage crumbs={[{ label: 'Listings', href: '/platform/listings' }, { label: 'New listing' }]} title="New listing">
      {!brokerageId || !viewer.canManagePeople
        ? <ErrorBanner>Adding listings needs listing and people management access in an active brokerage.</ErrorBanner>
        : <div className="max-w-3xl rounded-xl border border-border bg-card p-4 shadow-xs md:p-6"><ListingForm agents={agents} canAssign /></div>}
    </PlatformPage>
  )
}
