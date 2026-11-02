// The reviewed `updatedAt` a client sends back can be the same instant in another form: with or
// without milliseconds, `Z` vs `+00:00`, or a Date the DateTime scalar already parsed. Compare and
// bind both sides as one canonical ISO string; a raw `!==` refuses an unchanged record.
export function reviewedIso(value: unknown): string | null {
  const date = value instanceof Date ? value : typeof value === 'string' && value.trim() ? new Date(value.trim()) : null
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null
}

/** True only when both are valid and name the same instant. */
export function sameReviewedVersion(current: unknown, reviewed: unknown): boolean {
  const now = reviewedIso(current), seen = reviewedIso(reviewed)
  return now !== null && seen !== null && now === seen
}
