# Database Schema

## Design principles

- **Slugs as URL identifiers, not IDs.** `/materials/iso-e-super` is readable, SEO-friendly, stable.
- **Citations are structural, not optional.** Every fact-bearing row has a non-nullable `source_id`.
- **Soft deletes on editorial content.** `deleted_at` columns on materials and descriptions; never lose history.
- **Nothing is published unreviewed** (migration `0008`, 2026-10-02). Readers see a material only when `deleted_at IS NULL AND reviewed_hash = content_hash`. Both columns hold a fingerprint of what the material's page renders, including the shared rows it shows (family and IFRA category names, hazard statements, class names, full citation rows). The seed refreshes `content_hash` for every live material after each run; only `npm run db:review publish`, given the fingerprint the maker was shown, sets `reviewed_hash`. Any change to what a reviewed page shows hides it until it is reviewed again, and the detail page re-checks the fingerprint on every request. One predicate, `materialIsPublished` in `lib/db/published.ts`, applies this everywhere. Families with no published material are hidden too.
- **Constraints liberally applied.** NOT NULL, FOREIGN KEY, CHECK constraints are documentation that the database enforces.
- **Timestamps everywhere.** `created_at` and `updated_at` on every mutable table.
- **Row-Level Security on every table, deny-by-default** (migration `0002`, 2026-08-30). Supabase grants `anon` full DML over PostgREST, so a table without RLS is world-writable the moment the site is live. Editorial tables carry no policies — the app reads them through Drizzle, which connects as `postgres` and bypasses RLS; user tables carry owner-scoped policies. Never touch user tables through Drizzle.

## Core tables

### `materials`

The central table — one row per aromachemical or natural material.

| Column             | Type                               | Notes                                                                                                                                                                                                                       |
| ------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                 | uuid PK                            |                                                                                                                                                                                                                             |
| slug               | text UNIQUE NOT NULL               | URL identifier (e.g. "iso-e-super")                                                                                                                                                                                         |
| canonical_name     | text NOT NULL                      | The display name                                                                                                                                                                                                            |
| material_type      | enum NOT NULL                      | synthetic / natural / isolate — drives browse filters; the starter list mixes all three and users will expect to filter by it                                                                                               |
| cas_number         | text NULLABLE, INDEXED             | Some naturals lack CAS; allow null                                                                                                                                                                                          |
| iupac_name         | text NULLABLE                      |                                                                                                                                                                                                                             |
| smiles             | text NULLABLE                      | Canonical SMILES (PubChem); NULL for naturals/mixtures. Drives rendering, similarity, substructure search                                                                                                                   |
| molecular_formula  | text NULLABLE                      |                                                                                                                                                                                                                             |
| identity_source_id | uuid FK → sources NOT NULL         | The record the identity scalars (cas_number, iupac_name, smiles, molecular_formula, molecular_weight) come from — one source per material, cited once. Added nullable in migration `0004`, NOT NULL in `0005` (2026-09-05). |
| molecular_weight   | numeric NULLABLE                   |                                                                                                                                                                                                                             |
| created_at         | timestamptz NOT NULL DEFAULT now() |                                                                                                                                                                                                                             |
| updated_at         | timestamptz NOT NULL DEFAULT now() |                                                                                                                                                                                                                             |
| deleted_at         | timestamptz NULLABLE               | Soft delete                                                                                                                                                                                                                 |
| content_hash       | text NULLABLE                      | Review gate (`0008`): stored fingerprint of what the page renders (`lib/review/fingerprint.ts`), refreshed by the seed for every live material                                                                              |
| reviewed_hash      | text NULLABLE                      | Review gate: written ONLY by `npm run db:review publish`. Readers see the row only while it equals the fingerprint of what the page renders                                                                                 |
| reviewed_at        | timestamptz NULLABLE               | When the maker reviewed it. CHECK: set together with `reviewed_hash` or not at all                                                                                                                                          |

### `material_synonyms`

Many synonyms per material — drives search.

