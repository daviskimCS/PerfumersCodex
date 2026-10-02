import { and, asc, count, eq, gt, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

import { families, materialFamilies, materials } from '@/db/schema'
import { db } from '@/lib/db'
import { materialIsPublished } from '@/lib/db/published'
import type { FamilySummary } from '@/lib/types'

/**
 * Editorial family reads (docs/architecture.md D1).
 *
 * Families are public editorial data, so Drizzle — the same side of the RLS
 * boundary as materials. Raw rows never escape this file: everything maps to
 * `FamilySummary` in `lib/types.ts`.
 *
 * `materialCount` is part of the shape on purpose. A browse surface that
 * lists families always wants the counts too, and computing them per row
 * would be an N+1 across the taxonomy; one grouped query answers both.
 *
 * There is deliberately no `description` — the `families` table has no such
 * column, and offering one here would invite a UI slot that can never be
 * filled (lib/types.ts, W5-A entry criteria).
 */

/** Self-join: `parent_family_id` resolved to the parent's slug. */
const parentFamilies = alias(families, 'parent_families')

/**
 * The one query both exports run, with an optional predicate.
 *
 * Three things are load-bearing here:
 *
 * - the count is `count(materials.id)`, not `count(*)` — a family with no
 *   materials still produces one row from the LEFT JOINs, and counting a
 *   NULL-able joined column is what makes that row count 0 rather than 1;
 * - the published filter (`materialIsPublished`) lives in the JOIN
 *   condition, so only reviewed materials are counted;
 * - `HAVING count > 0` then drops every family with no published material.
 *   A family is editorial content too: until a reviewed material belongs to
 *   it, its name (placeholders such as "PROPOSED — maker to replace", test
 *   families) is unreviewed and stays off the site. `getFamilyBySlug`
 *   inherits this, so an empty family's page is a 404, not an empty page.
 */
function selectFamilies(where: SQL | undefined) {
  return db
    .select({
      slug: families.slug,
      name: families.name,
      parentSlug: parentFamilies.slug,
      materialCount: count(materials.id),
    })
    .from(families)
    .leftJoin(parentFamilies, eq(families.parentFamilyId, parentFamilies.id))
    .leftJoin(materialFamilies, eq(materialFamilies.familyId, families.id))
    .leftJoin(
      materials,
      and(eq(materialFamilies.materialId, materials.id), materialIsPublished())
    )
    .where(where)
    .groupBy(families.id, families.slug, families.name, parentFamilies.slug)
    .having(gt(count(materials.id), 0))
    .orderBy(asc(families.name))
}

/**
 * Every family with at least one published material, alphabetically, with
 * its published material count.
 *
 * Alphabetical rather than hierarchical: the taxonomy is one level deep in
 * practice, and a flat A–Z list is what a filter row and a "browse another
 * family" nav both want. `parentSlug` carries the hierarchy for any caller
 * that wants to show it.
 */
export async function listFamilies(): Promise<FamilySummary[]> {
  return selectFamilies(undefined)
}

/**
 * One family by slug, or null when the slug matches nothing — the route turns
 * null into `notFound()`.
 */
export async function getFamilyBySlug(
  slug: string
): Promise<FamilySummary | null> {
  const rows = await selectFamilies(eq(families.slug, slug))
  return rows[0] ?? null
}
