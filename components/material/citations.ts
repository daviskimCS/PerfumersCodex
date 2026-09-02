import type { Citation } from '@/lib/types'

/**
 * Citation numbering, in one place.
 *
 * The rule is pinned in `lib/types.ts` and implemented in `lib/db/materials.ts`:
 * `MaterialDetail.sources` is already ordered by first reference (walking the
 * sourceId-bearing fields in declaration order, deduped), so the superscript
 * number is simply the index in that array plus one. Nothing here re-derives
 * that order — doing so would let the UI and the data layer disagree about
 * what "[2]" means.
 *
 * A plain module with no `'use client'`: both the server panels and the client
 * superscript import from it, so it must stay callable on either side.
 */

export const SOURCE_ANCHOR_PREFIX = 'source-'

export function sourceAnchorId(number: number): string {
  return `${SOURCE_ANCHOR_PREFIX}${number}`
}

/** `null` for an uncited row, or for an id that resolves to no source. */
export function citationNumber(
  sources: Citation[],
  sourceId: string | null
): number | null {
  if (sourceId === null) return null
  const index = sources.findIndex((source) => source.id === sourceId)
  return index === -1 ? null : index + 1
}
