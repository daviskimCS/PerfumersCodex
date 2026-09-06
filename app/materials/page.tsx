import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { FlaskConical, SearchX } from 'lucide-react'

import { EmptyState } from '@/components/empty-state'
import {
  MaterialCard,
  MaterialCardGrid,
  MaterialCardSkeleton,
} from '@/components/material-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { listChemicalClasses } from '@/lib/db/chemical-classes'
import { listFamilies } from '@/lib/db/families'
import { DEFAULT_PAGE_SIZE, listMaterials } from '@/lib/db/materials'
import type { MaterialSort } from '@/lib/db/materials'

/**
 * The browse index (W5-A / P2-H).
 *
 * **The URL is the state.** Sort, the two filters (olfactive family and
 * structural class, which compose) and page all live in `searchParams` and
 * every control is a plain `<Link>`, so a filtered view is
 * a real address: sharable, bookmarkable, crawlable, and working with
 * scripting off. Nothing here fetches on the client.
 */

// Without this Next statically prerenders the segment and the DB query runs at
// build time, so `next build` starts depending on a live database (CI has
// none). The deliberate caching pass (`cacheLife`/`cacheTag`) comes after
// seeding settles — not this wave (wave-4.md, constraint 3).
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Materials',
  description:
    'Browse every material in the Perfumers Codex by name, by olfactive family, or by structural class.',
}

/** Label for each sort the URL accepts. Order here is the order rendered. */
const SORT_LABELS: Record<MaterialSort, string> = {
  name: 'Name',
  'recently-updated': 'Recently updated',
}

const DEFAULT_SORT: MaterialSort = 'name'

type RawSearchParams = Record<string, string | string[] | undefined>

interface BrowseQuery {
  sort: MaterialSort
  family: string | null
  /** The structural axis. Independent of `family`; the two compose. */
  class: string | null
  page: number
}

/** `?sort=a&sort=b` is not a thing a person types; take the first and move on. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/**
 * Parse leniently, never throw. A hand-mangled query string should show a
 * sensible page, not a 500 — the only values that survive unrecognised are the
 * family and class slugs, because an unknown one of either has to reach the
 * empty state rather than silently widen to the whole corpus.
 */
function readQuery(params: RawSearchParams): BrowseQuery {
  const sort = first(params.sort)
  const family = first(params.family)?.trim()
  const chemicalClass = first(params.class)?.trim()
  const page = Number(first(params.page))

  return {
    sort: sort === 'recently-updated' ? 'recently-updated' : DEFAULT_SORT,
    family: family !== undefined && family !== '' ? family : null,
    class:
      chemicalClass !== undefined && chemicalClass !== ''
        ? chemicalClass
        : null,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  }
}

/**
 * Build a browse URL, omitting defaults so the plain view stays `/materials`
 * and every state has exactly one address.
 */
function browseHref(query: BrowseQuery): string {
  const params = new URLSearchParams()
  if (query.sort !== DEFAULT_SORT) params.set('sort', query.sort)
  if (query.family !== null) params.set('family', query.family)
  if (query.class !== null) params.set('class', query.class)
  if (query.page > 1) params.set('page', String(query.page))

  const search = params.toString()
  return search === '' ? '/materials' : `/materials?${search}`
}

/**
 * Deliberately NOT async, and `searchParams` is passed down unawaited.
 *
 * Awaiting the promise here would suspend the page above its own
 * `<Suspense>`, and React would fall back to the nearest ancestor boundary —
 * `app/materials/loading.tsx`, which exists to stand in for the *detail*
 * route. Keeping this function synchronous is what guarantees the index
 * renders its own skeleton and the material page renders the detail one.
 */
