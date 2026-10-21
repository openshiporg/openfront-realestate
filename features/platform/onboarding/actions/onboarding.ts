'use server'

import { revalidatePath } from 'next/cache'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'dismissed'

type SeedSummary = { created: number; skipped: number; total: number }

type OnboardingActionResult = {
  success: boolean
  error?: string
  core?: SeedSummary | null
  expansion?: SeedSummary | null
}

type OnboardingMutationResult = {
  completed: boolean
  status: string
  core?: SeedSummary | null
  expansion?: SeedSummary | null
}

function revalidateDashboard() {
  revalidatePath('/dashboard', 'layout')
}

/** Record the signed-in user's own setup progress. */
export async function updateOnboardingStatus(status: OnboardingStatus): Promise<OnboardingActionResult> {
  const me = await keystoneClient<{ authenticatedItem: { id: string } | null }>(`
    query OnboardingUser { authenticatedItem { ... on User { id } } }
  `, {}, { cache: 'no-store' })
  const userId = me.success ? me.data.authenticatedItem?.id : null
  if (!userId) return { success: false, error: 'Sign in again to continue setup.' }

  const response = await keystoneClient<{ updateUser: { id: string; onboardingStatus: string } | null }>(`
    mutation UpdateOnboardingStatus($id: ID!, $status: UserOnboardingStatusType!) {
      updateUser(where: { id: $id }, data: { onboardingStatus: $status }) { id onboardingStatus }
    }
  `, { id: userId, status }, { cache: 'no-store' })

  if (!response.success || response.data.updateUser?.onboardingStatus !== status) {
    return { success: false, error: 'Setup progress could not be saved.' }
  }
  revalidateDashboard()
  return { success: true }
}

export async function startOnboarding() {
  return updateOnboardingStatus('in_progress')
}

export async function completeOnboarding() {
  return updateOnboardingStatus('completed')
}

/** Create the starter brokerage records. The server marks setup completed on success. */
export async function applyOnboarding(template: 'full' | 'minimal' = 'full'): Promise<OnboardingActionResult> {
  const response = await keystoneClient<{ runRealEstateOnboarding: OnboardingMutationResult }>(`
    mutation RunRealEstateOnboarding($template: String!) {
      runRealEstateOnboarding(template: $template) {
        completed
        status
        core { created skipped total }
        expansion { created skipped total }
      }
    }
  `, { template }, { cache: 'no-store' })

  if (!response.success) {
    return { success: false, error: response.error || 'Brokerage setup failed.' }
  }

  if (!response.data.runRealEstateOnboarding?.completed || response.data.runRealEstateOnboarding.status !== 'completed') {
    return { success: false, error: 'Brokerage setup did not finish. Try again.' }
  }
  revalidatePath('/', 'layout')
  revalidateDashboard()
  revalidatePath('/dashboard/platform/operations')
  return { success: true, ...response.data.runRealEstateOnboarding }
}

export async function dismissOnboarding(): Promise<OnboardingActionResult> {
  const response = await keystoneClient<{ dismissRealEstateOnboarding: OnboardingMutationResult }>(`
    mutation DismissRealEstateOnboarding {
      dismissRealEstateOnboarding { completed status }
    }
  `, {}, { cache: 'no-store' })

  if (!response.success) {
    return { success: false, error: response.error || 'Could not dismiss brokerage setup.' }
  }

  revalidateDashboard()
  return { success: true }
}
