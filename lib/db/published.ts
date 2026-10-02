import { sql, type SQL } from 'drizzle-orm'

import { materials } from '@/db/schema'

/**
 * What readers may see: a material that is not soft-deleted AND was reviewed
 * by the maker in its current form (migration 0008, `db/schema.ts`).
 *
 * Every public read of `materials` goes through one of these two — pages,
 * search, counts, family and class counts, similarity links, bookmarks. A
 * query that filters only on `deleted_at` would publish unreviewed data, so
 * the bare `deleted_at IS NULL` check should not appear on its own anywhere
 * in `lib/db/` any more.
 *
 * `reviewed_hash = content_hash` is false when either side is NULL (SQL
 * equality with NULL is NULL), so "never seeded with a hash", "never
 * reviewed" and "changed since review" all hide the material.
 */
export function materialIsPublished(): SQL {
  return sql`(${materials.deletedAt} IS NULL AND ${materials.reviewedHash} = ${materials.contentHash})`
}

/**
 * The same predicate for the raw-SQL search query, which aliases `materials`
 * as `m`. The alias is a literal type, never a runtime string, so nothing a
 * reader types can reach `sql.raw`.
 */
export function materialIsPublishedAs(alias: 'm'): SQL {
  return sql.raw(
    `(${alias}.deleted_at IS NULL AND ${alias}.reviewed_hash = ${alias}.content_hash)`
  )
}
