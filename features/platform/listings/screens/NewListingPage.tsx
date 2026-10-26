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
        : <div className="max-w-3xl pb-20"><ListingForm agents={agents} canAssign /></div>}
    </PlatformPage>
  )
}
