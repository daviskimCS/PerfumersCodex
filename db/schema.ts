/**
 * Drizzle table definitions — the single place the database shape is declared.
 *
 * This file is a faithful translation of `docs/database-schema.md` (maker
 * authored, approved 2026-08-28). Tables appear in the doc's order so the two
 * can be reviewed side by side. Nothing here is a design decision; where the
 * doc is silent, this file stays silent too.
 *
 * Declarations only — no queries, no client, no connection string. `lib/db/`
 * is the only module that imports this file (docs/architecture.md D1).
 *
 * Deliberately NOT here, per the spec and the wave plan:
 * - `pg_trgm` and the `material_search_view` materialized view, including the
 *   full-text index on `material_synonyms.name` — a custom migration in W3-C
 *   (docs/database-schema.md, "Search infrastructure").
 *
 * RLS (added 2026-08-30, migration 0002 — pulled forward from Wave 5):
 * every public table enables RLS. Supabase grants anon/authenticated full DML
 * on the public schema by default and serves it over PostgREST with the
 * publishable key, so a table without RLS is world-writable the moment the
 * site is live — which it now is. Editorial tables carry NO policies:
 * deny-by-default closes the Data API while the app keeps reading them
 * through Drizzle (the `postgres` role bypasses RLS). The two user tables
 * carry owner-scoped policies for the Supabase client (Wave 5 verifies them
 * with two real accounts before bookmarks/notes ship). `auth.uid()` is
 * wrapped in a subselect on purpose — Postgres caches it as an InitPlan
 * instead of re-evaluating per row.
 *
 * Two mapping notes for `lib/db/`: `numeric` columns arrive from postgres.js
 * as strings and must be converted to the `number | null` shapes in
 * `lib/types.ts`; enum columns arrive as the exact literals below, which match
 * the string-literal unions in `lib/types.ts` one for one.
 */

