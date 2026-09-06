import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  type SQL,
} from 'drizzle-orm'

import {
  chemicalClasses,
  families,
  hazardCodes,
  landmarkUses,
  materialChemicalClasses,
  materialComputedProperties,
  materialDescriptions,
  materialFamilies,
  materialHazards,
  materialIfraAbsences,
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
import type {
  ChemicalClassRef,
  Citation,
  FamilyRef,
  IfraAbsence,
  MaterialDetail,
  MaterialSummary,
} from '@/lib/types'

/**
 * Editorial material reads (docs/architecture.md D1).
 *
 * Drizzle only — materials are public editorial data, the correct side of the
 * RLS boundary. Raw Drizzle rows never escape this file: everything maps to
 * the contract-locked shapes in `lib/types.ts`. Soft-deleted rows
 * (`deleted_at IS NOT NULL`) are excluded everywhere, including the
 * similar-materials join and the active-description lookup.
 *
 * Two mapping conventions (see db/schema.ts header):
 * - `numeric` columns arrive from postgres-js as strings → `toNumber`.
 * - `timestamptz` columns arrive as `Date` → ISO strings. `date` columns
 *   (sources.published_at) already arrive as `YYYY-MM-DD` strings.
 *
 * Intra-array ordering is deterministic ON PURPOSE: the citation-ordering
 * contract (below) walks these arrays, so their order decides superscript
 * numbers. Changing any `orderBy` here renumbers citations.
 */

/** postgres-js returns `numeric` as string (exact); the contract wants number. */
function toNumber(value: string): number
function toNumber(value: string | null): number | null
function toNumber(value: string | null): number | null {
  return value === null ? null : Number(value)
}

/* -------------------------------------------------------------------------
 * Summary lists — the browse surfaces (index, family pages, /saved)
 * ---------------------------------------------------------------------- */

/**
 * The orders the browse surfaces offer. These literals travel in the URL
 * (`/materials?sort=recently-updated`), so they are part of a public contract
 * and are spelled the way a person would read them, not the way the column is
 * named.
 */
export type MaterialSort = 'name' | 'recently-updated'

export interface ListMaterialsOptions {
  /** Defaults to `'name'`. */
  sort?: MaterialSort
  /** Restrict to one olfactive family by slug. Omit/null = the whole corpus. */
  familySlug?: string | null
  /**
   * Restrict to one structural class by slug. Omit/null = every class.
   *
   * Independent of `familySlug` and composable with it: passing both narrows
   * to materials that are in the family AND in the class. The two axes answer
   * different questions ("what smells woody" vs "what is an ester"), so
   * neither may quietly override the other.
   */
  classSlug?: string | null
  /** 1-based. Values below 1 are treated as 1. */
  page?: number
  /** Defaults to `DEFAULT_PAGE_SIZE`; clamped to `MAX_PAGE_SIZE`. */
  pageSize?: number
}

export interface MaterialList {
  items: MaterialSummary[]
  /** Rows matching the filter across ALL pages — what "Page 2 of 7" needs. */
  total: number
}

/** One screenful of cards at three columns; also the family page's cap. */
export const DEFAULT_PAGE_SIZE = 24
/** A ceiling so a hand-edited `pageSize` cannot ask for the whole table. */
const MAX_PAGE_SIZE = 100

/** The row shape every summary query selects; never leaves this file. */
const summaryColumns = {
  id: materials.id,
  slug: materials.slug,
  canonicalName: materials.canonicalName,
  materialType: materials.materialType,
  casNumber: materials.casNumber,
} as const

type SummaryRow = {
  id: string
  slug: string
  canonicalName: string
  materialType: MaterialSummary['materialType']
  casNumber: string | null
}

/** Bucket `{ materialId, ...ref }` rows by material, preserving row order. */
function bucketByMaterial<Row extends { materialId: string }, Ref>(
  rows: Row[],
  toRef: (row: Row) => Ref
): Map<string, Ref[]> {
  const byMaterial = new Map<string, Ref[]>()
  for (const row of rows) {
    const bucket = byMaterial.get(row.materialId)
    const ref = toRef(row)
    if (bucket) {
      bucket.push(ref)
    } else {
      byMaterial.set(row.materialId, [ref])
    }
  }
  return byMaterial
}

/**
 * Attach each row's two taxonomies — olfactive families and structural
 * classes — in ONE extra round-trip each, bucketed in TS.
 *
 * Every summary list goes through here, which is what keeps the index, the
 * family pages and `/saved` from drifting apart — and what keeps the fan-out
 * to `material_families` and `material_chemical_classes` at one query per
 * page instead of one per row. The two queries run in parallel, so a page of
 * 24 cards costs the same two round-trips as a page of one.
 *
 * (Was `withFamilies` until the structural axis landed. Renamed rather than
 * paired with a second helper: a summary is only ever complete with both, and
 * two helpers would let a caller build one with half its axes filled.)
 */
async function withRefs(rows: SummaryRow[]): Promise<MaterialSummary[]> {
  if (rows.length === 0) return []

  const ids = rows.map((row) => row.id)

  const [familyRows, classRows] = await Promise.all([
    db
      .select({
        materialId: materialFamilies.materialId,
        slug: families.slug,
        name: families.name,
      })
      .from(materialFamilies)
      .innerJoin(families, eq(materialFamilies.familyId, families.id))
      .where(inArray(materialFamilies.materialId, ids))
      .orderBy(asc(families.name)),
    // Curated order, matching the filter row and `listChemicalClasses` — the
    // reader meets these classes in one order everywhere or in none.
    db
      .select({
        materialId: materialChemicalClasses.materialId,
        slug: chemicalClasses.slug,
        name: chemicalClasses.name,
      })
      .from(materialChemicalClasses)
      .innerJoin(
        chemicalClasses,
        eq(materialChemicalClasses.classSlug, chemicalClasses.slug)
      )
      .where(inArray(materialChemicalClasses.materialId, ids))
      .orderBy(asc(chemicalClasses.sortOrder), asc(chemicalClasses.slug)),
  ])

  const familiesByMaterial = bucketByMaterial(familyRows, (row): FamilyRef => ({
    slug: row.slug,
    name: row.name,
  }))
  const classesByMaterial = bucketByMaterial(
    classRows,
    (row): ChemicalClassRef => ({ slug: row.slug, name: row.name })
  )

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    canonicalName: row.canonicalName,
    materialType: row.materialType,
    casNumber: row.casNumber,
    families: familiesByMaterial.get(row.id) ?? [],
    // Empty for a NULL-SMILES material by construction: a mixture has no
    // single structure, so the seed derives no membership rows for it.
    chemicalClasses: classesByMaterial.get(row.id) ?? [],
  }))
}

