import type { Context } from '.keystone/types'
import { lockPropertyForDecision } from '../lib/propertyLock'

import { activeBrokerageIds, type Session } from '../access'
import { requireRepresentationAuthority } from '../lib/authorityEvidence'
import { showingReviewRevision } from '../lib/showingReviewRevision'
import { sameShowingIdentity, scopedSchedulingIdentity, scopedShowingIdentity } from '../lib/showingAssociations'
import { ownedShowingEventHeader } from '../lib/showingEventScope'
import { leadStatusAfterShowing, reconcileLeadStatusAfterShowing, requireAvailableShowingSlot, showingInterval } from '../lib/showingPolicy'
import { runControlledEvidenceCommand } from './controlledEvidenceCommand'
import { ownsShowingScheduleReceipt, showingSnapshot } from './showingJourney'

import { commandText as clean } from '../../lib/date-time'
function actorId(context: Context) { return (context.session as any)?.itemId as string | undefined }
function role(context: Context) { return (context.session as any)?.data?.role || {} }

function authorized(context: Context, brokerageId: string, permission: string, ownerId?: string | null) {
  const actor = actorId(context)
  if (!actor || !role(context)[permission] || !activeBrokerageIds(context.session as any).includes(brokerageId)) return false
  return Boolean(role(context).canManagePeople || !ownerId || ownerId === actor)
}

function validMoney(value: string) {
  return /^\d{1,10}(?:\.\d{1,2})?$/.test(value)
}

async function command(
  context: Context,
  options: {
    eventKey: string
    request: Record<string, unknown>
    lockKey: string
    permission: string
    authorizeTarget?: (scoped: Context) => Promise<boolean>
    authorizeReplayHeader?: (scoped: Context, header: unknown) => Promise<boolean>
    authorizeReplay?: (scoped: Context, existing: any) => Promise<boolean>
    execute: (context: Context) => Promise<{ result: any; event: any }>
  }
): Promise<any> {
  return runControlledEvidenceCommand(context, options)
}

export async function inviteBrokerageMemberCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const brokerageId = clean(data.brokerageId), name = clean(data.name), email = clean(data.email).toLowerCase(), password = String(data.temporaryPassword || ''), roleName = clean(data.roleName), membershipRole = clean(data.membershipRole), key = clean(data.idempotencyKey)
  const allowedRoles = ['Brokerage Admin', 'Listing Agent', 'Brokerage Analyst']
  const allowedMemberships = ['admin', 'team_lead', 'agent', 'coordinator', 'analyst']
  if (!brokerageId || !name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320 || password.length < 12 || password.length > 200 || !allowedRoles.includes(roleName) || !allowedMemberships.includes(membershipRole) || !key) {
    return { ok: false, message: 'Valid member details, a 12+ character temporary password, and idempotency key are required.', itemId: null, replayed: false }
  }
  const actorMembership = (context.session as any)?.data?.brokerageMemberships?.find((membership: any) => membership.brokerage?.id === brokerageId && membership.status === 'active' && membership.brokerage?.status === 'active')
  if (!actorMembership || !['owner', 'admin'].includes(actorMembership.membershipRole) || !role(context).canManageRoles) return { ok: false, message: 'Brokerage owner or administrator role authority is required.', itemId: null, replayed: false }
  if ((roleName === 'Brokerage Admin' || membershipRole === 'admin') && actorMembership.membershipRole !== 'owner') return { ok: false, message: 'Only a brokerage owner can add another administrator.', itemId: null, replayed: false }
  const request = { brokerageId, name, email, password, roleName, membershipRole }
  return command(context, {
    eventKey: `command:brokerage:${brokerageId}:invite-member:${key}`, lockKey: `membership:${brokerageId}:${email}`, permission: 'canManagePeople', request,
    execute: async scoped => {
      const sudo = scoped.sudo() as any
      const [brokerage, existingUsers, roles] = await Promise.all([
        sudo.query.Brokerage.findOne({ where: { id: brokerageId }, query: 'id slug status' }),
        sudo.query.User.findMany({ where: { email: { equals: email } }, take: 1, query: 'id' }),
        sudo.query.Role.findMany({ where: { name: { equals: roleName } }, take: 2, query: 'id name' }),
      ])
      if (!brokerage || brokerage.status !== 'active' || !activeBrokerageIds(scoped.session as any).includes(brokerage.id)) return { result: { ok: false, message: 'Brokerage not found or access denied.', itemId: null }, event: null as never }
      if (existingUsers.length) return { result: { ok: false, message: 'That email already belongs to an account. Ask the account owner to contact your brokerage administrator.', itemId: null }, event: null as never }
      if (roles.length !== 1) return { result: { ok: false, message: 'The selected immutable role template is unavailable.', itemId: null }, event: null as never }
      const user = await sudo.query.User.createOne({ data: { name, email, password, role: { connect: { id: roles[0].id } }, activeBrokerage: { connect: { id: brokerage.id } }, onboardingStatus: 'not_started' }, query: 'id name email' })
      const membership = await sudo.query.BrokerageMembership.createOne({ data: { membershipKey: `${brokerage.slug}:${email}`, brokerage: { connect: { id: brokerage.id } }, user: { connect: { id: user.id } }, membershipRole, status: 'active', isPrimary: true, joinedAt: new Date().toISOString() }, query: 'id' })
      const result = { ok: true, message: 'Brokerage member created. Share the temporary password through an approved private channel.', itemId: user.id }
      return { result, event: { eventType: 'brokerage.member_created', brokerageId: brokerage.id, aggregateType: 'brokerageMembership', aggregateId: membership.id, actorId: actorId(scoped), action: 'create_member', before: null, after: { ...result, email, roleName, membershipRole } } }
    },
  })
}

