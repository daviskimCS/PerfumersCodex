/**
 * 3D conformers — the pass that fills `material_conformers` (migration 0014).
 *
 * The "View in 3D" model on a material page is one computed low-energy shape
 * of the molecule. Like the 2D drawing (`./draw.ts`) it is a deterministic
 * function of the SMILES and the toolkit, so the seed computes it once, here
 * in Node, and the page hands the stored molfile to the viewer. The reader's
 * browser never runs a conformer search.
 *
 * Method: OpenChemLib's ConformerGenerator with a fixed seed proposes up to
 * `CONFORMER_CANDIDATES` collision-free conformers from its torsion
 * database; each is minimised with MMFF94s+ and the lowest-energy one is
 * kept, turned so its longest axis lies along x (`alignToPrincipalAxes`).
 * Explicit hydrogens are part of the model: a ball-and-stick picture without
 * them misstates the shape, and the force field needs them anyway.
 *
 * Rules, which follow `./draw.ts` where they can:
 *
 * - **A NULL-SMILES material gets no conformer and no error.** A mixture has
 *   no single structure.
 * - **Some molecules are skipped on purpose.** One conformer is a fair
 *   picture of a rigid molecule and a misleading one of a floppy molecule.
 *   A macrocycle (any ring of `MACROCYCLE_MIN_RING` atoms or more, like
 *   Civetone's 17) or a molecule with more than `MAX_ROTATABLE_BONDS`
 *   rotatable bonds folds into many shapes of similar energy, so it gets no
 *   model and its page shows no button.
 * - **The model must keep the SMILES's stereochemistry.** Every stereocentre
 *   and double bond the SMILES specifies is read back from the stored 3D
 *   coordinates and compared; a mismatch would show the wrong isomer, so it
 *   is a failure. An unspecified centre gets whichever configuration the
 *   search found, which is as true as the SMILES.
 * - **A failure is a warning, not an abort.** Unlike the drawing, the model
 *   is an optional extra beneath it: a molecule OpenChemLib cannot embed
 *   loses its button and the seed says so, rather than refusing the corpus.
 * - **A stored conformer is reused while its inputs are unchanged.** The
 *   result depends on the SMILES, the OpenChemLib version and `METHOD`. When
 *   all three match the stored row, the seed keeps the stored molfile
 *   instead of recomputing it. Recomputing would cost seconds per material,
 *   and a different Node release could round a coordinate differently,
 *   which would change the review fingerprint and hide a published page.
 */

import * as OCL from 'openchemlib'

/** How many candidate conformers are minimised before the lowest is kept. */
export const CONFORMER_CANDIDATES = 20
/** Fixed, so the same inputs always give the same model. */
export const CONFORMER_SEED = 1
/** Rings this size or larger are macrocycles: too many shapes for one model. */
export const MACROCYCLE_MIN_RING = 12
/** More rotatable bonds than this and one shape stops being representative. */
export const MAX_ROTATABLE_BONDS = 5

/**
 * Everything about the computation other than the SMILES and the toolkit
 * version. Change any constant above and change this string with it: it is
 * what tells the seed a stored conformer is stale.
 */
export const METHOD = `MMFF94s+ lowest of ${CONFORMER_CANDIDATES}, seed ${CONFORMER_SEED}, principal axes`

export const OPENCHEMLIB_VERSION: string = OCL.version

/** The `materials` fields this pass needs. */
export interface ConformableMaterial {
  slug: string
  smiles: string | null
}

/** A `material_conformers` row as the seed reads and writes it. */
export interface StoredConformer {
  smiles: string
  molfile: string
  openchemlibVersion: string
  method: string
}

export type ConformerOutcome =
  | { kind: 'computed' | 'reused'; conformer: StoredConformer }
  | { kind: 'skipped'; reason: string }
  | { kind: 'failed'; reason: string }

let resourcesRegistered = false

/**
 * One material's outcome. `stored` is the row the database already holds for
 * it, if any. Returns null for a NULL-SMILES material: nothing to say.
 */
