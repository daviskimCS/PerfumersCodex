import { z } from 'zod'

/**
 * Seed-pipeline input format — the contract between `perfumers-codex-data`
 * (which produces these JSON files) and `scripts/seed.ts` (which consumes
 * them). Wave-4 W4-A defines the format here; the data repo conforms.
 *
 * Field names are snake_case mirrors of the docs/database-schema.md column
 * names, on purpose: the data repo is Python, and the seed script's mapping
 * onto Drizzle stays trivial. App code never sees these shapes — it uses the
 * camelCase contracts in lib/types.ts.
 *
 * The input set is one JSON file per material plus four reference files:
 *
 *   families.json          [{ slug, name, parent_slug }]
 *   usage-categories.json  [{ id (1–11), name, description }]
 *   hazard-codes.json      [{ code, description, category }]
 *   chemical-classes.json  [{ slug, name, smarts, description, sort_order }]
 *   <material>.json        { slug, canonical_name, material_type,
 *                            cas_number, iupac_name, smiles,
 *                            molecular_formula, molecular_weight,
 *                            identity_source_key,
 *                            synonyms[], families[], sources[],
 *                            usage_limits[], ifra_absences[], hazards[],
 *                            description, usage_guidance, landmark_uses[],
 *                            computed_properties, similarity[],
 *                            odor_predictions[] }
 *
 * Identity is cited like every other fact (2026-09-05, docs/database-schema.md
 * `materials.identity_source_id`, `material_synonyms.source_id`): every file
 * names `identity_source_key`, the one record its identity scalars come from
 * (a natural cites whatever established its identity), and every synonym
 * carries its own `source_key`. `ifra_absences[]` records a verified absence
 * of an IFRA Standard, one row per amendment whose index was searched — so a
 * material with no Standard is distinguishable from one nobody has researched
 * (no limits and no absence). A file may not carry both a usage limit and an
 * absence for the same amendment.
 *
 * Two deliberate departures from a 1:1 column mirror (both wave-4 decisions):
 *
 * - Fact rows carry `source_key`, not `source_id`: a per-file reference into
 *   the material's own `sources` array, each source carrying a maker-chosen
 *   stable `key`. `sources.url` is nullable, so url-less sources (books,
 *   interviews) have no natural identity for idempotent seeding without it.
 *   Keys are unique within a file and *global* across the set (`sources.key`
 *   is UNIQUE): the same key in two files names the same document and seeds
 *   as one row, so the two declarations must agree on `url` and `title` —
 *   a key naming two different documents is a data error, not a merge. The
 *   converse holds too (`sources.url` is UNIQUE): one url under two keys is
 *   rejected, because the second key would collide with the first's row.
 * - Cross-row references use slugs (`families`, `similar_slug`,
 *   `parent_slug`), never UUIDs — the input set predates any database ids.
 *
 * `validateMaterialData` is the whole-set entry point: it validates every
 * file structurally, then runs the cross-file referential checks, and only
 * returns a bundle when the entire set is clean — the seed script must not
 * open a database connection before that (wave-4: validate everything first).
 */

/**
 * The four reference filenames, fixed by this format.
 *
 * They live here rather than in `scripts/seed.ts` because the input format is
 * this module's contract: the seed script discovers material files by
 * elimination (every other `.json` in the directory), so a name that drifted
 * out of sync would not fail — it would quietly seed `families.json` as if it
 * were a material.
 */
export const FAMILIES_FILE = 'families.json'
export const USAGE_CATEGORIES_FILE = 'usage-categories.json'
export const HAZARD_CODES_FILE = 'hazard-codes.json'
export const CHEMICAL_CLASSES_FILE = 'chemical-classes.json'

export const REFERENCE_FILES: readonly string[] = [
  FAMILIES_FILE,
  USAGE_CATEGORIES_FILE,
  HAZARD_CODES_FILE,
  CHEMICAL_CLASSES_FILE,
]

/**
 * Slug form shared by material slugs, family slugs, and source keys — the
 * same shape AGENTS.md mandates for URLs (`/materials/iso-e-super`).
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const slugSchema = z
  .string()
  .regex(SLUG_PATTERN, 'must be a lowercase hyphenated slug (a-z, 0-9)')

/** Nonempty after trimming; the parsed output is the trimmed string. */
const textSchema = z.string().trim().min(1, 'must be a nonempty string')

/** Nullable free text (notes, authors) — absent and null both mean "none". */
const optionalTextSchema = textSchema.nullable().default(null)

/**
 * CAS registry form: 2–7 digits, 2 digits, 1 check digit. Twin of
 * CAS_PATTERN in lib/search/normalize.ts, duplicated rather than imported so
 * this module stays standalone for the pipeline and lib/search stays pure
 * for the gold set. Same semantics as the twin: form only, no check-digit
 * arithmetic — a supplier-sheet oddity must remain enterable.
 */
const CAS_PATTERN = /^\d{2,7}-\d{2}-\d$/

const casNumberSchema = z
  .string()
  .regex(CAS_PATTERN, 'must have CAS form: 2-7 digits, 2 digits, 1 digit')

