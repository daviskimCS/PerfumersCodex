import { isSafeStructureSvg } from '@/lib/structure/svg'
import { drawableMatches } from '@/lib/structure/highlight'
import type { MaterialDetail } from '@/lib/types'

import { ClassHighlights } from './class-highlights'
import { MaterialStructure } from './structure'

/**
 * The material page's structure column: the 2D drawing with the material's
 * chemical classes under it, each one a toggle that tints the part of the
 * drawing that earned it (`./class-highlights`).
 *
 * A NULL-SMILES material renders nothing, as `MaterialStructure` does: a
 * mixture has no structure and no classes. When the drawing is missing or
 * refused, the classes still show, as plain chips with nothing to tint.
 */
export function MaterialStructureFigure({
  material,
}: {
  material: MaterialDetail
}) {
  if (material.smiles === null) return null

  const drawn =
    material.structure !== null && isSafeStructureSvg(material.structure.svg)
  const matches = drawn
    ? drawableMatches(material.structure, material.classMatches)
    : []

  return (
    <div className="w-full shrink-0 sm:w-80 md:w-72 lg:w-80">
      <ClassHighlights classes={material.chemicalClasses} matches={matches}>
        <MaterialStructure
          smiles={material.smiles}
          structure={material.structure}
          conformer={material.conformer}
          name={material.canonicalName}
        />
      </ClassHighlights>
    </div>
  )
}
