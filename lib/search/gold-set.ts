/**
 * The search gold set (docs/architecture.md D5).
 *
 * Five real queries a working perfumer would type expecting the same material,
 * each arriving by a different route: canonical prefix, abbreviation, CAS
 * number, trade name, and an odour phrase that only the description carries.
 * They are the standing definition of "search works".
 *
 * Maintenance loop from database-schema.md: zero-result production queries get
 * *added* here as they surface. The synonym table is what usually has to
 * change to make a new case pass.
 */

/** Which layer of the pipeline decides a case. See `GOLD_SET` below. */
export type GoldSetLayer = 'rank' | 'pipeline'

export interface GoldSetCase {
  /** As typed by the user — un-normalized on purpose, so tests exercise that step. */
  query: string
  expectSlug: string
  /** Worst acceptable 1-based position of `expectSlug` in the results. */
  maxRank: number
  layer: GoldSetLayer
}

/**
 * Why `layer` exists — do not "simplify" it away.
 *
 * "54464-57-2" cannot be satisfied by `rankCandidates`. Tier 0 is an exact
 * lookup on the indexed `cas_number` column that short-circuits *before*
 * ranking runs (database-schema.md rule 0, architecture.md D2 step 2), so the
 * pure ranker has no path that produces it. Rather than drop the case or fake
 * a tier-0 candidate to satisfy a test, each entry names the layer that owns
 * it: `rank.test.ts` runs the `rank` cases against synthetic candidates and
 * skips the `pipeline` one, `normalize.test.ts` covers it where the decision
 * actually lives (`isCasNumber`), and P2-E asserts the lookup end to end.
 */
export const GOLD_SET: GoldSetCase[] = [
  // Prefix of the canonical name — the shorthand people actually type.
  { query: 'iso e', expectSlug: 'iso-e-super', maxRank: 1, layer: 'rank' },
  // Abbreviation synonym, upper-case as it is normally written.
  { query: 'OTNE', expectSlug: 'iso-e-super', maxRank: 1, layer: 'rank' },
  // CAS number — rule 0's short-circuit, owned by the pipeline.
  {
    query: '54464-57-2',
    expectSlug: 'iso-e-super',
    maxRank: 1,
    layer: 'pipeline',
  },
  // Trade-name synonym.
  { query: 'ambermax', expectSlug: 'iso-e-super', maxRank: 1, layer: 'rank' },
  // Odour phrase: no name matches at all, so this one rides on full text.
  { query: 'amber wood', expectSlug: 'iso-e-super', maxRank: 1, layer: 'rank' },
]
