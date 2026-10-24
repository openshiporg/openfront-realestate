import type { Context } from '.keystone/types';

import { requireListingAuthority } from '../lib/authorityEvidence'
import { lockBrokerageCommand } from '../lib/commandContext'
import { lockPropertyForDecision } from '../lib/propertyLock'
import { enqueueDomainEvent } from '../lib/domainEvents'
import { capturePublicLead, firstActiveBrokerageAgent } from './leadCapture'

type SubmitListingInquiryInput = {
  brokerageSlug: string;
  propertyId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  intent?: 'buy' | 'rent' | 'sell' | 'invest' | 'unknown' | null;
  message?: string | null;
  preferredTime?: string | null;
};

function clean(value?: string | null) {
  const trimmed = String(value || '').trim();
  return trimmed.length ? trimmed : '';
}

function validContact(email: string, phone: string) {
  const emailValid = !email || (email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  const phoneDigits = phone.replace(/\D/g, '')
  const phoneValid = !phone || (phone.length <= 40 && phoneDigits.length >= 7 && phoneDigits.length <= 15)
  return emailValid && phoneValid && Boolean(email || phone)
}

function normalizeIntent(intent?: string | null): 'buy' | 'rent' | 'sell' | 'invest' | 'unknown' {
  const value = clean(intent);
  return ['buy', 'rent', 'sell', 'invest', 'unknown'].includes(value)
    ? (value as 'buy' | 'rent' | 'sell' | 'invest' | 'unknown')
    : 'unknown';
}

function matchesRule(rule: any, property: any, intent: string) {
  if (!rule.assignedAgent?.id) return false;
  if (rule.intent && rule.intent !== 'any' && rule.intent !== intent) return false;
  if (rule.source && rule.source !== 'any' && rule.source !== 'website') return false;
  if (rule.city && property?.city && rule.city.toLowerCase() !== property.city.toLowerCase()) return false;
  if (rule.state && property?.state && rule.state.toLowerCase() !== property.state.toLowerCase()) return false;
  if (rule.postalCode && property?.postalCode && rule.postalCode !== property.postalCode) return false;
  return true;
}

async function findRoutingAgentId(context: Context, property: any, intent: string) {
  const rules = await context.sudo().query.LeadRoutingRule.findMany({
    where: { status: { equals: 'active' }, brokerage: { id: { equals: property.brokerage.id } } },
    orderBy: [{ priority: 'asc' }],
    take: 50,
    query: 'id intent source city state postalCode isFallback assignedAgent { id }',
  });

  const matchingRule = rules.find((rule: any) => matchesRule(rule, property, intent));
  const fallbackRule = rules.find((rule: any) => rule.isFallback && rule.assignedAgent?.id);

  return firstActiveBrokerageAgent(context, property.brokerage.id, [matchingRule?.assignedAgent?.id, property?.assignedAgent?.id, fallbackRule?.assignedAgent?.id]);
}

export async function submitListingInquiry(
  root: any,
  { data }: { data: SubmitListingInquiryInput },
  context: Context
) {
  const brokerageSlug = clean(data.brokerageSlug).toLowerCase();
  const propertyId = clean(data.propertyId);
  const name = clean(data.name);
  const email = clean(data.email);
  const phone = clean(data.phone);
  const message = clean(data.message);
  const preferredTime = clean(data.preferredTime);
  const intent = normalizeIntent(data.intent);

  if (!propertyId || propertyId.length > 200 || brokerageSlug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(brokerageSlug)) {
    return { ok: false, message: 'Choose a listing before sending an inquiry.', leadId: null };
  }

  if (!name || name.length > 120 || message.length > 5000 || preferredTime.length > 200 || !validContact(email, phone)) {
    return {
      ok: false,
      message: 'Add your name and either an email or phone number so an agent can follow up.',
      leadId: null,
    };
  }

  const brokerages = await context.sudo().query.Brokerage.findMany({ where: { slug: { equals: brokerageSlug }, status: { equals: 'active' } }, take: 1, query: 'id' })
  if (!brokerages[0]) return { ok: false, message: 'This listing is unavailable.', leadId: null }
  return context.transaction(async transactionContext => {
  const context = transactionContext
  await lockBrokerageCommand(context, brokerages[0].id)
  await lockPropertyForDecision(context, propertyId, brokerages[0].id)
  const properties = await context.sudo().query.Property.findMany({
    where: {
      id: { equals: propertyId },
      brokerage: { slug: { equals: brokerageSlug }, status: { equals: 'active' } },
    },
    take: 1,
    query: 'id title status city state postalCode brokerage { id } assignedAgent { id }',
  });
  const property = properties[0]

  if (!property || !['active', 'coming_soon'].includes(property.status)) {
    return { ok: false, message: 'This listing is no longer accepting inquiries.', leadId: null };
  }
  try {
    await requireListingAuthority(context, { brokerageId: property.brokerage.id, propertyId, practitionerId: property.assignedAgent?.id || '', jurisdictionCode: property.state, destination: 'public_site' })
  } catch {
    return { ok: false, message: 'This listing is not currently authorized for public inquiry.', leadId: null }
  }

  const body = [
    message || 'Website listing inquiry',
    preferredTime ? `Best time to reach: ${preferredTime}` : '',
  ].filter(Boolean).join('\n\n');

    const assignedAgentId = await findRoutingAgentId(transactionContext, property, intent);
    const now = new Date().toISOString();
    const capture = await capturePublicLead(transactionContext, {
      name,
      email,
      phone,
      intent,
      source: 'website',
      status: 'new',
      message: body,
      propertyId,
      assignedAgentId,
    })

    const recent = await transactionContext.sudo().query.LeadActivity.findMany({
      where: { lead: { id: { equals: capture.lead.id } }, activityType: { equals: 'inquiry' }, occurredAt: { gte: new Date(Date.now() - 60 * 60_000).toISOString() } },
      take: 5,
      query: 'id',
    })
    if (recent.length >= 5) return { ok: false, message: 'Unable to accept this request. Please contact the brokerage directly.', leadId: null }

    // Only a session account registered with this brokerage owns the inquiry; email is never proof.
    const customerId = context.session?.itemId || null
    const customer = customerId ? await transactionContext.sudo().query.User.findOne({ where: { id: customerId }, query: 'id activeBrokerage { id }' }) : null
    const ownedByCustomer = Boolean(customer && customer.activeBrokerage?.id === property.brokerage.id)

    const activity = await transactionContext.sudo().query.LeadActivity.createOne({
      data: {
        lead: { connect: { id: capture.lead.id } },
        ...(ownedByCustomer ? { customer: { connect: { id: customerId! } } } : {}),
        property: { connect: { id: propertyId } },
        activityType: 'inquiry',
        direction: 'inbound',
        channel: 'website',
        subject: capture.reused
          ? 'Repeat website listing inquiry matched'
          : assignedAgentId ? 'Website listing inquiry routed' : 'Website listing inquiry',
        body: `${body}${assignedAgentId ? '\n\nAuto-routed by lead routing rules/property agent.' : ''}`,
        occurredAt: now,
      },
      query: 'id',
    });

    await enqueueDomainEvent(transactionContext.sudo(), {
      eventKey: `public-inquiry:${activity.id}`,
      eventType: 'lead.inquiry_captured',
      brokerageId: property.brokerage.id,
      aggregateType: 'lead',
      aggregateId: capture.lead.id,
      action: 'capture_inquiry',
      request: { propertyId, intent, identityKey: capture.identityKey },
      before: null,
      after: { leadId: capture.lead.id, activityId: activity.id, reused: capture.reused },
    })

    return {
      ok: true,
      message: 'Inquiry sent. An agent will follow up with next steps shortly.',
      leadId: null,
    };
  }, { timeout: 30_000 })
}
