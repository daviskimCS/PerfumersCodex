# Architecture Decisions (Wave 0)

**Status: APPROVED** — drafted and approved Aug 26, 2026. Materialized in `AGENTS.md`, `lib/types.ts`, and the repo tooling; binding on all implementation work.

These are the six code-level decisions that must exist before parallel agentic
work can start on Phases 1–2. They sit _below_ the design docs (what the
product and data are — see [database-schema.md](./database-schema.md),
[tech-stack.md](./tech-stack.md)) and _above_ implementation: module layout,
contracts, and conventions that keep independently-written code convergent.

On approval: the distilled rules move into `AGENTS.md` (canonical), the
shared contracts materialize as files, and Wave 1 dispatches against them.
Until then nothing here is binding.

---

## D1 — Module layout

**Context.** `AGENTS.md` currently says both "schema in `/db/schema.ts`" and
"all DB access goes through `/lib/db/`". Both are kept, with the ambiguity
resolved: `db/` is where the database _shape_ is declared; `lib/db/` is where
the database is _accessed_.

**Decision.**

```
app/                  Routes only. Server components by default; pages compose
                      lib functions + components, no data-access logic inline.
components/
  ui/                 shadcn primitives (copied, owned — Week 6)
  *.tsx               Shared app components (empty-state, citation superscripts, …)
db/
  schema.ts           Drizzle table definitions — the single place the DB shape
                      is declared in TypeScript
  migrations/         drizzle-kit output. Generated, committed, never hand-edited.
drizzle.config.ts     Reads DIRECT_URL (5432). Migrations only.
lib/
  db/                 ALL data access, one file per domain (materials.ts,
                      families.ts, search.ts, …). Editorial/public reads import
                      the Drizzle client; user-owned data (Phase 3) imports the
                      Supabase server client so RLS is enforced.
    client.ts         Pooled Drizzle client — DATABASE_URL (6543), prepare: false
  supabase/           @supabase/ssr client factories: browser.ts, server.ts
  search/             The search pipeline (see D2)
  validation/         Zod schemas shared by client + server (see D6)
  types.ts            App-facing domain contracts (see D3)
  env.ts              Validated env access (see D6)
proxy.ts              Repo root — Supabase token-refresh proxy (Next 16's name
                      for middleware) plus the pre-launch password gate
                      (lib/gate.ts). The one location Next.js fixes; the only
                      file outside the layout above with a job.
```

**Rules (promote to AGENTS.md on approval):**

- Nothing outside `lib/db/` imports `db/schema.ts`, the Drizzle client, or a
  Supabase client. Pages and components call `lib/db/` functions and receive
  `lib/types.ts` shapes.
- **One carve-out, added 2026-08-31 (W4-A):** `scripts/` may import
  `db/schema.ts` directly. Build tooling is not the application — the seed
  pipeline writes every table in the schema, and routing that through
  `lib/db/` would mean adding a write API that no page ever calls, growing
  the app's data-access surface to serve a script. The rule's purpose is to
  keep _route and component_ code away from raw rows, and that purpose is
  untouched. `scripts/` still takes its client from `lib/db/` rather than
  opening its own connection, so there remains exactly one pooled client.
- `lib/db/` functions return app-facing types (D3), not raw Drizzle rows —
  row types stay internal to `lib/db/`.
- Imports use the `@/` alias (maps to repo root, already in tsconfig).

---

## D2 — Search: the SQL / TypeScript boundary

**Context.** Ranking rules 0–5 ([database-schema.md](./database-schema.md))
mix DB-side machinery (tsvector, pg_trgm) with app-side logic (CAS
short-circuit, tier ordering, tie-breaks). Where the line sits decides whether
ranking is unit-testable without Postgres — i.e. whether Week 5 logic can be
built and gold-set-tested before Phase 0 credentials exist.

**Decision: SQL returns _evidence_, TypeScript assigns _rank_.**

Pipeline in `lib/search/index.ts` — `searchMaterials(query: string)`:

1. **Normalize** (`lib/search/normalize.ts`, pure): trim, lowercase, collapse
   whitespace; detect CAS-number form (`\d{2,7}-\d{2}-\d`).
2. **CAS short-circuit** (rule 0): if the query is CAS-shaped, exact lookup on
   the indexed `cas_number` column (`lib/db/search.ts`). Hit → return that
   single tier-0 result. Miss → fall through to the normal pipeline.
3. **Fetch candidates** (`lib/db/search.ts`): one round-trip returning
   `SearchCandidate[]` — evidence rows (exact-synonym flag, trigram
   similarities, weighted `ts_rank`, `updated_at`), capped (~50). No ordering
   promises beyond the cap.
4. **Rank** (`lib/search/rank.ts`, pure): assign tiers 1–4 per the rules,
   sort by (tier, score desc, updatedAt desc), dedupe to best-tier-per-material.
