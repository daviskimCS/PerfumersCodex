import type { NextRequest } from 'next/server'

import { searchMaterials } from '@/lib/search'
import type { SearchResult } from '@/lib/types'

/**
 * The search endpoint the command palette talks to (W4-B / P2-F).
 *
 * Deliberately thin (docs/architecture.md D1/D2): parse `q`, hand it to the
 * pipeline, serialize the answer. No SQL, no ranking, no tier logic — the
 * whole point of `lib/search/index.ts` is that this handler and
 * `app/search/page.tsx` get identical results from identical input.
 *
 * NOT rate limited. That is the Week 18 Upstash pass (wave-4.md constraint 2),
 * recorded here so the gap is visible in the file it applies to rather than
 * only in a wave document.
 */

// Without this Next treats the handler as statically cacheable and the DB read
// happens at build time — and CI has no database. The deliberate caching pass
// (`cacheLife`/`cacheTag`) comes after seeding settles, not this wave.
export const dynamic = 'force-dynamic'

/**
 * The response body. Exported so the palette can `import type` it and the two
 * sides of the wire cannot drift apart silently — it is a type-only import, so
 * nothing from this module reaches the client bundle.
 */
export interface SearchResponse {
  /** Echoed back so a client can tell which query a response belongs to. */
  query: string
  results: SearchResult[]
}

/**
 * A query longer than this is not a search, and pg_trgm work grows with input
 * length. Truncated rather than rejected: the honest answer to a pasted
 * paragraph is the results for its beginning, not a 400.
 */
const MAX_QUERY_LENGTH = 200

export async function GET(request: NextRequest): Promise<Response> {
  const raw = request.nextUrl.searchParams.get('q') ?? ''
  const query = raw.slice(0, MAX_QUERY_LENGTH)

  // Empty or whitespace-only: answer without touching the database. The
  // pipeline guards this too (an empty normalized query returns early and is
  // not even logged), but stopping at the boundary means a keystroke-per-
  // request client cannot make an empty round-trip cost a connection.
  if (query.trim() === '') {
    return Response.json({ query, results: [] } satisfies SearchResponse)
  }

  const results = await searchMaterials(query)

  return Response.json({ query, results } satisfies SearchResponse, {
    // Private and uncached: search results reflect the live corpus, and the
    // query string is the user's, not something to leave in a shared cache.
    headers: { 'Cache-Control': 'no-store' },
  })
}
