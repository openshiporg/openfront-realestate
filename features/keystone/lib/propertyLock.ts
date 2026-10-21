import type { Context } from '.keystone/types'

/** The public/controlled decision holds this physical row lock through commit.
 * Ordinary PostgreSQL Property UPDATEs conflict with it, including generic
 * Keystone edits that do not take the brokerage advisory lock. Values are read
 * only AFTER acquisition. Existing edit permissions are unchanged. */
export async function lockPropertyForDecision(context: Context, id: string, brokerageId: string) {
  if (!id || !brokerageId) throw new Error('Property scope is required.')
  await context.prisma.$executeRawUnsafe('SELECT "id" FROM "Property" WHERE "id" = $1 AND "brokerage" = $2 FOR NO KEY UPDATE', id, brokerageId)
}

export async function lockAndRefreshProperty(context: Context, id: string, brokerageId: string) {
  await lockPropertyForDecision(context, id, brokerageId)
  const property = await context.sudo().query.Property.findOne({ where: { id }, query: 'id state brokerage { id } assignedAgent { id }' })
  if (!property || property.brokerage?.id !== brokerageId) throw new Error('Property is unavailable in the current brokerage.')
  return property
}
