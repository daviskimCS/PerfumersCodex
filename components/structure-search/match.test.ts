import { createRequire } from 'node:module'
import path from 'node:path'
import type { RDKitModule } from '@rdkit/rdkit'
import { beforeAll, describe, expect, it } from 'vitest'

import { matchPattern, type MatchCandidate } from './match'

/**
 * `matchPattern` against real RDKit — the only way these assertions mean
 * anything.
 *
 * A mocked RDKit would prove the branching and nothing about the chemistry,
 * and the chemistry is the part that can silently be wrong: a pattern that
 * matches everything, or nothing, still returns a tidy result the UI renders
 * without complaint. So every case below names the COMPLETE expected set, and
 * the negative controls carry as much weight as the positive ones.
 *
 * Node, not a browser: the module under test takes an `RDKitModule` and never
 * touches the DOM, which is exactly why it was separated from the component.
 * The WASM is loaded once for the file (`beforeAll`) — it is ~6.6 MB and
 * instantiating it per test would dominate the suite.
 */

const require = createRequire(import.meta.url)

/**
 * The published `RDKitLoader` type declares `locateFile` as a zero-argument
 * callback; the real one is handed the filename. Declared honestly here rather
 * than asserted away, matching `scripts/classify.ts`.
 */
type Init = (options: {
  locateFile: (file: string) => string
}) => Promise<RDKitModule>

let rdkit: RDKitModule

beforeAll(async () => {
  const glue = require.resolve('@rdkit/rdkit/dist/RDKit_minimal.js')
  const init = require(glue) as Init
  rdkit = await init({
    locateFile: (file) => path.join(path.dirname(glue), file),
  })
}, 60_000)

/**
 * Three synthetic candidates covering the shapes the page actually meets: a
 * molecule in two classes, a molecule whose small ring must NOT read as a
 * macrocycle, and a structure RDKit cannot parse.
 */
const CANDIDATES: MatchCandidate[] = [
  { id: 'ester-alcohol', smiles: 'CC(=O)OCCO' },
  { id: 'small-ring-ketone', smiles: 'O=C1CCCCC1' },
  { id: 'unparseable', smiles: 'not-a-smiles' },
]

function matched(smarts: string): string[] | 'invalid' {
  const outcome = matchPattern(rdkit, smarts, CANDIDATES)
  return outcome.status === 'invalid' ? 'invalid' : [...outcome.ids].sort()
}

describe('matchPattern — the shipped class patterns', () => {
  // Each case names the complete set on purpose: asserting only that a hit is
  // present would pass just as happily for a pattern that matches everything.
  it.each([
    ['ester', '[CX3](=O)[OX2H0][#6]', ['ester-alcohol']],
    ['alcohol', '[OX2H][CX4]', ['ester-alcohol']],
    ['ketone', '[#6][CX3](=O)[#6]', ['small-ring-ketone']],
    ['aldehyde', '[CX3H1](=O)[#6]', []],
    ['aromatic ring', 'c1ccccc1', []],
  ])('%s matches exactly its members', (_name, smarts, expected) => {
    expect(matched(smarts)).toEqual(expected)
  })

  /**
   * The ring-size patterns are the ones most likely to be quietly wrong, and
   * the small-ring ketone is the control that catches it: a `[r{12-}]` that
   * had degraded to "any ring" would match it.
   */
  it.each([
    ['macrocycle', '[r{12-}]'],
    ['macrocyclic ketone', '[#6;r{12-}][CX3;r{12-}](=O)[#6;r{12-}]'],
    ['macrolactone', '[CX3;r{12-}](=O)[OX2;r{12-}]'],
  ])('%s matches nothing in a corpus with no large rings', (_name, smarts) => {
    expect(matched(smarts)).toEqual([])
  })
})

describe('matchPattern — guards', () => {
  it('reports an unreadable pattern as invalid rather than throwing', () => {
    // A thrown error would surface in error.tsx, which is the wrong place for
    // "you typed a bracket wrong".
    for (const smarts of ['[[', 'c1ccccc1)', 'not-a-smarts']) {
      expect(matched(smarts)).toBe('invalid')
    }
  })

  it('separates "valid but matches nothing" from "invalid"', () => {
    // The page says different things for these two, so the distinction has to
    // survive: bromine is a perfectly good query that this corpus lacks.
    expect(matched('[Br]')).toEqual([])
  })

  it('skips a material whose SMILES will not parse', () => {
    // Every case above already proves it — `unparseable` never appears in a
    // result — but stating it directly keeps the intent findable.
    expect(matched('[#6]')).toEqual(['ester-alcohol', 'small-ring-ketone'])
  })

  /**
   * Not a guard this module implements — a guard it *requires*, recorded here
   * because the reason is not obvious from the call site. `get_qmol('')`
   * returns a live, `is_valid()` handle, so an empty pattern cannot be caught
   * as "invalid"; RDKit 2025.03.4 then reports no match for every molecule.
   * Rendering that would answer "which materials contain nothing" with a
   * confident "none". The component trims and never calls in.
   */
  it('treats the empty pattern as answerable, which is why the caller guards it', () => {
    expect(matched('')).toEqual([])
  })
})
