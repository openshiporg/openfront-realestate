import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

type Ref = { id: string; name?: string; title?: string } | null

export type DealRecord = {
  id: string; title: string; stage: string; transactionType: string; offerAmount: string | null; commissionAmount: string | null
  expectedCloseDate: string | null; closedAt: string | null; nextStep: string; notes: string; createdAt: string
  property: { id: string; title: string; slug: string; city: string; state: string; price: string; listingType: string } | null
  lead: { id: string; name: string; email: string; phone: string; status: string } | null
  assignedAgent: { id: string; name: string } | null
  assignedTeam: { id: string; name: string } | null
}

export type DealWorkspace = {
  deal: DealRecord
  offers: Array<{ id: string; offerNumber: string; version: number; status: string; amount: string; earnestMoney: string | null; financingType: string; contingencies: string; responseDueAt: string | null; submittedAt: string | null; parentOffer: { offerNumber: string } | null }> | null
  milestones: Array<{ id: string; name: string; status: string; dueAt: string | null; completedAt: string | null; notes: string; assignedTo: Ref }> | null
  documents: Array<{ id: string; title: string; documentType: string; status: string; fileUrl: string; requiresSignature: boolean; sentAt: string | null; signedAt: string | null }> | null
  disclosures: Array<{ id: string; title: string; disclosureType: string; status: string; documentUrl: string }> | null
  inspections: Array<{ id: string; title: string; inspectionType: string; status: string; scheduledAt: string | null; inspectorName: string; estimatedCost: string | null; summary: string }> | null
  escrows: Array<{ id: string; escrowNumber: string; status: string; escrowCompany: string; officerName: string; scheduledCloseAt: string | null; depositAmount: string | null }> | null
  titleOrders: Array<{ id: string; orderNumber: string; status: string; titleCompany: string; exceptions: string }> | null
  mortgages: Array<{ id: string; applicationNumber: string; status: string; lenderName: string; loanAmount: string | null; interestRate: string | null }> | null
  commissions: Array<{ id: string; title: string; status: string; side: string; grossCommission: string | null; netCommission: string | null; agent: Ref }> | null
}

const DEAL_FIELDS = `id title stage transactionType offerAmount commissionAmount expectedCloseDate closedAt nextStep notes createdAt
  property { id title slug city state price listingType } lead { id name email phone status } assignedAgent { id name } assignedTeam { id name }`

/** null for a section means the viewer's role can't read it; [] means there is nothing yet. */
async function section<T>(query: string, id: string, field: string): Promise<T[] | null> {
  const response = await keystoneClient<Record<string, T[]>>(query, { id }, { cache: 'no-store' })
  return response.success ? response.data[field] : null
}

export async function getDealWorkspace(id: string): Promise<{ workspace: DealWorkspace | null; error: string | null }> {
  const response = await keystoneClient<{ deal: DealRecord | null }>(`query PlatformDeal($id: ID!) { deal(where: { id: $id }) { ${DEAL_FIELDS} } }`, { id }, { cache: 'no-store' })
  if (!response.success) return { workspace: null, error: response.error }
  if (!response.data.deal) return { workspace: null, error: null }
  const where = '(where: { deal: { id: { equals: $id } } }'
  const [offers, milestones, documents, disclosures, inspections, escrows, titleOrders, mortgages, commissions] = await Promise.all([
    section<any>(`query($id: ID!) { offers${where}, orderBy: [{ createdAt: asc }], take: 50) { id offerNumber version status amount earnestMoney financingType contingencies responseDueAt submittedAt parentOffer { offerNumber } } }`, id, 'offers'),
    section<any>(`query($id: ID!) { transactionMilestones${where}, orderBy: [{ sortOrder: asc }], take: 100) { id name status dueAt completedAt notes assignedTo { id name } } }`, id, 'transactionMilestones'),
    section<any>(`query($id: ID!) { dealDocuments${where}, orderBy: [{ createdAt: asc }], take: 100) { id title documentType status fileUrl requiresSignature sentAt signedAt } }`, id, 'dealDocuments'),
    section<any>(`query($id: ID!) { disclosures${where}, take: 50) { id title disclosureType status documentUrl } }`, id, 'disclosures'),
    section<any>(`query($id: ID!) { propertyInspections${where}, orderBy: [{ scheduledAt: asc }], take: 50) { id title inspectionType status scheduledAt inspectorName estimatedCost summary } }`, id, 'propertyInspections'),
    section<any>(`query($id: ID!) { escrows${where}, take: 10) { id escrowNumber status escrowCompany officerName scheduledCloseAt depositAmount } }`, id, 'escrows'),
    section<any>(`query($id: ID!) { titleOrders${where}, take: 10) { id orderNumber status titleCompany exceptions } }`, id, 'titleOrders'),
    section<any>(`query($id: ID!) { mortgageApplications${where}, take: 10) { id applicationNumber status lenderName loanAmount interestRate } }`, id, 'mortgageApplications'),
    section<any>(`query($id: ID!) { commissions${where}, take: 20) { id title status side grossCommission netCommission agent { id name } } }`, id, 'commissions'),
  ])
  return { workspace: { deal: response.data.deal, offers, milestones, documents, disclosures, inspections, escrows, titleOrders, mortgages, commissions }, error: null }
}

export type DealOptions = { properties: Array<{ id: string; title: string }>; leads: Array<{ id: string; name: string }>; agents: Array<{ id: string; name: string }> }

export async function getDealOptions(): Promise<DealOptions> {
  const response = await keystoneClient<any>(`query DealOptions {
    properties(orderBy: [{ updatedAt: desc }], take: 200) { id title }
    leads(where: { status: { notIn: [closed, lost] } }, orderBy: [{ createdAt: desc }], take: 200) { id name }
    brokerageMemberships(where: { status: { equals: active } }, take: 200) { user { id name } }
  }`, {}, { cache: 'no-store' })
  if (!response.success) return { properties: [], leads: [], agents: [] }
  return {
    properties: response.data.properties,
    leads: response.data.leads,
    agents: (response.data.brokerageMemberships as Array<{ user: { id: string; name: string } | null }>).flatMap(m => m.user ? [m.user] : []),
  }
}