/**
 * GHS hazard statement form: H317, H360FD, EUH208. Form check only,
 * mirroring the CAS stance — hazard-codes.json is the authority on which
 * codes actually exist (checked in validateMaterialData).
 */
const GHS_CODE_PATTERN = /^(?:EU)?H\d{3}[A-Za-z]{0,2}$/

const ghsCodeSchema = z
  .string()
  .regex(GHS_CODE_PATTERN, 'must be a GHS hazard code (e.g. "H317")')

/** timestamptz columns: ISO 8601 with an explicit zone (Z or offset). */
const timestampSchema = z.iso.datetime({
  offset: true,
  error: 'must be an ISO 8601 timestamp with a timezone',
})

/** date columns: calendar date only. */
const dateSchema = z.iso.date({
  error: 'must be an ISO 8601 date (YYYY-MM-DD)',
})

/** CHECK 0 ≤ x ≤ 100 on every percentage column (docs/database-schema.md). */
const pctSchema = z.number().min(0).max(100)

/** CHECK 0–1 on `tanimoto` and `probability` (docs/database-schema.md). */
const unitIntervalSchema = z.number().min(0).max(1)

/*
 * Enum literal values match both the enum columns in docs/database-schema.md
 * and the string-literal unions in lib/types.ts (MaterialType, SourceType,
 * SynonymType, RestrictionType, Tenacity, Projection). tsc cannot see across
 * the snake/camel boundary, so keeping these in lockstep is a review
 * obligation, not a compiler-enforced one.
 */
export const materialTypeSchema = z.enum(['synthetic', 'natural', 'isolate'])
export const sourceTypeSchema = z.enum([
  'ifra',
  'sds',
  'pubchem',
  'gsc',
  'perfumer_blog',
  'book',
  'interview',
  'other',
])
export const synonymTypeSchema = z.enum([
  'trade_name',
  'iupac',
  'common_name',
  'abbreviation',
  'supplier_name',
])
export const restrictionTypeSchema = z.enum([
  'restriction',
  'prohibition',
  'specification',
])
export const tenacitySchema = z.enum(['low', 'medium', 'high', 'very_high'])
export const projectionSchema = z.enum(['low', 'medium', 'high'])

/** families.json — the `families` table; the parent reference is a slug. */
export const familyRecordSchema = z.strictObject({
  slug: slugSchema,
  name: textSchema,
  parent_slug: slugSchema.nullable().default(null),
})

export const familiesFileSchema = z.array(familyRecordSchema)

/**
 * usage-categories.json — the `usage_categories` table. IFRA's numbering is
 * the primary key (1–11). validateMaterialData additionally requires the
 * file to cover all eleven: `material_usage_limits` FKs into this table, so
 * a partial reference file turns valid limits into insert-time FK failures.
 */
export const usageCategoryRecordSchema = z.strictObject({
  id: z.number().int().min(1).max(11, 'IFRA categories are numbered 1-11'),
  name: textSchema,
  description: optionalTextSchema,
})

export const usageCategoriesFileSchema = z.array(usageCategoryRecordSchema)

/** hazard-codes.json — the `hazard_codes` table (GHS reference data). */
export const hazardCodeRecordSchema = z.strictObject({
  code: ghsCodeSchema,
  description: textSchema,
  // The three GHS hazard classes, verbatim from docs/database-schema.md.
  category: z.enum([
    'Health hazard',
    'Physical hazard',
    'Environmental hazard',
  ]),
})

export const hazardCodesFileSchema = z.array(hazardCodeRecordSchema)

/**
 * chemical-classes.json — the `chemical_classes` table (migration 0006).
 *
 * `smarts` is the pattern `scripts/classify.ts` computes membership from, so
 * the trimmed-nonempty rule is load-bearing rather than tidiness: RDKit
 * compiles `""` into a perfectly valid query molecule with no atoms, which
 * never errors and never matches — an empty pattern would quietly define a
 * class no material can ever join. Whether RDKit can compile the pattern at
 * all is checked in validateMaterialData, which needs RDKit and so takes the
 * compiler from its caller (see MaterialDataOptions).
 */
export const chemicalClassRecordSchema = z.strictObject({
  slug: slugSchema,
  name: textSchema,
  smarts: z
    .string()
    .trim()
    .min(1, 'SMARTS pattern cannot be empty — an empty query matches nothing'),
  description: textSchema,
  // smallint, and the list is curated rather than alphabetical.
  sort_order: z.number().int().min(0).max(32767),
})

export const chemicalClassesFileSchema = z.array(chemicalClassRecordSchema)

/**
 * A `material_synonyms` row. `source_key` is per row, not per material:
 * synonyms come from different documents (a PubChem list, a supplier sheet,
 * the IFRA Standard's commercial names).
 */
export const materialSynonymSchema = z.strictObject({
  name: textSchema,
  synonym_type: synonymTypeSchema,
  source_key: slugSchema,
})

/**
 * A citation, declared inline in the material file that cites it. `key` is
 * the maker-chosen stable identity fact rows point at via `source_key` — see
 * the header on why `sources.url` cannot serve as that identity.
 */
