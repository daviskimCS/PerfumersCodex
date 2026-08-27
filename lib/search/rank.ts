import type { MatchTier, SearchResult } from '@/lib/types'
import type { SearchCandidate } from '@/lib/search/types'
import { normalizeQuery } from '@/lib/search/normalize'

/**
 * Ranking rules 1–5 (docs/database-schema.md, "Search ranking rules") as a
 * pure function — step 4 of the pipeline in docs/architecture.md D2.
 *
 * Pure means pure: no I/O, no `Date.now()`, no randomness, no mutation of the
 * argument. Everything the ranker needs, including `updatedAt`, arrives on the
 * candidate. That is what lets the gold set run with no database.
 */

/**
 * The tiers this function can assign.
 *
 * Tier 0 (CAS exact) is part of `MatchTier` because the *pipeline* returns it:
 * rule 0 is an exact lookup on the indexed `cas_number` column that
 * short-circuits before ranking runs (D2 step 2, lands with P2-E). The ranker
 * never sees that path, and this type says so.
 */
type RankedTier = Exclude<MatchTier, 0>

/**
 * Matches pg_trgm's default `pg_trgm.similarity_threshold`, so the tier
 * boundary here agrees with the `%` operator that produced the candidate set
 * in the first place. Change one and change the other.
 */
export const TRIGRAM_THRESHOLD = 0.3

interface ScoredCandidate {
  candidate: SearchCandidate
  tier: RankedTier
  score: number
}

export function rankCandidates(
  candidates: SearchCandidate[],
  normalizedQuery: string
): SearchResult[] {
  // An empty query has no evidence to match against. The guard also closes the
  // `''.startsWith` trap: every string is prefixed by the empty string, so
  // without this an empty query would return the entire corpus as tier 3.
  if (normalizedQuery.trim() === '') return []

  const scored: ScoredCandidate[] = []
  for (const candidate of candidates) {
    const tier = assignTier(candidate, normalizedQuery)
    // No tier means no rule matched. Drop it rather than pad the results with
    // a row we cannot justify: in a citation-driven reference an unexplained
    // hit is worse than a shorter list, and rule-0-to-4 misses are exactly the
    // signal `search_queries` is meant to surface.
    if (tier === null) continue
    scored.push({
      candidate,
      tier,
      score: scoreFor(candidate, normalizedQuery, tier),
    })
  }

  scored.sort(compareScored)

  // Dedupe to the best tier per material. The sort already put the strongest
  // evidence for each material first, so first-one-wins is the best one.
  const seen = new Set<string>()
  const results: SearchResult[] = []
  for (const entry of scored) {
    if (seen.has(entry.candidate.id)) continue
    seen.add(entry.candidate.id)
    results.push(toResult(entry))
  }
  return results
}

function assignTier(
  candidate: SearchCandidate,
  normalizedQuery: string
): RankedTier | null {
  // Rule 1 — exact canonical name.
  if (normalizeQuery(candidate.canonicalName) === normalizedQuery) return 1

  // Rule 2 — exact synonym. The join that proves it is SQL's job (D2).
  if (candidate.exactSynonymMatch) return 2

  // Rule 3 — prefix or trigram. The canonical-name prefix is checked here
  // because it is exact and free; synonym-side prefixes and typos arrive as
  // trigram similarity, which is what the pg_trgm indexes exist for.
  if (isPrefixMatch(candidate, normalizedQuery)) return 3
  if (candidate.trigramSimilarity >= TRIGRAM_THRESHOLD) return 3

  // Rule 4 — the remainder: matched the weighted tsvector.
  if (candidate.tsRank > 0) return 4

  return null
}

function scoreFor(
  candidate: SearchCandidate,
  normalizedQuery: string,
  tier: RankedTier
): number {
  switch (tier) {
    case 1:
    case 2:
      // Exact is exact. Nothing separates two exact hits, so ordering falls
      // through to rule 5's most-recently-updated tie-break.
      return 1
    case 3:
      // A prefix hit is stronger evidence than a fuzzy one, so it takes the
      // top of the tier ahead of trigram-only matches.
      return isPrefixMatch(candidate, normalizedQuery)
        ? 1
        : candidate.trigramSimilarity
    case 4:
      return candidate.tsRank
  }
}

function isPrefixMatch(
  candidate: SearchCandidate,
  normalizedQuery: string
): boolean {
  return normalizeQuery(candidate.canonicalName).startsWith(normalizedQuery)
}

/** Sort order: tier asc, score desc, `updatedAt` desc (rule 5), then id. */
function compareScored(a: ScoredCandidate, b: ScoredCandidate): number {
  if (a.tier !== b.tier) return a.tier - b.tier
  if (a.score !== b.score) return b.score - a.score

  const byUpdatedAt =
    toTimestamp(b.candidate.updatedAt) - toTimestamp(a.candidate.updatedAt)
  if (byUpdatedAt !== 0) return byUpdatedAt

  // The candidate fetch makes no ordering promise beyond its cap (D2 step 3),
  // so without a final deterministic key the same query could come back in a
  // different order run to run. Id is arbitrary but stable.
  if (a.candidate.id < b.candidate.id) return -1
  if (a.candidate.id > b.candidate.id) return 1
  return 0
}

/**
 * Compared as parsed instants rather than raw strings so a `Z` and a `+00:00`
 * timestamp for the same moment tie instead of sorting apart.
 */
function toTimestamp(iso: string): number {
  const parsed = Date.parse(iso)
  // Unparseable timestamps sort as the epoch — last among ties, and never
  // NaN, which would silently corrupt the comparator.
  return Number.isNaN(parsed) ? 0 : parsed
}

function toResult({ candidate, tier }: ScoredCandidate): SearchResult {
  return {
    id: candidate.id,
    slug: candidate.slug,
    canonicalName: candidate.canonicalName,
    casNumber: candidate.casNumber,
    matchTier: tier,
    // Only a tier-2 hit is *because of* a synonym. Carrying one on any other
    // tier would make the UI claim a match that did not decide the result.
    matchedSynonym: tier === 2 ? candidate.matchedSynonym : null,
  }
}
