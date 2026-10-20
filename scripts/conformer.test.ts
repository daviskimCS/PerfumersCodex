import { describe, expect, it } from 'vitest'

import {
  conformerFor,
  keepsStereochemistry,
  METHOD,
  normalizeMolfile,
  OPENCHEMLIB_VERSION,
  type StoredConformer,
} from './conformer'

/**
 * The seed's 3D conformer pass. What matters is which molecules get a model,
 * that the same inputs always give the same stored text (the review
 * fingerprint hashes it), and that a stored model is kept rather than
 * recomputed while its inputs are unchanged. Structures are generic test
 * molecules, not corpus materials.
 */
const CYCLOHEXANONE = 'O=C1CCCCC1'

function atomCount(molfile: string): number {
  return Number.parseInt(molfile.split('\n')[3].slice(0, 3), 10)
}

/** The x, y, z of every atom line in a V2000 molfile. */
function coordinates(molfile: string): number[][] {
  const lines = molfile.split('\n')
  return lines
    .slice(4, 4 + atomCount(molfile))
    .map((line) => [0, 10, 20].map((at) => Number(line.slice(at, at + 10))))
}

/** The same molfile reflected through the xy plane: the mirror image. */
function mirrored(molfile: string): string {
  const lines = molfile.split('\n')
  for (let i = 4; i < 4 + atomCount(molfile); i++) {
    const z = Number(lines[i].slice(20, 30))
    lines[i] =
      lines[i].slice(0, 20) + (-z).toFixed(4).padStart(10) + lines[i].slice(30)
  }
  return lines.join('\n')
}

function computed(smiles: string): string {
  const outcome = conformerFor({ slug: 'test', smiles }, undefined)
  if (outcome?.kind !== 'computed') throw new Error(`not computed: ${smiles}`)
  return outcome.conformer.molfile
}

describe('conformerFor', () => {
  it('says nothing for a mixture (no SMILES)', () => {
    expect(
      conformerFor({ slug: 'test-natural', smiles: null }, undefined)
    ).toBe(null)
  })

  it('computes a model with explicit hydrogens, identically on every run', () => {
    const first = conformerFor(
      { slug: 'test-ketone', smiles: CYCLOHEXANONE },
      undefined
    )
    const second = conformerFor(
      { slug: 'test-ketone', smiles: CYCLOHEXANONE },
      undefined
    )
    expect(first?.kind).toBe('computed')
    if (first?.kind !== 'computed') return
    // C6H10O: 7 heavy atoms and 10 hydrogens.
    expect(atomCount(first.conformer.molfile)).toBe(17)
    expect(first.conformer).toMatchObject({
      smiles: CYCLOHEXANONE,
      openchemlibVersion: OPENCHEMLIB_VERSION,
      method: METHOD,
    })
    expect(second).toEqual(first)
  })

  it.each([
    ['a macrocycle', 'C1CCCCCCCCCCC1', /macrocycle \(12-membered ring\)/],
    ['a long flexible chain', 'CCCCCCCCCC=O', /8 rotatable bonds/],
  ])('skips %s, where one shape would mislead', (_name, smiles, reason) => {
    const outcome = conformerFor({ slug: 'test-skip', smiles }, undefined)
    expect(outcome?.kind).toBe('skipped')
    if (outcome?.kind === 'skipped') expect(outcome.reason).toMatch(reason)
  })

  it('keeps a ring below the macrocycle threshold', () => {
    expect(
      conformerFor({ slug: 'test-ring', smiles: 'C1CCCCCCCCCC1' }, undefined)
        ?.kind
    ).toBe('computed')
  })

  it('reports SMILES it cannot read as a failure, not a throw', () => {
    expect(
      conformerFor({ slug: 'test-bad', smiles: 'C1CC(' }, undefined)?.kind
    ).toBe('failed')
  })

  describe('reuse of a stored conformer', () => {
    const stored: StoredConformer = {
      smiles: CYCLOHEXANONE,
      // Not a real model: proves the stored text came back untouched.
      molfile: 'stored molfile',
      openchemlibVersion: OPENCHEMLIB_VERSION,
      method: METHOD,
    }

    it('keeps it while the SMILES, version and method all match', () => {
      expect(
        conformerFor({ slug: 'test-ketone', smiles: CYCLOHEXANONE }, stored)
      ).toEqual({ kind: 'reused', conformer: stored })
    })

    it.each<[string, Partial<StoredConformer>]>([
      ['the SMILES changed', { smiles: 'O=C1CCCC1' }],
      ['OpenChemLib was upgraded', { openchemlibVersion: '0.0.0' }],
      ['the method changed', { method: 'something else' }],
    ])('recomputes it when %s', (_name, difference) => {
      const outcome = conformerFor(
        { slug: 'test-ketone', smiles: CYCLOHEXANONE },
        { ...stored, ...difference }
      )
      expect(outcome?.kind).toBe('computed')
    })
  })
})

describe('the stored model', () => {
  // A generic chiral test molecule (2-butanol), one hand and the other.
  it.each(['C[C@H](O)CC', 'C[C@@H](O)CC'])(
    'keeps the configuration the SMILES specifies (%s)',
    (smiles) => {
      const molfile = computed(smiles)
      expect(keepsStereochemistry(smiles, molfile)).toBe(true)
      expect(keepsStereochemistry(smiles, mirrored(molfile))).toBe(false)
    }
  )

  it('keeps a specified double-bond geometry', () => {
    expect(keepsStereochemistry('C/C=C/CC', computed('C/C=C/CC'))).toBe(true)
    expect(keepsStereochemistry('C/C=C\\CC', computed('C/C=C/CC'))).toBe(false)
  })

  it('opens broadside: centred, longest axis along x, shortest along z', () => {
    // Butylcyclohexane: ten heavy atoms, written before its hydrogens.
    const heavy = coordinates(computed('CCCCC1CCCCC1')).slice(0, 10)
    const mean = (axis: number) =>
      heavy.reduce((total, atom) => total + atom[axis], 0) / heavy.length
    const spread = (axis: number) =>
      heavy.reduce((total, atom) => total + (atom[axis] - mean(axis)) ** 2, 0)
    for (const axis of [0, 1, 2])
      expect(Math.abs(mean(axis))).toBeLessThan(1e-3)
    expect(spread(0)).toBeGreaterThan(spread(1))
    expect(spread(1)).toBeGreaterThan(spread(2))
  })
})

describe('normalizeMolfile', () => {
  it('fixes the title and program lines, which vary between runs', () => {
    const raw =
      '#5\n  OCL 123\n\n  1  0  0  0  0  0  0  0  0  0999 V2000\nM  END\n'
    expect(normalizeMolfile(raw)).toBe(
      '\n  OpenChemLib\n\n  1  0  0  0  0  0  0  0  0  0999 V2000\nM  END\n'
    )
  })
})
