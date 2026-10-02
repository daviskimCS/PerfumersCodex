/**
 * Where one material stands at the review gate, for operator output (the
 * seed's report and `npm run db:review list`).
 *
 * This MUST agree with the SQL predicate readers are actually filtered by,
 * `materialIsPublished` in lib/db/published.ts:
 *
 *   deleted_at IS NULL AND reviewed_hash = content_hash
 *
 * Only 'published' is visible to readers. Every other state is hidden; the
 * names exist to tell the maker why, and what to do about it.
 */
export type ReviewState =
  | 'published'
  | 'awaiting review'
  | 'changed since review'
  | 'not fingerprinted'
  | 'soft-deleted'

export interface ReviewColumns {
  contentHash: string | null
  reviewedHash: string | null
  deletedAt: Date | null
}

export function reviewState(row: ReviewColumns): ReviewState {
  if (row.deletedAt !== null) return 'soft-deleted'
  // Never fingerprinted (seeded before migration 0008, and neither the seed
  // nor `db:review refresh` has run since).
  if (row.contentHash === null) return 'not fingerprinted'
  if (row.reviewedHash === null) return 'awaiting review'
  return row.reviewedHash === row.contentHash
    ? 'published'
    : 'changed since review'
}

/** What the maker should do next, per state. */
export const NEXT_STEP: Record<ReviewState, string> = {
  published: 'visible to readers',
  'awaiting review':
    'npm run db:review show <slug>, review it, then: npm run db:review publish <slug> <fingerprint>',
  'changed since review':
    'something it shows changed after review: show it again, re-review, then publish',
  'not fingerprinted': 'npm run db:review refresh',
  'soft-deleted': 'pruned; re-seed it to bring it back',
}