export function conformerFor(
  material: ConformableMaterial,
  stored: StoredConformer | undefined
): ConformerOutcome | null {
  const { smiles } = material
  if (smiles === null) return null

  if (
    stored !== undefined &&
    stored.smiles === smiles &&
    stored.openchemlibVersion === OPENCHEMLIB_VERSION &&
    stored.method === METHOD
  ) {
    return { kind: 'reused', conformer: stored }
  }

  if (!resourcesRegistered) {
    // The force-field and torsion tables ship as a JSON file beside the
    // module; reading it once is the Node.js path the library documents.
    OCL.Resources.registerFromNodejs()
    resourcesRegistered = true
  }

  let molecule: OCL.Molecule
  try {
    molecule = OCL.Molecule.fromSmiles(smiles)
  } catch {
    return {
      kind: 'failed',
      reason: `OpenChemLib cannot parse SMILES "${smiles}"`,
    }
  }

  const skip = reasonToSkip(molecule)
  if (skip !== null) return { kind: 'skipped', reason: skip }

  const molfile = lowestEnergyConformer(molecule)
  if (molfile === null) {
    return {
      kind: 'failed',
      reason: 'OpenChemLib found no collision-free conformer',
    }
  }
  if (!keepsStereochemistry(smiles, molfile)) {
    return {
      kind: 'failed',
      reason:
        'the computed model does not keep the stereochemistry the SMILES specifies',
    }
  }
  return {
    kind: 'computed',
    conformer: {
      smiles,
      molfile,
      openchemlibVersion: OPENCHEMLIB_VERSION,
      method: METHOD,
    },
  }
}

/** Why one conformer would mislead for this molecule, or null if it would not. */
export function reasonToSkip(molecule: OCL.Molecule): string | null {
  molecule.ensureHelperArrays(OCL.Molecule.cHelperRings)
  let largestRing = 0
  for (let atom = 0; atom < molecule.getAtoms(); atom++) {
    largestRing = Math.max(largestRing, molecule.getAtomRingSize(atom))
  }
  if (largestRing >= MACROCYCLE_MIN_RING) {
    return `macrocycle (${largestRing}-membered ring): too many shapes of similar energy for one model`
  }
  const rotatable = molecule.getRotatableBondCount()
  if (rotatable > MAX_ROTATABLE_BONDS) {
    return `${rotatable} rotatable bonds: too flexible for one model to be representative`
  }
  return null
}

function lowestEnergyConformer(molecule: OCL.Molecule): string | null {
  const generator = new OCL.ConformerGenerator(CONFORMER_SEED)
  // Systematic over the most likely torsions: with a fixed seed it visits
  // the same candidates in the same order on every run.
  if (
    !generator.initializeConformers(molecule, {
      strategy: OCL.ConformerGenerator.STRATEGY_LIKELY_SYSTEMATIC,
    })
  ) {
    return null
  }

  let best: { molfile: string; energy: number } | null = null
  for (let i = 0; i < CONFORMER_CANDIDATES; i++) {
    const candidate = generator.getNextConformerAsMolecule()
    if (candidate === null) break
    const field = new OCL.ForceFieldMMFF94(candidate, 'MMFF94s+')
    field.minimise()
    const energy = field.getTotalEnergy()
    if (Number.isFinite(energy) && (best === null || energy < best.energy)) {
      alignToPrincipalAxes(candidate)
      best = { molfile: normalizeMolfile(candidate.toMolfile()), energy }
    }
  }
  return best?.molfile ?? null
}

/**
 * True when every stereocentre and stereo double bond the SMILES specifies has
 * the same configuration in the model. Atom and bond indices line up: the
 * model is the SMILES molecule with hydrogens appended after its atoms.
 */
export function keepsStereochemistry(smiles: string, molfile: string): boolean {
  const { Molecule } = OCL
  const specified = Molecule.fromSmiles(smiles)
  specified.ensureHelperArrays(Molecule.cHelperParities)
  const model = Molecule.fromMolfile(molfile)
  model.ensureHelperArrays(Molecule.cHelperParities)

  for (let atom = 0; atom < specified.getAtoms(); atom++) {
    const parity = specified.getAtomParity(atom)
    const defined =
      parity === Molecule.cAtomParity1 || parity === Molecule.cAtomParity2
    if (defined && model.getAtomParity(atom) !== parity) return false
  }
  for (let bond = 0; bond < specified.getBonds(); bond++) {
    const parity = specified.getBondParity(bond)
    const defined =
      parity === Molecule.cBondParityEor1 || parity === Molecule.cBondParityZor2
    if (!defined) continue
    const same = model.getBond(
      specified.getBondAtom(0, bond),
      specified.getBondAtom(1, bond)
    )
    if (same === -1 || model.getBondParity(same) !== parity) return false
  }
  return true
}

