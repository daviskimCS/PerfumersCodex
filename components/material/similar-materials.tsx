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
 */
export function SimilarMaterialsModule({
  similar,
  smiles,
}: {
  similar: SimilarMaterial[]
  smiles: string | null
}) {
  if (smiles === null || similar.length === 0) return null

  const rdkitVersions = [...new Set(similar.map((n) => n.rdkitVersion))]

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
        {similar.map((neighbour) => (
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
        Tanimoto similarity over Morgan fingerprints, computed at seed time.
        Structural resemblance, not olfactive resemblance — near-identical
        molecules can smell nothing alike.
      </p>
    </PanelSection>
  )
}
