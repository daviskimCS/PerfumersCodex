# Architecture decisions

Six code-level decisions that keep the codebase convergent. Approved
2026-08-26; the binding one-line versions are in [`AGENTS.md`](../AGENTS.md).
This file holds the reasoning. The data model is in
[database-schema.md](./database-schema.md).

## D1 — Module layout

`db/` declares the database's shape; `lib/db/` is the only code that
accesses it.

```
app/                  Routes only. Server components by default; pages compose
                      lib functions + components, no data access inline.
components/
  ui/                 shadcn primitives (copied in, owned, edited freely)
  material/ auth/ …   App components, grouped by surface
db/
  schema.ts           Drizzle table definitions: the one TypeScript statement
                      of the database's shape
  migrations/         drizzle-kit output. Generated, committed, never hand-edited.
drizzle.config.ts     Reads DIRECT_URL (port 5432). Migrations only.
lib/
  db/                 ALL data access, one file per domain (materials.ts,
                      search.ts, bookmarks.ts, …). index.ts is the pooled
                      Drizzle client (DATABASE_URL, port 6543, prepare: false).
  supabase/           @supabase/ssr factories: client.ts (browser), server.ts,
                      proxy.ts (session refresh), admin.ts (secret key, server only)
  search/             The search pipeline (D2)
  review/             The review gate's fingerprint and state (database-schema.md)
  validation/         Zod schemas shared by client and server (D6)
  types.ts            App-facing view models (D3)
  env.ts              Validated environment access (D6)
scripts/              Build tooling: seed.ts, review.ts, classify.ts, draw.ts
tests/integration/    Account and RLS tests against a local Supabase stack
proxy.ts              Repo root — Supabase token-refresh proxy (Next 16's name
                      for middleware) plus the pre-launch password gate
                      (lib/gate.ts). The one location Next.js fixes; the only
                      file outside the layout above with a job.
```

Rules:

- Nothing outside `lib/db/` imports `db/schema.ts`, the Drizzle client, or a
  Supabase client. Pages and components call `lib/db/` functions and receive
  `lib/types.ts` shapes; Drizzle row types stay inside `lib/db/`.
- **One carve-out:** `scripts/` may import `db/schema.ts` directly. The seed
  writes every table, and routing that through `lib/db/` would add a write
  API no page calls. It still takes its client from `lib/db/`, so there is
  exactly one pooled client.
- Imports use the `@/` alias (repo root).

## D2 — Search: SQL returns evidence, TypeScript assigns rank

The ranking rules ([database-schema.md](./database-schema.md#search-ranking-rules))
mix database machinery (tsvector, pg_trgm) with app logic (CAS short-circuit,
tier order, tie-breaks). Drawing the line at "evidence" keeps ranking
unit-testable without Postgres.

`searchMaterials(query)` in `lib/search/index.ts` runs, in this order:

1. **Normalize** (`lib/search/normalize.ts`, pure): trim, lowercase, collapse
   whitespace; detect a CAS-shaped query (`\d{2,7}-\d{2}-\d`).
2. **CAS short-circuit:** a CAS-shaped query is an exact lookup on the indexed
   `cas_number` column. A hit is the single tier-0 result; a miss falls
   through.
3. **Fetch candidates** (`lib/db/search.ts`): one round trip returning up to
   50 evidence rows (exact-synonym flag, trigram similarities, weighted
   `ts_rank`, `updated_at`), with no ordering promise.
4. **Rank** (`lib/search/rank.ts`, pure): assign tiers, sort by (tier, score
   desc, updatedAt desc), keep each material's best tier.
5. **Log** `(query, result_count)` to `search_queries` through `after()`, so a
   failed insert never blocks or fails the search.

The boundary, the order and the tier meanings are fixed; the exact
`SearchCandidate` columns (`lib/search/types.ts`, pipeline-internal) may
change. The gold set (`lib/search/gold-set.ts`) runs against synthetic
candidates, and one round trip per search keeps the 150 ms p95 budget honest.

## D3 — Type contracts

`lib/types.ts` holds hand-written view models (camelCase mirrors of the
columns, enums as string unions, timestamps as ISO strings). They are derived
from [database-schema.md](./database-schema.md), not inferred from Drizzle, so
UI work never couples to the schema layer. The file is contract-locked: work
conforms to it rather than editing it.

Two properties of the contract matter beyond typing:

- **Citation numbering is structural.** A superscript's number is the
  position of its `sourceId` in `MaterialDetail.sources`, plus one, so the
  array's order is part of the contract.
- **`MaterialDetail` is what the review gate fingerprints.** Adding a field
  changes every material's fingerprint, and after publishing that hides every
  published page until it is reviewed again.

## D4 — Page states

- **Loading:** every route segment that fetches data ships `loading.tsx`, a
  skeleton matching the final layout.
- **Error:** every such segment ships `error.tsx`: plain language and a
  "Try again" that calls `retry()`. `reset()` re-renders without re-fetching,
  so a failed database read throws again at once. (Next 16.3 renamed
  `unstable_retry()` to `retry()`.) Never a raw error or stack trace.
- **Not found:** unknown slugs call `notFound()`; the global
  `app/not-found.tsx` renders it.
- **Empty:** one shared `components/empty-state.tsx`. "No results", "no
  landmark uses recorded yet" and "no saved materials" are content passed to
  it, never new components.
- **Failure posture:** server components let fetch failures reach
  `error.tsx`. No catch-and-render-blank: a silent empty section lies about
  the data.

## D5 — Tests

- Vitest, `environment: 'node'`, colocated `*.test.ts`. No jsdom, no
  component render tests, no browser end-to-end tests in v1.
- `npm test` runs unit tests with no database. `npm run test:integration`
  runs the real auth and account actions against a local Supabase stack
  (`tests/integration/README.md`); CI runs both.
- Thin `lib/db/` wrappers ("calls the database and returns it") are not unit
  tested.
- Zero-result production queries are added to the search gold set as they
  surface.

## D6 — Validation and environment

- **Zod.** One schema per form or domain in `lib/validation/`, imported by
  both the client form (inline errors) and the server action. "Server matches
  client" holds by construction because there is one schema.
- Server actions always re-parse with `safeParse`; a parse failure returns
  field-keyed errors, never a thrown 500.
- `lib/env.ts` parses the environment once at module load. No raw
  `process.env` elsewhere, so a missing variable fails loudly at boot.
