/**
 * Pipeline-internal search types.
 *
 * Deliberately NOT in `lib/types.ts`: that file is the app-facing contract
 * (docs/architecture.md D3), and `SearchCandidate` never leaves the search
 * pipeline. D2 also marks the exact candidate columns as flexible, so keeping
 * them here means a Week 5 SQL adjustment is not a contract change. Pages and
 * components only ever see `SearchResult`.
 */

/**
 * One evidence row from the candidate fetch (`lib/db/search.ts`, P2-E).
 *
 * D2's boundary is "SQL returns *evidence*, TypeScript assigns *rank*". Every
 * field below is something Postgres can compute and a pure function cannot:
 * the synonym join, a pg_trgm similarity, a weighted `ts_rank`. Nothing here
 * is a tier — `rankCandidates` derives those.
 */
export interface SearchCandidate {
  id: string
  slug: string
  canonicalName: string
  casNumber: string | null

  /**
   * True when the normalized query equals one of this material's synonyms
   * verbatim (ranking rule 2). SQL-side because the synonym join lives there.
   */
  exactSynonymMatch: boolean

  /**
   * The synonym that matched, in its stored casing, so the UI can show
   * "matched: OTNE". Null whenever `exactSynonymMatch` is false.
   */
  matchedSynonym: string | null

  /**
   * Best pg_trgm `similarity()` of the query against the canonical name or
   * any synonym, 0–1. This is what serves rule 3 for the synonym side and
   * what gives typo tolerance ("galoxolide" still finds galaxolide) — FTS
   * alone cannot do either (database-schema.md, pg_trgm section).
   */
  trigramSimilarity: number

  /**
   * Weighted `ts_rank` over `material_search_view.weighted_vector`
   * (name = A > synonyms = B > description = C). 0 when the row did not match
   * the tsquery at all — a candidate can be here on trigram evidence alone.
   */
  tsRank: number

  /** `materials.updated_at` as an ISO string — ranking rule 5's tie-break. */
  updatedAt: string
}
