import type { JSMol, RDKitModule } from '@rdkit/rdkit'

/**
 * The whole cheminformatics half of `/structure`, in one function with no
 * React and no database in it.
 *
 * Kept separate from the component for the same reason `lib/search/rank.ts` is
 * kept separate from the search page (docs/architecture.md D2): the part that
 * decides *which materials match* should be readable, and provable, without a
 * DOM or a Postgres connection around it.
 *
 * MEMORY. Every handle RDKit hands back is a C++ object on the WASM heap that
 * the JavaScript garbage collector knows nothing about, so each one is
 * `delete()`d in a `finally` — the house rule from
 * `components/material/structure-canvas.tsx`. Over ~50 candidates a leaked
 * molecule per keystroke would be invisible right up until it wasn't.
 *
 * FAILURE POSTURE. Nothing here throws. An unparseable pattern is a *result*
 * (`invalid`) the page renders calmly beside the input, and an unparseable
 * SMILES drops one material from the answer rather than taking the page down
 * with it. This function is called from a `useMemo` during render, so a throw
 * here would land in `error.tsx` — which is exactly the wrong place for "you
 * typed a bracket wrong".
 */

/** The minimum a candidate needs to be matched. */
export interface MatchCandidate {
  id: string
  /** Never null: NULL-SMILES materials are excluded before they get here. */
  smiles: string
}

export type MatchOutcome =
  /** `get_qmol` could not read the pattern. Not an error — a message. */
  | { status: 'invalid' }
  /** Ids of the candidates containing the fragment. Possibly empty. */
  | { status: 'matched'; ids: ReadonlySet<string> }

/**
 * Which of `candidates` contain `smarts` as a substructure.
 *
 * **`smarts` must already be non-empty and trimmed.** RDKit accepts `""` as a
 * *valid* query — `get_qmol('')` returns a live handle whose `is_valid()` is
 * true — so an empty pattern cannot be distinguished here from a real one, and
 * whatever it then answers (2025.03.4 reports no match for every molecule) is
 * not an answer to any question a reader asked. The caller guards it instead;
 * see the empty-pattern branch in `structure-search.tsx`.
 *
 * The query is compiled once and reused across every candidate — compiling per
 * material would be the expensive part of an otherwise instant loop.
 */
export function matchPattern(
  rdkit: RDKitModule,
  smarts: string,
  candidates: readonly MatchCandidate[]
): MatchOutcome {
  let query: JSMol | null = null

  try {
    query = rdkit.get_qmol(smarts)
    // 2025.03.4 returns null for everything malformed we could throw at it
    // ("not a smarts", "[[", "c1ccccc1)"), but the `is_valid()` check costs
    // nothing and covers a build that prefers to hand back a dead handle.
    if (query === null || !query.is_valid()) return { status: 'invalid' }

    const ids = new Set<string>()
    for (const candidate of candidates) {
      if (containsFragment(rdkit, query, candidate.smiles)) {
        ids.add(candidate.id)
      }
    }
    return { status: 'matched', ids }
  } catch {
    // Nothing observed so far throws out of `get_qmol`, so this is the
    // belt-and-braces branch: a future build that raises instead of returning
    // null still reads as "that pattern isn't valid" rather than as a crash.
    return { status: 'invalid' }
  } finally {
    query?.delete()
  }
}

/** One candidate, tested against an already-compiled query. */
function containsFragment(
  rdkit: RDKitModule,
  query: JSMol,
  smiles: string
): boolean {
  let mol: JSMol | null = null

  try {
    mol = rdkit.get_mol(smiles)
    if (mol === null || !mol.is_valid()) return false
    return isHit(mol.get_substruct_match(query))
  } catch {
    return false
  } finally {
    mol?.delete()
  }
}

/**
 * `get_substruct_match` returns a JSON *string*: `{"atoms":[…],"bonds":[…]}`
 * for a hit and `{}` for a miss. So "did it match" is "did it name at least
 * one atom" — checking for a non-empty `atoms` array rather than for
 * truthiness, because `"{}"` is a perfectly truthy string.
 */
function isHit(raw: string): boolean {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return false
    const atoms = (parsed as { atoms?: unknown }).atoms
    return Array.isArray(atoms) && atoms.length > 0
  } catch {
    return false
  }
}
