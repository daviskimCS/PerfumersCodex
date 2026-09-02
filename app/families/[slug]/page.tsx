import { cache } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FlaskConical } from 'lucide-react'

import { EmptyState } from '@/components/empty-state'
import { MaterialCard, MaterialCardGrid } from '@/components/material-card'
import { Button } from '@/components/ui/button'
import { getFamilyBySlug, listFamilies } from '@/lib/db/families'
import { DEFAULT_PAGE_SIZE, listMaterials } from '@/lib/db/materials'

/**
 * One olfactive family (W5-A / P2-H).
 *
 * The discovery surface for the taxonomy: what this family is, where it sits
 * in the hierarchy, what is in it, and how to get to the neighbouring
 * families. The *paginated, sortable* view of the same set is the index at
 * `/materials?family=<slug>` — this page shows the first page and hands off
 * rather than growing a second set of controls that could disagree with it.
 *
 * There is no family description anywhere here on purpose: the `families`
 * table has no such column (docs/database-schema.md), so a slot for one would
 * be a promise the data cannot keep.
 */

// Without this Next statically prerenders the route and the DB query runs at
// build time, so `next build` starts depending on a live database (CI has
// none). The deliberate caching pass (`cacheLife`/`cacheTag`) comes after
// seeding settles — not this wave (wave-4.md, constraint 3).
export const dynamic = 'force-dynamic'

interface FamilyRouteProps {
  params: Promise<{ slug: string }>
}

// generateMetadata and the page body both need the family; React's cache()
// dedupes them to one DB read per request.
const getFamily = cache(getFamilyBySlug)

export async function generateMetadata({
  params,
}: FamilyRouteProps): Promise<Metadata> {
  const { slug } = await params
  const family = await getFamily(slug)
  // No notFound() here — the page below owns that decision, and metadata for
  // a page that is about to 404 is never read.
  if (!family) return {}

  const description = `Materials in the ${family.name} olfactive family — every entry in the Perfumers Codex carrying it, each one cited.`

  return {
    // Exercises the root layout's title.template ("%s · Perfumers Codex").
    title: family.name,
    description,
    alternates: { canonical: `/families/${family.slug}` },
    openGraph: {
      type: 'website',
      title: family.name,
      description,
      url: `/families/${family.slug}`,
    },
    twitter: { card: 'summary', title: family.name, description },
  }
}

export default async function FamilyPage({ params }: FamilyRouteProps) {
  const { slug } = await params
  const family = await getFamily(slug)
  // A wrong slug is a 404, not an error state (docs/architecture.md D4).
  if (!family) notFound()

  const [{ items, total }, allFamilies] = await Promise.all([
    listMaterials({
      familySlug: family.slug,
      sort: 'name',
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    }),
    listFamilies(),
  ])

  const parent =
    family.parentSlug === null
      ? undefined
      : allFamilies.find((other) => other.slug === family.parentSlug)
  const children = allFamilies.filter(
    (other) => other.parentSlug === family.slug
  )
  const others = allFamilies.filter((other) => other.slug !== family.slug)

  return (
    <article className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      <header>
        <Link
          href="/materials"
          className="font-mono text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Materials
        </Link>

        <p className="mt-6 font-mono text-xs tracking-widest text-muted-foreground uppercase">
          Olfactive family
        </p>

        <h1 className="mt-3 font-display text-3xl md:text-4xl">
          {family.name}
        </h1>

        {parent === undefined ? null : (
          <p className="mt-4 text-sm text-muted-foreground">
            Sub-family of{' '}
            <Link
              href={`/families/${parent.slug}`}
              className="text-foreground underline underline-offset-4 hover:no-underline"
            >
              {parent.name}
            </Link>
          </p>
        )}

        {children.length === 0 ? null : (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-sm text-muted-foreground">Sub-families</span>
            <ul className="flex flex-wrap items-center gap-1">
              {children.map((child) => (
                <li key={child.slug}>
                  <Button asChild variant="ghost" size="lg">
                    <Link href={`/families/${child.slug}`}>
                      {child.name}
                      <span
                        aria-hidden="true"
                        className="text-muted-foreground tabular-nums"
                      >
                        {child.materialCount}
                      </span>
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </header>

      <section aria-labelledby="family-materials-heading" className="mt-12">
        <h2
          id="family-materials-heading"
          className="text-sm font-normal text-muted-foreground"
        >
          {total} {total === 1 ? 'material' : 'materials'}
        </h2>

        {items.length === 0 ? (
          <EmptyState
            className="mt-6"
            icon={FlaskConical}
            title="Nothing published here yet"
            description="This family is part of the taxonomy, but no material has been written up under it so far."
            action={
              <Button asChild variant="outline" size="lg">
                <Link href="/materials">Browse all materials</Link>
              </Button>
            }
          />
        ) : (
          <>
            <MaterialCardGrid className="mt-4">
              {items.map((material) => (
                <li key={material.id}>
                  <MaterialCard material={material} />
                </li>
              ))}
            </MaterialCardGrid>

            {/* Sorting and paging live on the index, so a family with more
                than one page hands off rather than growing its own controls
                that could rank the same set differently. */}
            {total > items.length ? (
              <div className="mt-8">
                <Button asChild variant="outline" size="lg">
                  <Link href={`/materials?family=${family.slug}`}>
                    See all {total} in the index
                  </Link>
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>

      {others.length === 0 ? null : (
        <nav
          aria-labelledby="other-families-heading"
          className="mt-16 border-t border-border pt-8"
        >
          <h2
            id="other-families-heading"
            className="text-sm font-normal text-muted-foreground"
          >
            Browse another family
          </h2>
          <ul className="mt-4 flex flex-wrap items-center gap-1">
            {others.map((other) => (
              <li key={other.slug}>
                <Button asChild variant="ghost" size="lg">
                  <Link href={`/families/${other.slug}`}>
                    {other.name}
                    <span
                      aria-hidden="true"
                      className="text-muted-foreground tabular-nums"
                    >
                      {other.materialCount}
                    </span>
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </article>
  )
}
