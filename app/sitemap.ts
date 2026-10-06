import type { MetadataRoute } from 'next'

import { listFamilies } from '@/lib/db/families'
import { listPublishedMaterialSlugs } from '@/lib/db/materials'
import { env } from '@/lib/env'

// Read per request, like every page it lists: a build-time sitemap would need
// a live database in CI and would go stale the moment a material is
// published or hidden by the review gate.
export const dynamic = 'force-dynamic'

/**
 * Published materials and families only. Both reads go through the review
 * gate (`materialIsPublished`; families with no published member are dropped),
 * so a hidden material or a placeholder family never reaches a crawler.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [slugs, families] = await Promise.all([
    listPublishedMaterialSlugs(),
    listFamilies(),
  ])
  const url = (path: string) => new URL(path, env.NEXT_PUBLIC_SITE_URL).href

  return [
    { url: url('/') },
    { url: url('/materials') },
    { url: url('/structure') },
    ...families.map((family) => ({ url: url(`/families/${family.slug}`) })),
    ...slugs.map((slug) => ({ url: url(`/materials/${slug}`) })),
    { url: url('/privacy') },
    { url: url('/terms') },
  ]
}