export const materialSourceSchema = z.strictObject({
  key: slugSchema,
  type: sourceTypeSchema,
  title: textSchema,
  url: z.url({ error: 'must be an absolute URL' }).nullable().default(null),
  author: optionalTextSchema,
  published_at: dateSchema.nullable().default(null),
  accessed_at: timestampSchema,
  notes: optionalTextSchema,
})

/**
 * A `material_usage_limits` row. `max_pct` is required-but-nullable rather
 * than defaulted: this is safety data, and "no numeric limit" must be an
 * authored decision, never an omission. UNIQUE (category_id,
 * ifra_amendment_version) is checked set-wide in validateMaterialData.
 */
export const usageLimitRecordSchema = z
  .strictObject({
    category_id: z
      .number()
      .int()
      .min(1)
      .max(11, 'IFRA categories are numbered 1-11'),
    restriction_type: restrictionTypeSchema,
    max_pct: pctSchema.nullable(),
    notes: optionalTextSchema,
    ifra_amendment_version: textSchema,
    verified_at: timestampSchema,
    source_key: slugSchema,
  })
  .refine(
    (limit) =>
      limit.restriction_type !== 'prohibition' || limit.max_pct === null,
    {
      error:
        'prohibitions carry max_pct: null — a numeric limit contradicts restriction_type (docs/database-schema.md)',
      path: ['max_pct'],
    }
  )

/**
 * A `material_ifra_absences` row: a verified absence of an IFRA Standard,
 * checked against one amendment's complete index (`source_key` is that index
 * document). PRIMARY KEY (material_id, ifra_amendment_version) and the
 * limit-versus-absence contradiction are checked in validateMaterialData.
 */
export const ifraAbsenceRecordSchema = z.strictObject({
  ifra_amendment_version: textSchema,
  verified_at: timestampSchema,
  notes: optionalTextSchema,
  source_key: slugSchema,
})

export const materialHazardRecordSchema = z.strictObject({
  hazard_code: ghsCodeSchema,
  source_key: slugSchema,
})

/**
 * A `material_descriptions` row. At most one per material, encoded
 * structurally as a single nullable object — the schema's partial unique
 * index allows one *active* description. `source_key: null` means written
 * purely from the maker's own experience (docs/database-schema.md).
 */
export const descriptionRecordSchema = z.strictObject({
  description: textSchema,
  tenacity: tenacitySchema.nullable().default(null),
  projection: projectionSchema.nullable().default(null),
  key_facets: z.array(textSchema).default([]),
  source_key: slugSchema.nullable().default(null),
})

export const usageGuidanceRecordSchema = z
  .strictObject({
    typical_pct_min: pctSchema.nullable().default(null),
    typical_pct_max: pctSchema.nullable().default(null),
    threshold_note: optionalTextSchema,
    dilution_note: optionalTextSchema,
    source_key: slugSchema.nullable().default(null),
  })
  .refine(
    (guidance) =>
      guidance.typical_pct_min === null ||
      guidance.typical_pct_max === null ||
      guidance.typical_pct_min <= guidance.typical_pct_max,
    {
      error:
        'typical_pct_max must be >= typical_pct_min (docs/database-schema.md CHECK)',
      path: ['typical_pct_max'],
    }
  )

export const landmarkUseRecordSchema = z.strictObject({
  perfume_name: textSchema,
  house: optionalTextSchema,
  year: z.number().int().nullable().default(null),
  notes: optionalTextSchema,
  source_key: slugSchema,
})

/**
 * A `material_computed_properties` row. Provenance is `rdkit_version`, not a
 * source key — these are deterministic recomputations, not cited facts
 * (AGENTS.md). `computed_at` is stamped by the seed script at insert time.
 */
export const computedPropertiesRecordSchema = z.strictObject({
  logp: z.number().nullable().default(null),
  tpsa: z.number().nullable().default(null),
  heavy_atom_count: z.number().int().nullable().default(null),
  rdkit_version: textSchema,
})

/** A `material_similarity` row; the target is referenced by slug. */
export const similarityRecordSchema = z.strictObject({
  similar_slug: slugSchema,
  tanimoto: unitIntervalSchema,
  rdkit_version: textSchema,
})

/** An `odor_predictions` row — experimental model output, never editorial. */
export const odorPredictionRecordSchema = z.strictObject({
  descriptor: textSchema,
  probability: unitIntervalSchema,
  model_version: textSchema,
})

/**
 * One material JSON file.
 *
 * Identity scalars the database allows to be NULL (cas_number, iupac_name,
 * smiles, molecular_formula, molecular_weight) are required-but-nullable:
 * the author writes the null, so "this natural has no CAS" is a recorded
 * decision rather than a possible omission. Child collections and singletons
 * default to empty/null — there, absence simply means absence.
 */
