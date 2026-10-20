import { beforeAll, describe, expect, it } from 'vitest'
import type { RDKitModule } from '@rdkit/rdkit'

import { loadRdkit } from '@/scripts/classify'
import {
  computeProperties,
  PropertiesError,
  suppliedPropertyConflicts,
} from '@/scripts/properties'

/**
 * Real RDKit, loaded once for the file. The first test is the one that
 * matters: the three values below were produced by a hand-run script before
 * the seed computed them, and two of those materials are published. If the
 * seed's numbers drift from them, a re-seed silently unpublishes both pages.
 */

let rdkit: RDKitModule
beforeAll(async () => {
  rdkit = await loadRdkit()
}, 60_000)

// SMILES and values exactly as PerfumersCodexData eff247c carries them.
const PUBLISHED_BEFORE = [
  {
    slug: 'iso-e-super',
    smiles: 'CC1CC2=C(CC1(C)C(=O)C)C(CCC2)(C)C',
    expected: { logp: 4.5183, tpsa: 17.07, heavyAtomCount: 17 },
  },
  {
    slug: 'javanol',
    smiles: 'CC1(C(CC2C1(C2)C)CC3CC3(C)CO)C',
    expected: { logp: 3.4673, tpsa: 20.23, heavyAtomCount: 16 },
  },
  {
    slug: 'civetone',
    smiles: 'C1CCC/C=C\\CCCCCCCC(=O)CCC1',
    expected: { logp: 5.5867, tpsa: 17.07, heavyAtomCount: 18 },
  },
]

describe('computeProperties', () => {
  it('reproduces the values the published pages were reviewed with', () => {
    const result = computeProperties(rdkit, PUBLISHED_BEFORE)
    for (const material of PUBLISHED_BEFORE) {
      expect(result.valuesByMaterial.get(material.slug)).toEqual(
        material.expected
      )
    }
  })

  it('stamps the RDKit version that computed them', () => {
    expect(computeProperties(rdkit, PUBLISHED_BEFORE).rdkitVersion).toBe(
      rdkit.version()
    )
  })

  it('skips a NULL-SMILES material without an entry or an error', () => {
    const result = computeProperties(rdkit, [
      { slug: 'vanilla-absolute', smiles: null },
      PUBLISHED_BEFORE[0]!,
    ])
    expect([...result.valuesByMaterial.keys()]).toEqual(['iso-e-super'])
  })

  it('refuses a SMILES RDKit cannot parse, naming the material', () => {
    expect(() =>
      computeProperties(rdkit, [{ slug: 'broken', smiles: 'C1CC(' }])
    ).toThrow(PropertiesError)
    expect(() =>
      computeProperties(rdkit, [{ slug: 'broken', smiles: 'C1CC(' }])
    ).toThrow(/broken/)
  })
})

describe('suppliedPropertyConflicts', () => {
  const iso = PUBLISHED_BEFORE[0]!

  it('accepts a file block that matches what the seed computes', () => {
    const material = {
      ...iso,
      computed_properties: {
        logp: 4.5183,
        tpsa: 17.07,
        heavy_atom_count: 17,
        rdkit_version: rdkit.version(),
      },
    }
    const computed = computeProperties(rdkit, [material])
    expect(suppliedPropertyConflicts([material], computed)).toEqual([])
  })

  it('accepts a material with no block at all', () => {
    const computed = computeProperties(rdkit, [iso])
    expect(suppliedPropertyConflicts([iso], computed)).toEqual([])
  })

  it('refuses a block that disagrees, naming the material', () => {
    const material = {
      ...iso,
      computed_properties: {
        logp: 1.5,
        tpsa: 20,
        heavy_atom_count: 10,
        rdkit_version: '0000.00.0-test',
      },
    }
    const computed = computeProperties(rdkit, [material])
    const conflicts = suppliedPropertyConflicts([material], computed)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toMatch(/^iso-e-super: /)
  })
})