export async function suspendBrokerageMemberCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const membershipId = clean(data.membershipId), key = clean(data.idempotencyKey)
  if (!membershipId || !key) return { ok: false, message: 'Membership and idempotency key are required.', itemId: null, replayed: false }
  return command(context, {
    eventKey: `command:membership:${membershipId}:suspend:${key}`, lockKey: `membership:${membershipId}`, permission: 'canManagePeople', request: { membershipId },
    execute: async scoped => {
      const sudo = scoped.sudo() as any
      const membership = await sudo.query.BrokerageMembership.findOne({ where: { id: membershipId }, query: 'id status membershipRole brokerage { id } user { id email }' })
      const actorMembership = (scoped.session as any)?.data?.brokerageMemberships?.find((item: any) => item.brokerage?.id === membership?.brokerage?.id && item.status === 'active' && item.brokerage?.status === 'active')
      if (!membership || !actorMembership || !['owner', 'admin'].includes(actorMembership.membershipRole) || !activeBrokerageIds(scoped.session as any).includes(membership.brokerage?.id) || membership.user?.id === actorId(scoped)) return { result: { ok: false, message: 'Membership not found or access denied.', itemId: null }, event: null as never }
      if (membership.membershipRole === 'owner') {
        if (actorMembership.membershipRole !== 'owner') return { result: { ok: false, message: 'Only an owner can suspend another owner.', itemId: null }, event: null as never }
        const owners = await sudo.query.BrokerageMembership.findMany({ where: { brokerage: { id: { equals: membership.brokerage.id } }, membershipRole: { equals: 'owner' }, status: { equals: 'active' }, id: { not: { equals: membership.id } } }, take: 1, query: 'id' })
        if (!owners.length) return { result: { ok: false, message: 'The last active brokerage owner cannot be suspended.', itemId: null }, event: null as never }
      }
      if (membership.status === 'suspended') return { result: { ok: true, message: 'Membership is already suspended.', itemId: membership.id }, event: { eventType: 'brokerage.member_suspension_replayed', brokerageId: membership.brokerage.id, aggregateType: 'brokerageMembership', aggregateId: membership.id, actorId: actorId(scoped), action: 'suspend_member', before: { status: 'suspended' }, after: { status: 'suspended' } } }
      await sudo.query.BrokerageMembership.updateOne({ where: { id: membership.id }, data: { status: 'suspended', isPrimary: false }, query: 'id' })
      const result = { ok: true, message: 'Membership suspended; its next request will fail active-membership authorization.', itemId: membership.id }
      return { result, event: { eventType: 'brokerage.member_suspended', brokerageId: membership.brokerage.id, aggregateType: 'brokerageMembership', aggregateId: membership.id, actorId: actorId(scoped), action: 'suspend_member', before: { status: membership.status }, after: { ...result, status: 'suspended' } } }
    },
  })
}

