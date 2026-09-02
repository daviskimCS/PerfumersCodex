/**
 * Seed pipeline — CHECKLIST P1-G, wave-4 W4-A.
 *
 * Reads the `perfumers-codex-data` JSON export from a directory named on the
 * command line, validates the ENTIRE set before opening a connection, writes
 * it into Postgres idempotently, and refreshes the search view at the end.
 *
 *   npm run db:seed -- ../perfumers-codex-data/out
 *   npm run db:seed -- ./scripts/fixtures --prune
 *
 * Re-running on unchanged input is a no-op in everything the site can observe:
 * no duplicate rows, no changed values, no bumped `materials.updated_at` (which
 * is search ranking rule 5's tie-break — bumping it every run would silently
 * reorder results).
 *
 * Write order, and why it is not negotiable:
 *
 *   1. reference tables (families, usage_categories, hazard_codes) — the first
 *      family/limit/hazard insert FKs into them;
 *   2. every material and its child rows;
 *   3. `material_similarity` — its FKs point at OTHER materials, so a one-pass
 *      per-material write dies on the first forward reference;
 *   4. optional pruning, then `REFRESH MATERIALIZED VIEW CONCURRENTLY`
 *      (outside every transaction — Postgres refuses it inside one).
 *
 * Four decisions worth knowing about:
 *
 * - **Source identity.** `sources` has no `key` column, so the input's stable
 *   per-file `key` has to become identity some other way. Sources WITH a url
 *   are keyed by url — that is exactly what the partial unique index
 *   `sources_url_uniq` exists for, and it also lets two materials cite one
 *   document without duplicating the row. Sources WITHOUT a url (books,
 *   interviews) get a deterministic UUIDv5 derived from
 *   `<material slug>\0<source key>`, so the same input always addresses the
 *   same row. Keys are per-file (two materials may both use "ifra-51" for
 *   different documents), hence the material slug in the derivation.
 *   Sources are never deleted: dropping a citation from the input leaves an
 *   unreferenced `sources` row behind, which is deliberate — deleting one
 *   would race the FKs of every other material that might cite it, and an
 *   orphaned citation costs nothing but a row.
 *
 * - **Child rows are replaced, not upserted** (wave-4): `material_synonyms`
 *   and `landmark_uses` have no natural key, so only delete-and-reinsert can
 *   be idempotent. The delete and the reinsert share one transaction, so a
 *   material is never briefly missing its synonyms.
 *
 * - **`material_descriptions` is the one exception to that.** Editorial
 *   content is soft-deleted, never hard-deleted (AGENTS.md), and the schema's
 *   partial unique index is explicitly built to let a retired description
 *   coexist with its replacement. So: identical description → untouched;
 *   changed → the old row is soft-deleted and the new one inserted (history
 *   preserved); dropped from the input → soft-deleted. Hard-deleting it would
 *   both break the soft-delete rule and reset `created_at` on every run.
 *
 * - **This file imports `db/schema.ts` directly**, which architecture D1
 *   otherwise reserves for `lib/db/`. D1 governs app code — pages and
 *   components go through `lib/db/` and receive `lib/types.ts` shapes. This is
 *   an operator tool that writes tables `lib/db/` has no write functions for,
 *   and the alternative (hand-written SQL strings) would be worse on every
 *   axis. The Drizzle client itself still comes from `lib/db/`.
 *
 * Out of scope by rule: `search_queries`, `correction_submissions`, and every
 * user-owned table. The seed never touches them.
 */

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { config as loadEnvFile } from 'dotenv'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'

import {
  families,
  hazardCodes,
  landmarkUses,
  materialComputedProperties,
  materialDescriptions,
  materialFamilies,
  materialHazards,
  materialSimilarity,
  materialSynonyms,
  materialUsageGuidance,
  materialUsageLimits,
  materials,
  odorPredictions,
  sources,
  usageCategories,
} from '@/db/schema'
import { db } from '@/lib/db'
import {
  FAMILIES_FILE,
  HAZARD_CODES_FILE,
  REFERENCE_FILES,
  USAGE_CATEGORIES_FILE,
  validateMaterialData,
  type FamilyRecord,
  type HazardCodeRecord,
  type MaterialDataBundle,
  type MaterialDataFile,
  type MaterialDataInput,
  type MaterialFile,
  type MaterialSourceRecord,
  type UsageCategoryRecord,
} from '@/lib/validation/material-data'

