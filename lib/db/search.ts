import { and, desc, eq, sql } from 'drizzle-orm'

import { materials, searchQueries } from '@/db/schema'
import { db } from '@/lib/db'
import { materialIsPublished, materialIsPublishedAs } from '@/lib/db/published'
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
  trigram_similarity: number
  ts_rank: number
  updated_at: Date | string
}

/**
 * D2 step 3: ONE round-trip returning evidence rows, capped at ~50, with no
 * ordering promise to the caller. Candidate generation is a union of three
 * legs:
 *
 * - trigram `%` on `materials.canonical_name` (base table)
 * - trigram `%` on `material_synonyms.name` (base table)
 * - full-text `@@` on `material_search_view.weighted_vector`
 *
 * The trigram legs filter to published materials themselves. The view leg
 * does not (the view predates the review gate and knows only `deleted_at`),
 * so the final `WHERE` applies `materialIsPublished` to every candidate.
 *
 * The `%` operator uses `pg_trgm.similarity_threshold`, which we leave at the
 * Postgres default of 0.3 — the same value as `TRIGRAM_THRESHOLD` in
 * `lib/search/rank.ts`. The SQL threshold and the TS tier boundary MUST
 * agree: change one and change the other (see the comment on the constant).
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
        (
          plainto_tsquery('simple', ${normalizedQuery}) ||
          plainto_tsquery('english', ${normalizedQuery})
        ) AS tsq
    ),
    candidate_ids AS (
      SELECT m.id
      FROM materials m, params p
      WHERE ${materialIsPublishedAs('m')} AND m.canonical_name % p.q
      UNION
      SELECT s.material_id
      FROM material_synonyms s
      JOIN materials m ON m.id = s.material_id AND ${materialIsPublishedAs('m')}
      CROSS JOIN params p
      WHERE s.name % p.q
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
      -- several synonyms normalize identically.
      SELECT
        bool_or(
          lower(regexp_replace(btrim(s.name), '[[:space:]]+', ' ', 'g')) = p.q
        ) AS exact_match,
        min(s.name) FILTER (
          WHERE
            lower(regexp_replace(btrim(s.name), '[[:space:]]+', ' ', 'g')) = p.q
        ) AS matched_name,
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
    trigramSimilarity: Number(row.trigram_similarity),
    tsRank: Number(row.ts_rank),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  }
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
