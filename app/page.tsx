import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'

import { HomeSearchButton } from '@/components/home-search'
import {
  HomeStructure,
  HomeStructureFallback,
} from '@/components/home-structure'
import { MaterialCard, MaterialCardGrid } from '@/components/material-card'
import { Button } from '@/components/ui/button'
import { listFamilies } from '@/lib/db/families'
import {
  countMaterials,
  getRandomDrawnMaterialSlug,
  listMaterials,
} from '@/lib/db/materials'

/**
 * The homepage (W5-A / P2-H) — the real one, replacing the scaffold's
 * "under construction" placeholder.
 *
 * Five things and no more: what this is, a way into search, the latest
 * entries, a way into the taxonomy, and an honest count. Beside them, one published structure drawing
 * itself in (`components/home-structure.tsx`), the site's one image. The copy is `docs/overview.md`'s own
 * description with the self-praise trimmed; nothing here claims a capability
 * the corpus does not currently have, which is why the count line reads
 * differently while the reference is still empty.
 *
 * This retires the `px-6` gutter debt the scaffold left behind: the page now
 * uses the `gutter` tokens like every other page.
 */

// Without this Next statically prerenders the page and the count query runs at
// build time, so `next build` starts depending on a live database (CI has
// none). The deliberate caching pass (`cacheLife`/`cacheTag`) comes after
// seeding settles — not this wave (wave-4.md, constraint 3).
export const dynamic = 'force-dynamic'

// Title and description come from the root layout's defaults; this only
// pins the canonical URL.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

/**
 * From docs/overview.md's "What makes this different", limited to what is
 * true today: the open-source card returns when the repositories go public.
 */
const PRINCIPLES = [
  {
    title: 'Citation-driven',
    body: 'Identity, safety and IFRA facts link to their sources. Computed values name the software that computed them, and nothing is scraped without attribution.',
  },
  {
    title: 'Curated, not aggregated',
    body: 'Hand-selected materials. Descriptions, as they are written, come from the bench rather than from catalogues.',
  },
  {
    title: 'Reviewed before it’s published',
    body: 'Nothing reaches the reference until it has been reviewed, and any later change takes it down until it is reviewed again.',
  },
]

export default async function HomePage() {
  const [materialCount, families, structureSlug, latest] = await Promise.all([
    countMaterials(),
    listFamilies(),
    getRandomDrawnMaterialSlug(),
    listMaterials({
      sort: 'recently-updated',
      page: 1,
      pageSize: 3,
      withThumbnails: true,
    }),
  ])

  return (
    <div className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between md:gap-12">
        <section className="max-w-measure">
          <h1 className="font-display text-4xl md:text-5xl">Perfumers Codex</h1>

          <p className="mt-6 text-lg text-muted-foreground">
            A curated, cited reference for working perfumers: identity, IFRA
            limits, odor and sources for each aromachemical and natural, on one
            page.
          </p>

          {/* The honest number. An empty corpus says so rather than boasting
            about the citation discipline of nothing. */}
          <p className="mt-6 font-mono text-sm">
            {materialCount === 0 ? (
              <span className="text-muted-foreground">
                No materials published yet — every entry is researched from
                primary sources and reviewed by hand before it goes up.
              </span>
            ) : (
              <>
                {materialCount} {materialCount === 1 ? 'material' : 'materials'}
                ,{' '}
                <span className="text-muted-foreground">
                  every identity and safety fact cited.
                </span>
              </>
            )}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-2">
            <HomeSearchButton />
            <Button asChild variant="outline" size="lg">
              <Link href="/materials">Browse the reference</Link>
            </Button>
          </div>
        </section>

        {/* A random published structure drawing itself in. Hidden until
            something with a structure is published. */}
        {structureSlug === null ? null : (
          <Suspense fallback={<HomeStructureFallback />}>
            <HomeStructure slug={structureSlug} />
          </Suspense>
        )}
      </div>

      {/* A way into actual entries without searching first. The same card
          as every list; nothing renders until something is published. */}
      {latest.items.length === 0 ? null : (
        <section aria-labelledby="latest-heading" className="mt-section">
          <div className="flex items-baseline justify-between gap-4">
            <h2
              id="latest-heading"
              className="text-sm font-normal text-muted-foreground"
            >
              Recently updated
            </h2>
            <Link
              href="/materials?sort=recently-updated"
              className="text-sm text-brand underline underline-offset-4 hover:no-underline"
            >
              All materials
            </Link>
          </div>
          <MaterialCardGrid className="mt-4">
            {latest.items.map((material) => (
              <li key={material.id}>
                <MaterialCard
                  material={material}
                  structureSvg={latest.thumbnails.get(material.id) ?? null}
                />
              </li>
            ))}
          </MaterialCardGrid>
        </section>
      )}

      <section
        aria-labelledby="principles-heading"
        className="reveal mt-section border-t border-border pt-8"
      >
        <h2
          id="principles-heading"
          className="text-sm font-normal text-muted-foreground"
        >
          What makes this different
        </h2>
        <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-3">
          {PRINCIPLES.map((principle) => (
            <div key={principle.title}>
              <dt className="font-medium">{principle.title}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">
                {principle.body}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {families.length === 0 ? null : (
        <section
          aria-labelledby="families-heading"
          className="reveal mt-section border-t border-border pt-8"
        >
          <h2
            id="families-heading"
            className="text-sm font-normal text-muted-foreground"
          >
            Olfactive families
          </h2>
          <ul className="mt-4 flex flex-wrap items-center gap-1">
            {families.map((family) => (
              <li key={family.slug}>
                <Button asChild variant="ghost" size="lg">
                  <Link href={`/families/${family.slug}`}>
                    {family.name}
                    <span
                      aria-hidden="true"
                      className="text-muted-foreground tabular-nums"
                    >
                      {family.materialCount}
                    </span>
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
