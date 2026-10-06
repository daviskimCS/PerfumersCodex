import type { Metadata } from 'next'
import Link from 'next/link'

import { HomeSearchButton } from '@/components/home-search'
import { Button } from '@/components/ui/button'
import { listFamilies } from '@/lib/db/families'
import { countMaterials } from '@/lib/db/materials'

/**
 * The homepage (W5-A / P2-H) — the real one, replacing the scaffold's
 * "under construction" placeholder.
 *
 * Four things and no more: what this is, a way into search, a way into the
 * taxonomy, and an honest count. The copy is `docs/overview.md`'s own
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
    body: 'Every fact links to its source. Nothing is scraped without attribution or generated.',
  },
  {
    title: 'Curated, not aggregated',
    body: 'Hand-selected materials, with descriptions written from the bench rather than compiled from catalogues.',
  },
  {
    title: 'Reviewed before it’s published',
    body: 'Nothing reaches the reference until it has been reviewed, and any later change takes it down until it is reviewed again.',
  },
]

export default async function HomePage() {
  const [materialCount, families] = await Promise.all([
    countMaterials(),
    listFamilies(),
  ])

  return (
    <div className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      <section className="max-w-measure">
        <h1 className="font-display text-4xl md:text-5xl">Perfumers Codex</h1>

        <p className="mt-6 text-lg text-muted-foreground">
          A curated, citation-driven aromachemical reference for working
          perfumers: one well-cited source of truth for the identity, safety
          data, olfactive character and usage of the aromachemicals and naturals
          used in modern perfumery.
        </p>

        {/* The honest number. An empty corpus says so rather than boasting
            about the citation discipline of nothing. */}
        <p className="mt-6 font-mono text-sm">
          {materialCount === 0 ? (
            <span className="text-muted-foreground">
              No materials published yet — every entry is researched, written,
              and cited by hand.
            </span>
          ) : (
            <>
              {materialCount} {materialCount === 1 ? 'material' : 'materials'},{' '}
              <span className="text-muted-foreground">every fact cited.</span>
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

      <section
        aria-labelledby="principles-heading"
        className="mt-section border-t border-border pt-8"
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
          className="mt-section border-t border-border pt-8"
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
