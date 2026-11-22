import type { Context } from '.keystone/types'
import { stateTimeZone } from '../../lib/date-time'
import { sendShowingEmail, type ShowingEmailKind } from './showingMail'

type Result = { ok: boolean; message: string; itemId?: string | null; replayed?: boolean }

/**
 * After a showing is confirmed, moved or cancelled, tells the customer by email through the
 * password-reset sender, and notes the outcome on the lead. The staff message says exactly
 * what happened; it never claims an email that was not accepted by the provider.
 */
export async function notifyShowingChange<T extends Result>(context: Context, kind: ShowingEmailKind, result: T): Promise<T> {
  if (!result?.ok || result.replayed || !result.itemId) return result
  const sudo = context.sudo() as any
  const showing = await sudo.query.Showing.findOne({
    where: { id: result.itemId },
    query: 'id scheduledStart brokerage { id name } lead { id name email } property { id title addressLine1 city state }',
  })
  const to = String(showing?.lead?.email || '').trim()
  if (!showing || !to) return { ...result, message: `${result.message} No email on file for this customer, so no email was sent.` }
  const zone = stateTimeZone(showing.property?.state) || 'America/Chicago'
  const when = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: zone, timeZoneName: 'short' }).format(new Date(showing.scheduledStart))
  let messageId = ''
  let failure = ''
  try {
    messageId = await sendShowingEmail({
      kind, to, name: showing.lead?.name, listing: showing.property?.title || 'the home', when, showingId: showing.id, storeName: showing.brokerage?.name,
      address: [showing.property?.addressLine1, showing.property?.city, showing.property?.state].filter(Boolean).join(', '),
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : 'unknown error'
  }
  const sent = Boolean(messageId) && !failure
  if (showing.lead?.id) {
    await sudo.query.LeadActivity.createOne({
      data: {
        brokerage: { connect: { id: showing.brokerage.id } }, lead: { connect: { id: showing.lead.id } },
        ...(showing.property?.id ? { property: { connect: { id: showing.property.id } } } : {}), showing: { connect: { id: showing.id } },
        activityType: 'email', direction: 'outbound', channel: 'email',
        subject: sent ? `Showing ${kind} email sent to ${to}` : `Showing ${kind} email NOT sent`,
        body: sent ? `Provider message id ${messageId}` : `Send failed: ${failure}`.slice(0, 2000),
        occurredAt: new Date().toISOString(),
      },
      query: 'id',
    }).catch(() => null)
  }
  if (sent) console.log(`Showing ${kind} email accepted for showing ${showing.id}: ${messageId}`)
  else console.error(`Showing ${kind} email failed for showing ${showing.id}: ${failure}`)
  return { ...result, message: sent ? `${result.message} Email sent to ${to}.` : `${result.message} The email to ${to} could not be sent, so tell the customer yourself.` }
}
