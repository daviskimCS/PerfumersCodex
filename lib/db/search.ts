import { and, desc, eq, sql } from 'drizzle-orm'

import { materials, searchQueries } from '@/db/schema'
import { db } from '@/lib/db'
import { materialIsPublished, materialIsPublishedAs } from '@/lib/db/published'
import { TRIGRAM_THRESHOLD } from '@/lib/search/rank'
import type { SearchCandidate } from '@/lib/search/types'

/**
 * Search data access (P2-E). Raw SQL lives here by design — this IS the
 * `lib/db/` layer (docs/architecture.md D1), and D2's boundary says SQL
 * returns *evidence* while TypeScript assigns *rank*. Nothing in this file
 * orders or tiers results; `lib/search/rank.ts` owns that.
 *
 * Editorial/public reads only, so the Drizzle client is correct here (the
 * user-data boundary does not apply — no user tables are touched).
 */

/**
 * Identity evidence for rule 0's short-circuit. A subset of `SearchCandidate`
 * on purpose: the pipeline (`lib/search/index.ts`) turns a hit into the single
 * tier-0 `SearchResult` — assigning the tier is TypeScript's job, not this
 * layer's (D2).
 */
export type CasMatch = Pick<
  SearchCandidate,
  'id' | 'slug' | 'canonicalName' | 'casNumber'
>

/**
 * Rule 0: exact match on the indexed `cas_number` column. The base table, not
 * the view — CAS numbers are deliberately absent from the tsvector
 * (docs/database-schema.md). Only a published material can match: soft-deleted
 * and unreviewed rows are excluded here (`materialIsPublished`).
 *
 * Expects an already-normalized query (`normalizeQuery` output).
 */
export async function findByCasNumber(cas: string): Promise<CasMatch | null> {
  const rows = await db
    .select({
      id: materials.id,
      slug: materials.slug,
      canonicalName: materials.canonicalName,
      casNumber: materials.casNumber,
    })
    .from(materials)
    .where(and(eq(materials.casNumber, cas), materialIsPublished()))
    // The schema does not force CAS uniqueness (the curated corpus treats it
    // as unique in practice); if duplicates ever exist, mirror rule 5's
    // most-recently-updated tie-break rather than returning an arbitrary row.
    .orderBy(desc(materials.updatedAt))
    .limit(1)

  return rows[0] ?? null
}

/** Row shape the candidate SQL emits, keyed exactly by its column aliases. */
interface CandidateRow extends Record<string, unknown> {
  id: string
  slug: string
  canonical_name: string
  cas_number: string | null
  exact_synonym_match: boolean
  matched_synonym: string | null
  synonym_prefix_match: boolean
  trigram_similarity: number
  ts_rank: number
  updated_at: Date | string
}

/**
 * D2 step 3: ONE round-trip returning evidence rows, capped at ~50, with no
 * ordering promise to the caller. Candidate generation is a union of three
 * legs:
 *
 * - `materials.canonical_name` (base table): a prefix match, or trigram `%`
 * - `material_synonyms.name` (base table): a prefix match, or trigram `%`
 * - full-text `@@` on `material_search_view.weighted_vector`
 *
 * The prefix half exists because trigrams cannot see it: "eth" shares three
 * of the sixteen trigrams it and "Ethyl vanillin" have between them, a
 * similarity of 0.19, so without its own leg rule 3's prefix match could never fire on a short
 * prefix of a long name — the ranker can only promote what SQL returned.
 * `ILIKE 'eth%'` is served by the same trigram GIN indexes (migration 0001)
 * from three characters up; one or two characters scan the published rows,
 * which stays cheap at the corpus sizes this project plans for.
 *
 * The trigram legs filter to published materials themselves. The view leg
 * does not (the view predates the review gate and knows only `deleted_at`),
 * so the final `WHERE` applies `materialIsPublished` to every candidate.
 *
 * The `%` operator is what lets the GIN index answer, and it reads the
 * session's `pg_trgm.similarity_threshold`. The explicit `similarity() >=`
 * beside it pins the floor to `TRIGRAM_THRESHOLD` in `lib/search/rank.ts`, so
 * the SQL admission rule and the TypeScript tier boundary are one constant,
 * whatever a pooled session's setting happens to be. (A session threshold
 * ABOVE 0.3 would still narrow the index's answer; nothing in this project
 * sets one, and the Postgres default is 0.3.)
 *
 * The tsquery side parses the query under both configs the vector was built
 * with, OR-ed: 'simple' lexemes reach the name/synonym weights verbatim and
 * 'english' stems reach the description weight (docs/database-schema.md).
 *
 * Expects an already-normalized query (`normalizeQuery` output).
 */
