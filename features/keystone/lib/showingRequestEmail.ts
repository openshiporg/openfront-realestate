// Showing-request receipt email. Runs AFTER the request transaction has committed; a mail
// failure never fails the request. Dedupe + status live in one DomainAuditEvent row whose
// unique eventKey is claimed atomically, so a replay or concurrent retry never resends.
const PENDING = 'sending'

export type ShowingReceipt = {
  showingId: string
  brokerageId: string
  brokerageName: string
  to: string
  propertyTitle: string
  address: string
  requestedStart: string
  timeZone: string | null
  showingType: 'in_person' | 'virtual'
  listingUrl: string
}

export function formatRequestedTime(iso: string, timeZone: string | null) {
  const zone = timeZone || 'UTC'
  const text = new Intl.DateTimeFormat('en-US', { timeZone: zone, dateStyle: 'full', timeStyle: 'short' }).format(new Date(iso))
  const label = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' }).formatToParts(new Date(iso)).find(part => part.type === 'timeZoneName')?.value || zone
  return `${text} ${label}`
}

export async function deliverShowingRequestEmail(sudo: any, receipt: ShowingReceipt) {
  const eventKey = `showing-request-email:${receipt.showingId}`
  const occurredAt = new Date().toISOString()
  try {
    await sudo.query.DomainAuditEvent.createOne({
      data: {
        eventKey,
        brokerage: { connect: { id: receipt.brokerageId } },
        aggregateType: 'showing',
        aggregateId: receipt.showingId,
        action: 'request_email',
        afterState: { status: PENDING },
        occurredAt,
      },
      query: 'id',
    })
  } catch {
    return // already claimed (replay or concurrent request) or bookkeeping unavailable
  }
  const mark = async (status: string, extra: Record<string, unknown> = {}) => {
    try {
      const row = await sudo.query.DomainAuditEvent.findOne({ where: { eventKey }, query: 'id' })
      if (row) await sudo.query.DomainAuditEvent.updateOne({ where: { id: row.id }, data: { afterState: { status, ...extra } }, query: 'id' })
    } catch {
      // The request is already committed; status bookkeeping must never surface.
    }
  }
  try {
    if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) {
      console.warn('Showing request email skipped: SMTP is not configured', receipt.showingId)
      await mark('skipped_not_configured')
      return
    }
    if (!receipt.to) {
      await mark('skipped_no_email')
      return
    }
    const { sendShowingRequestEmail } = await import('./mail')
    const result = await sendShowingRequestEmail(receipt.to, {
      brokerageName: receipt.brokerageName,
      propertyTitle: receipt.propertyTitle,
      address: receipt.address,
      whenLabel: formatRequestedTime(receipt.requestedStart, receipt.timeZone),
      showingType: receipt.showingType,
      showingNumber: receipt.showingId,
      url: receipt.listingUrl,
    })
    if (result.sent) await mark('sent', { sentAt: new Date().toISOString() })
    else await mark('failed', { error: result.error || 'send_failed' })
  } catch (error) {
    console.error('Showing request email failed:', error instanceof Error ? error.message : 'Unknown error')
    await mark('failed', { error: error instanceof Error ? error.message : 'send_failed' })
  }
}
