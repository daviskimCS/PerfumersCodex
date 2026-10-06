import { Droplet, Library } from 'lucide-react'

import { EmptyState } from '@/components/empty-state'
import type { Citation, LandmarkUse, UsageGuidance } from '@/lib/types'

import { Cite } from './cite'
import { Field, FieldList, PanelSection } from './section'

/**
 * Usage tab: how the material is worked with, and where it has been used.
 *
 * The two halves empty independently — a material can have a dosage note and
 * no documented landmark use, or the reverse — so each carries its own empty
 * state rather than the section vanishing wholesale.
 */

/** The typical-use range as one phrase, tolerating either bound being absent. */
function dosageRange(guidance: UsageGuidance): string | null {
  const { typicalPctMin: min, typicalPctMax: max } = guidance
  if (min !== null && max !== null) return `${min}–${max}%`
  if (min !== null) return `from ${min}%`
  if (max !== null) return `up to ${max}%`
  return null
}

function GuidanceFields({
  guidance,
  sources,
}: {
  guidance: UsageGuidance
  sources: Citation[]
}) {
  // Built before the JSX, not inside it: a fragment is always truthy, so
  // wrapping the range and its superscript together would give an all-NULL
  // row a label and a citation with no value between them.
  const range = dosageRange(guidance)

  // The one source cites the whole row, so its superscript goes on the first
  // field that renders. With no range, a note-only row (a recommended ceiling
  // kept out of the typical-use fields) would otherwise show no citation.
  const cite = <Cite sources={sources} sourceId={guidance.sourceId} />
  const citeOn =
    range !== null ? 'range' : guidance.thresholdNote ? 'threshold' : 'dilution'
  const cited = (text: string | null, field: typeof citeOn) =>
    text === null || text === '' ? null : (
      <>
        {text}
        {citeOn === field ? cite : null}
      </>
    )

  return (
    <>
      <FieldList>
        <Field term="Typical use" value={cited(range, 'range')} />
        <Field term="Note" value={cited(guidance.thresholdNote, 'threshold')} />
        <Field
          term="Dilution"
          value={cited(guidance.dilutionNote, 'dilution')}
        />
      </FieldList>
      {guidance.sourceId === null ? (
        <p className="mt-6 max-w-measure text-sm text-muted-foreground">
          Recorded from the maker&apos;s own bench experience rather than a
          cited source.
        </p>
      ) : null}
    </>
  )
}

export function UsagePanel({
  usageGuidance,
  landmarkUses,
  sources,
}: {
  usageGuidance: UsageGuidance | null
  landmarkUses: LandmarkUse[]
  sources: Citation[]
}) {
  return (
    <div>
      <PanelSection title="Usage guidance">
        {usageGuidance === null ? (
          <EmptyState
            icon={Droplet}
            headingLevel={3}
            title="No usage guidance recorded yet"
            description="Typical dosage, detection threshold, and dilution notes are entered per material. None have been entered for this one."
          />
        ) : (
          <GuidanceFields guidance={usageGuidance} sources={sources} />
        )}
      </PanelSection>

      <PanelSection title="Landmark uses">
        {landmarkUses.length === 0 ? (
          <EmptyState
            icon={Library}
            headingLevel={3}
            title="No landmark uses recorded yet"
            description="Documented uses come from interviews, books, and perfumer disclosures, and each one is cited. None have been recorded for this material."
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {landmarkUses.map((use) => (
              <li
                key={`${use.perfumeName}:${use.house ?? ''}:${use.year ?? ''}`}
                className="py-3"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-medium">
                    {use.perfumeName}
                    <Cite sources={sources} sourceId={use.sourceId} />
                  </span>
                  {use.house ? (
                    <span className="text-sm text-muted-foreground">
                      {use.house}
                    </span>
                  ) : null}
                  {use.year !== null ? (
                    <span className="font-mono text-sm text-muted-foreground">
                      {use.year}
                    </span>
                  ) : null}
                </div>
                {use.notes ? (
                  <p className="mt-1 max-w-measure text-sm text-muted-foreground">
                    {use.notes}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </PanelSection>
    </div>
  )
}