export async function updateDealFinancialTermsCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const dealId = clean(data.dealId), offerAmount = clean(data.offerAmount), commissionAmount = clean(data.commissionAmount), key = clean(data.idempotencyKey)
  if (!dealId || !key || !validMoney(offerAmount) || (commissionAmount && !validMoney(commissionAmount))) {
    return { ok: false, message: 'Deal, valid financial terms, and idempotency key are required.', itemId: null, replayed: false }
  }
  if (!role(context).canManagePeople) return { ok: false, message: 'Brokerage manager access is required.', itemId: null, replayed: false }
  const request = { dealId, offerAmount, commissionAmount }
  return command(context, {
    eventKey: `command:deal:${dealId}:financial-terms:${key}`, lockKey: `aggregate:deal:${dealId}`, permission: 'canManageDeals', request,
    execute: async scoped => {
      const sudo = scoped.sudo() as any
      const deal = await sudo.query.Deal.findOne({ where: { id: dealId }, query: 'id stage offerAmount commissionAmount brokerage { id }' })
      if (!deal || !authorized(scoped, deal.brokerage?.id, 'canManageDeals') || !role(scoped).canManagePeople) return { result: { ok: false, message: 'Deal not found or access denied.', itemId: null }, event: null as never }
      const accepted = await sudo.query.Offer.findMany({ where: { deal: { id: { equals: dealId } }, status: { equals: 'accepted' } }, take: 1, query: 'id' })
      if (['closed_won', 'closed_lost'].includes(deal.stage) || accepted.length) return { result: { ok: false, message: 'Accepted or closed financial terms require an append-only correction, not editing.', itemId: null }, event: null as never }
      await sudo.query.Deal.updateOne({ where: { id: dealId }, data: { offerAmount, commissionAmount: commissionAmount || null }, query: 'id' })
      const result = { ok: true, message: 'Deal financial terms recorded.', itemId: dealId }
      return { result, event: { eventType: 'deal.financial_terms_updated', brokerageId: deal.brokerage.id, aggregateType: 'deal', aggregateId: dealId, actorId: actorId(scoped), action: 'update_financial_terms', before: { offerAmount: deal.offerAmount, commissionAmount: deal.commissionAmount }, after: { ...result, offerAmount, commissionAmount: commissionAmount || null } } }
    },
  })
}

export async function updateDealNextStepCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const dealId = clean(data.dealId), nextStep = clean(data.nextStep), notes = clean(data.notes), key = clean(data.idempotencyKey)
  if (!dealId || !nextStep || nextStep.length > 500 || notes.length > 10_000 || !key) return { ok: false, message: 'Deal, next step, and idempotency key are required.', itemId: null, replayed: false }
  const request = { dealId, nextStep, notes }
  return command(context, {
    eventKey: `command:deal:${dealId}:next-step:${key}`, lockKey: `aggregate:deal:${dealId}`, permission: 'canManageDeals', request,
    execute: async scoped => {
      const sudo = scoped.sudo() as any
      const deal = await sudo.query.Deal.findOne({ where: { id: dealId }, query: 'id nextStep notes brokerage { id } assignedAgent { id }' })
      if (!deal || !authorized(scoped, deal.brokerage?.id, 'canManageDeals', deal.assignedAgent?.id)) return { result: { ok: false, message: 'Deal not found or access denied.', itemId: null }, event: null as never }
      await sudo.query.Deal.updateOne({ where: { id: dealId }, data: { nextStep, notes }, query: 'id' })
      const result = { ok: true, message: 'Next step saved.', itemId: dealId }
      return { result, event: { eventType: 'deal.next_step_updated', brokerageId: deal.brokerage.id, aggregateType: 'deal', aggregateId: dealId, actorId: actorId(scoped), action: 'update_next_step', before: { nextStep: deal.nextStep, notes: deal.notes }, after: result } }
    },
  })
}