export const materialFileSchema = z
  .strictObject({
    slug: slugSchema,
    canonical_name: textSchema,
    material_type: materialTypeSchema,
    cas_number: casNumberSchema.nullable(),
    iupac_name: textSchema.nullable(),
    smiles: z
      .string()
      .regex(/^\S+$/, 'SMILES cannot contain whitespace')
      .nullable(),
    molecular_formula: textSchema.nullable(),
    molecular_weight: z.number().positive().nullable(),
    // Required, never defaulted: identity is a cited fact, and a material
    // whose identity came from nowhere is not a material this reference
    // publishes (docs/database-schema.md `identity_source_id` NOT NULL).
    identity_source_key: slugSchema,
    synonyms: z.array(materialSynonymSchema).default([]),
    families: z.array(slugSchema).default([]),
    sources: z.array(materialSourceSchema).default([]),
    usage_limits: z.array(usageLimitRecordSchema).default([]),
    ifra_absences: z.array(ifraAbsenceRecordSchema).default([]),
    hazards: z.array(materialHazardRecordSchema).default([]),
    description: descriptionRecordSchema.nullable().default(null),
    usage_guidance: usageGuidanceRecordSchema.nullable().default(null),
    landmark_uses: z.array(landmarkUseRecordSchema).default([]),
    computed_properties: computedPropertiesRecordSchema
      .nullable()
      .default(null),
    similarity: z.array(similarityRecordSchema).default([]),
    odor_predictions: z.array(odorPredictionRecordSchema).default([]),
  })
  .superRefine((material, ctx) => {
    // CHECK material_id <> similar_material_id (docs/database-schema.md).
    material.similarity.forEach((entry, index) => {
      if (entry.similar_slug === material.slug) {
        ctx.addIssue({
          code: 'custom',
          message: `material cannot list itself as similar ("${material.slug}")`,
          path: ['similarity', index, 'similar_slug'],
        })
      }
    })
    // NULL smiles means natural/mixture, and every cheminformatics artifact
    // is computed FROM the structure — RDKit output attached to a
    // structureless material can only be a pipeline bug (AGENTS.md: skip
    // NULL-SMILES materials, never produce for them).
    if (material.smiles === null) {
      if (material.computed_properties !== null) {
        ctx.addIssue({
          code: 'custom',
          message:
            'computed_properties requires smiles — a NULL-SMILES material has no structure to compute from',
          path: ['computed_properties'],
        })
      }
      if (material.similarity.length > 0) {
        ctx.addIssue({
          code: 'custom',
          message:
            'similarity requires smiles — fingerprints come from the structure',
          path: ['similarity'],
        })
      }
    }
  })

export type FamilyRecord = z.infer<typeof familyRecordSchema>
export type UsageCategoryRecord = z.infer<typeof usageCategoryRecordSchema>
export type HazardCodeRecord = z.infer<typeof hazardCodeRecordSchema>
export type ChemicalClassRecord = z.infer<typeof chemicalClassRecordSchema>
export type MaterialSynonymRecord = z.infer<typeof materialSynonymSchema>
export type MaterialSourceRecord = z.infer<typeof materialSourceSchema>
export type UsageLimitRecord = z.infer<typeof usageLimitRecordSchema>
export type IfraAbsenceRecord = z.infer<typeof ifraAbsenceRecordSchema>
export type MaterialHazardRecord = z.infer<typeof materialHazardRecordSchema>
export type DescriptionRecord = z.infer<typeof descriptionRecordSchema>
export type UsageGuidanceRecord = z.infer<typeof usageGuidanceRecordSchema>
export type LandmarkUseRecord = z.infer<typeof landmarkUseRecordSchema>
export type ComputedPropertiesRecord = z.infer<
  typeof computedPropertiesRecordSchema
>
export type SimilarityRecord = z.infer<typeof similarityRecordSchema>
export type OdorPredictionRecord = z.infer<typeof odorPredictionRecordSchema>
export type MaterialFile = z.infer<typeof materialFileSchema>

/** One parsed JSON file, tagged with the name every error will carry. */
export interface MaterialDataFile {
  filename: string
  data: unknown
}

export interface MaterialDataInput {
  families: MaterialDataFile
  usageCategories: MaterialDataFile
  hazardCodes: MaterialDataFile
  chemicalClasses: MaterialDataFile
  materials: MaterialDataFile[]
}

/**
 * Checks this module cannot perform itself.
 *
 * `smartsIsValid` compiles a SMARTS pattern and says whether RDKit accepts it.
 * It is injected rather than imported because compiling needs RDKit.js — a
 * 6.6 MB WebAssembly module loaded asynchronously — and this module is
 * synchronous, dependency-free, and imported by tests that must not pay for
 * it. `scripts/seed.ts` supplies it from the same RDKit instance it classifies
 * with. Omitted, the structural checks on `smarts` still run (nonempty after
 * trimming) and only the compile check is skipped; the seed says so in its log
 * when it skips, and it only skips for a corpus that has nothing to classify.
 */
export interface MaterialDataOptions {
  smartsIsValid?: (smarts: string) => boolean
}

/** Every error names the offending file and the field path within it. */
export interface MaterialDataError {
  file: string
  path: string
  message: string
}

export interface MaterialDataBundle {
  families: FamilyRecord[]
  usageCategories: UsageCategoryRecord[]
  hazardCodes: HazardCodeRecord[]
  /** In `sort_order`, so the seed and the filter row agree on the order. */
  chemicalClasses: ChemicalClassRecord[]
  /** In input order; slugs are unique across the set. */
  materials: MaterialFile[]
}

export type MaterialDataResult =
  | { ok: true; bundle: MaterialDataBundle }
  | { ok: false; errors: MaterialDataError[] }

