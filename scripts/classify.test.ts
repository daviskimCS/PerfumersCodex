import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import type { RDKitModule } from '@rdkit/rdkit'

import {
  CHEMICAL_CLASSES_FILE,
  chemicalClassesFileSchema,
  FAMILIES_FILE,
  HAZARD_CODES_FILE,
  USAGE_CATEGORIES_FILE,
  validateMaterialData,
  type ChemicalClassRecord,
  type MaterialDataFile,
  type MaterialDataInput,
} from '@/lib/validation/material-data'
import {
  ClassificationError,
  classifyMaterials,
  isValidSmarts,
  loadRdkit,
} from '@/scripts/classify'

/**
 * The whole point of these tests is the NEGATIVE controls.
 *
 * A structural filter fails in exactly two ways, and neither one throws: a
 * pattern that matches everything (every material is an ester, the filter is
 * useless) and a pattern that matches nothing (the class exists and is always
 * empty). Both look like a working pipeline from the outside. So every case
 * below asserts the complete class list for a molecule whose structure is not
 * in dispute — what it is NOT is as load-bearing as what it is.
 *
 * RDKit is loaded once for the whole file: it is a 6.6 MB WebAssembly module,
 * and `classifyMaterials` is designed around the caller doing exactly this.
 */

const FIXTURES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures'
)

function loadFixture(filename: string): MaterialDataFile {
  const raw = readFileSync(path.join(FIXTURES_DIR, filename), 'utf8')
  return { filename, data: JSON.parse(raw) as unknown }
}

/** The shipped class list, parsed the way the seed parses it. */
const CLASSES: ChemicalClassRecord[] = chemicalClassesFileSchema.parse(
  loadFixture(CHEMICAL_CLASSES_FILE).data
)

let rdkit: RDKitModule

beforeAll(async () => {
  rdkit = await loadRdkit()
})

/**
 * Structures whose class membership is a matter of record, each with the
 * complete list of classes it must land in — and, by omission, the eight or
 * nine it must not.
 */
const cases: { name: string; smiles: string; classes: string[] }[] = [
  {
    // The macrocyclic ketone case. Explicitly NOT a lactone, ester or
    // macrolactone: there is no oxygen in the ring at all.
    name: 'civetone',
    smiles: 'C1CCC/C=C\\CCCCCCCC(=O)CCC1',
    classes: ['macrocyclic-ketone', 'macrocycle', 'ketone'],
  },
  {
    name: 'muscone',
    smiles: 'CC1CCCCCCCCCCCCC(=O)C1',
    classes: ['macrocyclic-ketone', 'macrocycle', 'ketone'],
  },
  {
    // The mirror image of civetone: an oxygen in the big ring makes it an
    // ester and a lactone, and the carbonyl is NOT a ketone.
    name: 'ambrettolide',
    smiles: 'O=C1CCCCCCC/C=C\\CCCCCCO1',
    classes: ['ester', 'lactone', 'macrolactone', 'macrocycle'],
  },
  {
    // A five-membered lactone: proves the ring-size cutoff actually cuts.
    name: 'gamma-decalactone',
    smiles: 'CCCCCCC1CCC(=O)O1',
    classes: ['ester', 'lactone'],
  },
  {
    // An open-chain ester: proves `lactone` requires the ring, not just the
    // ester linkage.
    name: 'ethyl acetate',
    smiles: 'CCOC(C)=O',
    classes: ['ester'],
  },
  {
    // Fused rings, but none of them large: not a macrocycle.
    name: 'iso e super',
    smiles: 'CC1CC2=C(CC1(C)C(=O)C)C(CCC2)(C)C',
    classes: ['ketone'],
  },
  {
    name: 'javanol',
    smiles: 'CC1(C(CC2C1(C2)C)CC3CC3(C)CO)C',
    classes: ['alcohol'],
  },
  {
    // The aldehyde/ketone boundary: one hydrogen on the carbonyl, so this is
    // an aldehyde and not a ketone.
    name: 'benzaldehyde',
    smiles: 'O=Cc1ccccc1',
    classes: ['aldehyde', 'aromatic'],
  },
  {
    // A tertiary alcohol with two alkenes: alcohol, and nothing else. If a
    // carbonyl pattern ever matched here it would be matching C=C.
    name: 'linalool',
    smiles: 'CC(C)=CCCC(C)(O)C=C',
    classes: ['alcohol'],
  },
  {
    // A ring, but a six-membered one — the negative control for `macrocycle`.
    name: 'cyclohexanone',
    smiles: 'O=C1CCCCC1',
    classes: ['ketone'],
  },
]

