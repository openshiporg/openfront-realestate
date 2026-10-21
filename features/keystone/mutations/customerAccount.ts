import type { Context } from '.keystone/types'

/** Customer identities reuse the family User/password/session system, but never
 * acquire operator memberships, roles, or guest records by matching email. */
export async function registerRealEstateCustomer(_root: unknown, { data }: { data: { name: string; email: string; password: string; brokerageSlug: string } }, context: Context) {
  const name = String(data.name || '').trim(), email = String(data.email || '').trim().toLowerCase(), password = String(data.password || '')
  const slug = String(data.brokerageSlug || '').trim()
  if (!name || name.length > 120 || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || password.length > 200 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return { ok: false, message: 'Enter a name, valid email, and a password of at least 12 characters.' }
  try {
    return await context.transaction(async tx => {
      await tx.prisma.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `customer-registration:${email}`)
      const sudo = tx.sudo()
      const brokerage = (await sudo.query.Brokerage.findMany({ where: { slug: { equals: slug }, status: { equals: 'active' } }, take: 1, query: 'id' }))[0]
      if (!brokerage || await sudo.query.User.count({}) === 0 || await sudo.query.User.findOne({ where: { email }, query: 'id' })) return { ok: false, message: 'Account could not be created. Sign in or use another email.' }
      await sudo.query.User.createOne({ data: { name, email, password, activeBrokerage: { connect: { id: brokerage.id } }, onboardingStatus: 'dismissed' }, query: 'id' })
      return { ok: true, message: 'Account created.' }
    })
  } catch { return { ok: false, message: 'Account could not be created. Sign in or use another email.' } }
}

export async function customerShowingHistory(_root: unknown, { brokerageSlug, id }: { brokerageSlug: string; id?: string }, context: Context) {
  const actor = context.session?.itemId
  if (!actor) throw new Error('Sign in to view your showings.')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(brokerageSlug) || brokerageSlug.length > 80 || (id && id.length > 200)) throw new Error('Showings unavailable.')
  // Session identity is established before elevation; exact ownership + active
  // brokerage are reapplied to every read. No email or request nonce is proof.
  const rows = await context.sudo().query.Showing.findMany({ where: {
    customer: { id: { equals: actor } }, brokerage: { slug: { equals: brokerageSlug }, status: { equals: 'active' } },
    ...(id ? { id: { equals: id } } : {}),
  }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100,
    query: 'id status showingType scheduledStart scheduledEnd requestSnapshot' })
  return rows.map(row => {
    const snapshot = row.requestSnapshot && typeof row.requestSnapshot === 'object' && !Array.isArray(row.requestSnapshot) ? row.requestSnapshot : {}
    return { id: row.id, status: row.status, showingType: row.showingType, scheduledStart: row.scheduledStart, scheduledEnd: row.scheduledEnd,
      listingTitle: typeof snapshot.listingTitle === 'string' ? snapshot.listingTitle : 'Residence',
      listingSlug: typeof snapshot.listingSlug === 'string' ? snapshot.listingSlug : '',
      requestedStart: typeof snapshot.scheduledStart === 'string' ? snapshot.scheduledStart : row.scheduledStart }
  })
}
