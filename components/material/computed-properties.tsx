import type { ComputedProperties } from '@/lib/types'

import { Field, FieldList, PanelSection } from './section'

/**
 * Computed properties — logP, TPSA, heavy-atom count.
 *
 * These are deterministic recomputations from the SMILES string, not cited
 * facts, so they carry an `rdkitVersion` instead of a citation superscript
 * (AGENTS.md; docs/data-strategy.md's structural layer). The framing line is
 * part of the data: read as measurements they would be wrong, and read as
 * volatility predictions they would be worse.
 *
 * Renders nothing without a SMILES string — a mixture has no structure to
 * compute from, so any value sitting against one would be meaningless.
 */
export function ComputedPropertiesModule({
  computed,
  smiles,
}: {
  computed: ComputedProperties | null
  smiles: string | null
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
      <p className="mt-5 max-w-measure text-sm text-muted-foreground">
        Calculated from the structure with RDKit {computed.rdkitVersion}. These
        are recomputable context, not measured values and not cited facts — they
        carry a library version rather than a source.
      </p>
    </PanelSection>
  )
}
