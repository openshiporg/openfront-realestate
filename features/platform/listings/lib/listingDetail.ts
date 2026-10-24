import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type ListingDetail = {
  id: string; title: string; slug: string; status: string; listingType: string; propertyType: string
  shortDescription: string; description: string; addressLine1: string; addressLine2: string; city: string; state: string; postalCode: string; neighborhood: string
  price: string; bedrooms: number | null; bathrooms: string | null; squareFeet: number | null; lotSizeSquareFeet: number | null; yearBuilt: number | null
  hoaFee: string | null; availableAt: string | null; isFeatured: boolean; virtualTourUrl: string; leaseTerm: string; securityDeposit: number | null; petPolicy: string
  primaryImageUrl: string; updatedAt: string
  assignedAgent: { id: string; name: string } | null
}
export type ListingMedia = { id: string; title: string; mediaType: string; url: string; altText: string; caption: string; sortOrder: number; isHero: boolean }
export type ListingOpenHouse = { id: string; title: string; status: string; startsAt: string; endsAt: string; attendeeCount: number | null; notes: string; hostAgent: { id: string; name: string } | null }
export type ListingLead = { id: string; name: string; status: string; intent: string; createdAt: string; assignedAgent: { name: string } | null }
export type ListingShowing = { id: string; status: string; showingType: string; scheduledStart: string; lead: { name: string } | null }
export type ListingSyndicationRow = { id: string; channel: string; status: string; listingUrl: string; errorMessage: string }
export type AgentOption = { id: string; name: string }

const PROPERTY_FIELDS = `id title slug status listingType propertyType shortDescription description addressLine1 addressLine2 city state postalCode neighborhood
  price bedrooms bathrooms squareFeet lotSizeSquareFeet yearBuilt hoaFee availableAt isFeatured virtualTourUrl leaseTerm securityDeposit petPolicy primaryImageUrl updatedAt
  assignedAgent { id name }`

async function section<T>(query: string, variables: Record<string, unknown>, pick: (data: any) => T, fallback: T): Promise<T> {
  const response = await keystoneClient<any>(query, variables, { cache: 'no-store' })
  return response.success ? pick(response.data) : fallback
}

/** Each section is its own request so a role that can't read one part (e.g. leads) still sees the rest. */
export async function getListingDetail(id: string) {
  const response = await keystoneClient<{ property: ListingDetail | null }>(`query PlatformListing($id: ID!) { property(where: { id: $id }) { ${PROPERTY_FIELDS} } }`, { id }, { cache: 'no-store' })
  if (!response.success) return { listing: null, error: response.error }
  const listing = response.data.property
  if (!listing) return { listing: null, error: null }
  const where = { property: { id: { equals: id } } }
  const [media, openHouses, leads, showings, syndications] = await Promise.all([
    section('query ListingMedia($where: PropertyMediaWhereInput!) { propertyMedias(where: $where, orderBy: [{ sortOrder: asc }], take: 50) { id title mediaType url altText caption sortOrder isHero } }', { where }, d => d.propertyMedias as ListingMedia[], [] as ListingMedia[]),
    section('query ListingOpenHouses($where: OpenHouseWhereInput!) { openHouses(where: $where, orderBy: [{ startsAt: desc }], take: 30) { id title status startsAt endsAt attendeeCount notes hostAgent { id name } } }', { where }, d => d.openHouses as ListingOpenHouse[], [] as ListingOpenHouse[]),
    section('query ListingLeads($where: LeadWhereInput!) { leads(where: $where, orderBy: [{ createdAt: desc }], take: 20) { id name status intent createdAt assignedAgent { name } } }', { where }, d => d.leads as ListingLead[], null as ListingLead[] | null),
    section('query ListingShowings($where: ShowingWhereInput!) { showings(where: $where, orderBy: [{ scheduledStart: desc }], take: 20) { id status showingType scheduledStart lead { name } } }', { where }, d => d.showings as ListingShowing[], null as ListingShowing[] | null),
    section('query ListingSyndications($where: ListingSyndicationWhereInput!) { listingSyndications(where: $where, take: 20) { id channel status listingUrl errorMessage } }', { where }, d => d.listingSyndications as ListingSyndicationRow[], [] as ListingSyndicationRow[]),
  ])
  return { listing, media, openHouses, leads, showings, syndications, error: null }
}

export async function getAgentOptions(): Promise<AgentOption[]> {
  return section('query AgentOptions { brokerageMemberships(where: { status: { equals: active } }, take: 200) { user { id name } } }', {},
    d => (d.brokerageMemberships as Array<{ user: AgentOption | null }>).flatMap(m => m.user ? [m.user] : []).sort((a, b) => a.name.localeCompare(b.name)), [] as AgentOption[])
}
