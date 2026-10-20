import Link from 'next/link'
import { Calculator } from 'lucide-react'

import type { ComputedProperties } from '@/lib/types'

import { Field, FieldList, PanelSection } from './section'

/**
 * Computed properties — logP, TPSA, heavy-atom count.
 *
 * These are deterministic recomputations from the SMILES string, not cited
 * facts, so they carry an `rdkitVersion` instead of a citation superscript
 * (AGENTS.md; docs/data-strategy.md's structural layer). The framing line is
 * part of the data: read as measurements they would be wrong, and read as
 * volatility predictions they would be worse. That framing and what each
 * property means sit behind the heading's info button.
 *
 * Renders nothing without a SMILES string — a mixture has no structure to
 * compute from, so any value sitting against one would be meaningless.
 *
 * `mapHref` links to the volatility map with this material highlighted. A
 * link, never the chart itself: the map shows other materials' data, which
 * this page's review fingerprint does not cover.
 */
export function ComputedPropertiesModule({
  computed,
  smiles,
  mapHref,
}: {
  computed: ComputedProperties | null
  smiles: string | null
  /** Null when the material is not plotted (no molecular weight or logP). */
  mapHref: string | null
}) {
  if (smiles === null || computed === null) return null
  if (
    computed.logp === null &&
    computed.tpsa === null &&
    computed.heavyAtomCount === null
  ) {
    return null
  }

  return (
    <PanelSection
      title="Computed properties"
      icon={Calculator}
      info={
        <div className="space-y-2">
          <p>
            Calculated from the structure with RDKit {computed.rdkitVersion}.
            These are recomputable context, not measured values and not cited
            facts: they carry a library version rather than a source.
          </p>
          <p>
            <span className="text-foreground">logP</span> (Crippen): how
            strongly the molecule prefers oil to water, on a log scale. Higher
            is more oil-soluble; each step of 1 is ten times more.
          </p>
          <p>
            <span className="text-foreground">TPSA</span>: topological polar
            surface area, the surface contributed by oxygen and nitrogen atoms
            and their hydrogens. Lower is less polar.
          </p>
          <p>
            <span className="text-foreground">Heavy atoms</span>: every atom
            except hydrogen, a rough measure of molecular size.
          </p>
        </div>
      }
      aside={
        <span className="font-mono text-xs text-muted-foreground">
          RDKit {computed.rdkitVersion}
        </span>
      }
    >
      <FieldList>
        <Field term="logP" value={computed.logp} mono />
        <Field
          term="TPSA"
          value={computed.tpsa === null ? null : `${computed.tpsa} Å²`}
          mono
        />
        <Field term="Heavy atoms" value={computed.heavyAtomCount} mono />
      </FieldList>
      {mapHref === null ? null : (
        <p className="mt-4 text-sm">
          <Link
            href={mapHref}
            className="text-brand underline underline-offset-4 hover:no-underline"
          >
            See where it sits on the volatility map
          </Link>
        </p>
      )}
    </PanelSection>
  )
}
