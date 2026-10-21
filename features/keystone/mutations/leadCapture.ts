import type { Context } from '.keystone/types'

export type PublicLeadCaptureInput = {
  name: string
  email?: string | null
  phone?: string | null
  intent: 'buy' | 'rent' | 'sell' | 'invest' | 'unknown'
  source: 'website'
  status: 'new' | 'tour_scheduled'
  message: string
  propertyId: string
  assignedAgentId?: string | null
}

export function normalizeLeadEmail(value?: string | null) {
  return String(value || '').trim().toLowerCase()
}

export function normalizeLeadPhone(value?: string | null) {
  const digits = String(value || '').replace(/\D/g, '')
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  return national.length >= 7 ? national : ''
}

export function leadIdentityKey(email?: string | null, phone?: string | null) {
  const normalizedEmail = normalizeLeadEmail(email)
  if (normalizedEmail) return `email:${normalizedEmail}`
  const normalizedPhone = normalizeLeadPhone(phone)
  return normalizedPhone ? `phone:${normalizedPhone}` : null
}

export async function capturePublicLead(context: Context, input: PublicLeadCaptureInput) {
  const identityKey = leadIdentityKey(input.email, input.phone)
  if (!identityKey) throw new Error('A valid lead email or phone number is required.')

  const sudo = context.sudo()
  await sudo.prisma.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `public-lead:${input.propertyId}:${identityKey}`)

  const existing = await sudo.query.Lead.findMany({
    where: {
      identityKey: { equals: identityKey },
      property: { id: { equals: input.propertyId } },
      status: { notIn: ['closed', 'lost'] },
    },
    orderBy: [{ createdAt: 'asc' }],
    take: 1,
    query: 'id status assignedAgent { id }',
  })

  if (existing[0]) return { lead: existing[0], reused: true, identityKey }

  const lead = await sudo.query.Lead.createOne({
    data: {
      identityKey,
      name: input.name,
      email: normalizeLeadEmail(input.email),
      phone: String(input.phone || '').trim(),
      intent: input.intent,
      source: input.source,
      status: input.status,
      message: input.message,
      property: { connect: { id: input.propertyId } },
      ...(input.assignedAgentId ? { assignedAgent: { connect: { id: input.assignedAgentId } } } : {}),
    },
    query: 'id status assignedAgent { id }',
  })

  return { lead, reused: false, identityKey }
}
