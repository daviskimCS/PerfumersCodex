import Link from 'next/link'

import type { SimilarMaterial } from '@/lib/types'

import { PanelSection } from './section'

/**
 * Structurally similar materials, by precomputed Tanimoto similarity over
 * Morgan fingerprints (docs/cheminformatics.md).
 *
 * Structural neighbours are not olfactive neighbours — structure–odor cliffs
 * are real, and two molecules a fingerprint calls close can smell nothing
 * alike. The framing line says so, because a bare "similar materials" heading
 * on a perfumery reference promises the wrong kind of similarity.
 *
 * Hidden entirely for NULL-SMILES materials: there is no fingerprint, so there
 * are no neighbours — an empty state would imply the data is merely missing.
 *
 * Neighbours below `MIN_TANIMOTO` are dropped here, not in the seed: the
 * stored rows are fingerprinted for review, and a display threshold is a
 * presentation choice. Below ~0.3 Morgan similarity is noise, and in a small
 * corpus the "nearest" material can be barely related at all, so a module of
 * 0.1s would claim a resemblance that isn't there. With nothing above the
 * floor the module is hidden.
 */
const MIN_TANIMOTO = 0.3

export function SimilarMaterialsModule({
  similar,
  smiles,
}: {
  similar: SimilarMaterial[]
  smiles: string | null
}) {
  const shown = similar.filter((n) => n.tanimoto >= MIN_TANIMOTO)
  if (smiles === null || shown.length === 0) return null

  const rdkitVersions = [...new Set(shown.map((n) => n.rdkitVersion))]

  return (
    <PanelSection
      title="Structurally similar"
      aside={
        <span className="font-mono text-xs text-muted-foreground">
          RDKit {rdkitVersions.join(', ')}
        </span>
      }
    >
      <ul className="divide-y divide-border/60">
        {shown.map((neighbour) => (
          <li
            key={neighbour.slug}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
          >
            <Link
              href={`/materials/${neighbour.slug}`}
              className="text-brand underline underline-offset-4 hover:no-underline"
            >
              {neighbour.canonicalName}
            </Link>
            <span className="font-mono text-sm text-muted-foreground">
              <span className="sr-only">Tanimoto similarity </span>
              {neighbour.tanimoto.toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-5 max-w-measure text-sm text-muted-foreground">
        The nearest materials in this reference, by Tanimoto similarity over
        Morgan fingerprints computed at seed time; matches below{' '}
        {MIN_TANIMOTO.toFixed(1)} are not shown. Structural resemblance, not
        olfactive resemblance — near-identical molecules can smell nothing
        alike.
      </p>
    </PanelSection>
  )
}