/**
 * One page of the corpus: sorted, optionally filtered to a family, and
 * counted so the caller can render "Page 2 of 7" without a second call.
 *
 * Offset pagination, deliberately. A curated reference is a few thousand rows
 * at its largest and the browse surface wants *addressable pages* — a URL a
 * reader can share and a crawler can follow — which keyset pagination does not
 * give without leaking row cursors into the URL.
 *
 * Both filters are subqueries rather than joins so a material in two families
 * (or two classes) cannot come back twice; `total` then needs no DISTINCT to
 * be right. They are separate `IN` predicates ANDed together, which is also
 * what makes them compose: one subquery per axis, each narrowing the same set.
 */
export async function listMaterials({
  sort = 'name',
  familySlug = null,
  classSlug = null,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
}: ListMaterialsOptions = {}): Promise<MaterialList> {
  const size = Math.min(Math.max(Math.trunc(pageSize), 1), MAX_PAGE_SIZE)
  const offset = (Math.max(Math.trunc(page), 1) - 1) * size

  const filters: SQL[] = [isNull(materials.deletedAt)]
  if (familySlug !== null) {
    filters.push(
      inArray(
        materials.id,
        db
          .select({ materialId: materialFamilies.materialId })
          .from(materialFamilies)
          .innerJoin(families, eq(materialFamilies.familyId, families.id))
          .where(eq(families.slug, familySlug))
      )
    )
  }
  if (classSlug !== null) {
    // `class_slug` IS the class's primary key, so this needs no join to
    // `chemical_classes` — and an unknown slug matches nothing, which is the
    // empty state the browse page wants rather than a silently wider list.
    filters.push(
      inArray(
        materials.id,
        db
          .select({ materialId: materialChemicalClasses.materialId })
          .from(materialChemicalClasses)
          .where(eq(materialChemicalClasses.classSlug, classSlug))
      )
    )
  }
  const where = and(...filters)

  // Slug is the tie-break in both orders: two materials can share a name, and
  // a whole seed run can share a second of `updated_at`. Without it the same
  // row could appear on two pages and another on none.
  const order =
    sort === 'recently-updated'
      ? [desc(materials.updatedAt), asc(materials.slug)]
      : [asc(materials.canonicalName), asc(materials.slug)]

  const [rows, totalRows] = await Promise.all([
    db
      .select(summaryColumns)
      .from(materials)
      .where(where)
      .orderBy(...order)
      .limit(size)
      .offset(offset),
    db.select({ value: count() }).from(materials).where(where),
  ])

  return {
    items: await withRefs(rows),
    total: totalRows[0]?.value ?? 0,
  }
}