/** `['usage_limits', 0, 'max_pct']` → `usage_limits[0].max_pct`. */
function formatPath(path: PropertyKey[]): string {
  let out = ''
  for (const segment of path) {
    if (typeof segment === 'number') out += `[${segment}]`
    else out += out === '' ? String(segment) : `.${String(segment)}`
  }
  return out === '' ? '(root)' : out
}

function parseFile<S extends z.ZodType>(
  file: MaterialDataFile,
  schema: S,
  errors: MaterialDataError[]
): z.output<S> | null {
  const result = schema.safeParse(file.data)
  if (result.success) return result.data
  for (const issue of result.error.issues) {
    errors.push({
      file: file.filename,
      path: formatPath(issue.path),
      message: issue.message,
    })
  }
  return null
}

/**
 * The whole-set validation the seed script calls before touching the
 * database. Structural parses and relational checks all accumulate into one
 * error list — a failure in one file must not hide problems in another, so
 * the maker sees the whole picture in a single run. The only suppression:
 * checks that need a file's contents are skipped when that file itself
 * failed to parse, so cascades don't bury the root cause.
 */
export function validateMaterialData(
  input: MaterialDataInput,
  options: MaterialDataOptions = {}
): MaterialDataResult {
  const errors: MaterialDataError[] = []

  const families = parseFile(input.families, familiesFileSchema, errors)
  const categories = parseFile(
    input.usageCategories,
    usageCategoriesFileSchema,
    errors
  )
  const hazardCodes = parseFile(
    input.hazardCodes,
    hazardCodesFileSchema,
    errors
  )
  const chemicalClasses = parseFile(
    input.chemicalClasses,
    chemicalClassesFileSchema,
    errors
  )

  const materials: { filename: string; material: MaterialFile }[] = []
  let allMaterialsParsed = true
  for (const file of input.materials) {
    const material = parseFile(file, materialFileSchema, errors)
    if (material === null) allMaterialsParsed = false
    else materials.push({ filename: file.filename, material })
  }

  if (families !== null) {
    checkFamilies(input.families.filename, families, errors)
  }
  if (categories !== null) {
    checkCategories(input.usageCategories.filename, categories, errors)
  }
  if (hazardCodes !== null) {
    checkHazardCodes(input.hazardCodes.filename, hazardCodes, errors)
  }
  if (chemicalClasses !== null) {
    checkChemicalClasses(
      input.chemicalClasses.filename,
      chemicalClasses,
      options.smartsIsValid,
      errors
    )
  }

  const refs: ReferenceSets = {
    familySlugs:
      families === null ? null : new Set(families.map((f) => f.slug)),
    categoryIds:
      categories === null ? null : new Set(categories.map((c) => c.id)),
    hazardCodes:
      hazardCodes === null ? null : new Set(hazardCodes.map((h) => h.code)),
  }

  // materials.slug is UNIQUE — and it is also this format's cross-file
  // identity, so a collision would make two files silently fight over one row.
  const slugToFile = new Map<string, string>()
  for (const { filename, material } of materials) {
    const priorFile = slugToFile.get(material.slug)
    if (priorFile !== undefined) {
      errors.push({
        file: filename,
        path: 'slug',
        message: `duplicate material slug "${material.slug}" — already declared in ${priorFile}`,
      })
    } else {
      slugToFile.set(material.slug, filename)
    }
    checkMaterial(filename, material, refs, errors)
  }

  // sources.key is UNIQUE across the whole table, so a key reused across
  // files seeds as ONE row — which is only right when both files mean the
  // same document. Disagreement on url or title means one file's citation
  // would silently be rewritten into the other's, so it fails here, by name.
  checkSharedSourceKeys(materials, errors)
  // And the converse: sources.url is UNIQUE too, so one document must carry
  // one key, or the seed aborts mid-transaction on the second key.
  checkSharedSourceUrls(materials, errors)

  // similar_slug resolution needs the full slug universe. When any material
  // file failed to parse, its slug is unknown, and flagging every reference
  // to it as dangling would bury the real (structural) error.
  if (allMaterialsParsed) {
    for (const { filename, material } of materials) {
      material.similarity.forEach((entry, index) => {
        if (!slugToFile.has(entry.similar_slug)) {
          errors.push({
            file: filename,
            path: `similarity[${index}].similar_slug`,
            message: `similar_slug "${entry.similar_slug}" matches no material in the input set`,
          })
        }
      })
    }
  }

  if (
    errors.length > 0 ||
    families === null ||
    categories === null ||
    hazardCodes === null ||
    chemicalClasses === null
  ) {
    return { ok: false, errors }
  }
  return {
    ok: true,
    bundle: {
      families,
      usageCategories: categories,
      hazardCodes,
      // Sorted here, once, so neither the seed nor the filter row has to
      // remember to: `sort_order` exists precisely because the list is
      // curated, and a file written out of order should still display in it.
      chemicalClasses: [...chemicalClasses].sort(
        (a, b) => a.sort_order - b.sort_order
      ),
      materials: materials.map((entry) => entry.material),
    },
  }
}