export async function completeShowingWithFeedback(_root: unknown, { data }: { data: any }, context: Context) {
  const showingId = clean(data.showingId), feedback = clean(data.feedback), key = clean(data.idempotencyKey)
  if (!showingId || !feedback || feedback.length > 10_000 || !key) return { ok: false, message: 'Showing, feedback, and idempotency key are required.', itemId: null, replayed: false }
  const request = { showingId, feedback,
    ...(data.expectedStatus != null ? { expectedStatus: clean(data.expectedStatus) } : {}),
    ...(data.expectedUpdatedAt != null ? { expectedUpdatedAt: clean(data.expectedUpdatedAt) } : {}),
    ...(data.expectedRevision != null ? { expectedRevision: clean(data.expectedRevision) } : {}),
  }
  return command(context, {
    eventKey: `command:showing:${showingId}:feedback:${key}`, lockKey: `aggregate:showing:${showingId}`, permission: 'canManageShowings', request,
    authorizeTarget: async scoped => Boolean(await scopedShowingIdentity(scoped, showingId)),
    authorizeReplayHeader: (scoped, header) => ownedShowingEventHeader(scoped, header, { eventKey: `command:showing:${showingId}:feedback:${key}`, eventType: 'showing.completed_with_feedback', purpose: 'showing' }),
    authorizeReplay: async (scoped, existing) => {
      if (existing.payload?.actorId !== actorId(scoped) || existing.payload?.aggregate?.type !== 'showing'
        || existing.payload.aggregate.id !== showingId || existing.payload?.request?.showingId !== showingId
        || existing.payload?.result?.itemId !== showingId || existing.payload?.result?.ok !== true) return false
      const header = await scopedShowingIdentity(scoped, showingId)
      if (!header || existing.payload.result.subject?.showingId !== showingId || existing.payload.result.subject?.leadId !== header.lead.id || existing.payload.result.subject?.propertyId !== header.property.id) return false
      const showing = await scoped.sudo().query.Showing.findOne({ where: { id: showingId }, query: 'id brokerage { id } assignedAgent { id }' })
      return Boolean(showing && authorized(scoped, showing.brokerage?.id, 'canManageShowings', showing.assignedAgent?.id))
    },
    execute: async scoped => {
      const sudo = scoped.sudo() as any
      const header = await scopedShowingIdentity(scoped, showingId)
      if (!header) return { result: { ok: false, message: 'Showing not found or access denied.', itemId: null }, event: null as never }
      await lockPropertyForDecision(scoped, header.property.id, header.brokerage.id)
      const showing = await sudo.query.Showing.findOne({ where: { id: showingId }, query: 'id status updatedAt showingType notes feedback scheduledStart scheduledEnd brokerage { id status } assignedAgent { id } lead { id status brokerage { id status } } property { id state brokerage { id status } }' })
      if (!sameShowingIdentity(showing, header)) return { result: { ok: false, message: 'Showing not found or access denied.', itemId: null }, event: null as never }
      if (!showing || !authorized(scoped, showing.brokerage?.id, 'canManageShowings', showing.assignedAgent?.id)) return { result: { ok: false, message: 'Showing not found or access denied.', itemId: null }, event: null as never }
      if ((data.expectedStatus != null && showing.status !== clean(data.expectedStatus))
        || (data.expectedUpdatedAt != null && showing.updatedAt !== clean(data.expectedUpdatedAt))
        || (data.expectedRevision != null && await showingReviewRevision(scoped, showing) !== clean(data.expectedRevision))) {
        return { result: { ok: false, message: 'The showing changed after review. Refresh before saving feedback.', itemId: showingId }, event: null as never }
      }
      try {
        await requireRepresentationAuthority(scoped, { brokerageId: showing.brokerage.id, leadId: showing.lead?.id, propertyId: showing.property?.id, practitionerId: showing.assignedAgent?.id || actorId(scoped)!, jurisdictionCode: showing.property?.state, side: 'buyer', allowCustomerAssistance: true })
      } catch (error) {
        return { result: { ok: false, message: error instanceof Error ? error.message : 'Practitioner authority is required.', itemId: showingId }, event: null as never }
      }
      if (showing.status !== 'scheduled') return { result: { ok: false, message: `Cannot complete showing from ${showing.status}.`, itemId: showingId }, event: null as never }
      const nextLeadStatus = showing.lead?.id
        ? await reconcileLeadStatusAfterShowing(scoped, {
          currentLeadStatus: showing.lead.status,
          nextShowingStatus: 'completed',
          brokerageId: showing.brokerage.id,
          leadId: showing.lead.id,
          showingId,
        })
        : undefined
      const now = new Date().toISOString()
      await sudo.query.Showing.updateOne({ where: { id: showingId }, data: { feedback, status: 'completed' }, query: 'id' })
      if (showing.lead?.id) {
        await sudo.query.Lead.updateOne({ where: { id: showing.lead.id }, data: { status: nextLeadStatus || showing.lead.status, lastContactedAt: now }, query: 'id' })
        await sudo.query.LeadActivity.createOne({ data: { brokerage: { connect: { id: showing.brokerage.id } }, lead: { connect: { id: showing.lead.id } }, ...(showing.property?.id ? { property: { connect: { id: showing.property.id } } } : {}), showing: { connect: { id: showingId } }, agent: { connect: { id: actorId(scoped)! } }, activityType: 'showing_feedback', direction: 'internal', channel: 'crm', subject: 'Showing feedback', body: feedback, occurredAt: now }, query: 'id' })
      }
      const result = { ok: true, message: 'Feedback saved and showing completed.', itemId: showingId }
      return { result, event: { eventType: 'showing.completed_with_feedback', brokerageId: showing.brokerage.id, aggregateType: 'showing', aggregateId: showingId, actorId: actorId(scoped), action: 'complete_with_feedback', before: { status: showing.status, feedback: showing.feedback }, after: { ...result, status: 'completed', subject: { showingId, leadId: header.lead.id, propertyId: header.property.id } } } }
    },
  })
}

