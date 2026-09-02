import { FlaskConical } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { OdorPrediction } from '@/lib/types'

import { compareVersions } from './format'

/**
 * The experimental structure–odor module.
 *
 * Three hard rules, all from AGENTS.md and docs/cheminformatics.md:
 *
 * 1. It renders only when there is model output. No empty state — an absent
 *    experiment is not a gap in the reference.
 * 2. It never mixes with the human-written description. It lives outside the
 *    tabs entirely, in its own bordered, labelled block, so nothing about the
 *    layout can be misread as editorial content.
 * 3. It is labelled with the model version, always.
 *
 * `odor_predictions` is unique per material + descriptor + version, so one
 * material can carry several generations of output at once. Showing them
 * together would put a superseded model's guesses beside the current one's
 * with nothing but a version string to tell them apart, so this filters to the
 * newest version present and says which one that is.
 *
 * "Newest" is decided by a digit-aware comparison of the version strings —
 * `lib/types.ts` gives predictions no timestamp, so the string is the only
 * ordering signal available.
 */
export function OdorPredictionsModule({
  predictions,
}: {
  predictions: OdorPrediction[]
}) {
  if (predictions.length === 0) return null

  const latestVersion = predictions.reduce(
    (newest, prediction) =>
      compareVersions(prediction.modelVersion, newest) > 0
        ? prediction.modelVersion
        : newest,
    predictions[0].modelVersion
  )
  const current = predictions.filter(
    (prediction) => prediction.modelVersion === latestVersion
  )
  if (current.length === 0) return null

  return (
    <section
      aria-labelledby="odor-predictions-heading"
      className="mt-16 rounded-xl border border-dashed border-border-strong p-6 md:p-8"
    >
      <div className="flex flex-wrap items-center gap-3">
        <FlaskConical
          aria-hidden="true"
          strokeWidth={1.5}
          className="size-5 text-muted-foreground"
        />
        <h2 id="odor-predictions-heading" className="text-xl">
          Predicted odor descriptors
        </h2>
        <Badge variant="outline" className="font-mono">
          Experimental — model {latestVersion}
        </Badge>
      </div>

      <p className="mt-4 max-w-measure text-sm text-muted-foreground">
        Output of a structure&#8211;odor classifier, not an olfactive
        description and not reviewed like one. Published metrics and a failure
        analysis are the point of this module; the predictions themselves are
        the experiment, not the reference.
      </p>

      <ul className="mt-6 divide-y divide-border/60">
        {current.map((prediction) => (
          <li
            key={prediction.descriptor}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
          >
            <span>{prediction.descriptor}</span>
            <span className="font-mono text-sm text-muted-foreground">
              <span className="sr-only">predicted probability </span>
              {(prediction.probability * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