export async function fetchCandidates(
  normalizedQuery: string
): Promise<SearchCandidate[]> {
  const rows = await db.execute<CandidateRow>(sql`
    WITH params AS (
      SELECT
        ${normalizedQuery}::text AS q,
        ${likePrefixPattern(normalizedQuery)}::text AS prefix,
        ${TRIGRAM_THRESHOLD}::float4 AS min_similarity,
        (
          plainto_tsquery('simple', ${normalizedQuery}) ||
          plainto_tsquery('english', ${normalizedQuery})
        ) AS tsq
    ),
    candidate_ids AS (
      SELECT m.id
      FROM materials m, params p
      WHERE ${materialIsPublishedAs('m')}
        AND (
          m.canonical_name ILIKE p.prefix
          OR (
            m.canonical_name % p.q
            AND similarity(m.canonical_name, p.q) >= p.min_similarity
          )
        )
      UNION
      SELECT s.material_id
      FROM material_synonyms s
      JOIN materials m ON m.id = s.material_id AND ${materialIsPublishedAs('m')}
      CROSS JOIN params p
      WHERE s.name ILIKE p.prefix
        OR (s.name % p.q AND similarity(s.name, p.q) >= p.min_similarity)
      UNION
      SELECT v.id
      FROM material_search_view v, params p
      WHERE v.weighted_vector @@ p.tsq
    )
    SELECT
      m.id,
      m.slug,
      m.canonical_name,
      m.cas_number,
      coalesce(syn.exact_match, false) AS exact_synonym_match,
      syn.matched_name AS matched_synonym,
      coalesce(syn.prefix_match, false) AS synonym_prefix_match,
      greatest(
        similarity(m.canonical_name, p.q),
        coalesce(syn.best_similarity, 0)
      )::float8 AS trigram_similarity,
      coalesce(fts.rank, 0)::float8 AS ts_rank,
      m.updated_at
    FROM candidate_ids c
    JOIN materials m ON m.id = c.id
    CROSS JOIN params p
    LEFT JOIN LATERAL (
      -- The synonym aggregate mirrors normalizeQuery (lower, trim, collapse
      -- whitespace) so "the same query string" means the same thing on both
      -- sides of the SQL/TS boundary. matched_name keeps the stored casing
      -- for the UI ("matched: OTNE"); min() makes the pick deterministic if
      -- several synonyms normalize identically. prefix_match runs the same
      -- normalization, so it agrees with rank.ts's canonical-name prefix
      -- check (normalized name, then startsWith).
      SELECT
        bool_or(
          lower(regexp_replace(btrim(s.name), '[[:space:]]+', ' ', 'g')) = p.q
        ) AS exact_match,
        min(s.name) FILTER (
          WHERE
            lower(regexp_replace(btrim(s.name), '[[:space:]]+', ' ', 'g')) = p.q
        ) AS matched_name,
        bool_or(
          lower(regexp_replace(btrim(s.name), '[[:space:]]+', ' ', 'g'))
            LIKE p.prefix
        ) AS prefix_match,
        max(similarity(s.name, p.q)) AS best_similarity
      FROM material_synonyms s
      WHERE s.material_id = m.id
    ) syn ON true
    LEFT JOIN LATERAL (
      SELECT ts_rank(v.weighted_vector, p.tsq) AS rank
      FROM material_search_view v
      WHERE v.id = m.id
    ) fts ON true
    WHERE ${materialIsPublishedAs('m')}
    -- Cap-eviction policy only, NOT an ordering promise (D2): when more than
    -- 50 rows qualify, keep the strongest evidence. rankCandidates re-sorts.
    ORDER BY trigram_similarity DESC, ts_rank DESC, m.id
    LIMIT 50
  `)

  return rows.map(toCandidate)
}

function toCandidate(row: CandidateRow): SearchCandidate {
  return {
    id: row.id,
    slug: row.slug,
    canonicalName: row.canonical_name,
    casNumber: row.cas_number,
    exactSynonymMatch: row.exact_synonym_match,
    // The contract: null whenever exactSynonymMatch is false. The FILTER
    // clause already guarantees it; the guard keeps the invariant local.
    matchedSynonym: row.exact_synonym_match ? row.matched_synonym : null,
    synonymPrefixMatch: row.synonym_prefix_match,
    trigramSimilarity: Number(row.trigram_similarity),
    tsRank: Number(row.ts_rank),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  }
}

/**
 * `q%` as a LIKE pattern that matches `q` literally. A query is user input,
 * so `%` and `_` in it are characters to find, not wildcards: "50%" must not
 * mean "starts with 50". Backslash is LIKE's default escape character, so it
 * is escaped first.
 */
function likePrefixPattern(normalizedQuery: string): string {
  return `${normalizedQuery.replace(/[\\%_]/g, '\\$&')}%`
}

/**
 * D2 step 5's write. Privacy-deliberate on purpose: the table holds query +
 * result count only — no user_id, no IP, no session key (the schema has no
 * such columns by design). Callers pass the *normalized* query so the admin
 * "top searches" view aggregates cleanly.
 *
 * This function just inserts; never-fail/never-block is the pipeline's job
 * (`lib/search/index.ts` wraps it in `after()` + try/catch).
 */
export async function logSearchQuery(
  normalizedQuery: string,
  resultCount: number
): Promise<void> {
  await db.insert(searchQueries).values({ query: normalizedQuery, resultCount })
}
