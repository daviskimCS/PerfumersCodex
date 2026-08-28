import { describe, expect, it } from 'vitest'
import { TRIGRAM_THRESHOLD, rankCandidates } from '@/lib/search/rank'
import { normalizeQuery } from '@/lib/search/normalize'
import { GOLD_SET } from '@/lib/search/gold-set'
import type { SearchCandidate } from '@/lib/search/types'

const UPDATED_AT = '2026-01-15T00:00:00.000Z'

/**
 * Synthetic candidates only. The distractors are deliberately fake materials —
 * inventing a plausible-looking aromachemical would put a fact in the repo
 * that nobody cited. `iso-e-super` appears because the gold set names it.
 */
function makeCandidate(
  overrides: Partial<SearchCandidate> = {}
): SearchCandidate {
  return {
    id: 'mat-alpha',
    slug: 'test-material-alpha',
    canonicalName: 'Test Material Alpha',
    // The ranker never reads casNumber — rule 0 is the pipeline's job — so
    // fixtures leave it null except where pass-through is asserted.
    casNumber: null,
    exactSynonymMatch: false,
    matchedSynonym: null,
    trigramSimilarity: 0,
    tsRank: 0,
    updatedAt: UPDATED_AT,
    ...overrides,
  }
}

function makeBeta(overrides: Partial<SearchCandidate> = {}): SearchCandidate {
  return makeCandidate({
    id: 'mat-beta',
    slug: 'test-material-beta',
    canonicalName: 'Test Material Beta',
    ...overrides,
  })
}

function makeTarget(overrides: Partial<SearchCandidate> = {}): SearchCandidate {
  return makeCandidate({
    id: 'mat-iso-e-super',
    slug: 'iso-e-super',
    canonicalName: 'Iso E Super',
    ...overrides,
  })
}

describe('rankCandidates — tier assignment', () => {
  it('assigns tier 1 to an exact canonical-name match', () => {
    const results = rankCandidates([makeTarget()], 'iso e super')
    expect(results.map((r) => r.matchTier)).toEqual([1])
  })

  it('assigns tier 2 to an exact synonym match', () => {
    const candidate = makeTarget({
      exactSynonymMatch: true,
      matchedSynonym: 'OTNE',
    })
    expect(rankCandidates([candidate], 'otne').map((r) => r.matchTier)).toEqual(
      [2]
    )
  })

  it('assigns tier 3 to a canonical-name prefix match', () => {
    expect(
      rankCandidates([makeTarget()], 'iso e').map((r) => r.matchTier)
    ).toEqual([3])
  })

  it('assigns tier 3 at the trigram threshold', () => {
    const candidate = makeTarget({ trigramSimilarity: TRIGRAM_THRESHOLD })
    expect(
      rankCandidates([candidate], 'not a prefix').map((r) => r.matchTier)
    ).toEqual([3])
  })

  it('falls to tier 4 when trigram similarity is below the threshold', () => {
    const candidate = makeTarget({
      trigramSimilarity: TRIGRAM_THRESHOLD - 0.01,
      tsRank: 0.4,
    })
    expect(
      rankCandidates([candidate], 'not a prefix').map((r) => r.matchTier)
    ).toEqual([4])
  })

  it('assigns tier 4 to a full-text-only match', () => {
    const candidate = makeTarget({ tsRank: 0.2 })
    expect(
      rankCandidates([candidate], 'not a prefix').map((r) => r.matchTier)
    ).toEqual([4])
  })

  it('prefers the strongest rule when several apply', () => {
    // A material can satisfy rules 1–4 at once; the earliest rule wins.
    const candidate = makeTarget({
      exactSynonymMatch: true,
      matchedSynonym: 'Ignored Synonym',
      trigramSimilarity: 1,
      tsRank: 1,
    })
    expect(
      rankCandidates([candidate], 'iso e super').map((r) => r.matchTier)
    ).toEqual([1])
  })

  it('drops a candidate no rule matches', () => {
    // SQL should not return one, but a zero-evidence row must never be shown
    // as a result we cannot explain.
    expect(rankCandidates([makeTarget()], 'nothing matches this')).toEqual([])
  })

  it('never assigns tier 0 — the CAS short-circuit is the pipeline’s', () => {
    const candidate = makeTarget({
      casNumber: '00-00-0',
      exactSynonymMatch: true,
      matchedSynonym: 'Test Synonym',
      trigramSimilarity: 1,
      tsRank: 1,
    })
    for (const query of ['iso e super', 'otne', 'iso e', '00-00-0']) {
      for (const result of rankCandidates([candidate], query)) {
        expect(result.matchTier).not.toBe(0)
      }
    }
  })
})