export async function addLeadActivityCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const leadId = clean(data.leadId), body = clean(data.body), key = clean(data.idempotencyKey)
  if (!leadId || !body || body.length > 10_000 || clean(data.subject).length > 200 || !key) return { ok: false, message: 'Lead, body, and idempotency key are required.', itemId: null, replayed: false }
  const request = { leadId, propertyId: clean(data.propertyId), activityType: clean(data.activityType) || 'note', direction: clean(data.direction) || 'internal', channel: clean(data.channel) || 'crm', subject: clean(data.subject), body }
  return command(context, {
    eventKey: `command:lead:${leadId}:activity:${key}`, lockKey: `aggregate:lead:${leadId}`, permission: 'canManageLeads', request,
    execute: async scoped => {
      const sudo = scoped.sudo() as any
      const lead = await sudo.query.Lead.findOne({ where: { id: leadId }, query: 'id brokerage { id } assignedAgent { id } property { id }' })
      if (!lead || !authorized(scoped, lead.brokerage?.id, 'canManageLeads', lead.assignedAgent?.id)) return { result: { ok: false, message: 'Lead not found or access denied.', itemId: null }, event: null as never }
      const activity = await sudo.query.LeadActivity.createOne({ data: { brokerage: { connect: { id: lead.brokerage.id } }, lead: { connect: { id: leadId } }, ...(request.propertyId ? { property: { connect: { id: request.propertyId } } } : {}), agent: { connect: { id: actorId(scoped)! } }, activityType: request.activityType, direction: request.direction, channel: request.channel, subject: request.subject || 'CRM note', body, occurredAt: new Date().toISOString() }, query: 'id' })
      const result = { ok: true, message: 'Activity saved.', itemId: activity.id }
      return { result, event: { eventType: 'lead.activity_added', brokerageId: lead.brokerage.id, aggregateType: 'lead', aggregateId: leadId, actorId: actorId(scoped), action: 'add_activity', before: null, after: result } }
    },
  })
}

