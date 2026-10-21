'use server'

import { revalidatePath } from 'next/cache'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type PlatformDeal = {
  id: string
  title: string
  stage: string
  transactionType?: string | null
  offerAmount?: string | null
  commissionAmount?: string | null
  expectedCloseDate?: string | null
  closedAt?: string | null
  nextStep?: string | null
  notes?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  property?: {
    id: string
    title: string
    city: string
    state: string
    price: string
    listingType: string
  } | null
  lead?: {
    id: string
    name: string
    email?: string | null
    phone?: string | null
    status: string
  } | null
  assignedAgent?: {
    id: string
    name: string
    email: string
  } | null
}

export type PipelineStats = {
  total: number
  open: number
  underContract: number
  closedWon: number
  closedLost: number
  projectedCommission: string
}

export type DealActionState = {
  ok: boolean
  message: string
}

export async function getPipelineDeals(): Promise<{ deals: PlatformDeal[]; stats: PipelineStats; error: string | null }> {
  const query = `
    query PlatformPipeline {
      platformPipeline {
        items {
          id title stage transactionType offerAmount commissionAmount expectedCloseDate closedAt nextStep notes createdAt updatedAt
          property { id title city state price listingType }
          lead { id name email phone status }
          assignedAgent { id name email }
        }
        stats { total open underContract closedWon closedLost projectedCommission }
      }
    }
  `
  const response = await keystoneClient<any>(query, {}, { cache: 'no-store' })
  if (!response.success) return { deals: [], stats: { total: 0, open: 0, underContract: 0, closedWon: 0, closedLost: 0, projectedCommission: '0.00' }, error: response.error }
  const workspace = response.data.platformPipeline
  return { deals: workspace.items, stats: { ...workspace.stats, projectedCommission: workspace.stats.projectedCommission || '0.00' }, error: null }
}

export async function updateDealStage(_prevState: DealActionState, formData: FormData): Promise<DealActionState> {
  const dealId = String(formData.get('dealId') || '')
  const stage = String(formData.get('stage') || '')
  if (!dealId || !stage) return { ok: false, message: 'Missing deal or stage.' }

  const mutation = `
    mutation TransitionDealStage($dealId: ID!, $stage: String!, $idempotencyKey: String!) {
      transitionDealStage(data: { id: $dealId, status: $stage, idempotencyKey: $idempotencyKey }) { ok message itemId status replayed }
    }
  `

  const response = await keystoneClient<{ transitionDealStage: DealActionState }>(
    mutation,
    { dealId, stage, idempotencyKey: crypto.randomUUID() },
    { cache: 'no-store' }
  )
  if (!response.success || !response.data.transitionDealStage.ok) {
    return { ok: false, message: response.success ? response.data.transitionDealStage.message : 'Could not update deal stage.' }
  }

  revalidatePath('/dashboard/platform/pipeline')
  revalidatePath('/dashboard/platform/reports')
  return { ok: true, message: 'Deal stage updated.' }
}

export async function updateDealFinancialTerms(_prevState: DealActionState, formData: FormData): Promise<DealActionState> {
  const dealId = String(formData.get('dealId') || '')
  const offerAmount = String(formData.get('offerAmount') || '').replace(/[^\d.]/g, '')
  const commissionAmount = String(formData.get('commissionAmount') || '').replace(/[^\d.]/g, '')
  if (!dealId || !offerAmount) return { ok: false, message: 'Add a valid offer amount.' }
  const response = await keystoneClient<{ updateDealFinancialTermsCommand: DealActionState }>(`
    mutation UpdateDealFinancialTerms($data: UpdateDealFinancialTermsInput!) {
      updateDealFinancialTermsCommand(data: $data) { ok message itemId replayed }
    }
  `, { data: { dealId, offerAmount, commissionAmount, idempotencyKey: crypto.randomUUID() } }, { cache: 'no-store' })
  if (!response.success || !response.data.updateDealFinancialTermsCommand.ok) {
    return { ok: false, message: response.success ? response.data.updateDealFinancialTermsCommand.message : 'Could not record financial terms.' }
  }
  revalidatePath('/dashboard/platform/pipeline')
  revalidatePath('/dashboard/platform/reports')
  return { ok: true, message: 'Financial terms recorded.' }
}

export async function updateDealNextStep(_prevState: DealActionState, formData: FormData): Promise<DealActionState> {
  const dealId = String(formData.get('dealId') || '')
  const nextStep = String(formData.get('nextStep') || '').trim()
  const notes = String(formData.get('notes') || '').trim()

  if (!dealId || !nextStep) return { ok: false, message: 'Add a next step before saving.' }

  const mutation = `
    mutation UpdateDealNextStep($data: UpdateDealNextStepInput!) {
      updateDealNextStepCommand(data: $data) { ok message itemId replayed }
    }
  `

  const response = await keystoneClient<{ updateDealNextStepCommand: DealActionState }>(mutation, {
    data: { dealId, nextStep, notes, idempotencyKey: crypto.randomUUID() },
  }, { cache: 'no-store' })
  if (!response.success || !response.data.updateDealNextStepCommand.ok) {
    return { ok: false, message: response.success ? response.data.updateDealNextStepCommand.message : 'Could not save next step.' }
  }

  revalidatePath('/dashboard/platform/pipeline')
  return { ok: true, message: 'Next step saved.' }
}
