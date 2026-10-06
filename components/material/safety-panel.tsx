import { ShieldAlert, TriangleAlert } from 'lucide-react'

import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import type { Citation, Hazard, IfraAbsence, UsageLimit } from '@/lib/types'

import { Cite } from './cite'
import { compareVersions, datePart } from './format'
import { PanelSection } from './section'

/**
 * Safety tab: IFRA usage limits and GHS hazards.
 *
 * Three rules shape this panel, and all are honesty rules rather than layout
 * ones:
 *
 * 1. `restrictionType` decides what the limit column says. A prohibition with
 *    a NULL `maxPct` is "Prohibited" — never a dash, never "no limit". The
 *    numeric column is not the whole fact, and rendering it as if it were
 *    would invert the meaning of the most consequential row on the page.
 * 2. The IFRA amendment a limit was verified against is displayed prominently
 *    (docs/data-strategy.md): the 52nd Amendment lands around launch, rows are
 *    inserted rather than overwritten, so a reader has to be able to see which
 *    standard they are reading without hunting for it.
 * 3. "No Standard" and "not researched" are different facts and get different
 *    blocks. A verified absence (`ifraAbsences`, checked against an
 *    amendment's complete index) is *content* with a citation — the answer a
 *    perfumer came for is "unrestricted". Only the case with no limits AND no
 *    absence is an empty state, and it means exactly "nobody has looked yet".
 */

/** The limit as a phrase, with `restrictionType` carrying its real weight. */
function limitPhrase(limit: UsageLimit): string {
  switch (limit.restrictionType) {
    case 'prohibition':
      return 'Prohibited'
    case 'restriction':
      return limit.maxPct === null ? 'Restricted' : `${limit.maxPct}% maximum`
    case 'specification':
      return limit.maxPct === null
        ? 'Specification'
        : `${limit.maxPct}% maximum, by specification`
  }
}

/**
 * Every amendment this material has been checked against — whether the check
 * found a Standard (a limit row) or verified there is none (an absence row).
 */
function AmendmentBadges({
  limits,
  absences,
}: {
  limits: UsageLimit[]
  absences: IfraAbsence[]
}) {
  const versions = [
    ...new Set([
      ...limits.map((limit) => limit.ifraAmendmentVersion),
      ...absences.map((absence) => absence.ifraAmendmentVersion),
    ]),
  ].sort(compareVersions)
  if (versions.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      {versions.map((version) => (
        <Badge key={version} variant="secondary" className="font-mono">
          IFRA {version} Amendment
        </Badge>
      ))}
    </div>
  )
}

/**
 * The verified-absence state, when there are no limits to tabulate. Not an
 * `EmptyState`: it states a fact and cites its evidence, one block per
 * amendment checked.
 */
