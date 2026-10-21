'use server'

import { revalidatePath } from 'next/cache'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type PlatformAgent = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  licenseNumber?: string | null
  brokerageTitle?: string | null
  avatarUrl?: string | null
  onboardingStatus?: string | null
  role?: { id: string; name: string } | null
  memberships: Array<{ id: string; membershipRole: string; isPrimary: boolean; brokerage?: { id: string; name: string; slug: string } | null }>
  listingCount: number
  leadCount: number
  showingCount: number
  dealCount: number
}

export type PlatformAgentTeam = {
  id: string
  name: string
  slug: string
  teamType: string
  status: string
  description?: string | null
  leadAgent?: { id: string; name: string; email?: string | null } | null
  members: Array<{ id: string; name: string; email?: string | null }>
  leadCount: number
  dealCount: number
}

const QUERY = `
  query PlatformPeople {
    platformPeople {
      agents { id name email phone licenseNumber brokerageTitle avatarUrl onboardingStatus role { id name } memberships { id membershipRole isPrimary brokerage { id name slug } } listingCount leadCount showingCount dealCount }
      teams { id name slug teamType status description leadAgent { id name email } members { id name email } leadCount dealCount }
    }
  }
`

export type PeopleCommandState = { ok: boolean; message: string }

export async function inviteBrokerageMember(_previous: PeopleCommandState, formData: FormData): Promise<PeopleCommandState> {
  const brokerageId = String(formData.get('brokerageId') || '')
  const name = String(formData.get('name') || '').trim()
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const temporaryPassword = String(formData.get('temporaryPassword') || '')
  const roleName = String(formData.get('roleName') || '')
  const membershipRole = String(formData.get('membershipRole') || '')
  if (!brokerageId || !name || !email || temporaryPassword.length < 12) return { ok: false, message: 'Complete all member fields and use a 12+ character temporary password.' }
  const response = await keystoneClient<{ inviteBrokerageMemberCommand: PeopleCommandState }>(`
    mutation InviteBrokerageMember($data: InviteBrokerageMemberInput!) {
      inviteBrokerageMemberCommand(data: $data) { ok message itemId replayed }
    }
  `, { data: { brokerageId, name, email, temporaryPassword, roleName, membershipRole, idempotencyKey: crypto.randomUUID() } }, { cache: 'no-store' })
  const result = response.success ? response.data.inviteBrokerageMemberCommand : { ok: false, message: 'Could not create brokerage member.' }
  if (result.ok) revalidatePath('/dashboard/platform/people')
  return result
}

export async function suspendBrokerageMember(_previous: PeopleCommandState, formData: FormData): Promise<PeopleCommandState> {
  const membershipId = String(formData.get('membershipId') || '')
  if (!membershipId) return { ok: false, message: 'Membership is required.' }
  const response = await keystoneClient<{ suspendBrokerageMemberCommand: PeopleCommandState }>(`
    mutation SuspendBrokerageMember($data: SuspendBrokerageMemberInput!) {
      suspendBrokerageMemberCommand(data: $data) { ok message itemId replayed }
    }
  `, { data: { membershipId, idempotencyKey: crypto.randomUUID() } }, { cache: 'no-store' })
  const result = response.success ? response.data.suspendBrokerageMemberCommand : { ok: false, message: 'Could not suspend brokerage member.' }
  if (result.ok) revalidatePath('/dashboard/platform/people')
  return result
}

export async function getPlatformPeople(): Promise<{ agents: PlatformAgent[]; teams: PlatformAgentTeam[]; error: string | null }> {
  const response = await keystoneClient<any>(QUERY, {}, { cache: 'no-store' })
  return response.success
    ? { agents: response.data.platformPeople.agents, teams: response.data.platformPeople.teams, error: null }
    : { agents: [], teams: [], error: response.error }
}
