import { after } from 'next/server'

import {
  fetchCandidates,
  findByCasNumber,
  logSearchQuery,
} from '@/lib/db/search'
import { isCasNumber, normalizeQuery } from '@/lib/search/normalize'
import { rankCandidates } from '@/lib/search/rank'
import type { SearchResult } from '@/lib/types'

/**
 * The search pipeline (docs/architecture.md D2) — the public entry point.
 * The order is locked: normalize → CAS short-circuit → fetch candidates →
 * rank → log. One DB round-trip per search on the normal path keeps the
 * <150ms p95 budget honest.
 */
export async function searchMaterials(query: string): Promise<SearchResult[]> {
  // Step 1 — normalize (pure).
  const normalized = normalizeQuery(query)

  // An empty query has nothing to search and nothing to teach: it never
  // touches the database — not even the log, which exists to surface
  // synonym-table gaps ('' is not a gap).
  if (normalized === '') return []

  // Step 2 — rule 0's CAS short-circuit. A hit is the single tier-0 result;
  // a mistyped CAS number simply misses and falls through to the normal
  // pipeline (lib/search/normalize.ts does no check-digit arithmetic).
  if (isCasNumber(normalized)) {
    const match = await findByCasNumber(normalized)
    if (match !== null) {
      // CAS queries are logged too — they are exactly the synonym-gap /
      // usage signal search_queries exists for.
      scheduleLog(normalized, 1)
      return [{ ...match, matchTier: 0, matchedSynonym: null }]
    }
  }

  // Steps 3 + 4 — one round-trip of evidence, then the pure ranker.
  const candidates = await fetchCandidates(normalized)
  const results = rankCandidates(candidates, normalized)

  // Step 5 — log every query with its result count (0 = the to-do list for
  // the synonym table).
  scheduleLog(normalized, results.length)
  return results
}

/**
 * Fire the `search_queries` insert without ever failing or blocking the
 * search (D2 step 5).
 *
 * `after()` from next/server is the sanctioned post-response hook: a floating
 * promise is not, because the serverless freeze after the response is sent
 * can silently kill it mid-flight. The try/catch inside `record` swallows
 * insert failures — a broken log line must never surface as a search error.
 */
function scheduleLog(normalizedQuery: string, resultCount: number): void {
  const record = async (): Promise<void> => {
    try {
      await logSearchQuery(normalizedQuery, resultCount)
    } catch {
      // Swallowed by design: logging is observability, not correctness.
    }
  }

  try {
    after(record)
  } catch {
    // `after()` throws outside a request scope (unit tests, scripts). Degrade
    // to an immediate fire-and-forget — `record` handles its own failures.
    void record()
  }
}