function checkFamilies(
  file: string,
  families: FamilyRecord[],
  errors: MaterialDataError[]
): void {
  const bySlug = new Map<string, FamilyRecord>()
  const namesSeen = new Set<string>()
  families.forEach((family, index) => {
    if (bySlug.has(family.slug)) {
      errors.push({
        file,
        path: `[${index}].slug`,
        message: `duplicate family slug "${family.slug}"`,
      })
    } else {
      bySlug.set(family.slug, family)
    }
    // `name` is UNIQUE too (docs/database-schema.md).
    const nameKey = family.name.toLowerCase()
    if (namesSeen.has(nameKey)) {
      errors.push({
        file,
        path: `[${index}].name`,
        message: `duplicate family name "${family.name}"`,
      })
    } else {
      namesSeen.add(nameKey)
    }
  })

  families.forEach((family, index) => {
    if (family.parent_slug !== null && !bySlug.has(family.parent_slug)) {
      errors.push({
        file,
        path: `[${index}].parent_slug`,
        message: `parent_slug "${family.parent_slug}" matches no family in this file`,
      })
    }
  })

  // parent_family_id is a self-FK with no CHECK against cycles, and a cycle
  // would hang any recursive hierarchy walk downstream — catch it here.
  const inReportedCycle = new Set<string>()
  families.forEach((family, index) => {
    if (inReportedCycle.has(family.slug)) return
    const chain: string[] = []
    const seen = new Set<string>()
    let current: FamilyRecord | undefined = family
    while (current !== undefined) {
      if (inReportedCycle.has(current.slug)) return // tail into a known cycle
      if (seen.has(current.slug)) {
        const members = chain.slice(chain.indexOf(current.slug))
        for (const slug of members) inReportedCycle.add(slug)
        errors.push({
          file,
          path: `[${index}].parent_slug`,
          message: `family hierarchy cycle: ${[...members, current.slug].join(' -> ')}`,
        })
        return
      }
      seen.add(current.slug)
      chain.push(current.slug)
      current =
        current.parent_slug === null
          ? undefined
          : bySlug.get(current.parent_slug)
    }
  })
}

function checkCategories(
  file: string,
  categories: UsageCategoryRecord[],
  errors: MaterialDataError[]
): void {
  const idsSeen = new Set<number>()
  categories.forEach((category, index) => {
    if (idsSeen.has(category.id)) {
      errors.push({
        file,
        path: `[${index}].id`,
        message: `duplicate category id ${category.id}`,
      })
    } else {
      idsSeen.add(category.id)
    }
  })
  // All 11 required: material_usage_limits FKs into this table, so a partial
  // reference file turns valid limits into insert-time FK failures.
  for (let id = 1; id <= 11; id += 1) {
    if (!idsSeen.has(id)) {
      errors.push({
        file,
        path: '(root)',
        message: `missing IFRA category id ${id} — the file must cover all 11`,
      })
    }
  }
}

function checkHazardCodes(
  file: string,
  hazardCodes: HazardCodeRecord[],
  errors: MaterialDataError[]
): void {
  const codesSeen = new Set<string>()
  hazardCodes.forEach((hazard, index) => {
    if (codesSeen.has(hazard.code)) {
      errors.push({
        file,
        path: `[${index}].code`,
        message: `duplicate hazard code "${hazard.code}"`,
      })
    } else {
      codesSeen.add(hazard.code)
    }
  })
}

/**
 * `chemical_classes` is the one reference table whose contents are executable:
 * every pattern is run against every structure in the corpus, so a bad row
 * does not fail loudly at insert time the way a bad hazard code does — it
 * quietly mislabels materials. Hence three checks:
 *
 * - duplicate `slug` — the primary key, and the class's URL identity;
 * - duplicate `sort_order` — not a database constraint, but two classes
 *   sharing a position makes the filter row's order depend on how Postgres
 *   feels about ties, which is a display bug nobody will trace back to here;
 * - a SMARTS RDKit refuses — the pattern is the whole definition of the class,
 *   so an uncompilable one defines nothing. Skipped when the caller supplied
 *   no compiler (see MaterialDataOptions); the emptiness check above it is
 *   structural and always runs.
 */
function checkChemicalClasses(
  file: string,
  classes: ChemicalClassRecord[],
  smartsIsValid: ((smarts: string) => boolean) | undefined,
  errors: MaterialDataError[]
): void {
  const slugsSeen = new Set<string>()
  const sortOrdersSeen = new Set<number>()
  classes.forEach((chemicalClass, index) => {
    if (slugsSeen.has(chemicalClass.slug)) {
      errors.push({
        file,
        path: `[${index}].slug`,
        message: `duplicate chemical class slug "${chemicalClass.slug}"`,
      })
    } else {
      slugsSeen.add(chemicalClass.slug)
    }

    if (sortOrdersSeen.has(chemicalClass.sort_order)) {
      errors.push({
        file,
        path: `[${index}].sort_order`,
        message: `duplicate sort_order ${chemicalClass.sort_order} — the display order would be arbitrary between the two`,
      })
    } else {
      sortOrdersSeen.add(chemicalClass.sort_order)
    }

    if (smartsIsValid !== undefined && !smartsIsValid(chemicalClass.smarts)) {
      errors.push({
        file,
        path: `[${index}].smarts`,
        message: `RDKit cannot compile the SMARTS pattern ${JSON.stringify(chemicalClass.smarts)}`,
      })
    }
  })
}

