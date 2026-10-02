import { createHash } from 'node:crypto'

import type { MaterialDetail } from '@/lib/types'

/**
 * The review gate's fingerprint of one material (migration 0008): a hash of
 * EXACTLY what its page renders, not of the file it was seeded from.
 *
 * Input is the `MaterialDetail` the page is built from, as loaded by
 * `loadMaterialForReview` (lib/db/materials.ts): identity, synonyms, family
 * and class NAMES, IFRA limits with their category NAMES, absences, hazards
 * with their statement TEXT, olfactive description, guidance, landmark
 * uses, computed properties, every live similar material, predictions and
 * the full citation rows. Shared rows are hashed as resolved, so a family
 * rename, an IFRA category rename, a hazard-text edit, a reclassification,
 * or another material's file overwriting a shared source all change the
 * fingerprint of every material that shows them. That hides those pages
 * until the maker reviews them again.
 *
 * Because this hashes the render input itself, a field added to
 * `MaterialDetail` later is covered automatically. Anything a page shows
 * that is NOT in `MaterialDetail` is not covered; keep it that way.
 *
 * The version prefix makes an algorithm change explicit. A new prefix
 * un-reviews every material at once, which is the correct consequence.
 */
export const FINGERPRINT_VERSION = 'v1'

/** Hex digits shown to the maker and accepted by `db:review publish`. */
export const SHORT_FINGERPRINT_LENGTH = 16

export function materialFingerprint(detail: MaterialDetail): string {
  const digest = createHash('sha256')
    .update(stableStringify(detail))
    .digest('hex')
  return `${FINGERPRINT_VERSION}:sha256:${digest}`
}

/** The form printed by `db:review show`: enough to type, enough to be unique. */
export function shortFingerprint(fingerprint: string): string {
  const digest = fingerprint.split(':').at(-1) ?? ''
  return digest.slice(0, SHORT_FINGERPRINT_LENGTH)
}

/**
 * JSON with object keys in sorted order at every depth, so two values that
 * differ only in key order hash the same. Array order is kept, because it is
 * data (citation numbering, list order). Keys whose value is `undefined` are
 * omitted, as `JSON.stringify` does.
 *
 * Exported for tests only.
 */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? 'null' : stableStringify(item))).join(',')}]`
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    return `{${entries.join(',')}}`
  }
  // string, number, boolean, null — JSON's own encoding.
  return JSON.stringify(value)
}
