import { asc } from 'drizzle-orm'

import { materials } from '@/db/schema'
import { db } from '@/lib/db'
import { materialIsPublished } from '@/lib/db/published'

/**
 * The one read `app/sitemap.ts` needs: every published material's slug and
 * when it last changed.
 *
 * Published means the review gate's predicate (`materialIsPublished`), the
 * same as every other public read. A sitemap that listed a hidden slug would
 * hand its name to every crawler, which is the leak the gate exists to stop.
 */
export interface SitemapMaterial {
  slug: string
  updatedAt: Date
}

export async function listPublishedMaterialsForSitemap(): Promise<
  SitemapMaterial[]
> {
  return db
    .select({ slug: materials.slug, updatedAt: materials.updatedAt })
    .from(materials)
    .where(materialIsPublished())
    .orderBy(asc(materials.slug))
}
