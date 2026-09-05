import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  FAMILIES_FILE,
  HAZARD_CODES_FILE,
  REFERENCE_FILES,
  USAGE_CATEGORIES_FILE,
  validateMaterialData,
  type MaterialDataError,
  type MaterialDataFile,
  type MaterialDataInput,
} from '@/lib/validation/material-data'

/**
 * Fixtures are loudly synthetic (wave-4 constraint 1): fake names, the
 * CAS-shaped "00-00-0", fake sources. The seed pipeline is the single most
 * dangerous place in the project to hallucinate perfumery data, so nothing
 * here may ever look like a real material, CAS number, or safety value.
 */
const FIXTURES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scripts/fixtures'
)

const ALPHA = 'test-material-alpha.json'
const BETA = 'test-material-beta.json'
const GAMMA = 'test-material-gamma.json'
/** Cites alpha's url-less book under the same key — the shared-source case. */
const DELTA = 'test-material-delta.json'

function loadFixture(filename: string): MaterialDataFile {
  const raw = readFileSync(path.join(FIXTURES_DIR, filename), 'utf8')
  return { filename, data: JSON.parse(raw) as unknown }
}

const baseline: MaterialDataInput = {
  families: loadFixture(FAMILIES_FILE),
  usageCategories: loadFixture(USAGE_CATEGORIES_FILE),
  hazardCodes: loadFixture(HAZARD_CODES_FILE),
  materials: [
    loadFixture(ALPHA),
    loadFixture(BETA),
    loadFixture(GAMMA),
    loadFixture(DELTA),
  ],
}

/** Each case mutates a fresh copy; the on-disk fixtures stay the one valid baseline. */
function makeInput(): MaterialDataInput {
  return structuredClone(baseline)
}

/**
 * Fixture JSON as loosely-typed records, so failure cases can break it in
 * ways the real types forbid — which is the point of the table.
 */
interface LooseRecord {
  [key: string]: LooseValue
}
type LooseValue =
  string | number | boolean | null | undefined | LooseValue[] | LooseRecord

function material(input: MaterialDataInput, filename: string): LooseRecord {
  const file = input.materials.find((entry) => entry.filename === filename)
  if (file === undefined) throw new Error(`fixture not loaded: ${filename}`)
  return file.data as LooseRecord
}

function rows(value: LooseValue): LooseRecord[] {
  if (!Array.isArray(value)) {
    throw new Error('fixture shape drifted: expected an array')
  }
  return value as LooseRecord[]
}

describe('validateMaterialData — fixture set', () => {
  it('accepts the synthetic fixture set', () => {
    const result = validateMaterialData(makeInput())
    expect(result.ok, JSON.stringify(!result.ok && result.errors)).toBe(true)
    if (!result.ok) return
    expect(result.bundle.materials.map((m) => m.slug)).toEqual([
      'test-material-alpha',
      'test-material-beta',
      'test-material-gamma',
      'test-material-delta',
    ])
    expect(result.bundle.families).toHaveLength(2)
    expect(result.bundle.usageCategories).toHaveLength(11)
    expect(result.bundle.hazardCodes).toHaveLength(3)
  })

  /**
   * `scripts/seed.ts` discovers material files by elimination — every `.json`
   * in the directory that is not one of these three. If a reference file were
   * renamed on disk without updating the constant, the seed would not fail:
   * it would try to seed the taxonomy as a material. This test is that
   * mismatch's only alarm.
   */
  it('names reference files that exist in the fixture directory', () => {
    const present = readdirSync(FIXTURES_DIR)
    for (const filename of REFERENCE_FILES) {
      expect(present, `${filename} is missing from scripts/fixtures`).toContain(
        filename
      )
    }
    const materialFiles = present.filter(
      (name) => name.endsWith('.json') && !REFERENCE_FILES.includes(name)
    )
    expect(materialFiles.sort()).toEqual([ALPHA, BETA, DELTA, GAMMA])
  })

  /**
   * `sources.key` is global: alpha and delta both declare `test-source-1`
   * for the same url-less book, and the seed must resolve both to ONE row.
   * This pins the fixture set to actually exercising that path — if someone
   * "fixes" delta's key to be unique, the live dedupe run tests nothing.
   */
  it('shares one source key between two files for the same document', () => {
    const result = validateMaterialData(makeInput())
    expect(result.ok, JSON.stringify(!result.ok && result.errors)).toBe(true)
    if (!result.ok) return
    const alpha = result.bundle.materials[0].sources.find(
      (s) => s.key === 'test-source-1'
    )
    const delta = result.bundle.materials[3].sources.find(
      (s) => s.key === 'test-source-1'
    )
    expect(alpha).toBeDefined()
    expect(delta).toBeDefined()
    expect(delta?.url).toBe(alpha?.url)
    expect(delta?.title).toBe(alpha?.title)
  })

  it('accepts a shared key whose non-identity fields differ', () => {
    const input = makeInput()
    // Beta cites alpha's second (url-bearing) source under alpha's key. Same
    // document, but accessed on a different day with its own note — the
    // identity is url + title, and only those must agree.
    const alphaSource = structuredClone(rows(material(input, ALPHA).sources)[1])
    alphaSource.accessed_at = '2026-02-02T00:00:00Z'
    alphaSource.notes = 'Cited again from beta - still a synthetic fixture'
    rows(material(input, BETA).sources).push(alphaSource)

    const result = validateMaterialData(input)
    expect(result.ok, JSON.stringify(!result.ok && result.errors)).toBe(true)
  })

  it('applies defaults for omitted collections and singletons', () => {
    const result = validateMaterialData(makeInput())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // test-material-gamma.json omits every child section entirely.
    const gamma = result.bundle.materials[2]
    expect(gamma.synonyms).toEqual([])
    expect(gamma.landmark_uses).toEqual([])
    expect(gamma.description).toBeNull()
    expect(gamma.usage_guidance).toBeNull()
    expect(gamma.computed_properties).toBeNull()
  })
})

