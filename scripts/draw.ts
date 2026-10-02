/**
 * Structure drawing — the pass that fills `material_structure_drawings`.
 *
 * The 2D diagram on a material page used to be drawn in the reader's browser,
 * which cost every reader a 6.6 MB WebAssembly download to redraw the same
 * picture from the same SMILES on every visit. The drawing is a deterministic
 * function of the SMILES and the RDKit version, so the seed draws it once
 * here, stamps it with that version, and the page inlines the stored markup
 * as part of its server render (AGENTS.md, docs/cheminformatics.md).
 *
 * It follows `scripts/classify.ts` rule for rule:
 *
 * - **A NULL-SMILES material gets no drawing and no error.** A natural is a
 *   mixture with no single structure, and the page renders no structure UI
 *   for it at all.
 * - **A SMILES RDKit cannot draw is a loud failure.** The seed refuses to
 *   write a corpus it cannot draw, rather than publishing a page whose
 *   diagram is quietly missing.
 * - **Every WASM handle is released**, in a `finally`.
 *
 * The caller loads RDKit once (`loadRdkit` in `./classify`) and passes it in.
 */

import type { RDKitModule } from '@rdkit/rdkit'

import {
  adaptStructureSvg,
  isSafeStructureSvg,
  STRUCTURE_DRAW_OPTIONS,
} from '@/lib/structure/svg'

/** A drawing failure the seed reports as one plain line, not a stack. */
export class DrawingError extends Error {}

/** The `materials` fields drawing actually needs. */
export interface DrawableMaterial {
  slug: string
  smiles: string | null
}

export interface MaterialDrawings {
  /**
   * Material slug → inline-ready SVG. Only materials with a SMILES have an
   * entry; a NULL-SMILES material is absent, which the seed reads as "no
   * drawing row", the correct answer for a mixture.
   */
  svgByMaterial: Map<string, string>
  /** `RDKit.version()`, the provenance stamp on every row. */
  rdkitVersion: string
}

export function drawMaterials(
  rdkit: RDKitModule,
  materials: readonly DrawableMaterial[]
): MaterialDrawings {
  const options = JSON.stringify(STRUCTURE_DRAW_OPTIONS)
  const svgByMaterial = new Map<string, string>()

  for (const material of materials) {
    if (material.smiles === null) continue

    const molecule = rdkit.get_mol(material.smiles)
    try {
      if (molecule === null || !molecule.is_valid()) {
        throw new DrawingError(
          `${material.slug}: RDKit cannot parse SMILES "${material.smiles}", so it cannot be drawn`
        )
      }
      const svg = adaptStructureSvg(molecule.get_svg_with_highlights(options))
      if (svg === null || !isSafeStructureSvg(svg)) {
        // Not the input's fault: RDKit emitted markup outside the allowlist
        // in lib/structure/svg.ts, most likely after an RDKit upgrade. Widen
        // the allowlist deliberately rather than store what it rejects.
        throw new DrawingError(
          `${material.slug}: RDKit ${rdkit.version()} drew an SVG the page would refuse to inline (lib/structure/svg.ts)`
        )
      }
      svgByMaterial.set(material.slug, svg)
    } finally {
      molecule?.delete()
    }
  }

  return { svgByMaterial, rdkitVersion: rdkit.version() }
}
