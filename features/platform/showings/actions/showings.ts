'use server'

import { revalidatePath } from 'next/cache'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { classifyShowingFeedbackResponse, classifyShowingStatusResponse, type ShowingActionState } from '../lib/showingActionFeedback'
import { readShowingDetail } from '../lib/showingDetail'
import { isShowingBoardProjection, type ShowingBoardItem, type ShowingBoardStats } from '../lib/showingProjection'


export type PlatformShowing = ShowingBoardItem
export type ShowingStats = ShowingBoardStats

export type ShowingPageInfo = {
  hasNextPage: boolean
  hasPreviousPage: boolean
  nextCursor: string | null
  previousCursor: string | null
}

export type GetShowingsResult = {
  showings: PlatformShowing[]
  stats: ShowingStats | null
  pageInfo: ShowingPageInfo | null
  error: string | null
}

export async function getPlatformShowings(status?: string, range?: string, q?: string, after?: string, before?: string): Promise<GetShowingsResult> {
  const query = `
    query PlatformShowings($status: String, $range: String, $q: String, $after: String, $before: String) {
      platformShowings(status: $status, range: $range, q: $q, after: $after, before: $before) {
        items {
          id status showingType scheduledStart scheduledEnd notes feedback createdAt
          property { id title slug addressLine1 city state price listingType }
          lead { id name email phone status intent }
          assignedAgent { id name email phone }
        }
        stats { total requested scheduled completed noShow cancelled }
        pageInfo { hasNextPage hasPreviousPage nextCursor previousCursor }
      }
    }
  `
  let response
  try {
    response = await keystoneClient<unknown>(query, { status, range, q, after, before }, { cache: 'no-store' })
  } catch {
    return { showings: [], stats: null, pageInfo: null, error: 'Showings could not be loaded. Please try again.' }
  }
  if (!response.success) return { showings: [], stats: null, pageInfo: null, error: response.error || 'Showings could not be loaded.' }

  const data = response.data && typeof response.data === 'object' ? response.data as Record<string, unknown> : null
  const workspace = data?.platformShowings
  if (!isShowingBoardProjection(workspace)) {
    return { showings: [], stats: null, pageInfo: null, error: 'Showings could not be loaded. Please refresh and try again.' }
  }
  return { showings: workspace.items, stats: workspace.stats, pageInfo: workspace.pageInfo, error: null }
}

export async function getShowingDetail(id: string, before?: string) {
  return readShowingDetail(id, before, (query, variables) => keystoneClient<unknown>(query, variables, { cache: 'no-store' }))
}

export async function updateShowingStatus(_prevState: ShowingActionState, formData: FormData): Promise<ShowingActionState> {
  if (_prevState.uncertain) return _prevState
  const id = String(formData.get('showingId') || '')
  const status = String(formData.get('status') || '')
  const expectedStatus = String(formData.get('expectedStatus') || '')
  const expectedUpdatedAt = String(formData.get('expectedUpdatedAt') || '')
  const expectedRevision = String(formData.get('expectedRevision') || '')
  if (!id || !status || !expectedStatus || !expectedUpdatedAt || !/^[a-f0-9]{64}$/.test(expectedRevision)) return { ok: false, message: 'Refresh the page and try again.' }

  const mutation = `
    mutation UpdateShowingStatus($data: ShowingReviewInput!) {
      transitionShowingStatus: reviewShowingCommand(data: $data) {
        ok message itemId status replayed
      }
    }
  `

  let response: unknown
  try {
    response = await keystoneClient<any>(mutation, { data: { id, status, expectedStatus, expectedUpdatedAt, expectedRevision, idempotencyKey: crypto.randomUUID() } }, { cache: 'no-store' })
  } catch {
    return classifyShowingStatusResponse(null, id, status)
  }
  const result = classifyShowingStatusResponse(response, id, status)
  if (!result.ok) return result

  revalidatePath(`/dashboard/platform/showings/${id}`)
  revalidatePath('/dashboard/platform/showings')
  revalidatePath('/dashboard/platform/leads')
  return result
}

export async function addShowingFeedback(_prevState: ShowingActionState, formData: FormData): Promise<ShowingActionState> {
  if (_prevState.uncertain) return _prevState
  const id = String(formData.get('showingId') || '')
  const feedback = String(formData.get('feedback') || '').trim()
  const expectedStatus = String(formData.get('expectedStatus') || '')
  const expectedUpdatedAt = String(formData.get('expectedUpdatedAt') || '')
  const expectedRevision = String(formData.get('expectedRevision') || '')
  if (!id || !feedback || !expectedStatus || !expectedUpdatedAt || !/^[a-f0-9]{64}$/.test(expectedRevision)) return { ok: false, message: 'Add feedback before saving.' }

  const mutation = `
    mutation AddShowingFeedback($data: CompleteShowingWithFeedbackInput!) {
      completeShowingWithFeedback(data: $data) { ok message itemId replayed }
    }
  `

  let response: unknown
  try {
    response = await keystoneClient<any>(mutation, { data: { showingId: id, feedback, expectedStatus, expectedUpdatedAt, expectedRevision, idempotencyKey: crypto.randomUUID() } }, { cache: 'no-store' })
  } catch {
    return classifyShowingFeedbackResponse(null, id)
  }
  const result = classifyShowingFeedbackResponse(response, id)
  if (!result.ok) return result

  revalidatePath(`/dashboard/platform/showings/${id}`)
  revalidatePath('/dashboard/platform/showings')
  revalidatePath('/dashboard/platform/leads')
  return result
}