5. **Log** (rule from schema doc): `logSearchQuery(query, resultCount)` —
   fire-and-forget, never blocks or fails the response.

**Locked:** the boundary itself, the pipeline order, and the tier semantics.
**Deliberately flexible:** the exact `SearchCandidate` columns and SQL shape —
those may adjust during Week 5 implementation without a decision review.
`SearchCandidate` is pipeline-internal and lives in `lib/search/types.ts`,
not in the app-facing `lib/types.ts`.

**Consequences:** `normalize.ts` + `rank.ts` are pure functions — the Week 5
gold set ("iso e", "OTNE", "54464-57-2", "timbersilk", "amber wood" → Iso E
Super at expected rank) runs against synthetic candidates with no database.
One DB round-trip per search keeps the <150ms p95 budget honest. The public
import path stays `@/lib/search` (the milestone plan's `lib/search.ts` becomes
`lib/search/index.ts`).

---

## D3 — Core type contracts

**Context.** No interfaces exist anywhere in the repo or docs, and parallel
agents need shapes they must conform to and may not change. These are
hand-written **view models** derived from
[database-schema.md](./database-schema.md) — deliberately _not_ inferred from
Drizzle, so UI work never couples to the schema layer and can proceed in
parallel with it.

**Decision.** `lib/types.ts` materializes with exactly these contracts
(orchestrator-owned; subagents read, never modify). camelCase mirrors of the
snake_case columns; DB enums become string-literal unions; timestamps are ISO
strings.

```ts
export type MaterialType = 'synthetic' | 'natural' | 'isolate'
export type SourceType =
  | 'ifra'
  | 'sds'
  | 'pubchem'
  | 'gsc'
  | 'perfumer_blog'
  | 'book'
  | 'interview'
  | 'other'
export type SynonymType =
  'trade_name' | 'iupac' | 'common_name' | 'abbreviation' | 'supplier_name'
export type RestrictionType = 'restriction' | 'prohibition' | 'specification'
export type Tenacity = 'low' | 'medium' | 'high' | 'very_high'
export type Projection = 'low' | 'medium' | 'high'

export interface Citation {
  id: string
  type: SourceType
  title: string
  url: string | null
  author: string | null
  publishedAt: string | null
  accessedAt: string
}

export interface FamilyRef {
  slug: string
  name: string
}

export interface MaterialSummary {
  id: string
  slug: string
  canonicalName: string
  materialType: MaterialType
  casNumber: string | null
  families: FamilyRef[]
}

export interface UsageLimit {
  categoryId: number // 1–11, IFRA numbering
  categoryName: string
  restrictionType: RestrictionType
  maxPct: number | null // null = no numeric limit; read with restrictionType
  notes: string | null
  ifraAmendmentVersion: string // e.g. "51st" — display prominently (data-strategy)
  verifiedAt: string
  sourceId: string
}

export interface Hazard {
  code: string // e.g. "H317"
  description: string
  category: string
  sourceId: string
}

export interface OlfactiveDescription {
  description: string
  tenacity: Tenacity | null
  projection: Projection | null
  keyFacets: string[]
  sourceId: string | null // null = written from the maker's own experience
}

export interface UsageGuidance {
  typicalPctMin: number | null
  typicalPctMax: number | null
  thresholdNote: string | null
  dilutionNote: string | null
  sourceId: string | null
}

export interface LandmarkUse {
  perfumeName: string
  house: string | null
  year: number | null
  notes: string | null
  sourceId: string
}

export interface ComputedProperties {
  logp: number | null
  tpsa: number | null
  heavyAtomCount: number | null
  rdkitVersion: string // provenance — always shown with the values
}

export interface SimilarMaterial {
  slug: string
  canonicalName: string
  tanimoto: number // 0–1
  rdkitVersion: string
}

export interface OdorPrediction {
  descriptor: string
  probability: number // 0–1
  modelVersion: string // e.g. "sor-v0.1" — always shown
}

export interface MaterialDetail extends MaterialSummary {
  iupacName: string | null
  smiles: string | null // null = natural/mixture → hide ALL structure features
  molecularFormula: string | null
  molecularWeight: number | null
  synonyms: { name: string; type: SynonymType }[]
  usageLimits: UsageLimit[]
  hazards: Hazard[]
  olfactive: OlfactiveDescription | null
  usageGuidance: UsageGuidance | null
  landmarkUses: LandmarkUse[]
  computed: ComputedProperties | null
  similar: SimilarMaterial[]
  odorPredictions: OdorPrediction[] // renders ONLY in the labeled experimental module
  sources: Citation[] // every sourceId above resolves here; superscript
  // number = index in this array + 1
}

export type MatchTier = 0 | 1 | 2 | 3 | 4
// 0 CAS exact · 1 canonical-name exact · 2 synonym exact · 3 prefix/trigram · 4 full-text

export interface SearchResult {
  id: string
  slug: string
  canonicalName: string
  casNumber: string | null
  matchTier: MatchTier
  matchedSynonym: string | null // set when the hit came via a synonym → UI can
  // show “matched: OTNE”
}
```

