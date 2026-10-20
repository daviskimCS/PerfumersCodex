import { and, asc, count, eq, isNotNull } from 'drizzle-orm'

import { materialComputedProperties, materials } from '@/db/schema'
import { db } from '@/lib/db'
import { materialIsPublished } from '@/lib/db/published'
import type { ComputedProperties, MaterialDetail } from '@/lib/types'

/**
 * The volatility map's one read (`app/volatility/page.tsx`).
 *
 * Every plotted value is already part of its own material's reviewed record:
 * `molecularWeight` is an identity scalar and `logp` is a computed property,
 * both inside `MaterialDetail` and so inside the fingerprint. The map adds no
 * field and needs no review of its own, which holds only while it reads
 * nothing else and only published rows (`materialIsPublished`, the stored
 * `content_hash` check every list uses). It must never be embedded on a
 * material page, where it would show other materials' data outside that
 * page's fingerprint.
 */

export type VolatilityPoint = Pick<MaterialDetail, 'slug' | 'canonicalName'> & {
  molecularWeight: number
  logp: number
  rdkitVersion: ComputedProperties['rdkitVersion']
}

export interface VolatilityMap {
  /** Ordered by molecular weight, lightest first, then name. */
  points: VolatilityPoint[]
  /** Every published material, plotted or not, so the page can say how many it left out. */
  publishedCount: number
}

export async function getVolatilityMap(): Promise<VolatilityMap> {
  const [rows, published] = await Promise.all([
    db
      .select({
        slug: materials.slug,
        canonicalName: materials.canonicalName,
        molecularWeight: materials.molecularWeight,
        logp: materialComputedProperties.logp,
        rdkitVersion: materialComputedProperties.rdkitVersion,
      })
      .from(materials)
      .innerJoin(
        materialComputedProperties,
        eq(materialComputedProperties.materialId, materials.id)
      )
      .where(
        and(
          materialIsPublished(),
          isNotNull(materials.smiles),
          isNotNull(materials.molecularWeight),
          isNotNull(materialComputedProperties.logp)
        )
      )
      .orderBy(asc(materials.molecularWeight), asc(materials.canonicalName)),
    db.select({ value: count() }).from(materials).where(materialIsPublished()),
  ])

  return {
    points: rows.flatMap((row) =>
      // Unreachable nulls — the WHERE above excludes them. The guard narrows
      // the types without an assertion.
      row.molecularWeight === null || row.logp === null
        ? []
        : [
            {
              slug: row.slug,
              canonicalName: row.canonicalName,
              molecularWeight: Number(row.molecularWeight),
              logp: Number(row.logp),
              rdkitVersion: row.rdkitVersion,
            },
          ]
    ),
    publishedCount: published[0]?.value ?? 0,
  }
}