import { sql } from 'drizzle-orm'
import { authUid, authenticatedRole } from 'drizzle-orm/supabase'
import {
  type AnyPgColumn,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgPolicy,
  pgSchema,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/* -------------------------------------------------------------------------
 * Enums
 *
 * Values are the contract shared with `lib/types.ts` (MaterialType,
 * SourceType, SynonymType, RestrictionType, Tenacity, Projection) and with the
 * seed-input enums in `lib/validation/material-data.ts`. tsc cannot see across
 * the snake/camel boundary, so these three lists stay in lockstep by review.
 * ---------------------------------------------------------------------- */

export const materialTypeEnum = pgEnum('material_type', [
  'synthetic',
  'natural',
  'isolate',
])

export const synonymTypeEnum = pgEnum('synonym_type', [
  'trade_name',
  'iupac',
  'common_name',
  'abbreviation',
  'supplier_name',
])

export const sourceTypeEnum = pgEnum('source_type', [
  'ifra',
  'sds',
  'pubchem',
  'gsc',
  'perfumer_blog',
  'book',
  'interview',
  'other',
])

/**
 * IFRA standards come in three kinds. Without this column a NULL `max_pct`
 * ambiguously means both "unrestricted" and "prohibited" — a safety-data
 * ambiguity the schema must not permit.
 */
export const restrictionTypeEnum = pgEnum('restriction_type', [
  'restriction',
  'prohibition',
  'specification',
])

export const tenacityEnum = pgEnum('tenacity', [
  'low',
  'medium',
  'high',
  'very_high',
])

export const projectionEnum = pgEnum('projection', ['low', 'medium', 'high'])

export const correctionStatusEnum = pgEnum('correction_status', [
  'new',
  'accepted',
  'rejected',
])

/**
 * `auth.users` belongs to Supabase Auth — "schema is theirs"
 * (docs/database-schema.md, "User tables"). This stub is not a project table
 * and is deliberately unexported: it exists only so the two user-owned tables
 * can declare a real FK with ON DELETE CASCADE, which is what makes account
 * deletion actually delete data (GDPR, AGENTS.md).
 *
 * drizzle-kit's `schemaFilter` defaults to `["public"]`, so neither the `auth`
 * schema nor this table is emitted into a generated migration — only the
 * referencing FK on the tables below. Never read or write through this stub;
 * `supabase.auth.getUser()` is the only source of the caller's identity.
 */
const authUsers = pgSchema('auth').table('users', {
  // No default: Supabase Auth mints these ids; this stub only mirrors them.
  id: uuid('id').primaryKey(),
})

/* -------------------------------------------------------------------------
 * Core tables
 *
 * FK deletion policy (deliberate): no ON DELETE action on any FK below.
 * Editorial content is soft-deleted (`deleted_at`), never hard-deleted, so a
 * blocked hard delete is a feature — it makes an accidental destructive
 * delete loud instead of silently cascading through cited data. The two
 * `auth.users` CASCADEs in the user tables are the only exception, because
 * account deletion must actually delete (GDPR).
 * ---------------------------------------------------------------------- */

/** The central table — one row per aromachemical or natural material. */
export const materials = pgTable(
  'materials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** URL identifier ("iso-e-super"). URLs use slugs, never ids. */
    slug: text('slug').notNull().unique(),
    canonicalName: text('canonical_name').notNull(),
    /** Drives the browse filters; the starter list mixes all three. */
    materialType: materialTypeEnum('material_type').notNull(),
    /** Nullable: some naturals carry no CAS. Indexed below. */
    casNumber: text('cas_number'),
    iupacName: text('iupac_name'),
    /**
     * Canonical SMILES from PubChem; NULL for naturals and mixtures, which
     * have no single structure. Every cheminformatics feature (2D render,
     * similarity, substructure, computed properties) skips NULL-SMILES
     * materials rather than erroring.
     */
    smiles: text('smiles'),
    molecularFormula: text('molecular_formula'),
    /**
     * All `numeric` columns in this schema are deliberately unconstrained
     * (no precision/scale): a fixed scale would silently round regulatory
     * values — IFRA limits go to ppm-scale decimals — while unconstrained
     * numeric is exact and never clips. Range CHECKs bound the values where
     * the spec calls for it, and `lib/db/` converts the driver's string to
     * the `number` shapes in `lib/types.ts`.
     */
    molecularWeight: numeric('molecular_weight'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Soft delete — editorial content keeps its history for audit/recovery. */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    // Search rule 0 short-circuits on an exact CAS match, so this lookup sits
    // in front of every query that starts with a CAS-shaped string.
    index('materials_cas_number_idx').on(t.casNumber),
  ]
).enableRLS()

/** Many synonyms per material — the substrate for search rules 2 and 3. */
export const materialSynonyms = pgTable(
  'material_synonyms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    materialId: uuid('material_id')
      .notNull()
      .references(() => materials.id),
    name: text('name').notNull(),
    synonymType: synonymTypeEnum('synonym_type').notNull(),
  },
  (t) => [
    // Every material detail page and every search hit fans out to this table
    // by material_id.
    index('material_synonyms_material_id_idx').on(t.materialId),
  ]
).enableRLS()

/** Olfactive families and sub-families. */
export const families = pgTable('families', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  /** Self-referential: sub-families hang off a parent, top level is NULL. */
  parentFamilyId: uuid('parent_family_id').references(
    (): AnyPgColumn => families.id
  ),
}).enableRLS()

/** Many-to-many join. */
export const materialFamilies = pgTable(
  'material_families',
  {
    materialId: uuid('material_id')
      .notNull()
      .references(() => materials.id),
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id),
  },
  (t) => [
    primaryKey({
      name: 'material_families_pk',
      columns: [t.materialId, t.familyId],
    }),
  ]
).enableRLS()

/**
 * IFRA's 11 categories. Static reference data, seeded once — the id is IFRA's
 * own numbering (1–11), not a generated key, so limits stay readable against
 * the published standards.
 */
