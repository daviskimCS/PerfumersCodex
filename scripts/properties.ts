/**
 * Computed properties — the pass that fills `material_computed_properties`.
 *
 * logP, TPSA and heavy-atom count are deterministic recomputations from
 * `materials.smiles`, not cited facts, so the seed derives them here and
 * stamps every row with the RDKit version, exactly as it does for classes
 * (`./classify`) and drawings (`./draw`). This replaces the research script
 * that produced the values for Iso E Super, Javanol and Civetone outside
 * either repository (docs/cheminformatics.md): RDKit.js 2025.03.4 reproduces
 * all three exactly at the precision below, so a re-seed leaves their
 * reviewed fingerprints where they were.
 *
 * Rules, the same as the other derived passes:
 *
 * - **A NULL-SMILES material gets no entry and no error.** A mixture has no
 *   single structure to compute from.
 * - **A SMILES RDKit cannot parse is a loud failure.** In practice classify
 *   and draw stop the run first; this guard keeps the module honest alone.
 * - **Every WASM handle is released**, in a `finally`.
 *
 * Values are rounded where the hand-run script rounded them (logP to four
 * places, TPSA to two). The rounding is part of the fingerprint: a change
 * here changes every reviewed page that shows the values.
 */

import type { RDKitModule } from '@rdkit/rdkit'

/** A computation failure the seed reports as one plain line, not a stack. */
export class PropertiesError extends Error {}

/** The `materials` fields the computation needs. */
export interface ComputableMaterial {
  slug: string
  smiles: string | null
  /** What the data file supplied, if anything; checked against the result. */
  computed_properties?: {
    logp: number | null
    tpsa: number | null
    heavy_atom_count: number | null
    rdkit_version: string
  } | null
}

export interface PropertyValues {
  /** Crippen logP. */
  logp: number
  /** Topological polar surface area, Å². */
  tpsa: number
  heavyAtomCount: number
}

export interface MaterialProperties {
  /** Material slug → values. A NULL-SMILES material is absent. */
  valuesByMaterial: Map<string, PropertyValues>
  /** `RDKit.version()`, the provenance stamp on every row. */
  rdkitVersion: string
}

const LOGP_PLACES = 4
const TPSA_PLACES = 2

function round(value: number, places: number): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

/** The descriptor keys RDKit.js's `get_descriptors()` uses. */
interface RdkitDescriptors {
  CrippenClogP?: unknown
  tpsa?: unknown
  NumHeavyAtoms?: unknown
}

function finite(value: unknown, what: string, slug: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new PropertiesError(
      `${slug}: RDKit returned no ${what}, so its computed properties cannot be written`
    )
  }
  return value
}

export function computeProperties(
  rdkit: RDKitModule,
  materials: readonly ComputableMaterial[]
): MaterialProperties {
  const valuesByMaterial = new Map<string, PropertyValues>()

  for (const material of materials) {
    if (material.smiles === null) continue

    const molecule = rdkit.get_mol(material.smiles)
    try {
      if (molecule === null || !molecule.is_valid()) {
        throw new PropertiesError(
          `${material.slug}: RDKit cannot parse SMILES "${material.smiles}", so its properties cannot be computed`
        )
      }
      const descriptors = JSON.parse(
        molecule.get_descriptors()
      ) as RdkitDescriptors
      valuesByMaterial.set(material.slug, {
        logp: round(
          finite(descriptors.CrippenClogP, 'logP', material.slug),
          LOGP_PLACES
        ),
        tpsa: round(
          finite(descriptors.tpsa, 'TPSA', material.slug),
          TPSA_PLACES
        ),
        heavyAtomCount: finite(
          descriptors.NumHeavyAtoms,
          'heavy-atom count',
          material.slug
        ),
      })
    } finally {
      molecule?.delete()
    }
  }

  return { valuesByMaterial, rdkitVersion: rdkit.version() }
}

/**
 * Files written before the seed derived these values may still carry a
 * `computed_properties` block. One that matches what the seed computed is
 * redundant and harmless; one that disagrees means the file claims values
 * its structure does not produce, so the seed refuses it rather than choose
 * silently. Returns one message per disagreeing material.
 */
export function suppliedPropertyConflicts(
  materials: readonly ComputableMaterial[],
  computed: MaterialProperties
): string[] {
  const conflicts: string[] = []
  for (const material of materials) {
    const supplied = material.computed_properties
    if (supplied === null || supplied === undefined) continue
    const derived = computed.valuesByMaterial.get(material.slug)
    const agrees =
      derived !== undefined &&
      supplied.logp === derived.logp &&
      supplied.tpsa === derived.tpsa &&
      supplied.heavy_atom_count === derived.heavyAtomCount &&
      supplied.rdkit_version === computed.rdkitVersion
    if (!agrees) {
      conflicts.push(
        `${material.slug}: computed_properties in the file disagree with RDKit ${computed.rdkitVersion} ` +
          `(file: logP ${supplied.logp}, TPSA ${supplied.tpsa}, heavy atoms ${supplied.heavy_atom_count}, ${supplied.rdkit_version}; ` +
          `derived: ${
            derived === undefined
              ? 'nothing'
              : `logP ${derived.logp}, TPSA ${derived.tpsa}, heavy atoms ${derived.heavyAtomCount}`
          }). The seed derives these now: delete the block from the file`
      )
    }
  }
  return conflicts
}