**Notes.** Citation numbering is structural: the detail page renders
superscripts by position of `sourceId` in `sources`, so ordering is part of
the contract, not a UI choice. Phase 3 types (bookmarks, notes) are
deliberately absent — they get added when Phase 3 waves are planned, through
the same review gate.

---

## D4 — Page-state conventions

**Context.** The quality bar demands empty/loading/error on every page. Left
unconvened, parallel agents invent three different patterns — the exact
divergence the orchestrator would otherwise have to reconcile after the fact.

**Decision.**

- **Loading:** every route segment that fetches data ships `loading.tsx` with
  a skeleton matching the final layout (no visual jump). Skeletons compose
  the shadcn `Skeleton` primitive once Week 6 lands.
- **Error:** every such segment ships `error.tsx` (client component): plain
  language for what happened + a retry via **`unstable_retry()`**. Never render
  raw error messages or stack traces; log server-side instead.
  _(Corrected 2026-08-28: this decision originally said `reset()`. In Next 16.2
  `reset()` re-renders without re-fetching, so a failed database read re-throws
  immediately; `unstable_retry()` is the prop Next's own `error.js` convention
  documents as "re-fetching and re-rendering the segment". Found by W3-B.)_
- **Not-found:** global `app/not-found.tsx`; unknown slugs call `notFound()` —
  a wrong `/materials/[slug]` is a 404, not an error state.
- **Empty:** one shared `components/empty-state.tsx` (title, description,
  optional action). Domain empty states — "no results", "no landmark uses
  recorded yet", "no saved materials" — are _content_ passed to this one
  component, never new bespoke components.
- **Failure posture:** server components let fetch failures throw to
  `error.tsx`. No catch-and-render-blank — a silent empty section lies about
  the data.

---

## D5 — Test conventions

**Context.** No Vitest, no `test` script, no location convention exists.
The testing philosophy (AGENTS.md) already says _what_ to test; this fixes
_how and where_.

**Decision.**

- Vitest, `environment: 'node'`. No jsdom, no component render tests, no E2E
  in v1 (per AGENTS.md forbidden list).
- Tests are colocated: `lib/search/rank.test.ts` next to `lib/search/rank.ts`.
- `package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`. CI runs
  `tsc --noEmit` + `vitest run` (runbook Week 1 step 8).
- The search gold set is a typed data module, `lib/search/gold-set.ts`:
  `{ query, expectSlug, maxRank }[]`, seeded with the five Week 5 cases.
  Ranking tests iterate it against synthetic candidates. Zero-result
  production queries get _added_ to the gold set as they surface — the
  maintenance loop the schema doc already prescribes.
- v1 skips tests on `lib/db/` functions (thin "calls the database" wrappers —
  explicitly on the skip list).

**Materialization note:** installing Vitest is a package-manifest change —
orchestrator-owned, not subagent work.

---

## D6 — Validation

**Context.** The quality checklist requires client + server validation with
inline messages and names "Zod or equivalent" without locking it. AGENTS.md
forbids new dependencies without maker approval.

**Decision: Zod.** The de-facto standard, pairs with structured extraction
later in the pipeline, one runtime dependency. **Approving this document is
the maker approval to add `zod`** (and dev-deps `vitest` per D5) — nothing
else gets added without a fresh ask.

Conventions:

- One schema per form/domain in `lib/validation/`, imported by **both** the
  client form (inline errors, on-blur) and the server action
  (`schema.safeParse` before any effect). "Server matches client" holds by
  construction because there is exactly one schema.
- Server actions never trust client-validated input — they re-parse. A parse
  failure returns field-keyed errors, never a thrown 500.
- `lib/env.ts` parses required environment variables with Zod once at module
  load and exports a typed object. No raw `process.env` reads outside it —
  a missing var fails loud at boot, not as `undefined` at 2 a.m.

---

## Materialization checklist (rest of Wave 0, on approval — orchestrator-owned)

1. Update `AGENTS.md`: resolve the D1 path ambiguity, add the D1/D2/D4/D6
   rules; this doc joins the `docs/` index.
2. Create `lib/types.ts` exactly per D3.
3. Install `vitest` + `zod`; add `test`/`test:watch` scripts; extend CI with
   `vitest run`.
4. Dispatch Wave 1 (disjoint file sets, each with a proving command):
   - **Schema translation** — `db/schema.ts` + `drizzle.config.ts` from
     database-schema.md · proves: `tsc --noEmit` + `drizzle-kit generate`
   - **UI foundation** — design tokens in `app/globals.css`, shadcn
     primitives in `components/ui/`, global layout · proves: `npm run build`
   - **Search pure logic** — `lib/search/{normalize,rank,types,gold-set}.ts`
     - tests · proves: `vitest run lib/search`