const USAGE = `usage: npm run db:seed -- <data-directory> [--prune [--force-prune]]`

/** Expected failure: printed as one plain line, no stack trace. */
class SeedAbort extends Error {}

function log(message: string): void {
  console.log(`seed: ${message}`)
}

/* -------------------------------------------------------------------------
 * Command line
 * ---------------------------------------------------------------------- */

interface SeedOptions {
  /** Absolute, resolved from the invoking cwd. Never hardcoded. */
  directory: string
  prune: boolean
  forcePrune: boolean
}

function parseArgs(argv: string[]): SeedOptions {
  let directory: string | null = null
  let prune = false
  let forcePrune = false

  for (const arg of argv) {
    if (arg === '--prune') {
      prune = true
    } else if (arg === '--force-prune') {
      forcePrune = true
    } else if (arg.startsWith('-')) {
      throw new SeedAbort(`unknown flag "${arg}"\n${USAGE}`)
    } else if (directory !== null) {
      throw new SeedAbort(
        `expected one data directory, got two ("${directory}" and "${arg}")\n${USAGE}`
      )
    } else {
      directory = arg
    }
  }

  if (directory === null) {
    throw new SeedAbort(`no data directory given\n${USAGE}`)
  }
  // --force-prune only lifts the size guard; it must never silently turn
  // pruning ON, or a stray flag would delete without anyone asking it to.
  if (forcePrune && !prune) {
    throw new SeedAbort(
      `--force-prune only lifts the size guard on --prune; pass both or neither\n${USAGE}`
    )
  }

  return { directory: path.resolve(directory), prune, forcePrune }
}

/* -------------------------------------------------------------------------
 * Reading the input set
 * ---------------------------------------------------------------------- */

function readJsonFile(directory: string, filename: string): MaterialDataFile {
  const fullPath = path.join(directory, filename)
  let raw: string
  try {
    raw = readFileSync(fullPath, 'utf8')
  } catch (cause) {
    throw new SeedAbort(
      `${filename}: cannot be read (${(cause as Error).message})`
    )
  }
  try {
    return { filename, data: JSON.parse(raw) as unknown }
  } catch (cause) {
    throw new SeedAbort(
      `${filename}: not valid JSON — ${(cause as Error).message}`
    )
  }
}

/**
 * A flat directory: the three reference files by their fixed names, and every
 * other `.json` file is one material. Sorted, so log order and the order two
 * materials contend for a shared source row are both stable across runs.
 */
function readInput(directory: string): MaterialDataInput {
  let entries: string[]
  try {
    entries = readdirSync(directory)
  } catch (cause) {
    throw new SeedAbort(
      `cannot read data directory ${directory} (${(cause as Error).message})\n${USAGE}`
    )
  }

  const materialFilenames = entries
    .filter(
      (name) =>
        name.endsWith('.json') &&
        !name.startsWith('.') &&
        !REFERENCE_FILES.includes(name) &&
        statSync(path.join(directory, name)).isFile()
    )
    .sort()

  return {
    families: readJsonFile(directory, FAMILIES_FILE),
    usageCategories: readJsonFile(directory, USAGE_CATEGORIES_FILE),
    hazardCodes: readJsonFile(directory, HAZARD_CODES_FILE),
    materials: materialFilenames.map((name) => readJsonFile(directory, name)),
  }
}

/* -------------------------------------------------------------------------
 * Small helpers
 * ---------------------------------------------------------------------- */

/** Drizzle maps `numeric` to string (exact, never rounded — db/schema.ts). */
function numericValue(value: number | null): string | null {
  return value === null ? null : String(value)
}

/** Compares a stored `numeric` (string) against an input number. */
function sameNumeric(stored: string | null, input: number | null): boolean {
  if (stored === null || input === null)
    return stored === null && input === null
  return Number(stored) === input
}

