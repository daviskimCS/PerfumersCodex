/**
 * Where one material stands at the review gate, for operator output (the
 * seed's report and `npm run db:review -- --list`).
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
  // Seeded before migration 0008: there is nothing to review against until
  // the seed runs again and records a fingerprint.
  if (row.contentHash === null) return 'not fingerprinted'
  if (row.reviewedHash === null) return 'awaiting review'
  return row.reviewedHash === row.contentHash
    ? 'published'
    : 'changed since review'
}

/** What the maker should do next, per state. */
export const NEXT_STEP: Record<ReviewState, string> = {
  published: 'visible to readers',
  'awaiting review': 'review it, then: npm run db:review -- <slug>',
  'changed since review':
    'its data changed after review — re-review, then: npm run db:review -- <slug>',
  'not fingerprinted': 're-run the seed first so the review binds to its data',
  'soft-deleted': 'pruned; re-seed it to bring it back',
}
