import { describe, expect, it } from 'vitest'
import { isCasNumber, normalizeQuery } from '@/lib/search/normalize'
import { GOLD_SET } from '@/lib/search/gold-set'

describe('normalizeQuery', () => {
  it('trims, lowercases, and collapses internal whitespace', () => {
    expect(normalizeQuery('  Iso   E   Super  ')).toBe('iso e super')
  })

  it('collapses tabs and newlines, not just spaces', () => {
    expect(normalizeQuery('iso\te\n\nsuper')).toBe('iso e super')
  })

  it('returns an empty string for an empty query', () => {
    expect(normalizeQuery('')).toBe('')
  })

  it('returns an empty string for a whitespace-only query', () => {
    expect(normalizeQuery('   \t\n  ')).toBe('')
  })

  it('leaves an already-normalized query untouched', () => {
    expect(normalizeQuery('iso e super')).toBe('iso e super')
  })

  it('is idempotent', () => {
    const once = normalizeQuery('  MIXED   Case  Query ')
    expect(normalizeQuery(once)).toBe(once)
  })

  it('normalizes every gold-set query to a non-empty string', () => {
    for (const goldCase of GOLD_SET) {
      expect(normalizeQuery(goldCase.query)).not.toBe('')
    }
  })
})

describe('isCasNumber', () => {
  /**
   * The gold set's CAS case is owned by the pipeline, not by `rankCandidates`
   * (see the comment in gold-set.ts). This is the layer that actually decides
   * it, so this is where the case is covered.
   */
  it('recognizes the gold-set CAS query', () => {
    const casCases = GOLD_SET.filter((c) => c.layer === 'pipeline')
    expect(casCases).toHaveLength(1)
    for (const goldCase of casCases) {
      expect(isCasNumber(normalizeQuery(goldCase.query))).toBe(true)
    }
    expect(isCasNumber('54464-57-2')).toBe(true)
  })

  it('accepts the shortest and longest valid forms', () => {
    // Form only — no check-digit arithmetic, so these obviously-fake numbers
    // pass. Rule 0's exact lookup on `cas_number` misses them harmlessly.
    expect(isCasNumber('00-00-0')).toBe(true)
    expect(isCasNumber('0000000-00-0')).toBe(true)
  })

  it('rejects the other gold-set queries', () => {
    for (const goldCase of GOLD_SET.filter((c) => c.layer === 'rank')) {
      expect(isCasNumber(normalizeQuery(goldCase.query))).toBe(false)
    }
  })

  it.each([
    ['', 'empty query'],
    ['   ', 'whitespace-only query'],
    ['1-23-4', 'first group too short'],
    ['00000000-00-0', 'first group too long'],
    ['00-0-0', 'middle group too short'],
    ['00-000-0', 'middle group too long'],
    ['00-00-00', 'check digit too long'],
    ['00-00', 'missing check digit'],
    ['00_00_0', 'wrong separator'],
    ['aa-bb-c', 'not digits'],
  ])('rejects %j (%s)', (query) => {
    expect(isCasNumber(query)).toBe(false)
  })

  it('is anchored, so a CAS-shaped substring is not a CAS query', () => {
    // Otherwise a description search would short-circuit to a single material.
    expect(isCasNumber('cas 00-00-0')).toBe(false)
    expect(isCasNumber('00-00-0 substitute')).toBe(false)
  })

  it('expects a normalized query — normalize first, then test', () => {
    expect(isCasNumber('  00-00-0  ')).toBe(false)
    expect(isCasNumber(normalizeQuery('  00-00-0  '))).toBe(true)
  })
})
