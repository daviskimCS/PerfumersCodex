import { describe, expect, it } from 'vitest'

import { reviewState, type ReviewColumns } from '@/lib/review/state'

/**
 * The operator-facing mirror of `materialIsPublished`. If these disagree with
 * the SQL, the maker is told a material is live when readers cannot see it, or
 * the reverse. Only one row of this table may be 'published'.
 */
const H1 = 'v1:sha256:aaa'
const H2 = 'v1:sha256:bbb'
const DELETED = new Date('2026-10-01T00:00:00Z')

describe('reviewState', () => {
  it.each<[string, ReviewColumns, ReturnType<typeof reviewState>]>([
    [
      'reviewed in its current form',
      { contentHash: H1, reviewedHash: H1, deletedAt: null },
      'published',
    ],
    [
      'never reviewed',
      { contentHash: H1, reviewedHash: null, deletedAt: null },
      'awaiting review',
    ],
    [
      'data changed after review',
      { contentHash: H2, reviewedHash: H1, deletedAt: null },
      'changed since review',
    ],
    [
      'seeded before the gate existed',
      { contentHash: null, reviewedHash: null, deletedAt: null },
      'not fingerprinted',
    ],
    [
      'reviewed, then hash cleared',
      { contentHash: null, reviewedHash: H1, deletedAt: null },
      'not fingerprinted',
    ],
    [
      'reviewed but soft-deleted',
      { contentHash: H1, reviewedHash: H1, deletedAt: DELETED },
      'soft-deleted',
    ],
  ])('%s', (_name, row, expected) => {
    expect(reviewState(row)).toBe(expected)
  })
})
