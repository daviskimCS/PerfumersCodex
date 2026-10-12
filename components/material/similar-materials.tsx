import Link from 'next/link'
import { Network } from 'lucide-react'

import type { SimilarMaterial } from '@/lib/types'

import { SIMILARITY_BAND_LABELS, similarityBand } from './format'
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
 *
 * A bare "0.42" means nothing to a perfumer, so each score is drawn on its
 * 0–1 scale with a word for what the band means (`similarityBand`); the method
 * and the caveat sit behind the heading's info button.
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
      icon={Network}
      aside={
        <span className="font-mono text-xs text-muted-foreground">
          RDKit {rdkitVersions.join(', ')}
        </span>
      }
      info={
        <div className="space-y-2">
          <p>
            Tanimoto similarity over Morgan fingerprints, computed at seed time:
            the share of structural fragments two molecules have in common, from
            0 (none) to 1 (identical fingerprints).
          </p>
          <p>
            As a rule of thumb, below {MIN_TANIMOTO.toFixed(1)} is noise and is
            not shown, 0.3–0.5 is distantly related, 0.5–0.7 related, and 0.7 or
            more a close analogue.
          </p>
          <p>
            Structural resemblance, not olfactive resemblance: near-identical
            molecules can smell nothing alike.
          </p>
        </div>
      }
    >
      <ul className="divide-y divide-border/60">
        {shown.map((neighbour) => (
          <li
            key={neighbour.slug}
            className="grid grid-cols-1 gap-x-6 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] sm:items-center"
          >
            <Link
              href={`/materials/${neighbour.slug}`}
              className="text-brand underline underline-offset-4 hover:no-underline"
            >
              {neighbour.canonicalName}
            </Link>
            <SimilarityScale tanimoto={neighbour.tanimoto} />
          </li>
        ))}
      </ul>
    </PanelSection>
  )
}

/**
 * One score on its 0–1 track, with its band in words. The bar is decorative;
 * the text beside it carries the whole reading for a screen reader.
 */
function SimilarityScale({ tanimoto }: { tanimoto: number }) {
  const band = SIMILARITY_BAND_LABELS[similarityBand(tanimoto)]
  return (
    <div className="flex items-center gap-3">
      <div
        aria-hidden="true"
        className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-border"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-brand"
          style={{ width: `${Math.min(Math.max(tanimoto, 0), 1) * 100}%` }}
        />
      </div>
      <span className="w-52 shrink-0 font-mono text-sm">
        <span className="sr-only">Tanimoto similarity </span>
        {tanimoto.toFixed(2)}
        <span className="sr-only"> of 1, </span>
        <span className="ml-2 text-muted-foreground">{band}</span>
      </span>
    </div>
  )
}
