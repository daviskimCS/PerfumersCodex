/**
 * Structural classification — the pass that fills `material_chemical_classes`.
 *
 * Class membership ("this is an ester", "this is a macrocyclic ketone") is a
 * deterministic recomputation from `materials.smiles`, not a cited fact: the
 * seed derives it here and stamps every row with the RDKit version that
 * produced it, exactly as it does for computed properties and similarity
 * (AGENTS.md). Nothing in a data file can claim a class the structure does not
 * support, because no data file is consulted.
 *
 * Doing it at seed time rather than in the browser is the whole point of the
 * feature: browsing by class becomes a plain SQL filter on an indexed column
 * instead of a 6.6 MB WebAssembly download on the materials page.
 *
 * Three rules this module exists to enforce:
 *
 * - **A NULL-SMILES material gets no rows and no error.** Naturals are
 *   mixtures with no single structure; every cheminformatics feature skips
 *   them rather than erroring (AGENTS.md).
 * - **A SMILES RDKit cannot parse is a loud failure.** The seed must refuse to
 *   write a corpus it cannot classify — silently skipping the material would
 *   publish it as belonging to no class, which reads as a fact rather than as
 *   the pipeline failure it is.
 * - **Every WASM handle is released.** `get_mol`/`get_qmol` allocate on the
 *   emscripten heap and are not garbage collected; leaking one per molecule
 *   across a corpus is a real leak, so each is `delete()`d in a `finally`.
 *
 * Cost discipline: the caller loads RDKit ONCE (`loadRdkit`) and passes it in,
 * and `classifyMaterials` compiles each class SMARTS once and reuses the query
 * across the whole corpus. The module is otherwise database-free and pure, so
 * `scripts/classify.test.ts` runs without Postgres.
 */

import { createRequire } from 'node:module'
import path from 'node:path'

import type { JSMol, RDKitModule } from '@rdkit/rdkit'

/** A classification failure the seed reports as one plain line, not a stack. */
export class ClassificationError extends Error {}

/** The `chemical_classes` fields classification actually needs. */
export interface ClassPattern {
  slug: string
  smarts: string
}

/** The `materials` fields classification actually needs. */
export interface ClassifiableMaterial {
  slug: string
  smiles: string | null
}

export interface MaterialClassification {
  /**
   * Material slug → matched class slugs, in the order the classes were given
   * (their curated `sort_order`). A NULL-SMILES material has an entry with an
   * empty array — "classified, matched nothing" — never a missing entry.
   */
  classesByMaterial: Map<string, string[]>
  /** `RDKit.version()`, e.g. "2025.03.4" — the provenance stamp on every row. */
  rdkitVersion: string
}

/**
 * `RDKit_minimal.js` is an emscripten UMD bundle with no ESM entry point, so
 * it is loaded through `createRequire` rather than `import`. `locateFile`
 * points the loader at the `.wasm` beside it — without it emscripten resolves
 * the wasm relative to the process cwd, and the seed is run from wherever the
 * maker happens to be standing.
 *
 * The published `RDKitLoader` type declares `locateFile` as `() => string`,
 * which the real loader calls with the filename; the local type below is the
 * honest signature.
 */
type RdkitInit = (options: {
  locateFile: (file: string) => string
}) => Promise<RDKitModule>

/**
 * Loads RDKit.js in plain Node. Call this ONCE per process — it instantiates
 * a 6.6 MB WebAssembly module, and a corpus with no SMILES at all should never
 * call it (see `scripts/seed.ts`).
 */
export async function loadRdkit(): Promise<RDKitModule> {
  const require = createRequire(import.meta.url)
  const entry = require.resolve('@rdkit/rdkit/dist/RDKit_minimal.js')
  const dist = path.dirname(entry)
  const init = require(entry) as RdkitInit
  return init({ locateFile: (file) => path.join(dist, file) })
}

/**
 * True when RDKit accepts `smarts` as a query.
 *
 * Note what this deliberately does NOT accept: the caller must reject an empty
 * or whitespace-only pattern before it gets here. RDKit compiles `""` into a
 * perfectly valid query molecule with no atoms, whose match result is
 * indistinguishable from "no match" — so an empty pattern would not error, it
 * would quietly define a class nothing can ever belong to.
 * `lib/validation/material-data.ts` rejects it structurally.
 */
export function isValidSmarts(rdkit: RDKitModule, smarts: string): boolean {
  const query = rdkit.get_qmol(smarts)
  if (query === null) return false
  query.delete()
  return true
}

/**
 * True when `molecule` contains `query` as a substructure.
 *
 * `get_substruct_match` returns a JSON object, `{}` when there is no match.
 * The match is read through its `atoms` array rather than through the object
 * being nonempty, so a degenerate zero-atom query can never be read as a hit.
 */
function matches(molecule: JSMol, query: JSMol): boolean {
  const raw = molecule.get_substruct_match(query)
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return false
  }
  const atoms = (parsed as { atoms?: unknown }).atoms
  return Array.isArray(atoms) && atoms.length > 0
}

/**
 * Classifies a whole corpus against a whole class list.
 *
 * `rdkit` is passed in rather than loaded here so one process pays for the
 * WASM once. Each class SMARTS is compiled once, up front, and reused across
 * every molecule — compiling per molecule would be O(materials x classes)
 * parses for no gain.
 *
 * Throws `ClassificationError` if any class SMARTS fails to compile or any
 * non-null SMILES fails to parse. Both lists are accumulated in full before
 * throwing: a corpus with four bad structures should report four, not make the
 * maker rerun the seed four times.
 */
export function classifyMaterials(
  rdkit: RDKitModule,
  materials: readonly ClassifiableMaterial[],
  classes: readonly ClassPattern[]
): MaterialClassification {
  const compiled: { slug: string; query: JSMol }[] = []
  const badPatterns: string[] = []

  try {
    for (const chemicalClass of classes) {
      const query = rdkit.get_qmol(chemicalClass.smarts)
      if (query === null) {
        badPatterns.push(
          `${chemicalClass.slug} (${JSON.stringify(chemicalClass.smarts)})`
        )
        continue
      }
      compiled.push({ slug: chemicalClass.slug, query })
    }
    if (badPatterns.length > 0) {
      throw new ClassificationError(
        `RDKit could not compile ${badPatterns.length === 1 ? 'this SMARTS pattern' : 'these SMARTS patterns'}: ${badPatterns.join(', ')}`
      )
    }

    const classesByMaterial = new Map<string, string[]>()
    const unparseable: string[] = []

    for (const material of materials) {
      // A mixture has no single structure to match against. No rows, no error
      // — this is the expected shape of every natural in the corpus.
      if (material.smiles === null) {
        classesByMaterial.set(material.slug, [])
        continue
      }

      const molecule = rdkit.get_mol(material.smiles)
      if (molecule === null) {
        unparseable.push(
          `${material.slug} (${JSON.stringify(material.smiles)})`
        )
        continue
      }
      try {
        classesByMaterial.set(
          material.slug,
          compiled
            .filter((entry) => matches(molecule, entry.query))
            .map((entry) => entry.slug)
        )
      } finally {
        molecule.delete()
      }
    }

    if (unparseable.length > 0) {
      throw new ClassificationError(
        `RDKit could not parse the SMILES of ${unparseable.length === 1 ? 'this material' : 'these materials'}: ${unparseable.join(', ')}`
      )
    }

    return { classesByMaterial, rdkitVersion: rdkit.version() }
  } finally {
    for (const entry of compiled) entry.query.delete()
  }
}
