import type { Metadata } from 'next'
import Link from 'next/link'
import { Search, SearchX } from 'lucide-react'

import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { searchMaterials } from '@/lib/search'
import type { SearchResult } from '@/lib/types'

/**
 * The server-rendered results page (W4-B / P2-F).
 *
 * This is the sharable, no-JS half of search: `/search?q=…` is a real URL that
 * can be pasted into a message, and the form below is a plain GET form, so the
 * page works with scripting off. The palette in the header is the fast path,
 * not the only one — both call the same `searchMaterials` pipeline, so they can
 * never disagree about ranking.
 */

// Without this Next statically prerenders the segment and the DB query runs at
// build time, so `next build` starts depending on a live database (CI has
// none). The deliberate caching pass (`cacheLife`/`cacheTag`) comes after
// seeding settles — not this wave.
export const dynamic = 'force-dynamic'

/** Mirrors the cap in `app/api/search/route.ts` so both entry points agree. */
const MAX_QUERY_LENGTH = 200

type SearchPageProps = {
  searchParams: Promise<{ q?: string | string[] }>
}

/** `?q=a&q=b` is not a thing a person types; take the first and move on. */
function readQuery(params: { q?: string | string[] }): string {
  const raw = Array.isArray(params.q) ? (params.q[0] ?? '') : (params.q ?? '')
  return raw.slice(0, MAX_QUERY_LENGTH).trim()
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const query = readQuery(await searchParams)

  return {
    title: query === '' ? 'Search' : `Search: ${query}`,
    description:
      'Search the Perfumers Codex by name, trade name, or CAS number.',
    // A result page per query string is an unbounded set of thin pages. The
    // material pages are what belongs in an index.
    robots: { index: false },
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = readQuery(await searchParams)

  // An empty or whitespace-only query never reaches the database. (The
  // pipeline guards this too — belt and braces at the page boundary.)
  const results = query === '' ? [] : await searchMaterials(query)

  return (
    <div className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      <h1 className="text-3xl">Search</h1>

      {/*
        A plain GET form: no client JS, no server action, nothing to validate
        beyond what the pipeline already normalizes — so no Zod schema (D6 is
        about forms that mutate). `key` remounts it after a client-side
        navigation so the field shows the query actually being displayed.
      */}
      <form
        key={query}
        action="/search"
        method="get"
        role="search"
        className="mt-6 flex w-full max-w-measure items-center gap-2"
      >
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            name="q"
            defaultValue={query}
            maxLength={MAX_QUERY_LENGTH}
            placeholder="Search materials"
            aria-label="Search materials"
            autoComplete="off"
            spellCheck={false}
            className="h-9 pl-8"
          />
        </div>
        <Button type="submit" variant="outline" size="lg">
          Search
        </Button>
      </form>

      {query === '' ? (
        <EmptyState
          icon={Search}
          title="Search the reference"
          description="Look a material up by canonical name, trade name, IUPAC name, supplier name, or CAS number."
          action={
            <Button asChild variant="outline" size="lg">
              <Link href="/materials">Browse all materials</Link>
            </Button>
          }
        />
      ) : results.length === 0 ? (
        /*
          The genuinely-helpful no-results state. What it does NOT do is
          suggest alternative spellings: the data that would make a suggestion
          truthful (a synonym table with real coverage) does not exist yet, and
          a guessed suggestion in a citation-driven reference is worse than
          none. The zero-result rows in `search_queries` are the improvement
          loop instead.
        */
        <EmptyState
          icon={SearchX}
          title={`No results for “${query}”`}
          description={
            <>
              Trade names are written several different ways, so the spelling is
              worth a second look — or try the chemical name instead. A CAS
              number has to match exactly, hyphens included. The reference is
              also still being written by hand, so the entry may simply not be
              published yet.
            </>
          }
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button asChild variant="outline" size="lg">
                <Link href="/materials">Browse all materials</Link>
              </Button>
              <Button asChild variant="ghost" size="lg">
                <Link href="/">Go to the homepage</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <section aria-labelledby="search-results-heading" className="mt-10">
          <h2
            id="search-results-heading"
            className="text-sm font-normal text-muted-foreground"
          >
            {results.length} {results.length === 1 ? 'result' : 'results'} for{' '}
            <span className="text-foreground">“{query}”</span>
          </h2>

          <ul className="mt-4 divide-y divide-border border-y border-border">
            {results.map((result) => (
              <li key={result.id}>
                <Link
                  href={`/materials/${result.slug}`}
                  className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 py-3"
                >
                  <span className="min-w-0 flex-1 underline underline-offset-4 hover:no-underline">
                    {result.canonicalName}
                  </span>
                  <ResultMeta result={result} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/**
 * The rank-aware half of a result row — deliberately the same rules as the
 * palette's copy in `components/search-command.tsx`. It is duplicated rather
 * than shared because a shared component would be a third file, and this file
 * set is fixed for the item; if a third caller appears, factor it out then.
 *
 * Tier numbers are never shown. What the tier earns is the *reason* the row is
 * here: which synonym matched, or the CAS number that matched, set in the mono
 * face reserved for inherently monospaced data.
 */
function ResultMeta({ result }: { result: SearchResult }) {
  // The ranker's contract: matchedSynonym is non-null only on a tier-2 hit.
  if (result.matchedSynonym !== null) {
    return (
      <span className="shrink-0 text-xs text-muted-foreground">
        matched: {result.matchedSynonym}
      </span>
    )
  }

  if (result.matchTier === 0 && result.casNumber !== null) {
    return (
      <span className="shrink-0 font-mono text-xs text-muted-foreground">
        {result.casNumber}
      </span>
    )
  }

  return null
}
