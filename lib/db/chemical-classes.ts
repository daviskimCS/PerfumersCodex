import { and, asc, count, eq, isNull } from 'drizzle-orm'

import {
  chemicalClasses,
  materialChemicalClasses,
  materials,
} from '@/db/schema'
import { db } from '@/lib/db'
import type { ChemicalClass } from '@/lib/types'

/**
 * Editorial reads for the structural axis (docs/architecture.md D1).
 *
 * Classes are public reference data seeded from `chemical-classes.json`, so
 * Drizzle — the same side of the RLS boundary as materials and families. Raw
 * rows never escape this file: everything maps to `ChemicalClass` in
 * `lib/types.ts`.
 *
 * This is the STRUCTURAL axis and `lib/db/families.ts` is the olfactive one.
 * They are deliberately independent — nothing about a lactone ring predicts
 * how a material smells — but they are read the same way, and this file
 * mirrors that one on purpose so the two filter rows cannot drift apart.
 *
 * `materialCount` is part of the shape for the same reason it is there: a
 * filter row that lists classes always wants the counts too, and computing
 * them per row would be an N+1 across the taxonomy. One grouped query answers
 * both.
 */

/**
 * Every class in curated order, with its live material count.
 *
 * Two things are load-bearing, both inherited from `listFamilies`:
 *
 * - the count is `count(materials.id)`, not `count(*)` — a class with no
 *   members still produces one row from the LEFT JOINs, and counting a
 *   NULL-able joined column is what makes that row count 0 rather than 1;
 * - the soft-delete filter lives in the JOIN condition, not in `where`.
 *   Moved to `where` it would turn the LEFT JOIN into an inner one and drop
 *   empty classes off the list entirely.
 *
 * **Zero-count classes are returned.** The list is curated and short, and a
 * class the corpus does not yet exercise is information about the corpus —
 * "no macrocyclic musks are published yet" is a fact worth reading, and a row
 * that appears the moment the first one lands is less confusing than a filter
 * whose options change shape as the seed grows. Callers that want to hide
 * them can filter on `materialCount`; a caller cannot invent a row that was
 * never sent.
 *
 * Ordered by `sort_order`, not alphabetically: the class list is curated
 * (`sort_order` exists precisely to carry that editorial ordering), unlike
 * families, where A–Z is the honest order. `slug` is the tie-break so two
 * classes sharing a sort_order cannot swap places between requests.
 */
export async function listChemicalClasses(): Promise<ChemicalClass[]> {
  return db
    .select({
      slug: chemicalClasses.slug,
      name: chemicalClasses.name,
      smarts: chemicalClasses.smarts,
      description: chemicalClasses.description,
      materialCount: count(materials.id),
    })
    .from(chemicalClasses)
    .leftJoin(
      materialChemicalClasses,
      eq(materialChemicalClasses.classSlug, chemicalClasses.slug)
    )
    .leftJoin(
      materials,
      and(
        eq(materialChemicalClasses.materialId, materials.id),
        isNull(materials.deletedAt)
      )
    )
    .groupBy(
      chemicalClasses.slug,
      chemicalClasses.name,
      chemicalClasses.smarts,
      chemicalClasses.description,
      chemicalClasses.sortOrder
    )
    .orderBy(asc(chemicalClasses.sortOrder), asc(chemicalClasses.slug))
}
