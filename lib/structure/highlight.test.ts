import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import type { RDKitModule } from '@rdkit/rdkit'

import { drawableMatches, isHighlighted } from '@/lib/structure/highlight'
import type { ChemicalClassMatch, StructureDrawing } from '@/lib/types'
import { classifyMaterials, loadRdkit } from '@/scripts/classify'
import { drawMaterials } from '@/scripts/draw'

describe('isHighlighted', () => {
  const atoms = new Set([3, 4, 11])

  it.each([
    // A bond counts only when both of its atoms matched.
    ['bond-3 atom-3 atom-4', true],
    ['bond-10 atom-4 atom-11', true],
    ['bond-2 atom-2 atom-3', false],
    ['bond-0 atom-0 atom-1', false],
    // An atom label (one path per glyph: an OH is two).
    ['atom-11', true],
    ['atom-2', false],
    // Never a stereo note, an unclassed path or a malformed class.
    ['note', false],
    ['', false],
    ['bond-3 atom-3', false],
    ['bond-3 atom-3 atom-4 atom-11', false],
    ['atom-3 atom-4', false],
    ['bond-3 atom-3 atom-4 extra', false],
    ['atom-1x', false],
  ])('%j → %s', (classAttribute, expected) => {
    expect(isHighlighted(classAttribute, atoms)).toBe(expected)
  })

  it('highlights nothing for an empty atom set', () => {
    expect(isHighlighted('bond-3 atom-3 atom-4', new Set())).toBe(false)
    expect(isHighlighted('atom-11', new Set())).toBe(false)
  })
})

describe('drawableMatches', () => {
  const structure: StructureDrawing = {
    svg: '<svg></svg>',
    rdkitVersion: '2025.03.4',
  }
  const match = (
    slug: string,
    atoms: number[],
    rdkitVersion = '2025.03.4'
  ): ChemicalClassMatch => ({ slug, atoms, rdkitVersion })

  it('keeps matches computed by the RDKit that drew the structure', () => {
    const matches = [match('ester', [1, 2, 3]), match('ketone', [4, 5, 6])]
    expect(drawableMatches(structure, matches)).toEqual(matches)
  })

  it('drops a match from another RDKit, whose atom numbering may differ', () => {
    expect(
      drawableMatches(structure, [match('ester', [1, 2], '2024.09.1')])
    ).toEqual([])
  })

  it('drops an empty match and everything when there is no drawing', () => {
    expect(drawableMatches(structure, [match('ester', [])])).toEqual([])
    expect(drawableMatches(null, [match('ester', [1])])).toEqual([])
  })
})

/**
 * The seed's two passes, end to end: the atoms `classifyMaterials` stores
 * must pick out exactly the right paths of the drawing `drawMaterials`
 * stores, because the page tints by matching one against the other.
 */
describe('matched atoms on a real drawing', () => {
  let rdkit: RDKitModule
  beforeAll(async () => {
    rdkit = await loadRdkit()
  }, 60_000)

  /** The distinct `class` attributes a class's toggle would tint. */
  function tinted(slug: string, smiles: string, classSlug: string): string[] {
    const material = [{ slug, smiles }]
    const classes = classifyMaterials(rdkit, material, [
      { slug: classSlug, smarts: SMARTS[classSlug]! },
    ])
    const svg = drawMaterials(rdkit, material).svgByMaterial.get(slug)!
    const atoms = new Set(classes.atomsByMaterial.get(slug)?.get(classSlug))
    const classAttributes = [...svg.matchAll(/class='([^']*)'/g)].map(
      (found) => found[1]!
    )
    return [
      ...new Set(classAttributes.filter((c) => isHighlighted(c, atoms))),
    ].sort()
  }

  // The shipped patterns, as the seed reads them.
  const SMARTS: Record<string, string> = Object.fromEntries(
    (
      JSON.parse(
        readFileSync(
          new URL(
            '../../scripts/fixtures/chemical-classes.json',
            import.meta.url
          ),
          'utf8'
        )
      ) as { slug: string; smarts: string }[]
    ).map((entry) => [entry.slug, entry.smarts])
  )

  it("tints ethyl vanillin's aldehyde: C–C, C=O and the O label", () => {
    // CCOC1=C(C=CC(=C1)C=O)O: atom 9 is the formyl carbon, 10 its oxygen,
    // 7 the ring carbon it hangs from.
    expect(
      tinted('ethyl-vanillin', 'CCOC1=C(C=CC(=C1)C=O)O', 'aldehyde')
    ).toEqual(['atom-10', 'bond-8 atom-7 atom-9', 'bond-9 atom-9 atom-10'])
  })

  it("tints civetone's whole seventeen-membered ring, not its oxygen", () => {
    const paths = tinted(
      'civetone',
      'C1CCC/C=C\\CCCCCCCC(=O)CCC1',
      'macrocycle'
    )
    // A one-atom pattern has no bonds of its own; the ring shows through
    // the bonds between its matched atoms.
    const bonds = new Set(paths.map((path) => path.split(' ')[0]))
    expect(bonds.size).toBe(17)
    expect(paths.every((path) => path.startsWith('bond-'))).toBe(true)
  })

  it("tints coumarin's lactone, including the ring oxygen's label", () => {
    const paths = tinted('coumarin', 'C1=CC=C2C(=C1)C=CC(=O)O2', 'lactone')
    expect(paths).toContain('atom-10')
    expect(paths).toContain('atom-9')
    expect(paths.filter((path) => path.startsWith('bond-'))).not.toHaveLength(0)
  })
})
