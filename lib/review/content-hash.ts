import { createHash } from 'node:crypto'

import type { MaterialFile } from '@/lib/validation/material-data'

/**
 * The review gate's fingerprint of one material (migration 0008).
 *
 * The seed stores this as `materials.content_hash` on every run, and
 * `npm run db:review` copies it to `reviewed_hash`. Readers see a material
 * only while the two are equal, so the hash has one job: change whenever
 * anything the maker reviewed changes, and never otherwise.
 *
 * It covers the whole validated record, defaults applied, which is everything
 * the seed writes for this material: identity, synonyms, limits, absences,
 * hazards, sources as this file declares them, description, guidance,
 * landmark uses, computed properties, similarity and predictions. It does NOT
 * cover the shared reference files (families, IFRA category names, hazard
 * statements, structural classes). Those are reviewed as their own files.
 *
 * Deliberately conservative: reordering a list or editing a source note
 * changes the hash, so the page hides until re-reviewed. A false "changed" is
 * one more review; a false "unchanged" would publish unreviewed data.
 *
 * The version prefix makes an algorithm change explicit. A new prefix
 * un-reviews every material at once, which is the correct consequence.
 */
export const CONTENT_HASH_VERSION = 'v1'

export function materialContentHash(material: MaterialFile): string {
  const digest = createHash('sha256')
    .update(stableStringify(material))
    .digest('hex')
  return `${CONTENT_HASH_VERSION}:sha256:${digest}`
}

/**
 * JSON with object keys in sorted order at every depth, so two records that
 * differ only in key order hash the same. Array order is kept, because it is
 * data. Keys whose value is `undefined` are omitted, as `JSON.stringify` does.
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