export const usageCategories = pgTable(
  'usage_categories',
  {
    id: smallint('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
  },
  (t) => [
    // IFRA publishes exactly categories 1-11; anything else is a typo the
    // seed should not be able to smuggle in ("constraints liberally applied
    // - documentation the DB enforces").
    check('usage_categories_id_range_check', sql`${t.id} BETWEEN 1 AND 11`),
  ]
).enableRLS()

/** Per-material, per-category IFRA limits. */
export const materialUsageLimits = pgTable(
  'material_usage_limits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    materialId: uuid('material_id')
      .notNull()
      .references(() => materials.id),
    categoryId: smallint('category_id')
      .notNull()
      .references(() => usageCategories.id),
    restrictionType: restrictionTypeEnum('restriction_type')
      .notNull()
      .default('restriction'),
    /**
     * NULL means "no numeric limit" and must be read together with
     * `restriction_type` — a prohibition is NULL max_pct plus
     * restriction_type = 'prohibition'.
     */
    maxPct: numeric('max_pct'),
    notes: text('notes'),
    /** Safety data is citation-mandatory: NOT NULL by rule, not by habit. */
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id),
    /** e.g. "51st" — standards change per amendment and old ones stay queryable. */
    ifraAmendmentVersion: text('ifra_amendment_version').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    // Amendments are versioned, never overwritten: one row per material per
    // category per amendment.
    unique('material_usage_limits_material_category_amendment_uniq').on(
      t.materialId,
      t.categoryId,
      t.ifraAmendmentVersion
    ),
    check(
      'material_usage_limits_max_pct_range_check',
      sql`${t.maxPct} BETWEEN 0 AND 100`
    ),
  ]
).enableRLS()

/** GHS reference data, static, seeded once. The code itself is the identity. */
export const hazardCodes = pgTable('hazard_codes', {
  code: text('code').primaryKey(),
  description: text('description').notNull(),
  /** "Health hazard" / "Physical hazard" / "Environmental hazard". */
  category: text('category').notNull(),
}).enableRLS()

/** Join table. */
export const materialHazards = pgTable(
  'material_hazards',
  {
    materialId: uuid('material_id')
      .notNull()
      .references(() => materials.id),
    hazardCode: text('hazard_code')
      .notNull()
      .references(() => hazardCodes.code),
    /** Fact-bearing safety row — citation-mandatory. */
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id),
  },
  (t) => [
    primaryKey({
      name: 'material_hazards_pk',
      columns: [t.materialId, t.hazardCode],
    }),
  ]
).enableRLS()

/** Citations. Every superscript on the site resolves to a row here. */
export const sources = pgTable(
  'sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: sourceTypeEnum('type').notNull(),
    /** Nullable — books and interviews have no URL. */
    url: text('url'),
    title: text('title').notNull(),
    author: text('author'),
    publishedAt: date('published_at'),
    /**
     * Deliberately NO default: this is data — when the maker actually
     * accessed the source — supplied by input, not a row timestamp.
     */
    accessedAt: timestamp('accessed_at', { withTimezone: true }).notNull(),
    notes: text('notes'),
  },
  (t) => [
    // Partial, not plain: url is nullable, and a plain UNIQUE would still let
    // the seed pipeline accumulate a duplicate source row on every run for the
    // sources that do have URLs.
    uniqueIndex('sources_url_uniq')
      .on(t.url)
      .where(sql`${t.url} IS NOT NULL`),
  ]
).enableRLS()

/** Editorial olfactive descriptions, hand-written by the maker. */
export const materialDescriptions = pgTable(
  'material_descriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    materialId: uuid('material_id')
      .notNull()
      .references(() => materials.id),
    /** 3–6 sentences. */
    description: text('description').notNull(),
    tenacity: tenacityEnum('tenacity'),
    projection: projectionEnum('projection'),
    /** Tags, not entities — an array, so they need no lifecycle of their own. */
    keyFacets: text('key_facets').array().notNull().default([]),
    /**
     * Nullable by design: NULL means written purely from personal experience.
     * The citation-mandatory rule binds cited facts (limits, hazards, landmark
     * uses), not the maker's own bench notes.
     */
    sourceId: uuid('source_id').references(() => sources.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    // One *active* description per material. Without the partial index the
    // search view silently emits duplicate rows per material and the detail
    // page has to arbitrarily pick one; a plain UNIQUE would instead block
    // soft-deleted history from coexisting with its replacement.
    uniqueIndex('material_descriptions_active_material_uniq')
      .on(t.materialId)
      .where(sql`${t.deletedAt} IS NULL`),
  ]
).enableRLS()