export default function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  return (
    <div className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      <h1 className="text-3xl">Materials</h1>
      <p className="mt-3 max-w-measure text-muted-foreground">
        Every published entry, filterable by olfactive family and by structural
        class. Each one carries its sources.
      </p>

      {/* Static, so it renders with the heading rather than waiting behind the
          Suspense boundary below. The class row filters by the classes we
          precomputed; this is the escape hatch for the ones we did not. */}
      <p className="mt-3 max-w-measure text-sm text-muted-foreground">
        Looking for a pattern that isn&rsquo;t listed?{' '}
        <Link
          href="/structure"
          className="text-brand underline underline-offset-4 hover:no-underline"
        >
          Search by structure
        </Link>{' '}
        — type a SMARTS query and match it against every material with a known
        structure.
      </p>

      {/*
        The data-dependent half sits behind its own boundary rather than
        behind `loading.tsx`. Two reasons, and the second is the important
        one:

        1. the title above renders immediately on a cold load instead of
           waiting for the database;
        2. a segment-level `loading.tsx` here ALSO wraps `/materials/[slug]`
           (Next's loading.js "wraps page.js and any children below it"), so
           the index's skeleton would flash on every material page. See the
           note in loading.tsx — that file is now the material page's shield,
           and this boundary is the index's own skeleton.

        No `key`: on a filter change React holds the current rows until the
        new ones arrive rather than blanking to the skeleton, which is the
        calmer swap for a list that is mostly the same rows reordered.
      */}
      <Suspense fallback={<BrowseSkeleton />}>
        <Browse searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

/* ---------------------------------------------------------------------------
   The data-dependent half
   --------------------------------------------------------------------------- */

async function Browse({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const query = readQuery(await searchParams)

  const [{ items, total }, allFamilies, allClasses] = await Promise.all([
    listMaterials({
      sort: query.sort,
      familySlug: query.family,
      classSlug: query.class,
      page: query.page,
      pageSize: DEFAULT_PAGE_SIZE,
    }),
    listFamilies(),
    listChemicalClasses(),
  ])

  const pageCount = Math.max(Math.ceil(total / DEFAULT_PAGE_SIZE), 1)
  const activeFamily = allFamilies.find(
    (family) => family.slug === query.family
  )
  // Undefined for a slug that is not a class at all — the heading then says
  // only what it can vouch for, and the empty state below explains the rest.
  const activeClass = allClasses.find(
    (chemicalClass) => chemicalClass.slug === query.class
  )

  return (
    <>
      <Controls query={query} families={allFamilies} classes={allClasses} />

      {items.length === 0 ? (
        <EmptyResults query={query} total={total} />
      ) : (
        <section aria-labelledby="materials-results-heading" className="mt-8">
          <h2
            id="materials-results-heading"
            className="text-sm font-normal text-muted-foreground"
          >
            {total} {total === 1 ? 'material' : 'materials'}
            {activeFamily === undefined ? null : <> in {activeFamily.name}</>}
            {activeClass === undefined ? null : <> · {activeClass.name}</>}
            {pageCount > 1 ? (
              <>
                {' · '}page {query.page} of {pageCount}
              </>
            ) : null}
          </h2>

          <MaterialCardGrid className="mt-4">
            {items.map((material) => (
              <li key={material.id}>
                <MaterialCard material={material} />
              </li>
            ))}
          </MaterialCardGrid>

          <Pagination query={query} pageCount={pageCount} />
        </section>
      )}
    </>
  )
}

/* ---------------------------------------------------------------------------
   Controls — every one of them a link, so the browser does the work
   --------------------------------------------------------------------------- */

function Controls({
  query,
  families,
  classes,
}: {
  query: BrowseQuery
  families: Awaited<ReturnType<typeof listFamilies>>
  classes: Awaited<ReturnType<typeof listChemicalClasses>>
}) {
  return (
    <div className="mt-8 flex flex-col gap-4 border-y border-border py-4">
      <FilterRow label="Sort">
        {(Object.keys(SORT_LABELS) as MaterialSort[]).map((sort) => (
          <FilterLink
            key={sort}
            // Re-sorting from page 4 lands on page 4 of a different order,
            // which is nobody's intent — every control resets to page 1.
            href={browseHref({ ...query, sort, page: 1 })}
            active={sort === query.sort}
          >
            {SORT_LABELS[sort]}
          </FilterLink>
        ))}
      </FilterRow>

      {families.length > 0 ? (
        <FilterRow label="Family">
          <FilterLink
            href={browseHref({ ...query, family: null, page: 1 })}
            active={query.family === null}
          >
            All
          </FilterLink>
          {families.map((family) => (
            <FilterLink
              key={family.slug}
              href={browseHref({ ...query, family: family.slug, page: 1 })}
              active={family.slug === query.family}
            >
              {family.name}
              <span
                aria-hidden="true"
                className="text-muted-foreground tabular-nums"
              >
                {family.materialCount}
              </span>
            </FilterLink>
          ))}
        </FilterRow>
      ) : null}

      {/* The structural axis, beside the olfactive one rather than nested in
          it: the two are independent and compose, so a reader can hold both
          ("woody" AND "macrocyclic") and drop either without losing the
          other. Counts are rendered exactly as the family row renders them,
          zeroes included — `listChemicalClasses` returns classes the corpus
          does not yet exercise on purpose, and a "0" is a fact about the
          corpus rather than a broken control. */}
      {classes.length > 0 ? (
        <FilterRow label="Class">
          <FilterLink
            href={browseHref({ ...query, class: null, page: 1 })}
            active={query.class === null}
          >
            All
          </FilterLink>
          {classes.map((chemicalClass) => (
            <FilterLink
              key={chemicalClass.slug}
              href={browseHref({
                ...query,
                class: chemicalClass.slug,
                page: 1,
              })}
              active={chemicalClass.slug === query.class}
            >
              {chemicalClass.name}
              <span
                aria-hidden="true"
                className="text-muted-foreground tabular-nums"
              >
                {chemicalClass.materialCount}
              </span>
            </FilterLink>
          ))}
        </FilterRow>
      ) : null}
    </div>
  )
}

function FilterRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  const id = `filter-${label.toLowerCase()}`
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span
        id={id}
        className="text-2xs tracking-wide text-muted-foreground uppercase"
      >
        {label}
      </span>
      <ul aria-labelledby={id} className="flex flex-wrap items-center gap-1">
        {children}
      </ul>
    </div>
  )
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <li>
      <Button asChild variant={active ? 'secondary' : 'ghost'} size="lg">
        {/* aria-current="true" rather than "page": these change the current
            view, they are not links to a different page of the site. */}
        <Link href={href} aria-current={active ? 'true' : undefined}>
          {children}
        </Link>
      </Button>
    </li>
  )
}