interface ReferenceSets {
  /** null = that reference file failed to parse; skip resolution against it. */
  familySlugs: Set<string> | null
  categoryIds: Set<number> | null
  hazardCodes: Set<string> | null
}

/**
 * One document, one key — the converse of `checkSharedSourceKeys`.
 *
 * `sources_url_uniq` lets a url belong to at most one row, and the seed finds
 * rows by key. So one url declared under two different keys, in two files or
 * twice in one, passes every per-key check and then fails as a unique-index
 * violation inside the second material's transaction, aborting that material
 * and every later seed run. That happened on 2026-09-13: each research entry
 * cited IFRA's 51st-Amendment index under its own key and six entries failed
 * to seed (ceee802). Caught here instead, before any write, naming the key to
 * reuse.
 *
 * Matching is exact, like the index: two spellings of one url (a trailing
 * slash, a fragment) are two rows to Postgres and pass here too. url-less
 * sources never collide, because the index is partial (`url IS NOT NULL`).
 *
 * The check sees only the input set. A url already seeded under a key that no
 * file in this set declares still surfaces at write time, as before.
 */
function checkSharedSourceUrls(
  materials: { filename: string; material: MaterialFile }[],
  errors: MaterialDataError[]
): void {
  const first = new Map<string, { file: string; key: string }>()
  for (const { filename, material } of materials) {
    material.sources.forEach((source, index) => {
      if (source.url === null) return
      const prior = first.get(source.url)
      if (prior === undefined) {
        first.set(source.url, { file: filename, key: source.key })
        return
      }
      // Same key: a shared document (cross-file) or a duplicate key (same
      // file, already reported by checkMaterial). Neither is this error.
      if (prior.key === source.key) return
      const where =
        prior.file === filename ? 'earlier in this file' : `in ${prior.file}`
      errors.push({
        file: filename,
        path: `sources[${index}].url`,
        message: `url ${JSON.stringify(source.url)} is already declared under source key "${prior.key}" ${where} — one document has one key; cite it as "${prior.key}" instead of "${source.key}"`,
      })
    })
  }
}

/**
 * A source key reused across files must name the same document: `url` and
 * `title` must match the first declaration exactly. Only those two — they are
 * what identifies a document; `accessed_at`, `author`, `notes` may legitimately
 * differ between the files' declarations (the seed keeps the last-written).
 * The error lands on the later file, and names the earlier one.
 */
function checkSharedSourceKeys(
  materials: { filename: string; material: MaterialFile }[],
  errors: MaterialDataError[]
): void {
  const first = new Map<
    string,
    { file: string; url: string | null; title: string }
  >()
  for (const { filename, material } of materials) {
    material.sources.forEach((source, index) => {
      const prior = first.get(source.key)
      if (prior === undefined) {
        first.set(source.key, {
          file: filename,
          url: source.url,
          title: source.title,
        })
        return
      }
      // Same file: checkMaterial has already reported the duplicate.
      if (prior.file === filename) return
      if (prior.url !== source.url) {
        errors.push({
          file: filename,
          path: `sources[${index}].url`,
          message: `source key "${source.key}" is shared with ${prior.file} but the url differs (${JSON.stringify(prior.url)} there) — one key names one document; use a different key for a different source`,
        })
      }
      if (prior.title !== source.title) {
        errors.push({
          file: filename,
          path: `sources[${index}].title`,
          message: `source key "${source.key}" is shared with ${prior.file} but the title differs (${JSON.stringify(prior.title)} there) — one key names one document; use a different key for a different source`,
        })
      }
    })
  }
}

