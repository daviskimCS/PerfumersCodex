import Link from 'next/link'

import { MaterialStructure } from '@/components/material/structure'
import { StructurePlate } from '@/components/material/structure-plate'
import { getMaterialBySlug } from '@/lib/db/materials'

/**
 * The homepage's structure plate: one published material's 2D structure,
 * drawing itself in, with its name linking to its page. A different material
 * on each visit (the page passes a random slug), so the one image this site
 * has is also its front door.
 *
 * The drawing comes through `getMaterialBySlug`, the same reviewed,
 * fingerprint-checked read a material page makes, and the page streams it
 * behind `HomeStructureFallback` so the rest of the homepage never waits for
 * it. If the material stopped being published between the two reads, the
 * plate renders nothing rather than an empty frame.
 */
export async function HomeStructure({ slug }: { slug: string }) {
  const material = await getMaterialBySlug(slug)
  if (material === null || material.structure === null) return null

  return (
    <figure className="shrink-0">
      <MaterialStructure
        smiles={material.smiles}
        structure={material.structure}
        // The 3D model is a material-page feature; the homepage stays a
        // picture with no client JavaScript.
        conformer={null}
        name={material.canonicalName}
      />
      <figcaption className="mt-2 font-mono text-xs text-muted-foreground">
        <Link
          href={`/materials/${material.slug}`}
          className="rounded-sm underline-offset-4 outline-offset-2 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          {material.canonicalName}
        </Link>
      </figcaption>
    </figure>
  )
}

/** The same box, empty, while the drawing streams in: no layout shift. */
export function HomeStructureFallback() {
  return (
    <div aria-hidden="true" className="shrink-0">
      <StructurePlate>{null}</StructurePlate>
      <p className="mt-2 font-mono text-xs">&nbsp;</p>
    </div>
  )
}