export async function scheduleShowingForLeadCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const leadId = clean(data.leadId), propertyId = clean(data.propertyId), assignedAgentId = clean(data.assignedAgentId), scheduledStart = clean(data.scheduledStart), notes = clean(data.notes), key = clean(data.idempotencyKey)
  if (!leadId || !propertyId || !scheduledStart || notes.length > 5000 || !key || !Number.isFinite(new Date(scheduledStart).getTime())) return { ok: false, message: 'Lead, property, valid schedule, and idempotency key are required.', itemId: null, replayed: false }
  const originalScope = data.originalActorId == null && data.originalBrokerageId == null ? null
    : { originalActorId: clean(data.originalActorId), originalBrokerageId: clean(data.originalBrokerageId) }
  if (originalScope && (!originalScope.originalActorId || !originalScope.originalBrokerageId)) return { ok: false, message: 'Original request scope is unavailable.', itemId: null, replayed: false }
  const request = { leadId, propertyId, assignedAgentId, scheduledStart, notes, ...(originalScope || {}) }
  return command(context, {
    eventKey: `command:lead:${leadId}:schedule-showing:${key}`, lockKey: `aggregate:lead:${leadId}`, permission: 'canManageShowings', request,
    authorizeTarget: async scoped => (!originalScope || (originalScope.originalActorId === actorId(scoped)
      && originalScope.originalBrokerageId === activeBrokerageIds(scoped.session as Session)[0]))
      && Boolean(await scopedSchedulingIdentity(scoped, leadId, propertyId, false)),
    authorizeReplayHeader: (scoped, header) => ownedShowingEventHeader(scoped, header, { eventKey: `command:lead:${leadId}:schedule-showing:${key}`, eventType: 'showing.scheduled', purpose: 'owned_receipt', leadId, propertyId }),
    authorizeReplay: (scoped, existing) => ownsShowingScheduleReceipt(scoped, existing, leadId, propertyId),
    execute: async scoped => {
      const sudo = scoped.sudo() as any
      const identity = await scopedSchedulingIdentity(scoped, leadId, propertyId)
      if (!identity) return { result: { ok: false, message: 'Lead/property not found, cross-brokerage, or access denied.', itemId: null }, event: null as never }
      await lockPropertyForDecision(scoped, propertyId, identity.brokerageId)
      const [lead, property] = await Promise.all([
        sudo.query.Lead.findOne({ where: { id: leadId }, query: 'id status brokerage { id } assignedAgent { id } property { id }' }),
        sudo.query.Property.findOne({ where: { id: propertyId }, query: 'id title slug addressLine1 city state listingType price updatedAt brokerage { id } assignedAgent { id }' }),
      ])
      if (!lead || lead.id !== leadId || !property || property.id !== propertyId || lead.brokerage?.id !== identity.brokerageId || property.brokerage?.id !== identity.brokerageId || !authorized(scoped, lead.brokerage?.id, 'canManageShowings', lead.assignedAgent?.id)) return { result: { ok: false, message: 'Lead/property not found, cross-brokerage, or access denied.', itemId: null }, event: null as never }
      if (lead.property?.id !== property.id) return { result: { ok: false, message: 'The showing property must match the lead’s recorded listing interest.', itemId: null }, event: null as never }
      // Scheduling must not bypass the lead lifecycle's terminal states.
      if (lead.status === 'closed' || lead.status === 'lost') return { result: { ok: false, message: 'Closed or lost leads cannot be scheduled. Reopen a lost lead before scheduling.', itemId: null }, event: null as never }
      const agentId = assignedAgentId || lead.assignedAgent?.id || property.assignedAgent?.id
      if (agentId) {
        const agent = await sudo.query.User.findOne({ where: { id: agentId }, query: 'id brokerageMemberships(where: { status: { equals: active } }) { brokerage { id status } }' })
        if (!(agent?.brokerageMemberships || []).some((membership: any) => membership.brokerage?.id === lead.brokerage.id && membership.brokerage?.status === 'active')) return { result: { ok: false, message: 'Assigned agent is outside the brokerage.', itemId: null }, event: null as never }
        try {
          await requireRepresentationAuthority(scoped, { brokerageId: lead.brokerage.id, leadId, propertyId, practitionerId: agentId, jurisdictionCode: property.state, side: 'buyer', allowCustomerAssistance: true })
        } catch (error) {
          return { result: { ok: false, message: error instanceof Error ? error.message : 'Showing authority is required.', itemId: null }, event: null as never }
        }
      } else return { result: { ok: false, message: 'An authorized practitioner assignment is required.', itemId: null }, event: null as never }
      const settings = await sudo.query.BrokerageSettings.findMany({ where: { brokerage: { id: { equals: lead.brokerage.id } } }, take: 1, query: 'showingDurationMinutes' })
      const interval = showingInterval(scheduledStart, settings[0]?.showingDurationMinutes || 60)
      await requireAvailableShowingSlot(scoped, { brokerageId: lead.brokerage.id, propertyId, agentId, ...interval })
      const now = new Date().toISOString()
      const showing = await sudo.query.Showing.createOne({ data: { brokerage: { connect: { id: lead.brokerage.id } }, status: 'scheduled', showingType: 'in_person', ...interval, notes, lead: { connect: { id: leadId } }, property: { connect: { id: propertyId } }, assignedAgent: { connect: { id: agentId } } }, query: 'id' })
      await sudo.query.Lead.updateOne({ where: { id: leadId }, data: { status: leadStatusAfterShowing(lead.status, 'scheduled'), lastContactedAt: now }, query: 'id' })
      await sudo.query.LeadActivity.createOne({ data: { brokerage: { connect: { id: lead.brokerage.id } }, lead: { connect: { id: leadId } }, property: { connect: { id: propertyId } }, showing: { connect: { id: showing.id } }, ...(agentId ? { agent: { connect: { id: agentId } } } : {}), activityType: 'showing_scheduled', direction: 'internal', channel: 'crm', subject: 'Showing scheduled', body: notes, occurredAt: now }, query: 'id' })
      const result = { ok: true, message: 'Showing scheduled and lead updated.', itemId: showing.id }
      const receipt = { version: 1, showingId: showing.id, leadId, propertyId }
      const snapshot = showingSnapshot(property, { leadId, assignedAgentId: agentId, ...interval, showingType: 'in_person', notes }, now)
      return { result, event: { eventType: 'showing.scheduled', brokerageId: lead.brokerage.id, aggregateType: 'showing', aggregateId: showing.id, actorId: actorId(scoped), action: 'schedule', before: null, after: { ...result, status: 'scheduled', receipt, snapshot } } }
    },
  })
}