function IfraAbsenceStatement({
  absences,
  sources,
}: {
  absences: IfraAbsence[]
  sources: Citation[]
}) {
  return (
    <div className="max-w-measure">
      <h3 className="text-xl">No IFRA Standard</h3>
      <div className="mt-2 space-y-4">
        {absences.map((absence) => (
          <div key={absence.ifraAmendmentVersion}>
            <p className="text-foreground">
              Checked against the complete index of IFRA Standards for the{' '}
              {absence.ifraAmendmentVersion} Amendment on{' '}
              <span className="font-mono text-sm">
                {datePart(absence.verifiedAt)}
              </span>
              : this material is not the subject of any restriction, prohibition
              or specification.
              <Cite sources={sources} sourceId={absence.sourceId} />
            </p>
            {absence.notes ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {absence.notes}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * The verified-absence footnote under a limits table: the material has a
 * Standard under one amendment and none under another, and the reader needs
 * both halves to know which applies to them.
 */
function IfraAbsenceList({
  absences,
  sources,
}: {
  absences: IfraAbsence[]
  sources: Citation[]
}) {
  return (
    <ul className="mt-4 space-y-1 text-sm">
      {absences.map((absence) => (
        <li key={absence.ifraAmendmentVersion}>
          No Standard under the IFRA {absence.ifraAmendmentVersion} Amendment
          {' — '}
          <span className="text-muted-foreground">
            verified{' '}
            <span className="font-mono">{datePart(absence.verifiedAt)}</span>
          </span>
          <Cite sources={sources} sourceId={absence.sourceId} />
        </li>
      ))}
    </ul>
  )
}

export function SafetyPanel({
  usageLimits,
  ifraAbsences,
  hazards,
  sources,
}: {
  usageLimits: UsageLimit[]
  ifraAbsences: IfraAbsence[]
  hazards: Hazard[]
  sources: Citation[]
}) {
  return (
    <div>
      <PanelSection
        title="IFRA usage limits"
        aside={<AmendmentBadges limits={usageLimits} absences={ifraAbsences} />}
      >
        {usageLimits.length === 0 && ifraAbsences.length === 0 ? (
          // Neither a limit nor a verified absence: nobody has looked yet.
          <EmptyState
            icon={ShieldAlert}
            headingLevel={3}
            title="No IFRA limits recorded yet"
            description="Category limits are hand-entered from the published standard and stamped with the amendment they were verified against. None have been entered for this material."
          />
        ) : usageLimits.length === 0 ? (
          // Looked, and found no Standard: a cited fact, not an empty state.
          <IfraAbsenceStatement absences={ifraAbsences} sources={sources} />
        ) : (
          <div className="-mx-gutter overflow-x-auto px-gutter md:mx-0 md:px-0">
            <table className="w-full min-w-144 border-collapse text-left">
              <caption className="sr-only">
                IFRA category limits, with the amendment each was verified
                against
              </caption>
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Category
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Limit
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Amendment
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Verified
                  </th>
                </tr>
              </thead>
              <tbody>
                {usageLimits.map((limit) => (
                  <tr
                    key={`${limit.categoryId}:${limit.ifraAmendmentVersion}`}
                    className="border-b border-border/60 align-top"
                  >
                    <th
                      scope="row"
                      className="py-3 pr-4 font-normal whitespace-nowrap"
                    >
                      <span className="font-mono text-sm text-muted-foreground">
                        {limit.categoryId}
                      </span>{' '}
                      {limit.categoryName}
                    </th>
                    <td className="py-3 pr-4">
                      <span
                        className={
                          limit.restrictionType === 'prohibition'
                            ? 'font-medium text-destructive'
                            : 'font-medium'
                        }
                      >
                        {limitPhrase(limit)}
                      </span>
                      <Cite sources={sources} sourceId={limit.sourceId} />
                      {limit.notes ? (
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {limit.notes}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 font-mono text-sm whitespace-nowrap">
                      {limit.ifraAmendmentVersion}
                    </td>
                    <td className="py-3 font-mono text-sm whitespace-nowrap text-muted-foreground">
                      {datePart(limit.verifiedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Without this, a Standard issued under an older amendment (Iso E
                Super's 49th) reads as stale beside materials checked against
                the latest index. */}
            <p className="mt-3 max-w-measure text-sm text-muted-foreground">
              The amendment is the one that issued the Standard. A Standard
              stays in force through later amendments until IFRA revises it; the
              verified date is when it was last checked.
            </p>
            {ifraAbsences.length > 0 ? (
              // A Standard under one amendment, none under another.
              <IfraAbsenceList absences={ifraAbsences} sources={sources} />
            ) : null}
          </div>
        )}
      </PanelSection>

      <PanelSection title="GHS hazards">
        {hazards.length === 0 ? (
          <EmptyState
            icon={TriangleAlert}
            headingLevel={3}
            title="No GHS hazard codes recorded"
            description="Hazard codes are recorded only when a cited safety data sheet or majority classification states them. Check a current supplier SDS before use."
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {hazards.map((hazard) => (
              <li key={hazard.code} className="py-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-sm font-medium">
                    {hazard.code}
                  </span>
                  <span className="min-w-0">
                    {hazard.description}
                    <Cite sources={sources} sourceId={hazard.sourceId} />
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hazard.category}
                </p>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>

      <p className="mt-10 max-w-measure text-sm text-muted-foreground">
        This page is a reference, not a regulatory authority. Check the current
        IFRA standard and the supplier&apos;s safety data sheet before you
        formulate.
      </p>
    </div>
  )
}
