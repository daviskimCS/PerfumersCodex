import { isSafeStructureSvg } from '@/lib/structure/svg'
import type { StructureDrawing } from '@/lib/types'

import { StructurePlate } from './structure-plate'

/**
 * The material page's 2D structure diagram, rendered on the server from the
 * drawing the seed stored (`scripts/draw.ts`, migration 0009).
 *
 * This used to draw the molecule in the browser with RDKit.js, which cost
 * every reader a 6.6 MB WebAssembly download, after hydration, to redraw a
 * picture that only changes when the seed runs. Now the diagram arrives in
 * the HTML: no client JavaScript, no loading state, no layout shift, and it
 * works with scripting off. RDKit.js is still used on `/structure`, where a
 * reader types a pattern no seed could precompute.
 */
export function MaterialStructure({
  smiles,
  structure,
  name,
}: {
  /** `null` for naturals and other mixtures — see `lib/types.ts`. */
  smiles: string | null
  structure: StructureDrawing | null
  name: string
}) {
  // A NULL-SMILES material renders no structure UI at all: no plate, no
  // placeholder, no empty frame. There is nothing to draw and nothing missing
  // — a mixture simply has no single structure (AGENTS.md).
  if (smiles === null) return null

  // A SMILES with no stored drawing means the seed has not drawn it yet. The
  // stored markup is checked again here, not only at seed time, because it is
  // inlined as HTML: a row edited by hand in the SQL editor must not be able
  // to put markup on the page that RDKit would never have drawn.
  if (structure === null || !isSafeStructureSvg(structure.svg)) {
    return (
      <StructurePlate>
        <p className="px-4 text-center text-xs text-muted-foreground">
          Structure diagram unavailable. The SMILES string is on the Identity
          list below.
        </p>
      </StructurePlate>
    )
  }

  return (
    <StructurePlate>
      <div
        role="img"
        aria-label={`Two-dimensional structure diagram of ${name}`}
        className="size-full text-foreground [&>svg]:size-full"
        // RDKit's own output, drawn by the seed from a SMILES string this app
        // stored, narrowed by lib/structure/svg.ts and re-checked above.
        dangerouslySetInnerHTML={{ __html: structure.svg }}
      />
    </StructurePlate>
  )
}