export async function resolveDuplicateLeadCommand(_root: unknown, { data }: { data: any }, context: Context) {
  const primaryLeadId = clean(data.primaryLeadId), duplicateLeadId = clean(data.duplicateLeadId), note = clean(data.note), key = clean(data.idempotencyKey)
  if (!primaryLeadId || !duplicateLeadId || primaryLeadId === duplicateLeadId || note.length > 5000 || !key) return { ok: false, message: 'Two different leads and an idempotency key are required.', itemId: null, replayed: false }
  const request = { primaryLeadId, duplicateLeadId, note }
  return command(context, {
    eventKey: `command:lead:${duplicateLeadId}:merge:${key}`, lockKey: `aggregate:lead:${duplicateLeadId}`, permission: 'canManageLeads', request,
    execute: async scoped => {
      const sudo = scoped.sudo() as any
      const [primary, duplicate] = await Promise.all([primaryLeadId, duplicateLeadId].map(id => sudo.query.Lead.findOne({ where: { id }, query: 'id name identityKey status brokerage { id } assignedAgent { id } property { id }' })))
      if (!primary || !duplicate || primary.brokerage?.id !== duplicate.brokerage?.id || !authorized(scoped, primary.brokerage?.id, 'canManageLeads', primary.assignedAgent?.id) || !authorized(scoped, duplicate.brokerage?.id, 'canManageLeads', duplicate.assignedAgent?.id)) return { result: { ok: false, message: 'Leads not found, cross-brokerage, or access denied.', itemId: null }, event: null as never }
      if (primary.identityKey !== duplicate.identityKey) return { result: { ok: false, message: 'Lead identities do not match.', itemId: null }, event: null as never }
      const now = new Date().toISOString(), body = note || `Merged duplicate ${duplicateLeadId} into ${primaryLeadId}`
      await sudo.query.Lead.updateOne({ where: { id: duplicateLeadId }, data: { status: 'lost', lastContactedAt: now }, query: 'id' })
      for (const lead of [primary, duplicate]) await sudo.query.LeadActivity.createOne({ data: { brokerage: { connect: { id: primary.brokerage.id } }, lead: { connect: { id: lead.id } }, agent: { connect: { id: actorId(scoped)! } }, activityType: 'system', direction: 'internal', channel: 'crm', subject: lead.id === primaryLeadId ? 'Duplicate merged' : 'Marked duplicate', body, occurredAt: now }, query: 'id' })
      const result = { ok: true, message: 'Duplicate resolved and timelines updated.', itemId: primaryLeadId }
      return { result, event: { eventType: 'lead.duplicate_resolved', brokerageId: primary.brokerage.id, aggregateType: 'lead', aggregateId: primaryLeadId, actorId: actorId(scoped), action: 'resolve_duplicate', before: { duplicateStatus: duplicate.status }, after: result } }
    },
  })
}
