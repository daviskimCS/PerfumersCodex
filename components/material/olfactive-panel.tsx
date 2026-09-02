import { SprayCan } from 'lucide-react'

import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import type { Citation, OlfactiveDescription } from '@/lib/types'

import { Cite } from './cite'
import { humanize } from './format'
import { Field, FieldList, PanelSection } from './section'

/**
 * Olfactive tab: the human-written description and its measured-by-nose
 * qualifiers.
 *
 * Model output does not appear here, or anywhere near here — `odorPredictions`
 * renders in its own separated, labelled module below the tabs (AGENTS.md hard
 * rule; the schema keeps `odor_predictions` and `material_descriptions` apart
 * so the UI has no excuse to blur them).
 *
 * A NULL `sourceId` is not a missing citation: `lib/types.ts` defines it as
 * "written from the maker's own experience". Saying so in words beats an
 * absent superscript, which reads as an oversight.
 */
export function OlfactivePanel({
  olfactive,
  sources,
}: {
  olfactive: OlfactiveDescription | null
  sources: Citation[]
}) {
  if (olfactive === null) {
    return (
      <PanelSection title="Olfactive description">
        <EmptyState
          icon={SprayCan}
          headingLevel={3}
          title="No olfactive description yet"
          description="Descriptions are written by hand, from the bench, one material at a time. This one hasn't been written."
        />
      </PanelSection>
    )
  }

  return (
    <PanelSection title="Olfactive description">
      <p className="max-w-measure text-lg">
        {olfactive.description}
        <Cite sources={sources} sourceId={olfactive.sourceId} />
      </p>

      {olfactive.keyFacets.length > 0 ? (
        <ul className="mt-6 flex flex-wrap gap-2">
          {olfactive.keyFacets.map((facet) => (
            <li key={facet}>
              <Badge variant="outline">{facet}</Badge>
            </li>
          ))}
        </ul>
      ) : null}

      {olfactive.tenacity !== null || olfactive.projection !== null ? (
        <FieldList>
          <Field
            term="Tenacity"
            value={olfactive.tenacity ? humanize(olfactive.tenacity) : null}
          />
          <Field
            term="Projection"
            value={olfactive.projection ? humanize(olfactive.projection) : null}
          />
        </FieldList>
      ) : null}

      {olfactive.sourceId === null ? (
        <p className="mt-6 max-w-measure text-sm text-muted-foreground">
          Written from the maker&apos;s own bench experience rather than a cited
          source.
        </p>
      ) : null}
    </PanelSection>
  )
}
