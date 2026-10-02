import { describe, expect, it } from 'vitest'

import {
  FINGERPRINT_VERSION,
  materialFingerprint,
  shortFingerprint,
  stableStringify,
} from '@/lib/review/fingerprint'
import type { MaterialDetail } from '@/lib/types'

/**
 * The fingerprint is the review gate's only memory of what the maker
 * approved. A reader-visible change that does not move it would publish
 * unreviewed data, so the change table is the important half of this file.
 *
 * Loudly synthetic, like every fixture in this repo: nothing here may look
 * like a real material, CAS number or safety value.
 */
function detail(): MaterialDetail {
  return {
    id: '00000000-0000-0000-0000-00000000000a',
    slug: 'test-material-alpha',
    canonicalName: 'Test Material Alpha',
    materialType: 'synthetic',
    casNumber: '00-00-0',
    families: [{ slug: 'test-family', name: 'Test Family' }],
    chemicalClasses: [{ slug: 'ester', name: 'Ester' }],
    iupacName: 'test-iupac-name-alpha',
    smiles: 'CC(=O)OC',
    molecularFormula: 'C3H6O2',
    molecularWeight: 74.08,
    identitySourceId: 's1',
    synonyms: [
      { name: 'Test Alpha One', type: 'trade_name', sourceId: 's1' },
      { name: 'Test Alpha Two', type: 'common', sourceId: 's2' },
    ],
    usageLimits: [
      {
        categoryId: 1,
        categoryName: 'Test Category 1',
        restrictionType: 'restriction',
        maxPct: 50,
        notes: null,
        ifraAmendmentVersion: 'test-amendment',
        verifiedAt: '2026-01-01T00:00:00.000Z',
        sourceId: 's1',
      },
    ],
    ifraAbsences: [],
    hazards: [
      {
        code: 'H000',
        description: 'Test hazard statement zero',
        category: 'Health hazard',
        sourceId: 's2',
      },
    ],
    olfactive: null,
    usageGuidance: null,
    landmarkUses: [],
    computed: { logp: 1, tpsa: 2, heavyAtomCount: 5, rdkitVersion: 'test' },
    similar: [
      {
        slug: 'test-material-beta',
        canonicalName: 'Test Material Beta',
        tanimoto: 0.5,
        rdkitVersion: 'test',
      },
    ],
    odorPredictions: [],
    sources: [
      {
        id: 's1',
        type: 'book',
        title: 'Test Source One',
        url: null,
        author: 'Test Author',
        publishedAt: null,
        accessedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 's2',
        type: 'website',
        title: 'Test Source Two',
        url: 'https://example.com/test-source-2',
        author: null,
        publishedAt: null,
        accessedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  } as MaterialDetail
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
})

describe('materialFingerprint', () => {
  it('is deterministic, versioned, and has a typeable short form', () => {
    const fingerprint = materialFingerprint(detail())
    expect(fingerprint).toBe(materialFingerprint(detail()))
    expect(fingerprint).toMatch(
      new RegExp(`^${FINGERPRINT_VERSION}:sha256:[0-9a-f]{64}$`)
    )
    expect(shortFingerprint(fingerprint)).toMatch(/^[0-9a-f]{16}$/)
    expect(
      fingerprint.split(':')[2].startsWith(shortFingerprint(fingerprint))
    ).toBe(true)
  })

  it('ignores key order', () => {
    const reordered = Object.fromEntries(
      Object.entries(detail()).reverse()
    ) as unknown as MaterialDetail
    expect(materialFingerprint(reordered)).toBe(materialFingerprint(detail()))
  })

  // Every row is something a reader sees. The shared ones are the reason the
  // fingerprint hashes the rendered detail rather than the seed file: each of
  // them can change without the material's own file changing.
  const changes: Array<[string, (d: MaterialDetail) => void]> = [
    ['the name', (d) => (d.canonicalName = 'Test Material Alpha II')],
    ['the CAS number', (d) => (d.casNumber = '000-00-1')],
    ['a synonym', (d) => (d.synonyms[0].name = 'Renamed')],
    ['synonym order', (d) => d.synonyms.reverse()],
    ['an IFRA limit value', (d) => (d.usageLimits[0].maxPct = 0.123)],
    [
      'an IFRA category NAME (shared)',
      (d) => (d.usageLimits[0].categoryName = 'Renamed Category'),
    ],
    [
      'a hazard statement TEXT (shared)',
      (d) => (d.hazards[0].description = 'Edited statement'),
    ],
    [
      'a family NAME (shared)',
      (d) => (d.families[0].name = 'PROPOSED — maker to replace'),
    ],
    [
      'a structural class (derived)',
      (d) => d.chemicalClasses.push({ slug: 'lactone', name: 'Lactone' }),
    ],
    [
      'a citation author (shared source)',
      (d) => (d.sources[0].author = 'Another file'),
    ],
    [
      'a citation url (shared source)',
      (d) => (d.sources[1].url = 'https://example.com/moved'),
    ],
    [
      'a similar material name (another material)',
      (d) => (d.similar[0].canonicalName = 'Renamed Beta'),
    ],
    ['computed properties', (d) => (d.computed = null)],
  ]

  it.each(changes)('changes when %s changes', (_name, mutate) => {
    const changed = detail()
    mutate(changed)
    expect(materialFingerprint(changed)).not.toBe(materialFingerprint(detail()))
  })
})
