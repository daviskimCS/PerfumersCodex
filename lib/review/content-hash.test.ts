import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  CONTENT_HASH_VERSION,
  materialContentHash,
  stableStringify,
} from '@/lib/review/content-hash'
import {
  materialFileSchema,
  type MaterialFile,
} from '@/lib/validation/material-data'

/**
 * The hash is the review gate's only memory of what the maker approved. A
 * change that slips past it publishes unreviewed data, so the change cases are
 * the important half of this file.
 */
const ALPHA = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scripts/fixtures/test-material-alpha.json'
)

function alpha(): MaterialFile {
  return materialFileSchema.parse(JSON.parse(readFileSync(ALPHA, 'utf8')))
}

describe('stableStringify', () => {
  it('sorts keys at every depth and keeps array order', () => {
    expect(stableStringify({ b: 1, a: { d: [3, 1], c: null } })).toBe(
      '{"a":{"c":null,"d":[3,1]},"b":1}'
    )
  })

  it('drops undefined keys, as JSON.stringify does', () => {
    expect(stableStringify({ a: undefined, b: 'x' })).toBe('{"b":"x"}')
  })

  it('is insensitive to key order', () => {
    expect(stableStringify({ x: 1, y: [{ q: 1, p: 2 }] })).toBe(
      stableStringify({ y: [{ p: 2, q: 1 }], x: 1 })
    )
  })
})

describe('materialContentHash', () => {
  it('is deterministic and versioned', () => {
    const hash = materialContentHash(alpha())
    expect(hash).toBe(materialContentHash(alpha()))
    expect(hash).toMatch(
      new RegExp(`^${CONTENT_HASH_VERSION}:sha256:[0-9a-f]{64}$`)
    )
  })

  it('ignores key order in the data file', () => {
    const reordered = Object.fromEntries(
      Object.entries(alpha()).reverse()
    ) as MaterialFile
    expect(materialContentHash(reordered)).toBe(materialContentHash(alpha()))
  })

  // Each mutation is a change a reader would see. Every one must move the
  // hash, or a reviewed page would keep showing data nobody re-reviewed.
  const changes: Array<[string, (m: MaterialFile) => void]> = [
    ['canonical name', (m) => (m.canonical_name = `${m.canonical_name} II`)],
    ['CAS number', (m) => (m.cas_number = '000-00-1')],
    ['a synonym', (m) => (m.synonyms[0].name = 'Renamed Synonym')],
    ['synonym order', (m) => m.synonyms.reverse()],
    ['an IFRA limit value', (m) => (m.usage_limits[0].max_pct = 0.123)],
    ['a hazard code', (m) => (m.hazards[0].hazard_code = 'H001')],
    ['a source url', (m) => (m.sources[1].url = 'https://example.com/moved')],
    ['a source note', (m) => (m.sources[0].notes = 'edited note')],
    ['the description', (m) => (m.description = null)],
    ['similarity', (m) => (m.similarity[0].tanimoto = 0.01)],
  ]

  it.each(changes)('changes when %s changes', (_name, mutate) => {
    const changed = alpha()
    mutate(changed)
    expect(materialContentHash(changed)).not.toBe(materialContentHash(alpha()))
  })
})
