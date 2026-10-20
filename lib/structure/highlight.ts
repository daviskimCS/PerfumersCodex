/**
 * Class highlights on the stored 2D structure: which parts of the drawing a
 * chemical class tints when its chip is pressed on a material page.
 *
 * RDKit tags every path it draws with the atoms it belongs to. A bond is
 * `class='bond-3 atom-3 atom-4'` (one path per stroke, so a double bond is
 * two), and a heteroatom label is `class='atom-11'` (one path per glyph, so
 * an OH is two). Carbons in a skeletal drawing have no glyph: a carbon shows
 * only through its bonds. So a class is drawn as the bonds whose two atoms
 * both matched, plus the labels of the matched atoms that have one. That
 * also covers a one-atom pattern such as "any ring of twelve atoms or more",
 * whose matches carry no bonds of their own but whose atoms together are the
 * whole ring.
 *
 * Pure and DOM-free, so Vitest checks it against real RDKit drawings; the
 * client component applies it to the inlined SVG. The stored drawing, and
 * so the review fingerprint, never changes.
 */

import type { ChemicalClassMatch, StructureDrawing } from '@/lib/types'

/**
 * True when the drawing element with this `class` attribute belongs to the
 * highlighted part of the molecule. Anything that is neither a bond nor a
 * single atom's label (a stereo note, an unknown RDKit addition) is never
 * highlighted, which leaves it dimmed with the rest of the drawing.
 */
export function isHighlighted(
  classAttribute: string,
  atoms: ReadonlySet<number>
): boolean {
  const tokens = classAttribute.trim().split(/\s+/)
  const atomIndices: number[] = []
  let isBond = false
  for (const token of tokens) {
    if (/^bond-\d+$/.test(token)) isBond = true
    else {
      const atom = /^atom-(\d+)$/.exec(token)
      if (atom === null) return false
      atomIndices.push(Number(atom[1]))
    }
  }
  if (isBond) {
    return (
      atomIndices.length === 2 && atomIndices.every((atom) => atoms.has(atom))
    )
  }
  return atomIndices.length === 1 && atoms.has(atomIndices[0])
}

/**
 * The matches a page may draw on this drawing: only those computed by the
 * RDKit that drew it, because atom numbering is RDKit's own and the seed
 * writes both in one pass. A drawing and a classification from different
 * runs (a partial re-seed, an RDKit upgrade half applied) give the page no
 * toggles at all, never a tint on the wrong atoms.
 */
export function drawableMatches(
  structure: StructureDrawing | null,
  matches: readonly ChemicalClassMatch[]
): ChemicalClassMatch[] {
  if (structure === null) return []
  return matches.filter(
    (match) =>
      match.rdkitVersion === structure.rdkitVersion && match.atoms.length > 0
  )
}