/**
 * Summaries for a known set of ids, **in the order the ids were given**.
 *
 * `/saved` (W5-B) holds an ordered list of ids from `user_saved_materials`
 * and needs the editorial half of each; the ordering promise is what lets the
 * caller decide the order (most-recently-saved first) without this file
 * knowing anything about bookmarks. Ids that match nothing — or that match a
 * soft-deleted row — are dropped rather than returned as holes.
 */
export async function listMaterialsByIds(
  ids: string[]
): Promise<MaterialSummary[]> {
  const wanted = [...new Set(ids)]
  if (wanted.length === 0) return []

  const rows = await db
    .select(summaryColumns)
    .from(materials)
    .where(and(inArray(materials.id, wanted), isNull(materials.deletedAt)))

  const summaries = await withRefs(rows)
  const byId = new Map(summaries.map((summary) => [summary.id, summary]))

  return wanted
    .map((id) => byId.get(id))
    .filter((summary): summary is MaterialSummary => summary !== undefined)
}

/**
 * Every material a structure query can possibly match, with its SMILES.
 *
 * The substructure page (`/structure`) runs arbitrary SMARTS through RDKit.js
 * in the browser, which is the one thing SQL cannot answer: the pattern is
 * typed by the reader, so no precomputed class covers it. That page therefore
 * needs the whole matchable corpus in one payload, not a page of it — a
 * partial list would silently under-report matches.
 *
 * NULL-SMILES materials are excluded rather than returned with a null: a
 * natural is a mixture with no single structure, so it is not a candidate for
 * *any* structural pattern, and the narrowed `smiles: string` return type is
 * what stops the caller from having to decide that again per row.
 *
 * Ordered by canonical name so the client's filtered subset is already in
 * reading order — it never re-sorts, it only hides rows.
 *
 * Deliberately unpaginated and deliberately not cached here: the corpus is a
 * few thousand rows at its largest, and the caching pass (`cacheLife`/
 * `cacheTag`) is a later, whole-app decision.
 */
export async function listStructureCandidates(): Promise<
  Array<MaterialSummary & { smiles: string }>
> {
  const rows = await db
    .select({ ...summaryColumns, smiles: materials.smiles })
    .from(materials)
    .where(and(isNull(materials.deletedAt), isNotNull(materials.smiles)))
    .orderBy(asc(materials.canonicalName), asc(materials.slug))

  const smilesById = new Map(rows.map((row) => [row.id, row.smiles] as const))
  const summaries = await withRefs(rows)

  return summaries.flatMap((summary) => {
    const smiles = smilesById.get(summary.id)
    // Unreachable — `isNotNull` above guarantees it. The guard is what
    // narrows `string | null` to `string` without an assertion.
    return smiles === null || smiles === undefined
      ? []
      : [{ ...summary, smiles }]
  })
}

/** How many materials are published — the homepage's one number. */
export async function countMaterials(): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(materials)
    .where(isNull(materials.deletedAt))

  return rows[0]?.value ?? 0
}

