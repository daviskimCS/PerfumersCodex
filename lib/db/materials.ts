import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm'

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
import type {
  Citation,
  FamilyRef,
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

/**
 * All materials that are not soft-deleted, ordered by canonical name
 * (slug as a stable tie-break for duplicate names).
 */
export async function listMaterials(): Promise<MaterialSummary[]> {
  const materialRows = await db
    .select({
      id: materials.id,
      slug: materials.slug,
      canonicalName: materials.canonicalName,
      materialType: materials.materialType,
      casNumber: materials.casNumber,
    })
    .from(materials)
    .where(isNull(materials.deletedAt))
    .orderBy(asc(materials.canonicalName), asc(materials.slug))

  if (materialRows.length === 0) return []

  // One round-trip for every family assignment of every surviving material,
  // bucketed in TS — no N+1 across the index page.
  const familyRows = await db
    .select({
      materialId: materialFamilies.materialId,
      slug: families.slug,
      name: families.name,
    })
    .from(materialFamilies)
    .innerJoin(families, eq(materialFamilies.familyId, families.id))
    .innerJoin(materials, eq(materialFamilies.materialId, materials.id))
    .where(isNull(materials.deletedAt))
    .orderBy(asc(families.name))

  const familiesByMaterial = new Map<string, FamilyRef[]>()
  for (const row of familyRows) {
    const bucket = familiesByMaterial.get(row.materialId)
    const ref: FamilyRef = { slug: row.slug, name: row.name }
    if (bucket) {
      bucket.push(ref)
    } else {
      familiesByMaterial.set(row.materialId, [ref])
    }
  }

  return materialRows.map((row) => ({
    id: row.id,
    slug: row.slug,
    canonicalName: row.canonicalName,
    materialType: row.materialType,
    casNumber: row.casNumber,
    families: familiesByMaterial.get(row.id) ?? [],
  }))
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
    synonymRows,
    usageLimitRows,
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
    db
      .select({
        name: materialSynonyms.name,
        type: materialSynonyms.synonymType,
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
   * Citation ordering — the app-wide rule pinned by wave-3.md W3-B:
   * `sources` is ordered by FIRST REFERENCE, walking `MaterialDetail`'s
   * fields in declaration order, deduped by source id. The superscript
   * number is index-in-`sources` + 1. Fields with no sourceId (synonyms,
   * computed, similar, odorPredictions) contribute nothing; sources
   * referenced by no surviving row never appear.
   *
   * Walk order = declaration order of the sourceId-bearing fields:
   * usageLimits → hazards → olfactive → usageGuidance → landmarkUses.
   */
  const orderedSourceIds: string[] = []
  const seen = new Set<string>()
  const reference = (sourceId: string | null) => {
    if (sourceId !== null && !seen.has(sourceId)) {
      seen.add(sourceId)
      orderedSourceIds.push(sourceId)
    }
  }
  for (const row of usageLimitRows) reference(row.sourceId)
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
    iupacName: material.iupacName,
    smiles: material.smiles,
    molecularFormula: material.molecularFormula,
    molecularWeight: toNumber(material.molecularWeight),
    synonyms: synonymRows,
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
