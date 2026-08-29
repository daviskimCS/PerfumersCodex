import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  fetchCandidates,
  findByCasNumber,
  logSearchQuery,
} from '@/lib/db/search'
import { GOLD_SET } from '@/lib/search/gold-set'
import { searchMaterials } from '@/lib/search/index'
import type { SearchCandidate } from '@/lib/search/types'

/**
 * Pipeline-order tests with the DB module mocked (wave-3 W3-C): the CAS
 * short-circuit, the fall-through, and logging isolation. The live-DB half of
 * the gold set's pipeline case is the orchestrator's smoke test.
 *
 * `after()` from next/server throws outside a request scope here, which is
 * exactly the degradation path `scheduleLog` promises to handle — so these
 * tests also prove logging survives without a request context.
 */
vi.mock('@/lib/db/search', () => ({
  findByCasNumber: vi.fn(),
  fetchCandidates: vi.fn(),
  logSearchQuery: vi.fn(),
}))

const mockFindByCasNumber = vi.mocked(findByCasNumber)
const mockFetchCandidates = vi.mocked(fetchCandidates)
const mockLogSearchQuery = vi.mocked(logSearchQuery)

/** The one gold-set case the pipeline owns (see gold-set.ts on `layer`). */
const casGoldCases = GOLD_SET.filter((c) => c.layer === 'pipeline')

/**
 * Synthetic fixtures only, mirroring rank.test.ts: `iso-e-super` appears
 * because the gold set blesses it; everything else is obviously fake
 * ('Test Material Alpha', '00-00-0').
 */
function makeCandidate(
  overrides: Partial<SearchCandidate> = {}
): SearchCandidate {
  return {
    id: 'mat-alpha',
    slug: 'test-material-alpha',
    canonicalName: 'Test Material Alpha',
    casNumber: null,
    exactSynonymMatch: false,
    matchedSynonym: null,
    trigramSimilarity: 0,
    tsRank: 0,
    updatedAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFindByCasNumber.mockResolvedValue(null)
  mockFetchCandidates.mockResolvedValue([])
  mockLogSearchQuery.mockResolvedValue(undefined)
})

describe('searchMaterials — CAS short-circuit (rule 0)', () => {
  it('owns exactly one gold-set case', () => {
    expect(casGoldCases).toHaveLength(1)
  })

  it.each(casGoldCases)(
    'gold set: $query resolves to $expectSlug as the single tier-0 result',
    async (goldCase) => {
      mockFindByCasNumber.mockResolvedValue({
        id: 'mat-iso-e-super',
        slug: 'iso-e-super',
        canonicalName: 'Iso E Super',
        casNumber: goldCase.query,
      })

      const results = await searchMaterials(goldCase.query)

      const rank = results.findIndex((r) => r.slug === goldCase.expectSlug) + 1
      expect(rank).toBeGreaterThan(0)
      expect(rank).toBeLessThanOrEqual(goldCase.maxRank)

      expect(results).toEqual([
        {
          id: 'mat-iso-e-super',
          slug: 'iso-e-super',
          canonicalName: 'Iso E Super',
          casNumber: goldCase.query,
          matchTier: 0,
          matchedSynonym: null,
        },
      ])

      // The lookup got the normalized query, and the short-circuit really
      // short-circuited: no candidate fetch.
      expect(mockFindByCasNumber).toHaveBeenCalledExactlyOnceWith(
        goldCase.query
      )
      expect(mockFetchCandidates).not.toHaveBeenCalled()
    }
  )

  it('normalizes a messy CAS query before the lookup', async () => {
    mockFindByCasNumber.mockResolvedValue({
      id: 'mat-alpha',
      slug: 'test-material-alpha',
      canonicalName: 'Test Material Alpha',
      casNumber: '00-00-0',
    })

    await searchMaterials('  00-00-0  ')

    expect(mockFindByCasNumber).toHaveBeenCalledExactlyOnceWith('00-00-0')
  })

  it('falls through to fetch + rank on a CAS-form miss', async () => {
    mockFindByCasNumber.mockResolvedValue(null)
    // Trigram evidence only — proves the result went through rankCandidates
    // (tier 3), not through some CAS-path construction.
    mockFetchCandidates.mockResolvedValue([
      makeCandidate({ trigramSimilarity: 0.9 }),
    ])

    const results = await searchMaterials('00-00-0')

    expect(mockFindByCasNumber).toHaveBeenCalledExactlyOnceWith('00-00-0')
    expect(mockFetchCandidates).toHaveBeenCalledExactlyOnceWith('00-00-0')
    expect(results.map((r) => [r.slug, r.matchTier])).toEqual([
      ['test-material-alpha', 3],
    ])
  })

  it('never runs the CAS lookup for a non-CAS query', async () => {
    await searchMaterials('test material alpha')
    expect(mockFindByCasNumber).not.toHaveBeenCalled()
    expect(mockFetchCandidates).toHaveBeenCalledExactlyOnceWith(
      'test material alpha'
    )
  })
})