function sameStringArray(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function firstRow<T>(rows: T[], what: string): T {
  const row = rows[0]
  if (row === undefined) {
    throw new Error(`seed: ${what} returned no row (unreachable)`)
  }
  return row
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/**
 * RFC 4122 §4.3 name-based UUID (SHA-1). Node ships no v5 generator and this
 * is not worth a dependency. The namespace is an arbitrary fixed constant —
 * its only job is to keep these ids from colliding with anything else.
 */
const SOURCE_NAMESPACE = '6f3b8b4e-2a1d-4f7c-9c2e-5d0a1b6e8f34'

function uuidV5(name: string, namespace: string): string {
  const digest = createHash('sha1')
    .update(Buffer.from(namespace.replace(/-/g, ''), 'hex'))
    .update(Buffer.from(name, 'utf8'))
    .digest()
  digest[6] = (digest[6] & 0x0f) | 0x50 // version 5
  digest[8] = (digest[8] & 0x3f) | 0x80 // RFC 4122 variant
  const hex = digest.subarray(0, 16).toString('hex')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}

/** Stable id for a url-less source. Keys are per-file, so the slug is in it. */
function urllessSourceId(materialSlug: string, sourceKey: string): string {
  return uuidV5(`${materialSlug} ${sourceKey}`, SOURCE_NAMESPACE)
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

/* -------------------------------------------------------------------------
 * Reference tables
 * ---------------------------------------------------------------------- */

/**
 * Families in two passes: every row first, then the parent links. The
 * hierarchy is a self-FK, so a child written before its parent would fail —
 * and the input orders families by taxonomy, not by dependency.
 * Returns slug → id for the material pass.
 */
async function writeFamilies(
  records: FamilyRecord[]
): Promise<Map<string, string>> {
  return db.transaction(async (tx) => {
    if (records.length > 0) {
      await tx
        .insert(families)
        .values(
          records.map((record) => ({ slug: record.slug, name: record.name }))
        )
        .onConflictDoUpdate({
          target: families.slug,
          set: { name: sql`excluded.name` },
        })
    }

    const rows = await tx
      .select({
        id: families.id,
        slug: families.slug,
        parentFamilyId: families.parentFamilyId,
      })
      .from(families)
    const idBySlug = new Map(rows.map((row) => [row.slug, row.id]))
    const parentById = new Map(rows.map((row) => [row.id, row.parentFamilyId]))

    for (const record of records) {
      const id = idBySlug.get(record.slug)
      if (id === undefined) {
        throw new Error(`seed: family "${record.slug}" vanished after upsert`)
      }
      const parentId =
        record.parent_slug === null
          ? null
          : (idBySlug.get(record.parent_slug) ?? null)
      if (parentById.get(id) !== parentId) {
        await tx
          .update(families)
          .set({ parentFamilyId: parentId })
          .where(eq(families.id, id))
      }
    }

    return idBySlug
  })
}

async function writeUsageCategories(
  records: UsageCategoryRecord[]
): Promise<void> {
  if (records.length === 0) return
  await db
    .insert(usageCategories)
    .values(records)
    .onConflictDoUpdate({
      target: usageCategories.id,
      set: { name: sql`excluded.name`, description: sql`excluded.description` },
    })
}

async function writeHazardCodes(records: HazardCodeRecord[]): Promise<void> {
  if (records.length === 0) return
  await db
    .insert(hazardCodes)
    .values(records)
    .onConflictDoUpdate({
      target: hazardCodes.code,
      set: {
        description: sql`excluded.description`,
        category: sql`excluded.category`,
      },
    })
}

/* -------------------------------------------------------------------------
 * Sources
 * ---------------------------------------------------------------------- */

/** key → source id, for the material's fact rows to point at. */
async function writeSources(
  tx: Transaction,
  materialSlug: string,
  records: MaterialSourceRecord[]
): Promise<Map<string, string>> {
  const idByKey = new Map<string, string>()

  for (const record of records) {
    const values = {
      type: record.type,
      url: record.url,
      title: record.title,
      author: record.author,
      publishedAt: record.published_at,
      accessedAt: new Date(record.accessed_at),
      notes: record.notes,
    }

    const rows =
      record.url === null
        ? await tx
            .insert(sources)
            .values({
              id: urllessSourceId(materialSlug, record.key),
              ...values,
            })
            .onConflictDoUpdate({ target: sources.id, set: values })
            .returning({ id: sources.id })
        : await tx
            .insert(sources)
            .values(values)
            // The index is partial, so its predicate has to be restated for
            // Postgres to infer it. Unqualified on purpose — it must read
            // exactly like `sources_url_uniq`'s own WHERE clause.
            .onConflictDoUpdate({
              target: sources.url,
              targetWhere: sql`url is not null`,
              set: values,
            })
            .returning({ id: sources.id })

    idByKey.set(record.key, firstRow(rows, `source "${record.key}"`).id)
  }

  return idByKey
}

/* -------------------------------------------------------------------------
 * Materials
 * ---------------------------------------------------------------------- */

type RowOutcome = 'created' | 'updated' | 'unchanged'

/**
 * The material row itself, change-detected: an unchanged material keeps its
 * `updated_at`, so re-running the seed cannot reshuffle search results.
 * A soft-deleted material that reappears in the input is resurrected.
 */
async function writeMaterialRow(
  tx: Transaction,
  material: MaterialFile
): Promise<{ id: string; outcome: RowOutcome }> {
  const next = {
    canonicalName: material.canonical_name,
    materialType: material.material_type,
    casNumber: material.cas_number,
    iupacName: material.iupac_name,
    smiles: material.smiles,
    molecularFormula: material.molecular_formula,
    molecularWeight: numericValue(material.molecular_weight),
  }

  const existing = (
    await tx
      .select()
      .from(materials)
      .where(eq(materials.slug, material.slug))
      .limit(1)
  )[0]

  if (existing === undefined) {
    const row = firstRow(
      await tx
        .insert(materials)
        .values({ slug: material.slug, ...next })
        .returning({ id: materials.id }),
      `material "${material.slug}"`
    )
    return { id: row.id, outcome: 'created' }
  }

  const unchanged =
    existing.deletedAt === null &&
    existing.canonicalName === next.canonicalName &&
    existing.materialType === next.materialType &&
    existing.casNumber === next.casNumber &&
    existing.iupacName === next.iupacName &&
    existing.smiles === next.smiles &&
    existing.molecularFormula === next.molecularFormula &&
    sameNumeric(existing.molecularWeight, material.molecular_weight)

  if (unchanged) return { id: existing.id, outcome: 'unchanged' }

  await tx
    .update(materials)
    .set({ ...next, deletedAt: null, updatedAt: new Date() })
    .where(eq(materials.id, existing.id))
  return { id: existing.id, outcome: 'updated' }
}

/**
 * The olfactive description — the one child table that is NOT hard-deleted.
 * See the header: editorial content soft-deletes, and the partial unique index
 * is built to let the retired row sit beside its replacement.
 */
async function writeDescription(
  tx: Transaction,
  materialId: string,
  material: MaterialFile,
  sourceIdByKey: Map<string, string>
): Promise<'inserted' | 'replaced' | 'retired' | 'unchanged' | 'absent'> {
  const active = (
    await tx
      .select()
      .from(materialDescriptions)
      .where(
        and(
          eq(materialDescriptions.materialId, materialId),
          isNull(materialDescriptions.deletedAt)
        )
      )
      .limit(1)
  )[0]

  const record = material.description
  const retire = async (id: string): Promise<void> => {
    const now = new Date()
    await tx
      .update(materialDescriptions)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(materialDescriptions.id, id))
  }

  if (record === null) {
    if (active === undefined) return 'absent'
    await retire(active.id)
    return 'retired'
  }

  const sourceId =
    record.source_key === null
      ? null
      : resolveSource(sourceIdByKey, record.source_key, material.slug)

  if (
    active !== undefined &&
    active.description === record.description &&
    active.tenacity === record.tenacity &&
    active.projection === record.projection &&
    active.sourceId === sourceId &&
    sameStringArray(active.keyFacets, record.key_facets)
  ) {
    return 'unchanged'
  }

  if (active !== undefined) await retire(active.id)
  await tx.insert(materialDescriptions).values({
    materialId,
    description: record.description,
    tenacity: record.tenacity,
    projection: record.projection,
    keyFacets: record.key_facets,
    sourceId,
  })
  return active === undefined ? 'inserted' : 'replaced'
}

function resolveSource(
  sourceIdByKey: Map<string, string>,
  key: string,
  materialSlug: string
): string {
  const id = sourceIdByKey.get(key)
  if (id === undefined) {
    // validateMaterialData already proved every key resolves; reaching here
    // means the two halves disagree, which must be loud, not silently NULL.
    throw new Error(
      `seed: ${materialSlug}: source key "${key}" did not resolve`
    )
  }
  return id
}

interface MaterialWriteReport {
  slug: string
  /** The material's row id — the similarity pass resolves slugs through it. */
  id: string
  outcome: RowOutcome
  description: Awaited<ReturnType<typeof writeDescription>>
  childRows: number
}

/**
 * One material, one transaction: the material row, its sources, and a wholesale
 * replacement of every child collection. Nothing here touches another
 * material's rows — `material_similarity` is the separate pass below.
 */
async function writeMaterial(
  material: MaterialFile,
  familyIdBySlug: Map<string, string>
): Promise<MaterialWriteReport> {
  return db.transaction(async (tx) => {
    const { id, outcome } = await writeMaterialRow(tx, material)
    const sourceIdByKey = await writeSources(
      tx,
      material.slug,
      material.sources
    )
    const source = (key: string): string =>
      resolveSource(sourceIdByKey, key, material.slug)

    // Delete-and-reinsert, inside the transaction: synonyms and landmark uses
    // have no natural key, so replacement is the only idempotent write. The
    // rest ride along for one uniform rule (wave-4 W4-A).
    await tx.delete(materialSynonyms).where(eq(materialSynonyms.materialId, id))
    await tx.delete(materialFamilies).where(eq(materialFamilies.materialId, id))
    await tx
      .delete(materialUsageLimits)
      .where(eq(materialUsageLimits.materialId, id))
    await tx.delete(materialHazards).where(eq(materialHazards.materialId, id))
    await tx.delete(landmarkUses).where(eq(landmarkUses.materialId, id))
    await tx
      .delete(materialUsageGuidance)
      .where(eq(materialUsageGuidance.materialId, id))
    await tx
      .delete(materialComputedProperties)
      .where(eq(materialComputedProperties.materialId, id))
    await tx.delete(odorPredictions).where(eq(odorPredictions.materialId, id))

    let childRows = 0

    if (material.synonyms.length > 0) {
      await tx.insert(materialSynonyms).values(
        material.synonyms.map((synonym) => ({
          materialId: id,
          name: synonym.name,
          synonymType: synonym.synonym_type,
        }))
      )
      childRows += material.synonyms.length
    }

    if (material.families.length > 0) {
      await tx.insert(materialFamilies).values(
        material.families.map((slug) => {
          const familyId = familyIdBySlug.get(slug)
          if (familyId === undefined) {
            throw new Error(
              `seed: ${material.slug}: family "${slug}" did not resolve`
            )
          }
          return { materialId: id, familyId }
        })
      )
      childRows += material.families.length
    }

    if (material.usage_limits.length > 0) {
      await tx.insert(materialUsageLimits).values(
        material.usage_limits.map((limit) => ({
          materialId: id,
          categoryId: limit.category_id,
          restrictionType: limit.restriction_type,
          maxPct: numericValue(limit.max_pct),
          notes: limit.notes,
          sourceId: source(limit.source_key),
          ifraAmendmentVersion: limit.ifra_amendment_version,
          verifiedAt: new Date(limit.verified_at),
        }))
      )
      childRows += material.usage_limits.length
    }

    if (material.hazards.length > 0) {
      await tx.insert(materialHazards).values(
        material.hazards.map((hazard) => ({
          materialId: id,
          hazardCode: hazard.hazard_code,
          sourceId: source(hazard.source_key),
        }))
      )
      childRows += material.hazards.length
    }

    if (material.landmark_uses.length > 0) {
      await tx.insert(landmarkUses).values(
        material.landmark_uses.map((use) => ({
          materialId: id,
          perfumeName: use.perfume_name,
          house: use.house,
          year: use.year,
          notes: use.notes,
          sourceId: source(use.source_key),
        }))
      )
      childRows += material.landmark_uses.length
    }

    if (material.usage_guidance !== null) {
      const guidance = material.usage_guidance
      await tx.insert(materialUsageGuidance).values({
        materialId: id,
        typicalPctMin: numericValue(guidance.typical_pct_min),
        typicalPctMax: numericValue(guidance.typical_pct_max),
        thresholdNote: guidance.threshold_note,
        dilutionNote: guidance.dilution_note,
        sourceId:
          guidance.source_key === null ? null : source(guidance.source_key),
      })
      childRows += 1
    }

    if (material.computed_properties !== null) {
      const computed = material.computed_properties
      await tx.insert(materialComputedProperties).values({
        materialId: id,
        logp: numericValue(computed.logp),
        tpsa: numericValue(computed.tpsa),
        heavyAtomCount: computed.heavy_atom_count,
        rdkitVersion: computed.rdkit_version,
      })
      childRows += 1
    }

    if (material.odor_predictions.length > 0) {
      await tx.insert(odorPredictions).values(
        material.odor_predictions.map((prediction) => ({
          materialId: id,
          descriptor: prediction.descriptor,
          probability: String(prediction.probability),
          modelVersion: prediction.model_version,
        }))
      )
      childRows += material.odor_predictions.length
    }

    const description = await writeDescription(tx, id, material, sourceIdByKey)

    return { slug: material.slug, id, outcome, description, childRows }
  })
}

/**
 * `material_similarity` last, in its own transaction: every row's
 * `similar_material_id` FKs into another material, so this can only run once
 * the whole corpus exists.
 */
async function writeSimilarity(
  bundle: MaterialDataBundle,
  materialIdBySlug: Map<string, string>
): Promise<number> {
  let written = 0
  await db.transaction(async (tx) => {
    for (const material of bundle.materials) {
      const id = materialIdBySlug.get(material.slug)
      if (id === undefined) {
        throw new Error(`seed: ${material.slug}: material id did not resolve`)
      }
      await tx
        .delete(materialSimilarity)
        .where(eq(materialSimilarity.materialId, id))
      if (material.similarity.length === 0) continue
      await tx.insert(materialSimilarity).values(
        material.similarity.map((entry) => {
          const similarId = materialIdBySlug.get(entry.similar_slug)
          if (similarId === undefined) {
            throw new Error(
              `seed: ${material.slug}: similar_slug "${entry.similar_slug}" did not resolve`
            )
          }
          return {
            materialId: id,
            similarMaterialId: similarId,
            tanimoto: String(entry.tanimoto),
            rdkitVersion: entry.rdkit_version,
          }
        })
      )
      written += material.similarity.length
    }
  })
  return written
}

/* -------------------------------------------------------------------------
 * Run
 * ---------------------------------------------------------------------- */

let connectionOpened = false

async function closeConnection(): Promise<void> {
  if (!connectionOpened) return
  // `$client` is added by drizzle()'s return type, not by PostgresJsDatabase,
  // so lib/db's exported type does not carry it. Reached for defensively:
  // without ending the pool the process hangs after the last query.
  const client = (db as unknown as { $client?: { end?: () => Promise<void> } })
    .$client
  if (client && typeof client.end === 'function') await client.end()
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const startedAt = Date.now()

  // `tsx` is not Next.js: nothing loads .env.local for us. Same two-step as
  // drizzle.config.ts. Safe here because lib/env.ts parses lazily, per key.
  loadEnvFile({ path: '.env.local', quiet: true })
  loadEnvFile({ quiet: true })

  log(`reading ${options.directory}`)
  const input = readInput(options.directory)

  // Everything is validated — structurally and referentially — before a
  // connection is opened. A bad input set must cost zero writes.
  const result = validateMaterialData(input)
  if (!result.ok) {
    const detail = result.errors
      .map((error) => `  ${error.file}: ${error.path} — ${error.message}`)
      .join('\n')
    throw new SeedAbort(
      `${plural(result.errors.length, 'validation problem')}; nothing was written.\n${detail}`
    )
  }
  const bundle = result.bundle
  log(
    `validated ${plural(bundle.materials.length, 'material')}, ` +
      `${bundle.families.length} families, ` +
      `${bundle.usageCategories.length} usage categories, ` +
      `${plural(bundle.hazardCodes.length, 'hazard code')}`
  )
  if (bundle.materials.length === 0) {
    log('WARNING: the input set contains no material files')
  }

  connectionOpened = true

  // Snapshot BEFORE writing: the prune guard has to weigh the input against
  // the corpus as it stands, not against the corpus this run just topped up.
  const liveMaterials = await db
    .select({ id: materials.id, slug: materials.slug })
    .from(materials)
    .where(isNull(materials.deletedAt))
  const inputSlugs = new Set(bundle.materials.map((material) => material.slug))
  const absent = liveMaterials.filter((row) => !inputSlugs.has(row.slug))

  // The guard runs before any write: a typo'd path that happens to parse must
  // not be able to half-seed and then empty the corpus.
  if (
    options.prune &&
    !options.forcePrune &&
    bundle.materials.length * 2 < liveMaterials.length
  ) {
    throw new SeedAbort(
      `--prune refused: the input set (${plural(bundle.materials.length, 'material')}) ` +
        `is smaller than half the live corpus (${plural(liveMaterials.length, 'material')}). ` +
        `Check the data directory. If the shrink is intended, re-run with --prune --force-prune. ` +
        `Nothing was written.`
    )
  }

  const familyIdBySlug = await writeFamilies(bundle.families)
  await writeUsageCategories(bundle.usageCategories)
  await writeHazardCodes(bundle.hazardCodes)
  log(
    `reference tables written (families ${bundle.families.length}, ` +
      `usage categories ${bundle.usageCategories.length}, ` +
      `hazard codes ${bundle.hazardCodes.length})`
  )

  const materialIdBySlug = new Map<string, string>()
  for (const material of bundle.materials) {
    const report = await writeMaterial(material, familyIdBySlug)
    materialIdBySlug.set(report.slug, report.id)
    log(
      `  ${report.slug}: row ${report.outcome}, ` +
        `${plural(report.childRows, 'child row')} replaced, ` +
        `description ${report.description}`
    )
  }

  const similarityRows = await writeSimilarity(bundle, materialIdBySlug)
  log(`similarity written (${plural(similarityRows, 'row')})`)

  if (options.prune) {
    if (absent.length === 0) {
      log('prune: no live material is absent from the input')
    } else {
      // Logged in full BEFORE the write, so the record of what was removed
      // survives even if the statement below fails.
      log(
        `prune: soft-deleting ${plural(absent.length, 'material')} absent from the input:`
      )
      for (const row of absent) log(`  - ${row.slug}`)
      const now = new Date()
      await db
        .update(materials)
        .set({ deletedAt: now, updatedAt: now })
        .where(
          inArray(
            materials.id,
            absent.map((row) => row.id)
          )
        )
    }
  } else if (absent.length > 0) {
    log(
      `${plural(absent.length, 'live material')} absent from the input, left untouched ` +
        `(re-run with --prune to soft-delete): ${absent.map((row) => row.slug).join(', ')}`
    )
  }

  // Outside every transaction — Postgres rejects CONCURRENTLY inside one.
  log('refreshing material_search_view')
  await db.execute(
    sql`REFRESH MATERIALIZED VIEW CONCURRENTLY material_search_view`
  )

  log(`done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`)
}

main()
  .then(closeConnection)
  .catch(async (error: unknown) => {
    if (error instanceof SeedAbort) {
      console.error(`seed: ${error.message}`)
    } else {
      console.error(error)
    }
    process.exitCode = 1
    await closeConnection()
  })