function checkMaterial(
  file: string,
  material: MaterialFile,
  refs: ReferenceSets,
  errors: MaterialDataError[]
): void {
  const sourceKeys = new Set<string>()
  material.sources.forEach((source, index) => {
    if (sourceKeys.has(source.key)) {
      errors.push({
        file,
        path: `sources[${index}].key`,
        message: `duplicate source key "${source.key}"`,
      })
    } else {
      sourceKeys.add(source.key)
    }
  })

  const requireSource = (key: string | null, path: string): void => {
    if (key !== null && !sourceKeys.has(key)) {
      errors.push({
        file,
        path,
        message: `source_key "${key}" matches no source declared in this file`,
      })
    }
  }

  requireSource(material.identity_source_key, 'identity_source_key')
  material.synonyms.forEach((synonym, index) =>
    requireSource(synonym.source_key, `synonyms[${index}].source_key`)
  )
  material.usage_limits.forEach((limit, index) =>
    requireSource(limit.source_key, `usage_limits[${index}].source_key`)
  )
  material.ifra_absences.forEach((absence, index) =>
    requireSource(absence.source_key, `ifra_absences[${index}].source_key`)
  )
  material.hazards.forEach((hazard, index) =>
    requireSource(hazard.source_key, `hazards[${index}].source_key`)
  )
  material.landmark_uses.forEach((use, index) =>
    requireSource(use.source_key, `landmark_uses[${index}].source_key`)
  )
  if (material.description !== null) {
    requireSource(material.description.source_key, 'description.source_key')
  }
  if (material.usage_guidance !== null) {
    requireSource(
      material.usage_guidance.source_key,
      'usage_guidance.source_key'
    )
  }

  // PRIMARY KEY (material_id, family_id) — no repeats; slugs must resolve.
  const familiesSeen = new Set<string>()
  material.families.forEach((slug, index) => {
    if (familiesSeen.has(slug)) {
      errors.push({
        file,
        path: `families[${index}]`,
        message: `duplicate family "${slug}"`,
      })
    } else {
      familiesSeen.add(slug)
    }
    if (refs.familySlugs !== null && !refs.familySlugs.has(slug)) {
      errors.push({
        file,
        path: `families[${index}]`,
        message: `family "${slug}" matches no family in families.json`,
      })
    }
  })

  // material_synonyms has no natural key (the seed replaces rows wholesale —
  // wave-4), so a duplicate here would silently double in every reseed.
  const synonymsSeen = new Set<string>()
  material.synonyms.forEach((synonym, index) => {
    const key = `${synonym.name.toLowerCase()}\u0000${synonym.synonym_type}`
    if (synonymsSeen.has(key)) {
      errors.push({
        file,
        path: `synonyms[${index}].name`,
        message: `duplicate synonym "${synonym.name}" (${synonym.synonym_type})`,
      })
    } else {
      synonymsSeen.add(key)
    }
  })

  // UNIQUE (material_id, category_id, ifra_amendment_version).
  const limitsSeen = new Set<string>()
  material.usage_limits.forEach((limit, index) => {
    const key = `${limit.category_id}\u0000${limit.ifra_amendment_version}`
    if (limitsSeen.has(key)) {
      errors.push({
        file,
        path: `usage_limits[${index}].category_id`,
        message: `duplicate usage limit for category ${limit.category_id}, amendment "${limit.ifra_amendment_version}"`,
      })
    } else {
      limitsSeen.add(key)
    }
    if (refs.categoryIds !== null && !refs.categoryIds.has(limit.category_id)) {
      errors.push({
        file,
        path: `usage_limits[${index}].category_id`,
        message: `category id ${limit.category_id} matches no entry in usage-categories.json`,
      })
    }
  })

  // PRIMARY KEY (material_id, ifra_amendment_version) — one verdict per
  // amendment. And an absence contradicts any Standard under the same
  // amendment: "the index lists no Standard" and "here is its Standard"
  // cannot both be true of one document (docs/database-schema.md). A
  // Standard in a LATER amendment is fine — that is history, kept side by side.
  const limitAmendments = new Set(
    material.usage_limits.map((limit) => limit.ifra_amendment_version)
  )
  const absencesSeen = new Set<string>()
  material.ifra_absences.forEach((absence, index) => {
    const path = `ifra_absences[${index}].ifra_amendment_version`
    if (absencesSeen.has(absence.ifra_amendment_version)) {
      errors.push({
        file,
        path,
        message: `duplicate IFRA absence for amendment "${absence.ifra_amendment_version}"`,
      })
    } else {
      absencesSeen.add(absence.ifra_amendment_version)
    }
    if (limitAmendments.has(absence.ifra_amendment_version)) {
      errors.push({
        file,
        path,
        message: `a Standard and a verified absence for the same amendment cannot both be true — usage_limits also cites amendment "${absence.ifra_amendment_version}"`,
      })
    }
  })

  // PRIMARY KEY (material_id, hazard_code); codes FK into hazard_codes.
  const hazardsSeen = new Set<string>()
  material.hazards.forEach((hazard, index) => {
    if (hazardsSeen.has(hazard.hazard_code)) {
      errors.push({
        file,
        path: `hazards[${index}].hazard_code`,
        message: `duplicate hazard code "${hazard.hazard_code}"`,
      })
    } else {
      hazardsSeen.add(hazard.hazard_code)
    }
    if (
      refs.hazardCodes !== null &&
      !refs.hazardCodes.has(hazard.hazard_code)
    ) {
      errors.push({
        file,
        path: `hazards[${index}].hazard_code`,
        message: `hazard code "${hazard.hazard_code}" matches no entry in hazard-codes.json`,
      })
    }
  })

  // PRIMARY KEY (material_id, similar_material_id).
  const similarSeen = new Set<string>()
  material.similarity.forEach((entry, index) => {
    if (similarSeen.has(entry.similar_slug)) {
      errors.push({
        file,
        path: `similarity[${index}].similar_slug`,
        message: `duplicate similarity target "${entry.similar_slug}"`,
      })
    } else {
      similarSeen.add(entry.similar_slug)
    }
  })

  // UNIQUE (material_id, descriptor, model_version).
  const predictionsSeen = new Set<string>()
  material.odor_predictions.forEach((prediction, index) => {
    const key = `${prediction.descriptor.toLowerCase()}\u0000${prediction.model_version}`
    if (predictionsSeen.has(key)) {
      errors.push({
        file,
        path: `odor_predictions[${index}].descriptor`,
        message: `duplicate prediction for descriptor "${prediction.descriptor}", model "${prediction.model_version}"`,
      })
    } else {
      predictionsSeen.add(key)
    }
  })
}