/**
 * One material with every satellite the detail page renders, or null when the
 * slug matches nothing (the route turns null into `notFound()`).
 */
export async function getMaterialBySlug(
  slug: string
): Promise<MaterialDetail | null> {
  const materialRows = await db
    .select()
    .from(materials)
    .where(and(eq(materials.slug, slug), isNull(materials.deletedAt)))
    .limit(1)
  const material = materialRows[0]
  if (!material) return null

  const [
    familyRows,
    classRows,
    synonymRows,
    usageLimitRows,
    ifraAbsenceRows,
    hazardRows,
    descriptionRows,
    guidanceRows,
    landmarkRows,
    computedRows,
    similarRows,
    predictionRows,
  ] = await Promise.all([
    db
      .select({ slug: families.slug, name: families.name })
      .from(materialFamilies)
      .innerJoin(families, eq(materialFamilies.familyId, families.id))
      .where(eq(materialFamilies.materialId, material.id))
      .orderBy(asc(families.name)),
    // Structural classes — the same shape the summary lists carry, in the
    // same curated order. Membership is computed, so nothing here is cited
    // and nothing here joins the citation walk below.
    db
      .select({ slug: chemicalClasses.slug, name: chemicalClasses.name })
      .from(materialChemicalClasses)
      .innerJoin(
        chemicalClasses,
        eq(materialChemicalClasses.classSlug, chemicalClasses.slug)
      )
      .where(eq(materialChemicalClasses.materialId, material.id))
      .orderBy(asc(chemicalClasses.sortOrder), asc(chemicalClasses.slug)),
    db
      .select({
        name: materialSynonyms.name,
        type: materialSynonyms.synonymType,
        sourceId: materialSynonyms.sourceId,
      })
      .from(materialSynonyms)
      .where(eq(materialSynonyms.materialId, material.id))
      .orderBy(asc(materialSynonyms.name)),
    db
      .select({
        categoryId: materialUsageLimits.categoryId,
        categoryName: usageCategories.name,
        restrictionType: materialUsageLimits.restrictionType,
        maxPct: materialUsageLimits.maxPct,
        notes: materialUsageLimits.notes,
        ifraAmendmentVersion: materialUsageLimits.ifraAmendmentVersion,
        verifiedAt: materialUsageLimits.verifiedAt,
        sourceId: materialUsageLimits.sourceId,
      })
      .from(materialUsageLimits)
      .innerJoin(
        usageCategories,
        eq(materialUsageLimits.categoryId, usageCategories.id)
      )
      .where(eq(materialUsageLimits.materialId, material.id))
      // Category order, then oldest amendment first — verified_at is a real
      // timeline; the amendment label ("51st") is not lexically sortable.
      .orderBy(
        asc(materialUsageLimits.categoryId),
        asc(materialUsageLimits.verifiedAt)
      ),
    db
      .select({
        ifraAmendmentVersion: materialIfraAbsences.ifraAmendmentVersion,
        verifiedAt: materialIfraAbsences.verifiedAt,
        notes: materialIfraAbsences.notes,
        sourceId: materialIfraAbsences.sourceId,
      })
      .from(materialIfraAbsences)
      .where(eq(materialIfraAbsences.materialId, material.id))
      // One row per amendment (the PK), so this is effectively a single key;
      // verified_at is the tie-break for a deterministic citation walk.
      .orderBy(
        asc(materialIfraAbsences.ifraAmendmentVersion),
        asc(materialIfraAbsences.verifiedAt)
      ),
    db
      .select({
        code: materialHazards.hazardCode,
        description: hazardCodes.description,
        category: hazardCodes.category,
        sourceId: materialHazards.sourceId,
      })
      .from(materialHazards)
      .innerJoin(hazardCodes, eq(materialHazards.hazardCode, hazardCodes.code))
      .where(eq(materialHazards.materialId, material.id))
      .orderBy(asc(materialHazards.hazardCode)),
    // The partial unique index guarantees at most one active description.
    db
      .select({
        description: materialDescriptions.description,
        tenacity: materialDescriptions.tenacity,
        projection: materialDescriptions.projection,
        keyFacets: materialDescriptions.keyFacets,
        sourceId: materialDescriptions.sourceId,
      })
      .from(materialDescriptions)
      .where(
        and(
          eq(materialDescriptions.materialId, material.id),
          isNull(materialDescriptions.deletedAt)
        )
      )
      .limit(1),
    db
      .select({
        typicalPctMin: materialUsageGuidance.typicalPctMin,
        typicalPctMax: materialUsageGuidance.typicalPctMax,
        thresholdNote: materialUsageGuidance.thresholdNote,
        dilutionNote: materialUsageGuidance.dilutionNote,
        sourceId: materialUsageGuidance.sourceId,
      })
      .from(materialUsageGuidance)
      .where(eq(materialUsageGuidance.materialId, material.id))
      .limit(1),
    db
      .select({
        perfumeName: landmarkUses.perfumeName,
        house: landmarkUses.house,
        year: landmarkUses.year,
        notes: landmarkUses.notes,
        sourceId: landmarkUses.sourceId,
      })
      .from(landmarkUses)
      .where(eq(landmarkUses.materialId, material.id))
      // Postgres ASC puts NULL years last, which is what a timeline wants.
      .orderBy(asc(landmarkUses.year), asc(landmarkUses.perfumeName)),
    db
      .select({
        logp: materialComputedProperties.logp,
        tpsa: materialComputedProperties.tpsa,
        heavyAtomCount: materialComputedProperties.heavyAtomCount,
        rdkitVersion: materialComputedProperties.rdkitVersion,
      })
      .from(materialComputedProperties)
      .where(eq(materialComputedProperties.materialId, material.id))
      .limit(1),
    db
      .select({
        slug: materials.slug,
        canonicalName: materials.canonicalName,
        tanimoto: materialSimilarity.tanimoto,
        rdkitVersion: materialSimilarity.rdkitVersion,
      })
      .from(materialSimilarity)
      .innerJoin(
        materials,
        eq(materialSimilarity.similarMaterialId, materials.id)
      )
      // The neighbor itself must not be soft-deleted, or the link 404s.
      .where(
        and(
          eq(materialSimilarity.materialId, material.id),
          isNull(materials.deletedAt)
        )
      )
      .orderBy(desc(materialSimilarity.tanimoto), asc(materials.slug)),
    db
      .select({
        descriptor: odorPredictions.descriptor,
        probability: odorPredictions.probability,
        modelVersion: odorPredictions.modelVersion,
      })
      .from(odorPredictions)
      .where(eq(odorPredictions.materialId, material.id))
      .orderBy(
        desc(odorPredictions.probability),
        asc(odorPredictions.descriptor)
      ),
  ])

  const description = descriptionRows[0] ?? null
  const guidance = guidanceRows[0] ?? null
  const computed = computedRows[0] ?? null

  /**
   * Identity citations are mandatory (lib/types.ts: `identitySourceId` and
   * `synonyms[].sourceId` are plain strings). The columns are nullable only
   * between migrations 0004 and 0005, so a NULL here is a half-migrated
   * database, not a material with nothing to cite. Fail loudly and name the
   * column: passing it through as "no citation" would silently drop a source
   * from the walk below and renumber every superscript on the page.
   */
  const identitySourceId = material.identitySourceId
  if (identitySourceId === null) {
    throw new Error(
      `materials: ${material.slug} has NULL materials.identity_source_id — identity facts must cite a record (migration 0005 makes this NOT NULL)`
    )
  }
  const synonyms = synonymRows.map((row) => {
    if (row.sourceId === null) {
      throw new Error(
        `materials: ${material.slug} synonym "${row.name}" has NULL material_synonyms.source_id — every synonym must cite a record (migration 0005 makes this NOT NULL)`
      )
    }
    return { name: row.name, type: row.type, sourceId: row.sourceId }
  })

  /**
   * Citation ordering — the app-wide rule pinned by wave-3.md W3-B:
   * `sources` is ordered by FIRST REFERENCE, walking `MaterialDetail`'s
   * fields in declaration order, deduped by source id. The superscript
   * number is index-in-`sources` + 1. Fields with no sourceId (computed,
   * similar, odorPredictions) contribute nothing; sources referenced by no
   * surviving row never appear.
   *
   * Walk order = declaration order of the sourceId-bearing fields, which is
   * also the page's visual order:
   * identity → synonyms → usageLimits → ifraAbsences → hazards → olfactive
   * → usageGuidance → landmarkUses.
   */
  const orderedSourceIds: string[] = []
  const seen = new Set<string>()
  const reference = (sourceId: string | null) => {
    if (sourceId !== null && !seen.has(sourceId)) {
      seen.add(sourceId)
      orderedSourceIds.push(sourceId)
    }
  }
  reference(identitySourceId)
  for (const row of synonyms) reference(row.sourceId)
  for (const row of usageLimitRows) reference(row.sourceId)
  for (const row of ifraAbsenceRows) reference(row.sourceId)
  for (const row of hazardRows) reference(row.sourceId)
  reference(description?.sourceId ?? null)
  reference(guidance?.sourceId ?? null)
  for (const row of landmarkRows) reference(row.sourceId)

  const sourceRows =
    orderedSourceIds.length > 0
      ? await db
          .select()
          .from(sources)
          .where(inArray(sources.id, orderedSourceIds))
      : []
  const sourceById = new Map(sourceRows.map((row) => [row.id, row]))
  const citations: Citation[] = orderedSourceIds.map((id) => {
    const row = sourceById.get(id)
    if (!row) {
      // FKs make this unreachable; if it ever happens, fail loudly rather
      // than silently renumbering every superscript on the page.
      throw new Error(`materials: source ${id} referenced but not found`)
    }
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      url: row.url,
      author: row.author,
      publishedAt: row.publishedAt,
      accessedAt: row.accessedAt.toISOString(),
    }
  })

  return {
    id: material.id,
    slug: material.slug,
    canonicalName: material.canonicalName,
    materialType: material.materialType,
    casNumber: material.casNumber,
    families: familyRows,
    chemicalClasses: classRows,
    iupacName: material.iupacName,
    smiles: material.smiles,
    molecularFormula: material.molecularFormula,
    molecularWeight: toNumber(material.molecularWeight),
    identitySourceId,
    synonyms,
    usageLimits: usageLimitRows.map((row) => ({
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      restrictionType: row.restrictionType,
      maxPct: toNumber(row.maxPct),
      notes: row.notes,
      ifraAmendmentVersion: row.ifraAmendmentVersion,
      verifiedAt: row.verifiedAt.toISOString(),
      sourceId: row.sourceId,
    })),
    ifraAbsences: ifraAbsenceRows.map((row): IfraAbsence => ({
      ifraAmendmentVersion: row.ifraAmendmentVersion,
      verifiedAt: row.verifiedAt.toISOString(),
      notes: row.notes,
      sourceId: row.sourceId,
    })),
    hazards: hazardRows,
    olfactive: description
      ? {
          description: description.description,
          tenacity: description.tenacity,
          projection: description.projection,
          keyFacets: description.keyFacets,
          sourceId: description.sourceId,
        }
      : null,
    usageGuidance: guidance
      ? {
          typicalPctMin: toNumber(guidance.typicalPctMin),
          typicalPctMax: toNumber(guidance.typicalPctMax),
          thresholdNote: guidance.thresholdNote,
          dilutionNote: guidance.dilutionNote,
          sourceId: guidance.sourceId,
        }
      : null,
    landmarkUses: landmarkRows,
    computed: computed
      ? {
          logp: toNumber(computed.logp),
          tpsa: toNumber(computed.tpsa),
          heavyAtomCount: computed.heavyAtomCount,
          rdkitVersion: computed.rdkitVersion,
        }
      : null,
    similar: similarRows.map((row) => ({
      slug: row.slug,
      canonicalName: row.canonicalName,
      tanimoto: toNumber(row.tanimoto),
      rdkitVersion: row.rdkitVersion,
    })),
    odorPredictions: predictionRows.map((row) => ({
      descriptor: row.descriptor,
      probability: toNumber(row.probability),
      modelVersion: row.modelVersion,
    })),
    sources: citations,
  }
}
