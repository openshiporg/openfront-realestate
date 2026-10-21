import { GraphQLError } from 'graphql'

export const PUBLIC_LISTING_CANDIDATE_BATCH_SIZE = 25
export const PUBLIC_LISTING_CANDIDATE_SCAN_LIMIT = 250

export const PUBLIC_LISTING_SCAN_OVERFLOW_MARKER = 'PUBLIC_LISTING_SCAN_OVERFLOW'

export class PublicListingScanOverflowError extends GraphQLError {
  constructor() {
    super(`${PUBLIC_LISTING_SCAN_OVERFLOW_MARKER}: Narrow the search to verify eligible inventory safely.`, {
      extensions: { code: PUBLIC_LISTING_SCAN_OVERFLOW_MARKER },
    })
    this.name = 'PublicListingScanOverflowError'
  }
}

type CollectEligiblePageInput<T> = {
  take: number
  skip: number
  fetchCandidates: (offset: number, limit: number) => Promise<readonly T[]>
  isEligible: (candidate: T) => Promise<boolean>
  candidateBatchSize?: number
  candidateScanLimit?: number
}

export type EligiblePage<T> = {
  items: T[]
  candidatesScanned: number
}

/**
 * Apply public offset/take after eligibility, not to the raw candidate set.
 * A one-row lookahead detects an incomplete candidate scan without turning
 * unknown authority into a false empty or incomplete page.
 */
export async function collectEligiblePage<T>({
  take,
  skip,
  fetchCandidates,
  isEligible,
  candidateBatchSize = PUBLIC_LISTING_CANDIDATE_BATCH_SIZE,
  candidateScanLimit = PUBLIC_LISTING_CANDIDATE_SCAN_LIMIT,
}: CollectEligiblePageInput<T>): Promise<EligiblePage<T>> {
  if (!Number.isSafeInteger(take) || take < 1 || take > 100) throw new Error('Public listing page size is invalid.')
  if (!Number.isSafeInteger(skip) || skip < 0 || skip > 10_000) throw new Error('Public listing offset is invalid.')
  if (!Number.isSafeInteger(candidateBatchSize) || candidateBatchSize < 1) throw new Error('Public listing candidate batch is invalid.')
  if (!Number.isSafeInteger(candidateScanLimit) || candidateScanLimit < 1) throw new Error('Public listing candidate budget is invalid.')

  const items: T[] = []
  let candidatesScanned = 0
  let eligibleSkipped = 0

  while (candidatesScanned < candidateScanLimit) {
    const batchLimit = Math.min(candidateBatchSize, candidateScanLimit - candidatesScanned)
    const candidates = await fetchCandidates(candidatesScanned, batchLimit)
    if (candidates.length > batchLimit) throw new Error('Public listing candidate reader exceeded its bound.')
    if (candidates.length === 0) {
      return { items, candidatesScanned }
    }

    for (const candidate of candidates) {
      candidatesScanned += 1
      if (!await isEligible(candidate)) continue

      if (eligibleSkipped < skip) {
        eligibleSkipped += 1
        continue
      }

      items.push(candidate)
      if (items.length === take) {
        return { items, candidatesScanned }
      }
    }

    if (candidates.length < batchLimit) {
      return { items, candidatesScanned }
    }
  }

  // The budget is exhausted. Probe one bounded candidate so we can distinguish
  // an exactly exhausted inventory from an incomplete eligibility decision.
  const overflowProbe = await fetchCandidates(candidatesScanned, 1)
  if (overflowProbe.length > 1) throw new Error('Public listing overflow probe exceeded its bound.')
  if (overflowProbe.length > 0) throw new PublicListingScanOverflowError()

  return { items, candidatesScanned }
}