interface FailureCase {
  name: string
  mutate: (input: MaterialDataInput) => void
  at: { file: string; path: string }
  message?: RegExp
}

const failureCases: FailureCase[] = [
  {
    // The whole idempotency story for `sources` rests on this key existing —
    // without it a url-less source has no stable identity and every reseed
    // would stack another copy of the same book.
    name: 'missing key on a source',
    mutate: (input) => {
      delete rows(material(input, ALPHA).sources)[0].key
    },
    at: { file: ALPHA, path: 'sources[0].key' },
  },
  {
    name: 'missing source_key on a fact row',
    mutate: (input) => {
      delete rows(material(input, ALPHA).usage_limits)[0].source_key
    },
    at: { file: ALPHA, path: 'usage_limits[0].source_key' },
  },
  {
    name: 'unknown source_key on a landmark use',
    mutate: (input) => {
      rows(material(input, ALPHA).landmark_uses)[0].source_key =
        'test-source-none'
    },
    at: { file: ALPHA, path: 'landmark_uses[0].source_key' },
    message: /matches no source declared in this file/,
  },
  {
    name: 'unknown family slug',
    mutate: (input) => {
      material(input, ALPHA).families = ['test-family-none']
    },
    at: { file: ALPHA, path: 'families[0]' },
    message: /matches no family in families\.json/,
  },
  {
    name: 'unknown hazard code',
    mutate: (input) => {
      rows(material(input, ALPHA).hazards)[0].hazard_code = 'H999'
    },
    at: { file: ALPHA, path: 'hazards[0].hazard_code' },
    message: /matches no entry in hazard-codes\.json/,
  },
  {
    name: 'out-of-range max_pct',
    mutate: (input) => {
      rows(material(input, ALPHA).usage_limits)[0].max_pct = 101
    },
    at: { file: ALPHA, path: 'usage_limits[0].max_pct' },
  },
  {
    name: 'tanimoto above 1',
    mutate: (input) => {
      rows(material(input, ALPHA).similarity)[0].tanimoto = 1.5
    },
    at: { file: ALPHA, path: 'similarity[0].tanimoto' },
  },
  {
    name: 'self-similarity',
    mutate: (input) => {
      rows(material(input, ALPHA).similarity)[0].similar_slug =
        'test-material-alpha'
    },
    at: { file: ALPHA, path: 'similarity[0].similar_slug' },
    message: /cannot list itself/,
  },
  {
    name: 'dangling similar_slug',
    mutate: (input) => {
      rows(material(input, ALPHA).similarity)[0].similar_slug =
        'test-material-omega'
    },
    at: { file: ALPHA, path: 'similarity[0].similar_slug' },
    message: /matches no material in the input set/,
  },
  {
    name: 'duplicate material slugs across files',
    mutate: (input) => {
      const beta = material(input, BETA)
      beta.slug = 'test-material-alpha'
      // Beta's similarity points at alpha, so the rename would otherwise trip
      // the self-similarity parse check before the duplicate-slug check runs.
      beta.similarity = []
    },
    at: { file: BETA, path: 'slug' },
    message: /already declared in test-material-alpha\.json/,
  },
  {
    name: 'duplicate source keys within a file',
    mutate: (input) => {
      rows(material(input, ALPHA).sources)[1].key = 'test-source-1'
    },
    at: { file: ALPHA, path: 'sources[1].key' },
    message: /duplicate source key/,
  },
  {
    // The converse of the shared-key acceptance: a key is global, so the same
    // key naming a different document in another file is a data error — the
    // seed would otherwise overwrite alpha's citation with delta's.
    name: 'shared source key across files with a different title',
    mutate: (input) => {
      rows(material(input, DELTA).sources)[0].title =
        'Test Source One (a different book under the same key)'
    },
    at: { file: DELTA, path: 'sources[0].title' },
    message: /shared with test-material-alpha\.json but the title differs/,
  },
  {
    name: 'shared source key across files with a different url',
    mutate: (input) => {
      rows(material(input, DELTA).sources)[0].url =
        'https://example.com/test-source-1-moved'
    },
    at: { file: DELTA, path: 'sources[0].url' },
    message: /shared with test-material-alpha\.json but the url differs/,
  },
  {
    name: 'malformed CAS number',
    mutate: (input) => {
      material(input, ALPHA).cas_number = 'not-a-cas'
    },
    at: { file: ALPHA, path: 'cas_number' },
    message: /CAS form/,
  },
  {
    name: 'prohibition with a numeric max_pct',
    mutate: (input) => {
      // usage_limits[1] is the fixture's prohibition row.
      rows(material(input, ALPHA).usage_limits)[1].max_pct = 1
    },
    at: { file: ALPHA, path: 'usage_limits[1].max_pct' },
    message: /prohibitions carry max_pct: null/,
  },
  {
    name: 'guidance typical_pct_min above typical_pct_max',
    mutate: (input) => {
      const guidance = material(input, ALPHA).usage_guidance as LooseRecord
      guidance.typical_pct_min = 50
      guidance.typical_pct_max = 1
    },
    at: { file: ALPHA, path: 'usage_guidance.typical_pct_max' },
    message: />= typical_pct_min/,
  },
  {
    name: 'duplicate (category, amendment) limit pair',
    mutate: (input) => {
      const limits = rows(material(input, ALPHA).usage_limits)
      limits.push(structuredClone(limits[0]))
    },
    at: { file: ALPHA, path: 'usage_limits[2].category_id' },
    message: /duplicate usage limit/,
  },
  {
    name: 'duplicate synonym within a material',
    mutate: (input) => {
      const synonyms = rows(material(input, ALPHA).synonyms)
      synonyms.push(structuredClone(synonyms[0]))
    },
    at: { file: ALPHA, path: 'synonyms[2].name' },
    message: /duplicate synonym/,
  },
  {
    name: 'unrecognized key (typo protection)',
    mutate: (input) => {
      const alpha = material(input, ALPHA)
      alpha.canonical_nam = alpha.canonical_name
      delete alpha.canonical_name
    },
    at: { file: ALPHA, path: '(root)' },
    message: /nrecognized key/,
  },
  {
    name: 'incomplete usage-categories reference file',
    mutate: (input) => {
      rows(input.usageCategories.data as LooseValue).pop() // drops id 11
    },
    at: { file: 'usage-categories.json', path: '(root)' },
    message: /missing IFRA category id 11/,
  },
  {
    name: 'unknown parent family slug',
    mutate: (input) => {
      rows(input.families.data as LooseValue)[1].parent_slug =
        'test-family-none'
    },
    at: { file: 'families.json', path: '[1].parent_slug' },
    message: /matches no family in this file/,
  },
  {
    name: 'family hierarchy cycle',
    mutate: (input) => {
      // test-subfamily already points at test-family; close the loop.
      rows(input.families.data as LooseValue)[0].parent_slug = 'test-subfamily'
    },
    at: { file: 'families.json', path: '[0].parent_slug' },
    message: /cycle/,
  },
  {
    name: 'computed properties on a NULL-SMILES material',
    mutate: (input) => {
      material(input, GAMMA).computed_properties = {
        logp: null,
        tpsa: null,
        heavy_atom_count: null,
        rdkit_version: '0000.00.0-test',
      }
    },
    at: { file: GAMMA, path: 'computed_properties' },
    message: /requires smiles/,
  },
]

describe('validateMaterialData — rejections', () => {
  it.each(failureCases)('$name', (failureCase) => {
    const input = makeInput()
    failureCase.mutate(input)

    const result = validateMaterialData(input)
    expect(result.ok).toBe(false)
    const errors: MaterialDataError[] = result.ok ? [] : result.errors

    // Every error must name a file and a field path — the seed script's
    // abort message is only as good as this contract.
    for (const error of errors) {
      expect(error.file).toBeTruthy()
      expect(error.path).toBeTruthy()
    }

    const hit = errors.find(
      (error) =>
        error.file === failureCase.at.file && error.path === failureCase.at.path
    )
    expect(
      hit,
      `expected an error at ${failureCase.at.file}:${failureCase.at.path}, got ${JSON.stringify(errors)}`
    ).toBeDefined()
    if (failureCase.message !== undefined) {
      expect(hit?.message).toMatch(failureCase.message)
    }
  })
})