| Column       | Type                         | Notes                                                                                                                                  |
| ------------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| id           | uuid PK                      |                                                                                                                                        |
| material_id  | uuid FK → materials NOT NULL |                                                                                                                                        |
| name         | text NOT NULL                |                                                                                                                                        |
| synonym_type | enum NOT NULL                | trade_name / iupac / common_name / abbreviation / supplier_name                                                                        |
| source_id    | uuid FK → sources NOT NULL   | Per row — synonyms come from different documents (PubChem list, TGSC, the IFRA Standard's commercial names). Migrations `0004`/`0005`. |

Index: `(material_id)`, full-text index on `name`.

### `families`

Olfactive families and sub-families.

| Column           | Type                        | Notes                                 |
| ---------------- | --------------------------- | ------------------------------------- |
| id               | uuid PK                     |                                       |
| name             | text UNIQUE NOT NULL        | e.g. "Woody", "Amber", "Iso E ambers" |
| slug             | text UNIQUE NOT NULL        |                                       |
| parent_family_id | uuid FK → families NULLABLE | Self-referential for hierarchy        |

### `material_families`

Many-to-many join.

| Column                               | Type                | Notes |
| ------------------------------------ | ------------------- | ----- |
| material_id                          | uuid FK → materials |       |
| family_id                            | uuid FK → families  |       |
| PRIMARY KEY (material_id, family_id) |                     |       |

### `usage_categories`

IFRA's 11 categories. Static reference data, seeded once.

| Column      | Type          | Notes                           |
| ----------- | ------------- | ------------------------------- |
| id          | smallint PK   | 1–11 to match IFRA numbering    |
| name        | text NOT NULL | e.g. "Category 1: Lip products" |
| description | text          |                                 |

### `material_usage_limits`

Per-material, per-category IFRA limits.

| Column                 | Type                                    | Notes                                                                                                                                                             |
| ---------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                     | uuid PK                                 |                                                                                                                                                                   |
| material_id            | uuid FK → materials NOT NULL            |                                                                                                                                                                   |
| category_id            | smallint FK → usage_categories NOT NULL |                                                                                                                                                                   |
| restriction_type       | enum NOT NULL DEFAULT 'restriction'     | restriction / prohibition / specification — IFRA standards come in three kinds; without this, NULL max_pct ambiguously means both "unrestricted" and "prohibited" |
| max_pct                | numeric NULLABLE                        | NULL = "no numeric limit"; check constraint: 0 ≤ max_pct ≤ 100; prohibitions carry NULL max_pct + restriction_type='prohibition'                                  |
| notes                  | text NULLABLE                           |                                                                                                                                                                   |
| source_id              | uuid FK → sources NOT NULL              |                                                                                                                                                                   |
| ifra_amendment_version | text NOT NULL                           | e.g. "51st"                                                                                                                                                       |
| verified_at            | timestamptz NOT NULL                    |                                                                                                                                                                   |

UNIQUE (material_id, category_id, ifra_amendment_version).

### `chemical_classes`

Structural classes a molecule can belong to — "ester", "macrocyclic ketone", "contains a lactone ring" (migration `0006`, 2026-09-05). Reference data, seeded from `chemical-classes.json` like `usage_categories` and `hazard_codes`.

| Column      | Type              | Notes                                                                                                                                                      |
| ----------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| slug        | text PK           | URL identifier, e.g. "macrocyclic-ketone"                                                                                                                  |
| name        | text NOT NULL     | Display name                                                                                                                                               |
| smarts      | text NOT NULL     | The SMARTS pattern membership is computed from. Validated by compiling it before any write; an empty pattern is rejected because it matches every molecule |
| description | text NOT NULL     | One line of plain language for the reader                                                                                                                  |
| sort_order  | smallint NOT NULL | Display order; the list is curated, not alphabetical                                                                                                       |

This is a **structural** axis, not an olfactive one — `families` remains the olfactive taxonomy and the two are independent.

### `material_chemical_classes`

Which materials belong to which class.

| Column                                | Type                                | Notes                                                                              |
| ------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| material_id                           | uuid FK → materials NOT NULL        |                                                                                    |
| class_slug                            | text FK → chemical_classes NOT NULL |                                                                                    |
| rdkit_version                         | text NOT NULL                       | Provenance, exactly as on `material_computed_properties` and `material_similarity` |
| PRIMARY KEY (material_id, class_slug) |                                     |                                                                                    |

**Not a cited fact and carries no `source_id`.** Membership is a deterministic recomputation from `materials.smiles` and the class's SMARTS, so it is stamped with the RDKit version that produced it (AGENTS.md). It is never authored by hand: the seed derives it, so a data file cannot claim a class the structure does not support. A NULL-SMILES material — a natural or any other mixture — simply has no rows here.

### `material_ifra_absences`

A verified absence of an IFRA Standard, checked against one amendment's complete index (migration `0004`, 2026-09-05). Without it a material with no Standard was indistinguishable from one nobody had researched — zero `material_usage_limits` rows either way, and the safety panel said "none entered yet" to both.

| Column                                            | Type                         | Notes                                               |
| ------------------------------------------------- | ---------------------------- | --------------------------------------------------- |
| material_id                                       | uuid FK → materials NOT NULL |                                                     |
| ifra_amendment_version                            | text NOT NULL                | The amendment whose index was searched, e.g. "51st" |
| source_id                                         | uuid FK → sources NOT NULL   | The index document                                  |
| verified_at                                       | timestamptz NOT NULL         |                                                     |
| notes                                             | text NULLABLE                |                                                     |
| PRIMARY KEY (material_id, ifra_amendment_version) |                              |                                                     |

Never overwritten: when a later amendment brings a Standard, its `material_usage_limits` rows sit beside this row as history. Validation refuses a file carrying both a limit and an absence for the same amendment. No limits and no absence means "not researched", and the UI says exactly that.

### `hazard_codes`

GHS reference data, static, seeded once.

| Column      | Type          | Notes                                                        |
| ----------- | ------------- | ------------------------------------------------------------ |
| code        | text PK       | e.g. "H317"                                                  |
| description | text NOT NULL | "May cause an allergic skin reaction"                        |
| category    | text NOT NULL | "Health hazard" / "Physical hazard" / "Environmental hazard" |

### `material_hazards`

Join table.

| Column                                 | Type                       | Notes |
| -------------------------------------- | -------------------------- | ----- |
| material_id                            | uuid FK → materials        |       |
| hazard_code                            | text FK → hazard_codes     |       |
| source_id                              | uuid FK → sources NOT NULL |       |
| PRIMARY KEY (material_id, hazard_code) |                            |       |

### `sources`

Citations.

| Column       | Type                                       | Notes                                                                                                                                                                                                                         |
| ------------ | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id           | uuid PK                                    |                                                                                                                                                                                                                               |
| key          | text NULLABLE, UNIQUE (`sources_key_uniq`) | Global identity from the seed input, so one document cited by many materials is one row (migration `0003`, 2026-09-04). Every live row is keyed; the column is nullable only so legacy rows could be adopted by the backfill. |
| type         | enum NOT NULL                              | ifra / sds / pubchem / gsc / perfumer_blog / book / interview / other                                                                                                                                                         |
| url          | text NULLABLE                              |                                                                                                                                                                                                                               |
| title        | text NOT NULL                              |                                                                                                                                                                                                                               |
| author       | text NULLABLE                              |                                                                                                                                                                                                                               |
| published_at | date NULLABLE                              |                                                                                                                                                                                                                               |
| accessed_at  | timestamptz NOT NULL                       |                                                                                                                                                                                                                               |
| notes        | text NULLABLE                              |                                                                                                                                                                                                                               |

Sources resolve by `key` first. The partial unique index `UNIQUE (url) WHERE url IS NOT NULL` remains as the secondary guard — without it the seed pipeline accumulated duplicate rows every run.

### `material_descriptions`

Editorial olfactive descriptions, written by maker.

| Column      | Type                         | Notes                                             |
| ----------- | ---------------------------- | ------------------------------------------------- |
| id          | uuid PK                      |                                                   |
| material_id | uuid FK → materials NOT NULL |                                                   |
| description | text NOT NULL                | 3–6 sentences                                     |
| tenacity    | enum NULLABLE                | low / medium / high / very_high                   |
| projection  | enum NULLABLE                | low / medium / high                               |
| key_facets  | text[] NOT NULL DEFAULT '{}' | e.g. {"velvety","ambery","woody"}                 |
| source_id   | uuid FK → sources NULLABLE   | NULL when written purely from personal experience |
| created_at  | timestamptz NOT NULL         |                                                   |
| updated_at  | timestamptz NOT NULL         |                                                   |
| deleted_at  | timestamptz NULLABLE         |                                                   |

Partial unique index: `UNIQUE (material_id) WHERE deleted_at IS NULL` — one _active_ description per material. Without it, the search view (below) silently emits duplicate rows per material, and the detail page has to arbitrarily pick one.

### `material_usage_guidance`

Practical usage guidance — backs the "Usage" tab beyond IFRA limits. (The per-material data targets in [data-strategy.md](./data-strategy.md) promise typical %, threshold, and dilution guidance; this is where they live.)

| Column                  | Type                                | Notes                                             |
| ----------------------- | ----------------------------------- | ------------------------------------------------- |
| id                      | uuid PK                             |                                                   |
| material_id             | uuid FK → materials NOT NULL UNIQUE | One guidance row per material                     |
| typical_pct_min         | numeric NULLABLE                    | Typical use range in EDP concentrate; CHECK 0–100 |
| typical_pct_max         | numeric NULLABLE                    | CHECK 0–100, ≥ typical_pct_min                    |
| threshold_note          | text NULLABLE                       | Threshold-of-perception note                      |
| dilution_note           | text NULLABLE                       | Common working dilution recommendation            |
| source_id               | uuid FK → sources NULLABLE          | NULL when from the maker's own bench practice     |
| created_at / updated_at | timestamptz NOT NULL                |                                                   |

### `landmark_uses`

"Material X in Perfume Y" cited references.

| Column       | Type                         | Notes |
| ------------ | ---------------------------- | ----- |
| id           | uuid PK                      |       |
| material_id  | uuid FK → materials NOT NULL |       |
| perfume_name | text NOT NULL                |       |
| house        | text NULLABLE                |       |
| year         | smallint NULLABLE            |       |
| notes        | text NULLABLE                |       |
| source_id    | uuid FK → sources NOT NULL   |       |

## Cheminformatics tables (added August 2026)

Backs the v1 cheminformatics scope ([scope.md](./scope.md), [cheminformatics.md](./cheminformatics.md)). Design notes:

- **`smiles` is nullable** — naturals are mixtures with no single structure; every cheminformatics feature simply skips NULL-SMILES materials.
- **Substructure search needs no schema** — it runs client-side in RDKit.js over the corpus's SMILES strings.
- **Provenance for computed rows is the tool version, not a `source_id`** — the values are deterministic recomputations; `rdkit_version` records exactly what produced them.
- **Model predictions never touch `material_descriptions`** — they live in their own table, carry a `model_version`, and render only inside a clearly-labeled experimental module.

### `material_computed_properties`

| Column           | Type                    | Notes                            |
| ---------------- | ----------------------- | -------------------------------- |
| material_id      | uuid PK, FK → materials | One row per material with SMILES |
| logp             | numeric NULLABLE        | Crippen logP                     |
| tpsa             | numeric NULLABLE        | Topological polar surface area   |
| heavy_atom_count | int NULLABLE            |                                  |
| rdkit_version    | text NOT NULL           | Provenance                       |
| computed_at      | timestamptz NOT NULL    |                                  |

### `material_similarity`

Precomputed top-N (N≈10) Tanimoto neighbors per material, refreshed by the seed pipeline.

| Column                                         | Type                | Notes                                    |
| ---------------------------------------------- | ------------------- | ---------------------------------------- |
| material_id                                    | uuid FK → materials |                                          |
| similar_material_id                            | uuid FK → materials | CHECK material_id <> similar_material_id |
| tanimoto                                       | numeric NOT NULL    | CHECK 0–1; Morgan/ECFP4 fingerprints     |
| rdkit_version                                  | text NOT NULL       |                                          |
| PRIMARY KEY (material_id, similar_material_id) |                     |                                          |

### `odor_predictions`

Output of the structure–odor experiment. Experimental, clearly labeled in the UI, regenerable wholesale.

| Column        | Type                         | Notes                                          |
| ------------- | ---------------------------- | ---------------------------------------------- |
| id            | uuid PK                      |                                                |
| material_id   | uuid FK → materials NOT NULL |                                                |
| descriptor    | text NOT NULL                | The model's label space, e.g. "woody", "musky" |
| probability   | numeric NOT NULL             | CHECK 0–1                                      |
| model_version | text NOT NULL                | e.g. "sor-v0.1"                                |
| created_at    | timestamptz NOT NULL         |                                                |

UNIQUE (material_id, descriptor, model_version).

## User tables

### `users`

Managed by Supabase Auth — schema is theirs. Application reads `auth.users` for ID and email.

### `user_saved_materials`

Bookmarks. RLS-protected.

| Column                             | Type                                   | Notes                                                                    |
| ---------------------------------- | -------------------------------------- | ------------------------------------------------------------------------ |
| user_id                            | uuid FK → auth.users ON DELETE CASCADE | Cascade makes Supabase account deletion actually delete user data (GDPR) |
| material_id                        | uuid FK → materials                    |                                                                          |
| created_at                         | timestamptz NOT NULL                   |                                                                          |
| PRIMARY KEY (user_id, material_id) |                                        |                                                                          |

RLS policy: SELECT/INSERT/DELETE allowed only when `auth.uid() = user_id`.

### `user_notes`

Free-text private notes per material.

| Column      | Type                                            | Notes |
| ----------- | ----------------------------------------------- | ----- |
| id          | uuid PK                                         |       |
| user_id     | uuid FK → auth.users NOT NULL ON DELETE CASCADE |       |
| material_id | uuid FK → materials NOT NULL                    |       |
| body        | text NOT NULL                                   |       |
| created_at  | timestamptz NOT NULL                            |       |
| updated_at  | timestamptz NOT NULL                            |       |

UNIQUE (user_id, material_id) — one note per user per material.
RLS: same as above.

## Operational tables

These back v1 scope items ([scope.md](./scope.md)) that previously had no schema: the correction form and the admin dashboard's "top searches."

### `correction_submissions`

The "submit a correction" form. Public insert (rate-limited), maker-only read.

| Column      | Type                         | Notes                                  |
| ----------- | ---------------------------- | -------------------------------------- |
| id          | uuid PK                      |                                        |
| material_id | uuid FK → materials NULLABLE | NULL for general/site-wide corrections |
| email       | text NULLABLE                | Optional contact for follow-up         |
| body        | text NOT NULL                | The suggested correction               |
| status      | enum NOT NULL DEFAULT 'new'  | new / accepted / rejected              |
| created_at  | timestamptz NOT NULL         |                                        |

### `search_queries`

Drives the admin dashboard's "search count" and "top searches." Privacy-deliberate: no user_id, no IP, no session key — just the query string.

| Column       | Type                 | Notes                                                      |
| ------------ | -------------------- | ---------------------------------------------------------- |
| id           | uuid PK              |                                                            |
| query        | text NOT NULL        | Normalized (lowercased, trimmed)                           |
| result_count | int NOT NULL         | 0 = a miss — the most useful signal for synonym-table gaps |
| created_at   | timestamptz NOT NULL |                                                            |

Retention: **intended** to purge rows older than ~90 days via a Supabase scheduled job — **not implemented as of 2026-09-05** (verified against the live database: no `pg_cron`, no `cron` schema, no job). Rows are kept indefinitely until it is. `/privacy` says exactly that rather than promising a retention period nothing enforces; both need updating together when the job lands.

## Search infrastructure

### Extension: `pg_trgm`

`CREATE EXTENSION IF NOT EXISTS pg_trgm;` (one click on Supabase). Trigram GIN indexes on `materials.canonical_name` and `material_synonyms.name` serve ranking rule 3 (prefix) and give typo tolerance ("galoxolide" still finds galaxolide) — FTS alone cannot do either.

### Materialized view: `material_search_view`

Joins materials + synonyms + descriptions into a unified searchable corpus.

Design notes (each fixes a real failure mode):

- **`'simple'` config for names/synonyms, `'english'` only for descriptions.** English stemming mangles trade names — they aren't English words and must match verbatim.
- **CAS numbers are _not_ in the vector.** The `'english'`/`'simple'` tokenizers split `54464-57-2` unpredictably; CAS search is an exact-match short-circuit on the indexed `cas_number` column in `lib/search.ts` (rule 0 below).
- **Synonyms and descriptions aggregate in lateral subqueries**, not a flat `GROUP BY` join — joining both tables directly cross-multiplies rows when a material has several synonyms and more than one description row.
- **A plain unique index on `id` is mandatory** — `REFRESH MATERIALIZED VIEW CONCURRENTLY` refuses to run without one.

```sql
CREATE MATERIALIZED VIEW material_search_view AS
SELECT
  m.id,
  m.slug,
  m.canonical_name,
  m.cas_number,
  -- weights: name = A, synonyms = B, description = C
  setweight(to_tsvector('simple', m.canonical_name), 'A') ||
  setweight(to_tsvector('simple', coalesce(syn.names, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(d.description, '')), 'C') AS weighted_vector
FROM materials m
LEFT JOIN LATERAL (
  SELECT string_agg(s.name, ' ') AS names
  FROM material_synonyms s
  WHERE s.material_id = m.id
) syn ON true
LEFT JOIN LATERAL (
  SELECT d.description
  FROM material_descriptions d
  WHERE d.material_id = m.id AND d.deleted_at IS NULL
  ORDER BY d.updated_at DESC
  LIMIT 1
) d ON true
WHERE m.deleted_at IS NULL;

CREATE UNIQUE INDEX ON material_search_view (id);  -- required for REFRESH ... CONCURRENTLY
CREATE INDEX ON material_search_view USING GIN (weighted_vector);
```

Refresh: editorial data only changes via the seed script in v1, so refresh is one statement at the end of the seed run — no triggers, no debouncing needed yet.

### Search ranking rules

0. Exact match on `cas_number` (normalized) → immediate top, short-circuit
1. Exact match on `canonical_name` → top
2. Exact match on a synonym → second
3. Prefix/trigram match on canonical or synonym (pg_trgm) → third
4. Full-text match weighted by `setweight` (A > B > C) → remainder
5. Tie-break: most recently updated material first

These rules belong in `lib/search.ts` with Vitest cases for each. Log every query + result count to `search_queries` — zero-result queries are the to-do list for the synonym table.

## Schema decisions and rationale

- **Why slugs not IDs in URLs:** human-readable, SEO-friendly, stable across DB resets, support natural redirects.
- **Why mandatory `source_id`:** the entire project's value proposition is "every fact has a citation." Encoding that in the schema rather than convention is good engineering.
- **Why versioned IFRA limits:** standards change with each amendment. Old standards must remain queryable. Never overwrite — insert new rows with new amendment version.
- **Why soft deletes only on editorial content:** users can hard-delete their own data (GDPR); editorial content keeps history for audit and recovery.
- **Why text array for `key_facets` instead of join table:** facets are tags, not entities. They don't need their own lifecycle. PostgreSQL arrays + GIN indexing handle this cleanly.
- **Why predictions live apart from descriptions:** the editorial layer is the product's trust anchor. Model output carries its own provenance (`model_version`), renders only as labeled-experimental, and can be regenerated or withdrawn wholesale without touching human-written content.
- **Why computed properties have `rdkit_version` instead of `source_id`:** they aren't cited facts, they're deterministic recomputations — the honest provenance is the exact tool that produced them.

## Open questions from the first cited drafts (2026-09-05)

The first three real materials (Iso E Super, Javanol, Civetone — see
[maker-todo.md](./maker-todo.md)) produced verified facts this schema cannot
hold, and two of them are defects on the live page. Decide these before the
corpus grows; each sets a convention every later material follows.

1. ~~**A verified IFRA absence.**~~ **Decided 2026-09-05:** `material_ifra_absences`, one row per material per amendment (above).
2. ~~**Identity facts have no `source_id`.**~~ **Decided 2026-09-05:** `materials.identity_source_id` (one per material) and `material_synonyms.source_id` (per row); the detail page's citation walk now starts with them.
3. **IFRA subcategories.** Categories 5 and 10 split into subcategories with
   different limits; the table stores one value per category. Storing the
   most restrictive under-states what a body lotion or a spray may carry.
   `usage_categories` also stops at 11, so Category 12 is unrepresentable.
4. **Where verified physical properties, registry identifiers (FEMA, JECFA,
   EC, UNII), supplier substantivity figures and non-IFRA recommended maxima
   live.** All three materials produced them; all are parked in source
   `notes`.
5. **Minority GHS classifications.** Civetone's H315 is a 20 % self-notified
   position; `material_hazards` has no way to say so.
6. **Amendment label convention** for `ifra_amendment_version` — the
   Standard's own amendment, or the index it is current in. The unique key
   is (category, amendment), so one convention must hold.
