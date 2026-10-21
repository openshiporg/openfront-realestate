'use server'

import { sumMoney, moneyToMinor } from '@/features/lib/money'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type BrokerageReport = {
  leadsTotal: number
  newLeads: number
  qualifiedLeads: number
  toursScheduled: number
  showingsCompleted: number
  activeListings: number
  pendingListings: number
  closedDeals: number
  projectedCommission: string
  sourceCounts: Record<string, number>
  agentRows: Array<{ agent: string; leads: number; showings: number; deals: number; projectedCommission: string }>
  error: string | null
}

export async function getBrokerageReport(): Promise<BrokerageReport> {
  const query = `
    query BrokerageReport {
      platformReports {
        leads { id source status assignedAgent { id name } }
        showings { id status assignedAgent { id name } }
        deals { id stage commissionAmount assignedAgent { id name } }
        activeListings
        pendingListings
      }
    }
  `

  const response = await keystoneClient<any>(query, {}, { cache: 'no-store' })
  if (!response.success) {
    return {
      leadsTotal: 0,
      newLeads: 0,
      qualifiedLeads: 0,
      toursScheduled: 0,
      showingsCompleted: 0,
      activeListings: 0,
      pendingListings: 0,
      closedDeals: 0,
      projectedCommission: '0.00',
      sourceCounts: {},
      agentRows: [],
      error: response.error,
    }
  }

  const workspace = response.data.platformReports
  const leads = workspace.leads || []
  const showings = workspace.showings || []
  const deals = workspace.deals || []
  const sourceCounts: Record<string, number> = {}
  const agentMap = new Map<string, { agent: string; leads: number; showings: number; deals: number; projectedCommission: string }>()

  const agentRow = (agent: any) => {
    const key = agent?.id || 'unassigned'
    if (!agentMap.has(key)) agentMap.set(key, { agent: agent?.name || 'Unassigned', leads: 0, showings: 0, deals: 0, projectedCommission: '0.00' })
    return agentMap.get(key)!
  }

  for (const lead of leads) {
    sourceCounts[lead.source || 'unknown'] = (sourceCounts[lead.source || 'unknown'] || 0) + 1
    agentRow(lead.assignedAgent).leads += 1
  }
  for (const showing of showings) agentRow(showing.assignedAgent).showings += 1
  for (const deal of deals) {
    const row = agentRow(deal.assignedAgent)
    row.deals += 1
    row.projectedCommission = sumMoney([row.projectedCommission, deal.commissionAmount || '0'])
  }

  return {
    leadsTotal: leads.length,
    newLeads: leads.filter((lead: any) => lead.status === 'new').length,
    qualifiedLeads: leads.filter((lead: any) => lead.status === 'qualified').length,
    toursScheduled: showings.filter((showing: any) => showing.status === 'scheduled').length,
    showingsCompleted: showings.filter((showing: any) => showing.status === 'completed').length,
    activeListings: workspace.activeListings,
    pendingListings: workspace.pendingListings,
    closedDeals: deals.filter((deal: any) => deal.stage === 'closed_won').length,
    projectedCommission: sumMoney(deals.filter((deal: any) => deal.stage !== 'closed_lost').map((deal: any) => deal.commissionAmount || '0')),
    sourceCounts,
    agentRows: [...agentMap.values()].sort((a, b) => moneyToMinor(a.projectedCommission) < moneyToMinor(b.projectedCommission) ? 1 : moneyToMinor(a.projectedCommission) > moneyToMinor(b.projectedCommission) ? -1 : 0),
    error: null,
  }
}