function Pagination({
  query,
  pageCount,
}: {
  query: BrowseQuery
  pageCount: number
}) {
  if (pageCount <= 1) return null

  const previous = query.page > 1 ? query.page - 1 : null
  const next = query.page < pageCount ? query.page + 1 : null

  return (
    <nav
      aria-label="Pagination"
      className="mt-10 flex items-center justify-between gap-4 border-t border-border pt-6"
    >
      {/* Empty spans hold the ends of the row so the page counter stays
          centred whether or not both links exist. */}
      {previous === null ? (
        <span />
      ) : (
        <Button asChild variant="outline" size="lg">
          <Link href={browseHref({ ...query, page: previous })} rel="prev">
            Previous
          </Link>
        </Button>
      )}

      <p className="text-sm text-muted-foreground tabular-nums">
        Page {query.page} of {pageCount}
      </p>

      {next === null ? (
        <span />
      ) : (
        <Button asChild variant="outline" size="lg">
          <Link href={browseHref({ ...query, page: next })} rel="next">
            Next
          </Link>
        </Button>
      )}
    </nav>
  )
}

/* ---------------------------------------------------------------------------
   The four ways this list can be empty — all through the one EmptyState
   --------------------------------------------------------------------------- */

function EmptyResults({ query, total }: { query: BrowseQuery; total: number }) {
  // Past the last page. Reachable only by editing the URL, but a blank grid
  // there would look like a broken filter.
  if (total > 0) {
    return (
      <EmptyState
        className="mt-6"
        icon={SearchX}
        title="Nothing on this page"
        description="This page number is past the end of the list."
        action={
          <Button asChild variant="outline" size="lg">
            <Link href={browseHref({ ...query, page: 1 })}>
              Back to the first page
            </Link>
          </Button>
        }
      />
    )
  }

  // Class before family when both are set. Either message would be half-true
  // for a two-filter view, so the tie goes to the action that recovers the
  // most: clearing the class drops back to the family the reader chose, while
  // clearing the family would leave them staring at the class that emptied
  // the list. An unknown class slug lands here too — it matches nothing, and
  // "empty" is the honest answer rather than silently widening the corpus.
  if (query.class !== null) {
    return (
      <EmptyState
        className="mt-6"
        icon={SearchX}
        title="No materials in this class"
        description="Nothing published carries this structure — at least not with the other filters applied. The classes with entries are listed above, and a structure search will match patterns that aren't listed at all."
        action={
          <Button asChild variant="outline" size="lg">
            <Link href={browseHref({ ...query, class: null, page: 1 })}>
              Clear this class
            </Link>
          </Button>
        }
      />
    )
  }

  // A filter that matches nothing — an empty family, or a slug that is not a
  // family at all. Both are the same thing to a reader: this view is empty.
  if (query.family !== null) {
    return (
      <EmptyState
        className="mt-6"
        icon={SearchX}
        title="No materials in this family"
        description="Nothing has been published under this family yet. The families with entries are listed above."
        action={
          <Button asChild variant="outline" size="lg">
            <Link href={browseHref({ ...query, family: null, page: 1 })}>
              Show all materials
            </Link>
          </Button>
        }
      />
    )
  }

  // The honest state of a reference that is still being written — the corpus
  // is curated by hand and simply has no published entries yet.
  return (
    <EmptyState
      className="mt-6"
      icon={FlaskConical}
      title="The reference is being curated"
      description="Every entry is researched, written, and cited by hand, and the first materials haven't been published yet. Check back soon."
    />
  )
}

/* ---------------------------------------------------------------------------
   Skeleton — matches Browse block for block so the swap does not jump
   --------------------------------------------------------------------------- */

function BrowseSkeleton() {
  return (
    <>
      <div className="mt-8 flex flex-col gap-4 border-y border-border py-4">
        {/* Three control rows — sort, family, class: a label (text-2xs →
            1rem) plus buttons at h-9. */}
        {Array.from({ length: 3 }, (_, row) => (
          <div key={row} className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-32" />
          </div>
        ))}
      </div>

      <div className="mt-8">
        {/* The "N materials" line (text-sm → 1.25rem). */}
        <Skeleton className="h-5 w-40 max-w-full" />
        <MaterialCardGrid className="mt-4">
          {Array.from({ length: 6 }, (_, card) => (
            <li key={card}>
              <MaterialCardSkeleton />
            </li>
          ))}
        </MaterialCardGrid>
      </div>
    </>
  )
}
