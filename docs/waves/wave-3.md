# Wave 3 — First database-backed wave

**Status: REVIEWED — dispatch when entry criteria clear.** Prepared
2026-08-27; independently reviewed the same day (verdict: dispatch after
fixes — all 12 findings applied). Orchestrator-owned; subagents
read it, only the orchestrator edits it.

## Entry criteria — every box, no exceptions

- [x] **Phase 0 credentials exist** _(2026-08-28)_: Supabase project created (region matched
      to Vercel), both connection strings + `sb_publishable_`/`sb_secret_` keys in
      `.env.local` and Vercel. Until then `proxy.ts` 500s every route and nothing
      here can be proven.
- [x] **PR #1 merged** _(2026-08-28; default branch is main)_ and this branch's history is on `main` (or work
      continues on this branch by explicit choice). Default branch flipped to
      `main`.
- [x] **P1-A merged** _(2026-08-28, maker-approved with five best-practice decisions)_: `db/schema.ts` is the maker-reviewed real schema, not
      the placeholder. The maker owns this per the milestone plan's Week 2 rule.
- [x] **P1-C proven by the orchestrator** _(2026-08-28, live smoke-tested)_ (pre-dispatch step, not a wave
      item): `npm run db:generate` produces the initial migration, `npm run
db:migrate` applies it against the direct connection, tables visible in the
      Supabase dashboard. (`pg_trgm` is NOT hand-run here — AGENTS.md forbids
      ad-hoc DB edits; the extension ships as the first statement of W3-C's
      migration, and the orchestrator's pre-flight merely verifies it applied.)
- [x] **`lib/env.ts` created by the orchestrator** _(2026-08-28)_ (pre-dispatch, D6,
      orchestrator-owned): Zod-parsed env access so this first
      real-credentials wave doesn't spread raw `process.env` further.
- [x] **Supabase email confirmation settled by the maker** — _confirmation stays ON; maker still needs to point the confirm-email template at `/auth/confirm` once W3-A ships the route_ (needed by W3-A):
      either keep confirmation ON and update the Supabase confirm-email template
      to point at `/auth/confirm` (the route W3-A ships), or disable
      confirmation in the dashboard until Week 20. Say which.

**Partial dispatch:** W3-A needs only the first two boxes plus the email
decision — auth touches no app tables, so it may go out before P1-A/P1-C
clear. W3-B and W3-C need every box.

**Rule-3 (confirm-or-default, not blocking):** synonym-side prefix matching
stays the trigram approximation `lib/search/rank.ts` already implements
unless the maker asks for an exact `prefixMatch` flag from SQL; revisiting
later is one SQL column plus one guard in `assignTier`.

## Wave shape

Three items, one subagent each, max 3 concurrent. File sets verified
disjoint. None touches `app/layout.tsx`, `components/site-*`, `db/schema.ts`,
package manifests, or CI — those stay orchestrator/maker-owned.

| Item                    | Checklist ID | Exclusive files                                                                                                                                                                                                                                         | Proves it is done                                                              |
| ----------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| W3-A Auth flows         | P1-E         | `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, `app/(auth)/actions.ts`, `app/auth/confirm/route.ts`, `app/account/page.tsx`, `app/account/loading.tsx`, `app/account/error.tsx`, `lib/validation/auth.ts`                                   | `npm run typecheck && npm run lint && npm run build` + orchestrator smoke test |
| W3-B Material routes    | P1-F         | `app/materials/page.tsx`, `app/materials/loading.tsx`, `app/materials/error.tsx`, `app/materials/[slug]/page.tsx`, `app/materials/[slug]/loading.tsx`, `app/materials/[slug]/error.tsx`, `lib/db/materials.ts`                                          | same + `notFound()` verified on a bad slug                                     |
| W3-C Search query layer | P2-E         | `lib/db/search.ts`, `lib/search/index.ts`, one custom migration via `npx drizzle-kit generate --custom` — the SQL file **plus its `db/migrations/meta/` journal entry** (a hand-dropped SQL file is silently never applied), `lib/search/index.test.ts` | `npm test -- lib/search && npm run typecheck` + orchestrator smoke vs live DB  |

Sequencing note: W3-C's migration must be generated _after_ P1-C's initial
migration exists, which the entry criteria guarantee. W3-B renders whatever
rows exist; seeding real materials (P1-G + the maker's five hand-cited
materials) is NOT in this wave — W3-B must handle an empty table with the
shared `EmptyState`, not error.

## Standing constraints (all three prompts carry these verbatim)

1. Never write perfumery editorial content — no material names, descriptions,
   CAS numbers, safety data, even as fixtures. Seed/fixture data must be
   obviously synthetic. The one sanctioned exception: the queries already
   committed in `lib/search/gold-set.ts` are maker-blessed and MUST be
   asserted as-is.
2. Editorial/public reads through Drizzle (`lib/db/`); user-owned data only
   through the Supabase client. Server-side auth checks use
   `supabase.auth.getUser()`, never `getSession()`.
3. Conform to `lib/types.ts`; never edit it. `lib/db/` returns `lib/types.ts`
   shapes, never raw Drizzle rows (architecture D1).
4. Every data-fetching segment ships `loading.tsx` (skeleton matching final
   layout) + `error.tsx` (plain language + `reset()`); unknown slugs call
   `notFound()`; empty states go through `components/empty-state.tsx` (D4).
5. Zod schema per form in `lib/validation/`, shared by client and server;
   server actions re-parse with `safeParse`, return field-keyed errors (D6).
6. No new dependencies. Prettier per `.prettierrc`. Server components by
   default; `'use client'` only where interaction requires it.

## W3-A — Auth flows (P1-E)

**Verbatim item:** "Email/password sign-up, sign-in, sign-out; protected-route
check via `supabase.auth.getUser()` (never `getSession()`); basic `/account`
showing logged-in email. Google OAuth console setup is MAKER."

Acceptance criteria:

- `lib/validation/auth.ts`: Zod schemas for signup and login (email + password
  min-length; no password-strength theater beyond Supabase's own policy).
- Server actions in `app/(auth)/actions.ts` using the existing
  `lib/supabase/server.ts` client: `signUp`, `signIn`, `signOut`. Each
  re-parses with `safeParse`; failures return field-keyed errors rendered
  inline (per-form checklist: inline messages, errors on blur not keystroke,
  submit shows loading, disabled while invalid).
- `/login` and `/signup` pages: forms composing `components/ui/*` primitives,
  keyboard-accessible, both themes.
- `app/auth/confirm/route.ts`: confirmation handler per current Supabase SSR
  guidance (`verifyOtp` with `token_hash` + `type` from the query string;
  success → `/account`, failure → `/login` with a readable error). MAKER
  pairs this with the email-template change (entry criteria). If the maker
  chose to disable confirmation instead, ship the route anyway — it is the
  Week 20 path — and note it dormant.
- Post-signup UX: with confirmation ON, render a "check your email" state —
  do not pretend a session exists. Post-signin redirect target: `/account`.
- Auth _failure_ (wrong password, unconfirmed email) returns a form-level
  error message rendered above the fields — distinct from `safeParse`
  field-keyed errors. Never echo raw Supabase error internals; map to plain
  language.
- `/account`: server component; `getUser()`; unauthenticated → `redirect('/login')`;
  shows the logged-in email and a sign-out button. Ships `loading.tsx` +
  `error.tsx` per D4 (`getUser()` is a network fetch). Email-change /
  password-change / delete-account are Week 13, NOT here.
- No header changes: `components/site-header.tsx` has no auth affordance
  today; _adding_ a "sign in" link there is a handoff to a later item, not an
  edit here — that file is outside this item's list.
- Auth emails go through Supabase's default sender for now (Resend is Week
  20). **Rate limiting on signup/login is explicitly deferred to Week 18**
  (Upstash) — do not bolt it on, do not silently drop it from AGENTS.md's
  obligations; this sentence is the deferral record.

## W3-B — Material routes, structural (P1-F)

**Verbatim item:** "`/materials/[slug]` fetching one material and rendering
it; `/materials` index listing all materials. Ugly but real — polish is
P2-G/P2-H."

Acceptance criteria:

- `lib/db/materials.ts`: `getMaterialBySlug(slug)` → `MaterialDetail | null`,
  `listMaterials()` → `MaterialSummary[]`; Drizzle only; soft-deleted rows
  excluded; maps rows to `lib/types.ts` shapes (citation ordering per the
  `MaterialDetail.sources` contract — **pinned here, becoming the app-wide
  rule**: order of first reference, walking `MaterialDetail`'s fields in
  declaration order, deduped by source id; superscript number = index + 1).
- Index: plain list of canonical names linking to detail pages; empty table →
  `EmptyState`, not a blank page.
- Detail: renders the full `MaterialDetail` as structured-but-unstyled output
  (the milestone plan says raw JSON is acceptable); unknown slug →
  `notFound()`; NULL `smiles` renders nothing structure-related.
- Both segments ship `loading.tsx` + `error.tsx` per D4.
- Sets a page `title` on the detail route — first real exercise of the
  layout's `title.template`.
- Both routes declare `export const dynamic = 'force-dynamic'` with a short
  comment: without it Next statically prerenders them and the DB query runs
  at build time, so `next build` starts depending on a live database (CI has
  none). The caching strategy (`cacheLife`/`cacheTag` after seeding settles)
  is a later, deliberate decision — not this item's.

## W3-C — Search query layer (P2-E)

**Verbatim item:** "`lib/db/search.ts` returning `SearchCandidate[]` in one
round-trip, the CAS short-circuit, `lib/search/index.ts` composing the
pipeline, `search_queries` logging, plus the `pg_trgm` extension and
`material_search_view` migration."

Acceptance criteria:

- Custom migration, first statement `CREATE EXTENSION IF NOT EXISTS
pg_trgm;` (AGENTS.md: all schema changes are migrations): trigram GIN
  indexes on `materials.canonical_name` and `material_synonyms.name`, plus
  `material_search_view` **exactly as written in `docs/database-schema.md`** (lateral joins, `'simple'`/`'english'`
  configs, unique index on `id` for `REFRESH ... CONCURRENTLY`, GIN on the
  weighted vector). Do not redesign the SQL; it is already specified.
- `lib/db/search.ts`: `findByCasNumber`, `fetchCandidates` (one round-trip,
  cap ~50, emits the evidence columns `lib/search/types.ts` defines),
  `logSearchQuery` (query + result_count only — no user_id, no IP). Both
  lookup paths exclude soft-deleted rows: the MV already filters
  `deleted_at`, but the CAS lookup and trigram candidate legs hit base
  tables and must filter `deleted_at IS NULL` themselves.
- `lib/search/index.ts`: `searchMaterials(query)` composing normalize → CAS
  short-circuit (hit = single tier-0 result; miss falls through) → fetch →
  `rankCandidates` → logging. Logging covers **every** query including CAS
  hits (zero-result and CAS queries are exactly the synonym-gap signal the
  table exists for), records the _normalized_ query, and can never fail or
  block the search — use `after()` from `next/server`, not a floating
  promise, which serverless freezes can silently kill.
- `lib/search/index.test.ts`: pipeline-order tests with a mocked DB module
  (vi.mock) — CAS short-circuit, fall-through, logging isolation. The
  gold-set `'54464-57-2'` pipeline case gets its assertion here (mocked), and
  the live-DB half is the orchestrator's smoke test.
- Respect `TRIGRAM_THRESHOLD` in `lib/search/rank.ts` — the SQL `%` operator
  and the TS tier boundary must agree; if the migration sets a different
  similarity threshold, that is a reportable conflict, not a silent change.

## After the wave (orchestrator)

Full suite; combined diff review; smoke against the live DB (shape and
empty-corpus behavior only — latency numbers are meaningless until P1-G
seeds real rows; formal EXPLAIN ANALYZE is Week 17); crosscheck
against architecture D1/D2/D4/D6, `AGENTS.md`, `docs/database-schema.md`;
one commit per item; tick P1-E, P1-F, P2-E; update the CHECKLIST wave table.
