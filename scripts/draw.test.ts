import { beforeAll, describe, expect, it } from 'vitest'
import type { RDKitModule } from '@rdkit/rdkit'

import { isSafeStructureSvg } from '@/lib/structure/svg'
import { loadRdkit } from '@/scripts/classify'
import { DrawingError, drawMaterials } from '@/scripts/draw'

/**
 * Real RDKit, loaded once for the file, so these prove the stored markup is
 * what the page will accept: a drawing the seed writes and the page then
 * refuses would be a diagram that silently never appears.
 */

let rdkit: RDKitModule
beforeAll(async () => {
  rdkit = await loadRdkit()
}, 60_000)

// One of each feature the drawer handles differently: heteroatom labels,
// a cis double bond, stereocentres with annotations, a fused ring system.
const CORPUS = [
  { slug: 'coumarin', smiles: 'C1=CC=C2C(=C1)C=CC(=O)O2' },
  { slug: 'civetone', smiles: 'C1CCC/C=C\\CCCCCCCC(=O)CCC1' },
  {
    slug: 'ambrocenide',
    smiles: 'C[C@@H]1CC[C@@H]2[C@@]13C[C@H](C2(C)C)C4(C(C3)OC(O4)(C)C)C',
  },
  { slug: 'ethyl-vanillin', smiles: 'CCOC1=C(C=CC(=C1)C=O)O' },
]

describe('drawMaterials', () => {
  it('draws every SMILES material into markup the page will inline', () => {
    const drawings = drawMaterials(rdkit, CORPUS)
    expect([...drawings.svgByMaterial.keys()]).toEqual(
      CORPUS.map((material) => material.slug)
    )
    for (const svg of drawings.svgByMaterial.values()) {
      expect(isSafeStructureSvg(svg)).toBe(true)
      expect(svg).toContain('currentColor')
      expect(svg).toContain("viewBox='0 0 640 480'")
      // The fill bug this replaced: never an 8-digit colour cut in half.
      expect(svg).not.toMatch(/currentColor[0-9a-f]/i)
    }
  })

  it('stamps the RDKit version that drew them', () => {
    expect(drawMaterials(rdkit, CORPUS).rdkitVersion).toBe(rdkit.version())
  })

  it('is deterministic, so a re-seed does not change a reviewed fingerprint', () => {
    const first = drawMaterials(rdkit, CORPUS).svgByMaterial
    const second = drawMaterials(rdkit, CORPUS).svgByMaterial
    expect([...second.entries()]).toEqual([...first.entries()])
  })

  it('skips a NULL-SMILES material without an entry or an error', () => {
    const drawings = drawMaterials(rdkit, [
      { slug: 'vanilla-absolute', smiles: null },
      CORPUS[0]!,
    ])
    expect([...drawings.svgByMaterial.keys()]).toEqual(['coumarin'])
  })

  it('refuses a SMILES RDKit cannot parse, naming the material', () => {
    expect(() =>
      drawMaterials(rdkit, [{ slug: 'broken', smiles: 'C1CC(' }])
    ).toThrow(DrawingError)
    expect(() =>
      drawMaterials(rdkit, [{ slug: 'broken', smiles: 'C1CC(' }])
    ).toThrow(/broken/)
  })
})