/** Practical usage guidance — backs the "Usage" tab beyond IFRA limits. */
export const materialUsageGuidance = pgTable(
  'material_usage_guidance',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** One guidance row per material. */
    materialId: uuid('material_id')
      .notNull()
      .unique()
      .references(() => materials.id),
    /** Typical use range in EDP concentrate. */
    typicalPctMin: numeric('typical_pct_min'),
    typicalPctMax: numeric('typical_pct_max'),
    thresholdNote: text('threshold_note'),
    dilutionNote: text('dilution_note'),
    /** Nullable: NULL when it comes from the maker's own bench practice. */
    sourceId: uuid('source_id').references(() => sources.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      'material_usage_guidance_typical_pct_min_range_check',
      sql`${t.typicalPctMin} BETWEEN 0 AND 100`
    ),
    check(
      'material_usage_guidance_typical_pct_max_range_check',
      sql`${t.typicalPctMax} BETWEEN 0 AND 100`
    ),
    // An inverted range would render as "use at 5–0.5%" — nonsense the UI has
    // no way to detect. NULL on either side passes: a one-sided range is legal.
    check(
      'material_usage_guidance_typical_pct_order_check',
      sql`${t.typicalPctMax} >= ${t.typicalPctMin}`
    ),
  ]
).enableRLS()

/** "Material X in Perfume Y" cited references. */
export const landmarkUses = pgTable('landmark_uses', {
  id: uuid('id').primaryKey().defaultRandom(),
  materialId: uuid('material_id')
    .notNull()
    .references(() => materials.id),
  perfumeName: text('perfume_name').notNull(),
  house: text('house'),
  year: smallint('year'),
  notes: text('notes'),
  /** A claim about a real perfume — citation-mandatory. */
  sourceId: uuid('source_id')
    .notNull()
    .references(() => sources.id),
}).enableRLS()

/* -------------------------------------------------------------------------
 * Cheminformatics tables (added August 2026)
 *
 * Provenance for these rows is the tool version, not a `source_id`: the values
 * are deterministic recomputations, not cited facts, so `rdkit_version` (or
 * `model_version`) records exactly what produced them.
 * ---------------------------------------------------------------------- */