describe('classifyMaterials', () => {
  it.each(cases)('$name', ({ name, smiles, classes }) => {
    const result = classifyMaterials(rdkit, [{ slug: name, smiles }], CLASSES)
    expect(result.classesByMaterial.get(name)).toEqual(classes)
  })

  /**
   * A mixture has no single structure. No rows, no error — this is the
   * expected shape of every natural in the corpus, not a failure.
   */
  it('gives a NULL-SMILES material no classes and no error', () => {
    const result = classifyMaterials(
      rdkit,
      [{ slug: 'a-natural', smiles: null }],
      CLASSES
    )
    expect(result.classesByMaterial.get('a-natural')).toEqual([])
  })

  it('classifies a mixed corpus in one pass', () => {
    const result = classifyMaterials(
      rdkit,
      [
        { slug: 'civetone', smiles: 'C1CCC/C=C\\CCCCCCCC(=O)CCC1' },
        { slug: 'a-natural', smiles: null },
        { slug: 'ethyl-acetate', smiles: 'CCOC(C)=O' },
      ],
      CLASSES
    )
    expect([...result.classesByMaterial.keys()]).toEqual([
      'civetone',
      'a-natural',
      'ethyl-acetate',
    ])
    expect(result.classesByMaterial.get('ethyl-acetate')).toEqual(['ester'])
  })

  /** The provenance stamp on every `material_chemical_classes` row. */
  it('reports the RDKit version that produced the rows', () => {
    const result = classifyMaterials(rdkit, [], CLASSES)
    expect(result.rdkitVersion).toBe(rdkit.version())
    expect(result.rdkitVersion).toMatch(/^\d{4}\.\d{2}\.\d+$/)
  })

  it('returns matched classes in the class list order', () => {
    const result = classifyMaterials(
      rdkit,
      [{ slug: 'ambrettolide', smiles: 'O=C1CCCCCCC/C=C\\CCCCCCO1' }],
      CLASSES
    )
    const order = CLASSES.map((entry) => entry.slug)
    const matched = result.classesByMaterial.get('ambrettolide') ?? []
    expect(matched).toEqual(
      [...matched].sort((a, b) => order.indexOf(a) - order.indexOf(b))
    )
  })

  /**
   * The seed must refuse to write a corpus it cannot classify: a material
   * skipped here would publish as belonging to no class, which reads as a
   * fact about the molecule rather than as the pipeline failure it is.
   */
  it('refuses a SMILES RDKit cannot parse', () => {
    expect(() =>
      classifyMaterials(
        rdkit,
        [{ slug: 'broken', smiles: 'not-a-smiles' }],
        CLASSES
      )
    ).toThrow(ClassificationError)
  })

  it('names every unparseable material, not just the first', () => {
    let message = ''
    try {
      classifyMaterials(
        rdkit,
        [
          { slug: 'broken-one', smiles: 'not-a-smiles' },
          { slug: 'fine', smiles: 'CCOC(C)=O' },
          { slug: 'broken-two', smiles: '[C' },
        ],
        CLASSES
      )
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toContain('broken-one')
    expect(message).toContain('broken-two')
    expect(message).not.toContain('fine')
  })

  it('refuses a class whose SMARTS RDKit cannot compile', () => {
    expect(() =>
      classifyMaterials(
        rdkit,
        [{ slug: 'ethyl-acetate', smiles: 'CCOC(C)=O' }],
        [{ slug: 'broken', smarts: '[C' }]
      )
    ).toThrow(ClassificationError)
  })
})

describe('isValidSmarts', () => {
  it('accepts every shipped pattern', () => {
    for (const entry of CLASSES) {
      expect(isValidSmarts(rdkit, entry.smarts), entry.slug).toBe(true)
    }
  })

  it('rejects a malformed pattern', () => {
    expect(isValidSmarts(rdkit, '[C')).toBe(false)
  })

  /**
   * The trap this whole design is built around: RDKit *accepts* the empty
   * pattern. It compiles into a valid query molecule with no atoms, which
   * never errors and — in this build — never matches, so an empty pattern
   * would quietly define a class no material can ever join. The compile check
   * cannot catch it; validation's structural check has to.
   */
  it('accepts the empty pattern, which is why validation must reject it', () => {
    expect(isValidSmarts(rdkit, '')).toBe(true)
  })
})

/**
 * The seed injects the real compiler into validation. These run that wiring
 * end to end on the RDKit instance already loaded above, so the guarantee is
 * proven rather than stubbed.
 */
describe('validateMaterialData with the real RDKit compiler', () => {
  function baseline(): MaterialDataInput {
    return {
      families: loadFixture(FAMILIES_FILE),
      usageCategories: loadFixture(USAGE_CATEGORIES_FILE),
      hazardCodes: loadFixture(HAZARD_CODES_FILE),
      chemicalClasses: loadFixture(CHEMICAL_CLASSES_FILE),
      materials: [
        loadFixture('test-material-alpha.json'),
        loadFixture('test-material-beta.json'),
        loadFixture('test-material-gamma.json'),
        loadFixture('test-material-delta.json'),
      ],
    }
  }

  const compiler = { smartsIsValid: (s: string) => isValidSmarts(rdkit, s) }

  it('accepts the shipped class list', () => {
    const result = validateMaterialData(baseline(), compiler)
    expect(result.ok, JSON.stringify(!result.ok && result.errors)).toBe(true)
  })

  it('rejects a SMARTS RDKit cannot compile', () => {
    const input = baseline()
    ;(input.chemicalClasses.data as { smarts: string }[])[0].smarts = '[C'
    const result = validateMaterialData(input, compiler)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0].path).toBe('[0].smarts')
    expect(result.errors[0].message).toMatch(/cannot compile/)
  })

  it('rejects an empty SMARTS even though RDKit compiles it', () => {
    const input = baseline()
    ;(input.chemicalClasses.data as { smarts: string }[])[0].smarts = ''
    const result = validateMaterialData(input, compiler)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0].message).toMatch(/cannot be empty/)
  })
})

/**
 * The fixture corpus has to exercise both branches, or the seed's dry run
 * proves nothing: at least one SMILES-bearing material that picks up classes,
 * and the NULL-SMILES material that must pick up none.
 */
describe('the fixture corpus', () => {
  it('classifies alpha and beta, and leaves gamma and delta empty', () => {
    const materials = [
      'test-material-alpha.json',
      'test-material-beta.json',
      'test-material-gamma.json',
      'test-material-delta.json',
    ].map((filename) => {
      const data = loadFixture(filename).data as {
        slug: string
        smiles: string | null
      }
      return { slug: data.slug, smiles: data.smiles }
    })

    const result = classifyMaterials(rdkit, materials, CLASSES)
    expect(result.classesByMaterial.get('test-material-alpha')).toEqual([
      'ester',
      'alcohol',
    ])
    expect(result.classesByMaterial.get('test-material-beta')).toEqual([
      'ketone',
    ])
    expect(result.classesByMaterial.get('test-material-gamma')).toEqual([])
    expect(result.classesByMaterial.get('test-material-delta')).toEqual([])
  })
})