describe('rankCandidates — result shape', () => {
  it('populates matchedSynonym on tier-2 hits', () => {
    const candidate = makeTarget({
      exactSynonymMatch: true,
      matchedSynonym: 'OTNE',
    })
    expect(rankCandidates([candidate], 'otne')[0].matchedSynonym).toBe('OTNE')
  })

  it('clears matchedSynonym on hits that did not come via a synonym', () => {
    const candidate = makeTarget({ matchedSynonym: 'OTNE', tsRank: 0.5 })
    expect(
      rankCandidates([candidate], 'iso e super')[0].matchedSynonym
    ).toBeNull()
    expect(rankCandidates([candidate], 'iso e')[0].matchedSynonym).toBeNull()
    expect(
      rankCandidates([candidate], 'not a prefix')[0].matchedSynonym
    ).toBeNull()
  })

  it('passes identity fields through unchanged', () => {
    const candidate = makeTarget({ casNumber: '00-00-0' })
    expect(rankCandidates([candidate], 'iso e super')).toEqual([
      {
        id: 'mat-iso-e-super',
        slug: 'iso-e-super',
        canonicalName: 'Iso E Super',
        casNumber: '00-00-0',
        matchTier: 1,
        matchedSynonym: null,
      },
    ])
  })
})

describe('rankCandidates — sort order', () => {
  it('orders by tier before score', () => {
    const weakerTier = makeCandidate({ tsRank: 0.99 }) // tier 4
    const strongerTier = makeBeta({ trigramSimilarity: 0.31 }) // tier 3
    const results = rankCandidates(
      [weakerTier, strongerTier],
      'not a prefix of either'
    )
    expect(results.map((r) => r.slug)).toEqual([
      'test-material-beta',
      'test-material-alpha',
    ])
  })

  it('orders by score descending within a tier', () => {
    const low = makeCandidate({ tsRank: 0.1 })
    const high = makeBeta({ tsRank: 0.9 })
    const results = rankCandidates([low, high], 'not a prefix of either')
    expect(results.map((r) => r.slug)).toEqual([
      'test-material-beta',
      'test-material-alpha',
    ])
  })

  it('ranks a prefix hit above a trigram-only hit inside tier 3', () => {
    const trigramOnly = makeCandidate({ trigramSimilarity: 0.95 })
    const prefix = makeTarget()
    const results = rankCandidates([trigramOnly, prefix], 'iso e')
    expect(results.map((r) => r.slug)).toEqual([
      'iso-e-super',
      'test-material-alpha',
    ])
  })

  it('breaks a score tie by most recently updated (rule 5)', () => {
    const older = makeCandidate({
      tsRank: 0.5,
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    const newer = makeBeta({
      tsRank: 0.5,
      updatedAt: '2026-06-01T00:00:00.000Z',
    })
    const results = rankCandidates([older, newer], 'not a prefix of either')
    expect(results.map((r) => r.slug)).toEqual([
      'test-material-beta',
      'test-material-alpha',
    ])
  })

  it('compares timestamps as instants, not as strings', () => {
    // Same moment, two ISO spellings: they must tie and fall through to the
    // deterministic id tie-break rather than sort by character order.
    const withOffset = makeCandidate({
      id: 'mat-a',
      slug: 'test-material-a',
      tsRank: 0.5,
      updatedAt: '2026-03-01T00:00:00+00:00',
    })
    const withZ = makeCandidate({
      id: 'mat-b',
      slug: 'test-material-b',
      tsRank: 0.5,
      updatedAt: '2026-03-01T00:00:00.000Z',
    })
    const results = rankCandidates([withZ, withOffset], 'not a prefix')
    expect(results.map((r) => r.id)).toEqual(['mat-a', 'mat-b'])
  })

  it('is independent of the order the candidates arrive in', () => {
    // The candidate fetch promises no ordering (architecture.md D2 step 3).
    const candidates = [
      makeCandidate({ id: 'mat-c', slug: 'test-material-c', tsRank: 0.5 }),
      makeCandidate({ id: 'mat-a', slug: 'test-material-a', tsRank: 0.5 }),
      makeCandidate({ id: 'mat-b', slug: 'test-material-b', tsRank: 0.5 }),
    ]
    const forward = rankCandidates(candidates, 'not a prefix')
    const reversed = rankCandidates([...candidates].reverse(), 'not a prefix')
    expect(forward.map((r) => r.id)).toEqual(['mat-a', 'mat-b', 'mat-c'])
    expect(reversed).toEqual(forward)
  })
})

describe('rankCandidates — dedupe', () => {
  it('keeps one row per material, at its best tier', () => {
    // The candidate fetch can emit a material more than once (e.g. one row per
    // matching synonym); the user must see it once.
    const viaFullText = makeTarget({ tsRank: 0.9 })
    const viaSynonym = makeTarget({
      exactSynonymMatch: true,
      matchedSynonym: 'OTNE',
    })
    const results = rankCandidates([viaFullText, viaSynonym], 'otne')
    expect(results).toHaveLength(1)
    expect(results[0].matchTier).toBe(2)
    expect(results[0].matchedSynonym).toBe('OTNE')
  })

  it('keeps distinct materials that share a tier', () => {
    const results = rankCandidates(
      [makeCandidate({ tsRank: 0.5 }), makeBeta({ tsRank: 0.4 })],
      'not a prefix of either'
    )
    expect(results.map((r) => r.id)).toEqual(['mat-alpha', 'mat-beta'])
  })
})

describe('rankCandidates — edge cases', () => {
  it('returns nothing for an empty query', () => {
    // Guards the `''.startsWith` trap: without it every candidate would come
    // back as a tier-3 prefix match.
    expect(rankCandidates([makeTarget(), makeCandidate()], '')).toEqual([])
  })

  it('returns nothing for a whitespace-only query', () => {
    // `normalizeQuery` already collapses this to '', but the ranker must not
    // depend on the caller having done it.
    expect(rankCandidates([makeTarget()], '   ')).toEqual([])
  })

  it('returns nothing when there are no candidates', () => {
    expect(rankCandidates([], 'iso e super')).toEqual([])
  })

  it('matches an exact name through mixed case and messy whitespace', () => {
    const query = normalizeQuery('  ISO   E   Super  ')
    expect(
      rankCandidates([makeTarget()], query).map((r) => r.matchTier)
    ).toEqual([1])
  })

  it('normalizes the candidate name too, not just the query', () => {
    const candidate = makeTarget({ canonicalName: ' Iso  E   Super ' })
    expect(
      rankCandidates([candidate], normalizeQuery('Iso E Super')).map(
        (r) => r.matchTier
      )
    ).toEqual([1])
  })
})

describe('rankCandidates — purity', () => {
  const candidates = [
    makeTarget({ tsRank: 0.5 }),
    makeCandidate({ trigramSimilarity: 0.9 }),
  ]

  it('does not mutate its arguments', () => {
    const snapshot = structuredClone(candidates)
    rankCandidates(candidates, 'iso e')
    expect(candidates).toEqual(snapshot)
  })

  it('returns the same output for the same input', () => {
    expect(rankCandidates(candidates, 'iso e')).toEqual(
      rankCandidates(candidates, 'iso e')
    )
  })
})

/**
 * Synthetic candidate sets for the gold set, one per `layer: 'rank'` case.
 *
 * Each includes a distractor that would win under a naive scheme — a strong
 * full-text hit against a prefix hit, a strong trigram hit against an exact
 * synonym — so the assertion is about tier precedence, not about the target
 * being the only row in the array.
 */
const GOLD_SET_CANDIDATES: Record<string, SearchCandidate[]> = {
  // Prefix of the canonical name (tier 3) must beat a strong full-text hit.
  'iso e': [
    makeCandidate({ tsRank: 0.95 }),
    makeTarget({ trigramSimilarity: 0.4 }),
  ],
  // Abbreviation synonym (tier 2) must beat a strong trigram hit.
  OTNE: [
    makeCandidate({ trigramSimilarity: 0.9, tsRank: 0.9 }),
    makeTarget({ exactSynonymMatch: true, matchedSynonym: 'OTNE' }),
  ],
  // Trade-name synonym (tier 2), same shape.
  ambermax: [
    makeCandidate({ trigramSimilarity: 0.85 }),
    makeTarget({ exactSynonymMatch: true, matchedSynonym: 'Ambermax' }),
  ],
  // Odour phrase: nothing but full text matches, so tier 4 on ts_rank alone.
  'amber wood': [
    makeCandidate({ tsRank: 0.31 }),
    makeBeta({ tsRank: 0.05 }),
    makeTarget({ tsRank: 0.62 }),
  ],
}

describe('gold set', () => {
  const rankCases = GOLD_SET.filter((c) => c.layer === 'rank')

  it('still holds the five Week 5 cases, split by owning layer', () => {
    expect(GOLD_SET).toHaveLength(5)
    expect(rankCases).toHaveLength(4)
    expect(GOLD_SET.filter((c) => c.layer === 'pipeline')).toHaveLength(1)
    expect(GOLD_SET.every((c) => c.expectSlug === 'iso-e-super')).toBe(true)
  })

  it.each(rankCases)(
    '$query returns $expectSlug within rank $maxRank',
    (goldCase) => {
      const candidates = GOLD_SET_CANDIDATES[goldCase.query]
      expect(
        candidates,
        `no synthetic candidates defined for "${goldCase.query}"`
      ).toBeDefined()

      const results = rankCandidates(candidates, normalizeQuery(goldCase.query))
      const rank = results.findIndex((r) => r.slug === goldCase.expectSlug) + 1

      expect(
        rank,
        `${goldCase.expectSlug} missing from results`
      ).toBeGreaterThan(0)
      expect(rank).toBeLessThanOrEqual(goldCase.maxRank)
    }
  )
})