/** One row per material with SMILES; the material id is the whole key. */
export const materialComputedProperties = pgTable(
  'material_computed_properties',
  {
    materialId: uuid('material_id')
      .primaryKey()
      .references(() => materials.id),
    /** Crippen logP. */
    logp: numeric('logp'),
    /** Topological polar surface area. */
    tpsa: numeric('tpsa'),
    heavyAtomCount: integer('heavy_atom_count'),
    rdkitVersion: text('rdkit_version').notNull(),
    /** Insert time equals pipeline write time in our flow, so default it. */
    computedAt: timestamp('computed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  }
).enableRLS()

/** Precomputed top-N (N≈10) Tanimoto neighbors, refreshed by the seed pipeline. */
export const materialSimilarity = pgTable(
  'material_similarity',
  {
    materialId: uuid('material_id')
      .notNull()
      .references(() => materials.id),
    similarMaterialId: uuid('similar_material_id')
      .notNull()
      .references(() => materials.id),
    /** Morgan/ECFP4 fingerprints. */
    tanimoto: numeric('tanimoto').notNull(),
    rdkitVersion: text('rdkit_version').notNull(),
  },
  (t) => [
    primaryKey({
      name: 'material_similarity_pk',
      columns: [t.materialId, t.similarMaterialId],
    }),
    // A material is trivially its own nearest neighbor; letting that row exist
    // would burn a slot in every top-N list.
    check(
      'material_similarity_not_self_check',
      sql`${t.materialId} <> ${t.similarMaterialId}`
    ),
    check(
      'material_similarity_tanimoto_range_check',
      sql`${t.tanimoto} BETWEEN 0 AND 1`
    ),
  ]
).enableRLS()

/**
 * Output of the structure–odor experiment. Experimental, clearly labeled in
 * the UI, regenerable wholesale — and structurally separate from
 * `material_descriptions` so model output can never be mistaken for the
 * human-written editorial layer.
 */
export const odorPredictions = pgTable(
  'odor_predictions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    materialId: uuid('material_id')
      .notNull()
      .references(() => materials.id),
    /** The model's label space, e.g. "woody", "musky". */
    descriptor: text('descriptor').notNull(),
    probability: numeric('probability').notNull(),
    /** e.g. "sor-v0.1" — always displayed alongside the prediction. */
    modelVersion: text('model_version').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Re-running a model version must overwrite its own rows, not stack a
    // second copy of every descriptor beside the first.
    unique('odor_predictions_material_descriptor_model_uniq').on(
      t.materialId,
      t.descriptor,
      t.modelVersion
    ),
    check(
      'odor_predictions_probability_range_check',
      sql`${t.probability} BETWEEN 0 AND 1`
    ),
  ]
).enableRLS()

/* -------------------------------------------------------------------------
 * User tables
 *
 * User-owned rows: hard delete only, never `deleted_at` (GDPR). Read and
 * written through the Supabase client so RLS applies — Drizzle connects as
 * `postgres` and would silently bypass it (AGENTS.md).
 * ---------------------------------------------------------------------- */

/** Bookmarks. RLS-protected. */
export const userSavedMaterials = pgTable(
  'user_saved_materials',
  {
    /** CASCADE is what makes Supabase account deletion actually delete data. */
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    materialId: uuid('material_id')
      .notNull()
      .references(() => materials.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({
      name: 'user_saved_materials_pk',
      columns: [t.userId, t.materialId],
    }),
    // Owner-scoped. No UPDATE policy: a bookmark is its composite key plus a
    // timestamp — there is nothing to update, so updates stay denied.
    pgPolicy('user_saved_materials_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${authUid} = ${t.userId}`,
    }),
    pgPolicy('user_saved_materials_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`${authUid} = ${t.userId}`,
    }),
    pgPolicy('user_saved_materials_delete_own', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`${authUid} = ${t.userId}`,
    }),
  ]
)

/** Free-text private notes per material. RLS-protected. */
export const userNotes = pgTable(
  'user_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    materialId: uuid('material_id')
      .notNull()
      .references(() => materials.id),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // One note per user per material — the editor upserts against this.
    unique('user_notes_user_material_uniq').on(t.userId, t.materialId),
    pgPolicy('user_notes_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${authUid} = ${t.userId}`,
    }),
    pgPolicy('user_notes_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`${authUid} = ${t.userId}`,
    }),
    // UPDATE needs both barrels: `using` gates which rows are visible to the
    // update, `withCheck` stops re-pointing a row at another user.
    pgPolicy('user_notes_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`${authUid} = ${t.userId}`,
      withCheck: sql`${authUid} = ${t.userId}`,
    }),
    pgPolicy('user_notes_delete_own', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`${authUid} = ${t.userId}`,
    }),
  ]
)

/* -------------------------------------------------------------------------
 * Operational tables
 * ---------------------------------------------------------------------- */

/** The "submit a correction" form. Public insert (rate-limited), maker-only read. */
export const correctionSubmissions = pgTable('correction_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Nullable: NULL for general/site-wide corrections. */
  materialId: uuid('material_id').references(() => materials.id),
  /** Optional contact for follow-up. */
  email: text('email'),
  body: text('body').notNull(),
  status: correctionStatusEnum('status').notNull().default('new'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS()

/**
 * Drives the admin dashboard's "search count" and "top searches".
 * Privacy-deliberate: no user_id, no IP, no session key — just the query.
 * Rows older than ~90 days are purged by a Supabase scheduled job.
 */
export const searchQueries = pgTable('search_queries', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Normalized (lowercased, trimmed) — see lib/search/normalize.ts. */
  query: text('query').notNull(),
  /** 0 = a miss, the most useful signal for synonym-table gaps. */
  resultCount: integer('result_count').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS()