describe('searchMaterials — normal path', () => {
  it('normalizes the query before fetching and ranking', async () => {
    mockFetchCandidates.mockResolvedValue([makeCandidate()])

    const results = await searchMaterials('  Test   MATERIAL Alpha ')

    expect(mockFetchCandidates).toHaveBeenCalledExactlyOnceWith(
      'test material alpha'
    )
    // Exact canonical-name match → tier 1: the ranker really ran.
    expect(results.map((r) => [r.slug, r.matchTier])).toEqual([
      ['test-material-alpha', 1],
    ])
  })

  it('returns [] when no candidate survives ranking', async () => {
    // Zero-evidence rows are dropped by the ranker, not padded into results.
    mockFetchCandidates.mockResolvedValue([makeCandidate()])
    expect(await searchMaterials('nothing matches this')).toEqual([])
  })
})

describe('searchMaterials — empty queries', () => {
  it.each([[''], ['   '], ['\t\n']])(
    'returns [] for %j without touching the DB',
    async (query) => {
      expect(await searchMaterials(query)).toEqual([])
      expect(mockFindByCasNumber).not.toHaveBeenCalled()
      expect(mockFetchCandidates).not.toHaveBeenCalled()
      // Not even the log: an empty query carries no synonym-gap signal.
      expect(mockLogSearchQuery).not.toHaveBeenCalled()
    }
  )
})

describe('searchMaterials — logging', () => {
  it('logs the normalized query and count 1 on a CAS hit', async () => {
    mockFindByCasNumber.mockResolvedValue({
      id: 'mat-alpha',
      slug: 'test-material-alpha',
      canonicalName: 'Test Material Alpha',
      casNumber: '00-00-0',
    })

    await searchMaterials('  00-00-0 ')

    expect(mockLogSearchQuery).toHaveBeenCalledExactlyOnceWith('00-00-0', 1)
  })

  it('logs the normalized query and result count on the normal path', async () => {
    mockFetchCandidates.mockResolvedValue([
      makeCandidate(),
      makeCandidate({
        id: 'mat-beta',
        slug: 'test-material-beta',
        canonicalName: 'Test Material Beta',
        trigramSimilarity: 0.5,
      }),
    ])

    await searchMaterials('  Test   Material Alpha ')

    expect(mockLogSearchQuery).toHaveBeenCalledExactlyOnceWith(
      'test material alpha',
      2
    )
  })

  it('logs a zero-result query — the synonym-table to-do signal', async () => {
    mockFetchCandidates.mockResolvedValue([])
    await searchMaterials('no such material')
    expect(mockLogSearchQuery).toHaveBeenCalledExactlyOnceWith(
      'no such material',
      0
    )
  })

  it('still returns results when logging rejects', async () => {
    mockLogSearchQuery.mockRejectedValue(new Error('log insert failed'))
    mockFetchCandidates.mockResolvedValue([makeCandidate()])

    const results = await searchMaterials('test material alpha')

    expect(results).toHaveLength(1)
    expect(mockLogSearchQuery).toHaveBeenCalledExactlyOnceWith(
      'test material alpha',
      1
    )
  })

  it('still returns a CAS hit when logging throws synchronously', async () => {
    mockFindByCasNumber.mockResolvedValue({
      id: 'mat-alpha',
      slug: 'test-material-alpha',
      canonicalName: 'Test Material Alpha',
      casNumber: '00-00-0',
    })
    mockLogSearchQuery.mockImplementation(() => {
      throw new Error('log threw before returning a promise')
    })

    const results = await searchMaterials('00-00-0')

    expect(results.map((r) => r.matchTier)).toEqual([0])
  })
})
