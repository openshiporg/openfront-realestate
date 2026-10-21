import { createHash } from 'node:crypto'

export type SavedDiscoveryKind = 'property' | 'search'

export function savedDiscoveryLockName(
  kind: SavedDiscoveryKind,
  brokerageId: string,
  userId: string,
  target: string,
) {
  const fingerprint = createHash('sha256').update(JSON.stringify([kind, brokerageId, userId, target])).digest('hex')
  return `saved-discovery:${kind}:${fingerprint}`
}

export async function lockSavedDiscoveryIdentity(
  prisma: { $executeRawUnsafe: (query: string, value: string) => Promise<unknown> },
  kind: SavedDiscoveryKind,
  brokerageId: string,
  userId: string,
  target: string,
) {
  await prisma.$executeRawUnsafe(
    'SELECT pg_advisory_xact_lock(hashtext($1))',
    savedDiscoveryLockName(kind, brokerageId, userId, target),
  )
}