/**
 * Moves the molecule to a canonical pose: heavy-atom centroid at the origin,
 * longest axis along x, shortest along z (towards the reader). The viewer
 * opens on that pose, which shows the molecule broadside, filling the
 * landscape plate, instead of in whatever orientation the search left it.
 * A proper rotation, never a reflection, so the handedness of every centre
 * is untouched.
 */
export function alignToPrincipalAxes(molecule: OCL.Molecule): void {
  const atoms = molecule.getAllAtoms()
  const heavy: number[] = []
  for (let atom = 0; atom < atoms; atom++) {
    if (molecule.getAtomicNo(atom) !== 1) heavy.push(atom)
  }
  if (heavy.length < 2) return

  const point = (atom: number): [number, number, number] => [
    molecule.getAtomX(atom),
    molecule.getAtomY(atom),
    molecule.getAtomZ(atom),
  ]
  const centroid = [0, 0, 0]
  for (const atom of heavy) {
    point(atom).forEach(
      (value, axis) => (centroid[axis] += value / heavy.length)
    )
  }
  const covariance = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  for (const atom of heavy) {
    const d = point(atom).map((value, axis) => value - centroid[axis])
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) covariance[i][j] += d[i] * d[j]
    }
  }

  const [first, second] = principalAxes(covariance)
  const third = cross(first, second) // right-handed: a rotation, not a mirror
  for (let atom = 0; atom < atoms; atom++) {
    const d = point(atom).map((value, axis) => value - centroid[axis])
    molecule.setAtomX(atom, dot(d, first))
    molecule.setAtomY(atom, dot(d, second))
    molecule.setAtomZ(atom, dot(d, third))
  }
}

type Vector = [number, number, number]

/**
 * The two largest-variance unit eigenvectors of a symmetric 3×3 matrix, by
 * cyclic Jacobi rotations. Each is signed so its largest component is
 * positive, so the same molecule always lands the same way round.
 */
function principalAxes(matrix: number[][]): [Vector, Vector] {
  const a = matrix.map((row) => [...row])
  const v = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ]
  for (let sweep = 0; sweep < 50; sweep++) {
    const off = a[0][1] ** 2 + a[0][2] ** 2 + a[1][2] ** 2
    if (off < 1e-18) break
    for (const [p, q] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ]) {
      if (Math.abs(a[p][q]) < 1e-30) continue
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q])
      const t =
        Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
      const c = 1 / Math.sqrt(t * t + 1)
      const s = t * c
      for (let k = 0; k < 3; k++) {
        const akp = a[k][p]
        const akq = a[k][q]
        a[k][p] = c * akp - s * akq
        a[k][q] = s * akp + c * akq
      }
      for (let k = 0; k < 3; k++) {
        const apk = a[p][k]
        const aqk = a[q][k]
        a[p][k] = c * apk - s * aqk
        a[q][k] = s * apk + c * aqk
      }
      for (let k = 0; k < 3; k++) {
        const vkp = v[k][p]
        const vkq = v[k][q]
        v[k][p] = c * vkp - s * vkq
        v[k][q] = s * vkp + c * vkq
      }
    }
  }
  const order = [0, 1, 2].sort((i, j) => a[j][j] - a[i][i])
  const column = (i: number): Vector => {
    const vector: Vector = [v[0][i], v[1][i], v[2][i]]
    const largest = vector.reduce(
      (best, value) => (Math.abs(value) > Math.abs(best) ? value : best),
      0
    )
    return largest < 0 ? (vector.map((value) => -value) as Vector) : vector
  }
  return [column(order[0]), column(order[1])]
}

function dot(a: number[], b: number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function cross(a: Vector, b: Vector): Vector {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

/**
 * The molfile with a fixed header. OpenChemLib titles each molecule with a
 * per-process counter ("#5") on line 1 and writes its own program line on
 * line 2; either could make the stored text differ between two runs over the
 * same inputs. The viewer reads only the counts, atom and bond blocks.
 */
export function normalizeMolfile(molfile: string): string {
  const lines = molfile.split('\n')
  if (lines.length < 3) return molfile
  lines[0] = ''
  lines[1] = '  OpenChemLib'
  return lines.join('\n')
}
