import type { MetadataRoute } from 'next'

import { env } from '@/lib/env'
import { listFamilies } from '@/lib/db/families'
import { listPublishedMaterialsForSitemap } from '@/lib/db/sitemap'

/**
 * sitemap.xml: the public pages a crawler should find.
 *
 * Rendered per request, never cached. A sitemap baked at build time would need
 * a database during `next build` (CI has none), and a cached one would keep
 * listing a material after a re-seed hid it from readers — the review gate
 * promises a changed page disappears at once (AGENTS.md).
 *
 * Material and family lists come from the same published-only reads the
 * pages use, so the sitemap never names anything a reader cannot open.
 * Search results, account pages and auth routes are left out on purpose.
 */
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.NEXT_PUBLIC_SITE_URL
  const url = (path: string) => new URL(path, base).toString()

  const [materials, families] = await Promise.all([
    listPublishedMaterialsForSitemap(),
    listFamilies(),
  ])

  return [
    { url: url('/'), changeFrequency: 'weekly', priority: 1 },
    { url: url('/materials'), changeFrequency: 'weekly', priority: 0.9 },
    ...materials.map((material) => ({
      url: url(`/materials/${material.slug}`),
      lastModified: material.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...families.map((family) => ({
      url: url(`/families/${family.slug}`),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    { url: url('/structure'), changeFrequency: 'monthly', priority: 0.5 },
    { url: url('/about'), changeFrequency: 'monthly', priority: 0.4 },
    { url: url('/privacy'), changeFrequency: 'yearly', priority: 0.2 },
    { url: url('/terms'), changeFrequency: 'yearly', priority: 0.2 },
  ]
}
