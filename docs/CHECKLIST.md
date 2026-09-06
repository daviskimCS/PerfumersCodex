# Implementation Checklist — Phases 1–3

Dispatchable work items derived from the milestone plan (Weeks 1–13), filtered
to what an agent can actually do and build against. Design rationale lives in
[architecture.md](./architecture.md), [database-schema.md](./database-schema.md),
and [tech-stack.md](./tech-stack.md); this file is the work queue.

**Orchestrator-owned. Subagents read it; only the orchestrator ticks boxes.**

> **Updated Sep 5, 2026:** Phases 1–3 and Wave 7 are complete and merged
> (PRs #1–#9). The note below is history — `db/schema.ts` has been the real
> schema since P1-A. What remains of v1 scope is **Phase 4** at the end of
> this file.

> **Updated Aug 26, 2026** after reconciling the main checkout's uncommitted
> June work onto this branch. Week 1 scaffolding (Supabase clients + proxy
> middleware, pooled Drizzle client, `drizzle.config.ts`, `.env.example`,
> shadcn init with six primitives) already exists — P1-B and P1-D are done
> but unverified against a live database. `db/schema.ts` remains a deliberate
> placeholder awaiting the maker's Week 2 design pass.

## Legend

| Marker                       | Meaning                                                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `- [ ]` **READY**            | Dispatchable now — no external dependency                                                                            |
| `- [ ]` **BLOCKED: phase-0** | Needs a live Supabase project + connection strings before it can be built or proven                                  |
| `- [ ]` **BLOCKED: wave-N**  | Waits on every item of that wave being committed and verified                                                        |
| `- [ ]` **BLOCKED: <ID>**    | Waits on another checklist item                                                                                      |
| **MAKER**                    | Not agent work — account setup, editorial writing, or human verification. Listed for completeness; never dispatched. |

## Orchestrator-owned files — subagents must never modify these

```
package.json          package-lock.json     tsconfig.json
next.config.ts        vitest.config.ts      drizzle.config.ts
postcss.config.mjs    eslint.config.mjs     components.json
.github/**            docs/**               AGENTS.md    CLAUDE.md
lib/types.ts          lib/env.ts
```

Dependency installs, config changes, and CI edits are orchestrator steps. If an
item needs a package, the orchestrator installs it before dispatch.

## Standing constraints — apply to every item

1. **Never write editorial content.** Olfactive descriptions, cited safety
   data, usage guidance, and landmark uses are human-written
   ([data-strategy.md](./data-strategy.md)). Placeholder or fixture data must be
   obviously synthetic (`"Lorem material"`), never plausible-looking perfumery facts.
2. **Respect the RLS boundary.** Editorial/public data through Drizzle;
   user-owned data through the Supabase client only. Drizzle bypasses RLS.
3. **Conform to `lib/types.ts`.** It is contract-locked — read it, never edit it.
4. **Follow `AGENTS.md`.** It outranks general best practice.
5. **No new dependencies.** If an item seems to need one, stop and report it.
6. **`smiles` is nullable.** Every cheminformatics path skips NULL-SMILES
   materials rather than erroring.

---

## Phase 1 — Schema & Foundation (Weeks 1–4)

### P1-A — Drizzle schema translation · **DONE** _(2026-08-30 addendum: RLS enabled on all 19 tables + owner policies on the two user tables, migration `0002_rls-deny-by-default` — pulled forward from Wave 5 because the live site exposes the whole public schema over the Data API with default grants. W5-B's policy-migration deliverable is superseded; its two-account verification protocol still runs before bookmarks merge.)_

- [x] **Implement the schema per `docs/database-schema.md`: all tables with proper constraints (NOT NULL, FK, CHECK), slugs as URL identifiers, mandatory `source_id` on fact-bearing rows, and soft-delete columns where specified.**

**Acceptance criteria**

- Every table in `database-schema.md` is declared: `materials`, `material_synonyms`,
  `families`, `material_families`, `usage_categories`, `material_usage_limits`,
  `hazard_codes`, `material_hazards`, `sources`, `material_descriptions`,
  `material_usage_guidance`, `landmark_uses`, `material_computed_properties`,
  `material_similarity`, `odor_predictions`, `user_saved_materials`, `user_notes`,
  `correction_submissions`, `search_queries`.
- Enums declared with `pgEnum`: material_type, synonym_type, source type,
  restriction_type, tenacity, projection, correction status.
- Nullability matches the doc exactly — in particular `materials.smiles`,
  `materials.cas_number`, and `material_descriptions.source_id` are nullable;
  every `source_id` on a fact-bearing row (`material_usage_limits`,
  `material_hazards`, `landmark_uses`) is NOT NULL.
- CHECK constraints: `max_pct` 0–100; `tanimoto` 0–1; `probability` 0–1;
  `typical_pct_min`/`max` 0–100 with max ≥ min; `material_id <> similar_material_id`.
- Unique constraints: `materials.slug`, `families.name`, `families.slug`,
  `(material_id, category_id, ifra_amendment_version)`,
  `(user_id, material_id)` on notes, `(material_id, descriptor, model_version)`.
- Partial unique indexes: `sources(url) WHERE url IS NOT NULL`;
  `material_descriptions(material_id) WHERE deleted_at IS NULL`.
- `ON DELETE CASCADE` on both user tables' `user_id`.
- Indexes on `materials.cas_number` and `material_synonyms.material_id`.
- Composite PKs where the doc specifies them.
- File is declarations only — no queries, no client instantiation, no connection code.

**Files** — create/modify exactly: `db/schema.ts`

**Depends on** — nothing. _Orchestrator prerequisite: install `drizzle-orm`._

**Proves it is done** — `npm run typecheck`

**Out of scope** — migrations (needs `drizzle.config.ts` + a live DB), the
`material_search_view` materialized view and `pg_trgm` extension (raw SQL, lands
with P2-E), any `lib/db/` query code.

---

### P1-B — Drizzle client + config · **DONE** _(verified in production 2026-08-30 — live site queries through the pooled client)_

- [x] Pooled Drizzle client (`DATABASE_URL`, 6543, `prepare: false`) in `lib/db/index.ts`, `drizzle.config.ts` against `DIRECT_URL` (5432), `.env.example` documenting both.
      _Written June 2026, adopted onto this branch Aug 26. Code is correct and carries the RLS-boundary comment; **not yet run against a live database** — that verification is P1-C. `lib/env.ts` (Zod-validated env, architecture D6) is still outstanding and orchestrator-owned._

### P1-C — First migration round-trip · **DONE** _(2026-08-28: 19 tables + 7 enums live; defaults and the 1–11 CHECK smoke-tested with rollback. Note: DIRECT_URL uses the session pooler (5432) — the true direct host is IPv6-only and unreachable from the maker's network.)_

- [x] `drizzle-kit generate` + `migrate` against Supabase; verify tables in dashboard. _The budgeted 90-minute Week 1 trap._

### P1-D — Supabase clients + token-refresh middleware · **DONE** _(verified in production 2026-08-30 — signup/login/account work on the live site)_

- [x] `lib/supabase/{client,server,admin,proxy}.ts` + root `proxy.ts` (Next 16's middleware entry point) per `@supabase/ssr`.
      _Written June 2026, adopted Aug 26. Build registers the Proxy middleware. Not yet exercised against a live Supabase project._

### P1-E — Auth flows + protected routes · **DONE**

- [x] Email/password sign-up, sign-in, sign-out; protected-route check via `supabase.auth.getUser()` (never `getSession()`); basic `/account` showing logged-in email.
      _Google OAuth console setup is **MAKER**._
- [x] **Google OAuth (code side)** · **DONE** _(2026-09-02)_ — "Continue with
      Google" on `/login` and `/signup`, `/auth/callback` exchanging the code
      for a session. The `next` guard is shared with the confirm route and
      was verified against 14 attack inputs (`//evil.com`, `https://evil.com`,
      backslash, `javascript:`, `data:`) plus an end-to-end check that none
      reaches a `Location` header. Ships **dormant**: the provider is not
      configured, so the button shows "Google sign-in isn't available right
      now" until [maker-todo.md](./maker-todo.md) item 4 is done.

### P1-F — Material routes (structural) · **DONE**

- [x] `/materials/[slug]` fetching one material and rendering it; `/materials` index listing all materials. Ugly but real — polish is P2-G/P2-H.

### P1-G — Seed script · **DONE** _(2026-09-01, W4-A. Live-verified twice against synthetic fixtures: second run a no-op, zero duplicates across 14 tables, `updated_at` never bumped, `REFRESH ... CONCURRENTLY` confirmed working over the transaction-mode pooler. Awaits the maker's real five-material JSON for the production run.)_

- [x] TypeScript seed script reading the data repo's JSON into Postgres, idempotent, refreshing the search view at the end.

### **MAKER** — Phase 1 items that are not agent work

- Phase 0 accounts: GitHub remote, Vercel project + domain, Supabase project (region-matched), project email
- Schema design review — _"Don't let Claude Code drive this week"_ (milestone plan, Week 2). P1-A is mechanical translation of an already-decided design; review it against `database-schema.md` before it merges.
- The 5 hand-cited materials (Iso E Super, hedione, ambroxan, vanillin, ethyl maltol) and the `perfumers-codex-data` Python repo
- Blog post 1

---

## Phase 2 — Search & Polish (Weeks 5–10)

### P2-A — Search normalization + ranking (pure) · **DONE**

- [x] **Implement query normalization and the ranking rules from `docs/database-schema.md` as pure, database-free functions, with a Vitest gold set covering the Week 5 cases.**

**Acceptance criteria**

- `normalize.ts` exports `normalizeQuery(raw: string): string` (trim, lowercase,
  collapse internal whitespace) and `isCasNumber(q: string): boolean` matching
  the CAS form `\d{2,7}-\d{2}-\d`.
- `rank.ts` exports a pure `rankCandidates(candidates: SearchCandidate[], normalizedQuery: string): SearchResult[]`
  implementing tiers 1–4 from `database-schema.md`: canonical-name exact (1),
  synonym exact (2), prefix/trigram (3), full-text (4).
- Sort order is (tier asc, score desc, `updatedAt` desc); results are deduped to
  the best tier per material; `matchedSynonym` is populated on tier-2 hits.
- Tier 0 (CAS exact) is _represented in the type_ but assigned by the pipeline,
  not by `rankCandidates` — the short-circuit is a DB lookup and lands with P2-E.
- `SearchCandidate` is defined in `lib/search/types.ts` (pipeline-internal, not
  in `lib/types.ts`) and carries the evidence fields: exact-synonym flag,
  trigram similarity, `ts_rank`, `updatedAt`.
- `gold-set.ts` exports a typed `{ query, expectSlug, maxRank }[]` seeded with the
  five Week 5 cases: `"iso e"`, `"OTNE"`, `"54464-57-2"`, `"timbersilk"`,
  `"amber wood"` — each expecting `iso-e-super`. (The trade-name case was
  `"ambermax"` until 2026-09-05, when cited research showed Ambermax is a
  different Givaudan material; `e17d708`.)
- Tests iterate the gold set against synthetic candidates and assert expected
  rank; plus edge cases for empty query, whitespace-only, and mixed case.
- Zero database imports anywhere in these files.

**Files** — create/modify exactly:
`lib/search/normalize.ts`, `lib/search/rank.ts`, `lib/search/types.ts`,
`lib/search/gold-set.ts`, `lib/search/normalize.test.ts`, `lib/search/rank.test.ts`

**Depends on** — `lib/types.ts` (read-only: `SearchResult`, `MatchTier`)

**Proves it is done** — `npm test -- lib/search` and `npm run typecheck`

**Out of scope** — `lib/db/search.ts`, `lib/search/index.ts` (both need the DB
half, P2-E), and query logging.

---

### P2-B — Design tokens · **DONE**

- [x] **Establish the design tokens — typography scale, color tokens (light + dark, both first-class), and spacing — in the Tailwind v4 `@theme` block.**

**Starting point.** `app/globals.css` already carries shadcn's _default_
token set from `shadcn init` (neutral palette, chart/sidebar tokens, light +
dark blocks). This item replaces that generic palette with the project's own
identity — it is a customisation pass, not a greenfield file. Do not delete
the shadcn token contract the primitives in `components/ui/` depend on
(`--background`, `--foreground`, `--primary`, `--muted`, `--border`, `--ring`,
etc.); re-value them. Unused chart/sidebar tokens may be removed.

**Acceptance criteria**

- Tokens defined in `@theme` / `:root` / `.dark` in `app/globals.css`. No
  `tailwind.config.js` (Tailwind v4 is CSS-first).
- Every token name currently consumed by `components/ui/*` still resolves —
  verified by `npm run build` succeeding and the primitives rendering.
- A deliberate type scale with a serif or high-contrast display face for material
  names and a readable body face — _editorial, Apple developer docs, not a
  startup landing page_.
- Semantic color tokens (background, surface, foreground, muted, border, accent),
  each defined for light **and** dark. Both modes are first-class, not an
  afterthought; contrast targets WCAG AA.
- A consistent spacing scale. No one-off values.
- Brief comments explaining the intent of each token group, so later work uses
  them rather than inventing new values.
- Existing scaffold styles that conflict are replaced, not layered over.

**Files** — create/modify exactly: `app/globals.css`

**Depends on** — nothing

**Proves it is done** — `npm run typecheck` _(orchestrator runs `npm run build` after the wave)_

**Out of scope** — layout, components, adding or removing shadcn primitives,
any `app/layout.tsx` change.

---

### P2-C — Global layout + site chrome · **DONE**

- [x] Header (wordmark + search slot), main content region, minimal footer carrying the CC-BY-SA data-license line; real root metadata (title template, description, Open Graph).
      _Scope amendment (approved): also added the light/dark/system theme toggle — `.dark` was fully authored but nothing set the class, so half the palette was unreachable. A skip link was added too, per the `AGENTS.md` keyboard-navigation bar._
      **Files:** `app/layout.tsx`, `components/site-header.tsx`, `components/site-footer.tsx`
      **Proves:** `npm run typecheck`

### P2-D — Shared page-state primitives · **DONE**

- [x] Shared `empty-state.tsx` (title, description, optional action) per architecture D4, and a global `not-found.tsx`.
      _`loading.tsx` / `error.tsx` — the other half of D4 — are still outstanding._
      **Files:** `components/empty-state.tsx`, `app/not-found.tsx`
      **Proves:** `npm run typecheck`

### Debt surfaced by Wave 2 (not blocking, fold into the item that touches it)

- `app/page.tsx` uses a one-off `px-6` gutter instead of the `px-gutter` /
  `md:px-gutter-lg` tokens the rest of the app uses. It is the placeholder
  homepage, so fold the fix into **P2-H** when that replaces it.
- `loading.tsx` / `error.tsx` — the other half of architecture D4 — are still
  unwritten. They should reuse the same page wrapper idiom as `not-found.tsx`
  so all three states sit identically.
- `title.template` (`'%s · Perfumers Codex'`) is in place but unexercised: no
  route sets its own title yet. The first page that does (**P2-G** or **P2-H**)
  should confirm it renders.
- No `og:image` asset exists, so `openGraph.images` is deliberately unset.
  Wire it when the asset lands (Phase 4, per the OG-imagery open decision).

### P2-E — Search query layer + search view migration · **DONE**

- [x] `lib/db/search.ts` returning `SearchCandidate[]` in one round-trip, the CAS short-circuit, `lib/search/index.ts` composing the pipeline, `search_queries` logging, plus the `pg_trgm` extension and `material_search_view` migration.

### P2-F — Search UX · **DONE** _(2026-09-01, W4-B)_

- [x] Debounced instant search (~150ms), Cmd/Ctrl-K focus, arrow-key navigation, rank-aware results page, genuinely helpful no-results state, recent searches in localStorage.

### P2-G — Material detail page · **DONE** _(2026-09-01, W4-C. RDKit bundle isolation verified against real build output: zero references in every initial/shared client chunk.)_

- [x] Hero with client-side RDKit.js 2D structure (lazy-loaded, skipped when `smiles` is null), Safety/Olfactive/Usage/Sources tabs, numbered citation superscripts, matching loading skeletons, per-section empty states, real mobile layout.

### P2-H — Browse & discovery · **DONE** _(2026-09-01, W5-A. Also fixed the loading-skeleton shadowing W4-C found — diagnosed by measuring streamed HTML byte offsets, not reasoning.)_

- [x] `/families/[slug]` pages, a real homepage, and a browseable `/materials` index (sortable, filterable by family, paginated).

### **MAKER** — Phase 2 items that are not agent work

- 15 further hand-cited materials (Week 9)
- Aesthetic direction sign-off on P2-B before it propagates into P2-C/P2-G
- `EXPLAIN ANALYZE` review and index tuning once real data exists
- Blog post 2

---

## Phase 3 — Personal layer, light (Weeks 11–13)

User-owned data starts here. The RLS boundary becomes live: these features go
through the **Supabase client**, never Drizzle (which bypasses RLS), and no
item ships until its policies are verified with two real accounts.

### P3-A — Bookmarks · **DONE (RLS boundary proven; signed-in UI round trip unverified)** _(2026-09-01, W5-B. Policies proven with a discriminating probe pair: a forged insert refused 42501 while the legitimate control passed RLS and hit only the FK. The save/unsave round trip through a real session is untested — creating an account is not an action available to the agent or orchestrator; see MAKER items.)_

- [x] Save button on material pages (logged-in only), `/saved` page listing
      the user's saved materials, `user_saved_materials` RLS policies as a
      migration, all access via the Supabase client. Multi-account RLS
      verification before merge.

### P3-B — Private notes · **DONE (RLS boundary proven; signed-in round trip unverified)** _(2026-09-02, W6-A. Forged note refused 42501 while the legitimate control passed RLS and hit only the FK. The UPDATE policy could not be exercised — an empty table makes that probe vacuous, not passing; WITH CHECK is present in pg_policies and needs a real row to prove.)_

- [x] Per-material private note textarea, auto-save on blur with optimistic
      UI, `user_notes` RLS policies as a migration, Supabase client only.
      Rate limiting is the Week 18 pass — deferral recorded here, not dropped.

### P3-C — Account management · **DONE (cascade unverified — see maker-todo.md item 1)** _(2026-09-02, W6-B. Delete action takes its id from getUser() and never from the request. Secret key proven absent from every client chunk, against a control that actually fires.)_

- [x] Change email, change password, delete account. Deletion runs through
      the Supabase admin API with the secret key in a server action;
      `ON DELETE CASCADE` does the cleanup — verified with a throwaway account.

### **MAKER** — Phase 3 items that are not agent work

> **The consolidated, prioritised list is [maker-todo.md](./maker-todo.md).**
> It is the one to work from; the bullets below are the Phase 3 slice.

- Two throwaway test accounts for RLS verification (or approval for the
  orchestrator to create them via the admin API)
- **Verify account deletion cascades** (P3-C, Wave 6) — irreversible and
  unprovable by an agent; see maker-todo.md item 1
- **Verify the signed-in bookmark and note round trips** — the RLS boundary
  is proven, the wiring above it is not
- 15 further materials (Week 14), polish-pass sign-offs (Week 15),
  onboarding content (Week 16), blog post 3

## Wave 7 — quality bar _(2026-09-02, complete)_

Not a checklist phase: Phases 1–3 closed, so this paid down
[quality-checklist.md](./quality-checklist.md). See
[waves/wave-7.md](./waves/wave-7.md).

- [x] **W7-A identity & share cards** — `app/icon.svg` replacing
      create-next-app's default favicon, plus site-wide and per-material
      Open Graph cards. Both OG routes proven to survive an unreachable
      database (byte-identical to the generic card).
- [x] **W7-B accessibility audit** — 11 surfaces against the per-page and
      per-form checklists. Six defects: inactive tab labels at 4.39:1, an
      invisible focus stop on the tab panel, blur-fired field errors never
      announced, `/login` and `/signup` with no page title, a dangling
      `aria-controls`, and dark `--destructive` at 4.49:1 in one composition.
      All fixed; the tab defects went upstream into the primitive. The 404
      title is a Next 16 limitation (`not-found.js` supports no `metadata`
      export) and is reported, not fixed.

**Deferred deliberately:** the caching pass. Wave 4 put it after seeding
settles, and the corpus is still three synthetic materials — tuning
`cacheLife` against fixtures would be tuning against noise.

## Suggested wave grouping

_Historical — every wave below was dispatched and merged (PRs #3–#8); kept as
the record of how the work was cut._ File sets verified disjoint.

| Wave | Items                        | Why together                                                                                                                                                                                                            |
| ---- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **P1-A**, **P2-A**, **P2-B** | `db/`, `lib/search/`, `app/globals.css` — no overlap, no cross-dependencies                                                                                                                                             |
| 2    | **P2-C**, **P2-D**           | Both consume P2-B's tokens; `app/layout.tsx` + `components/site-*` vs `components/empty-state.tsx` + `app/not-found.tsx`                                                                                                |
| 3    | **P1-E**, **P1-F**, **P2-E** | Prepared and reviewed — see [waves/wave-3.md](./waves/wave-3.md) for entry criteria, prompts, and the partial-dispatch rule (P1-E can go early)                                                                         |
| 4    | **P1-G**, **P2-F**, **P2-G** | Prepared — see [waves/wave-4.md](./waves/wave-4.md). Gated on Wave 3 + the `@rdkit/rdkit` install decision                                                                                                              |
| 5    | **P2-H**, **P3-A**           | Prepared — see [waves/wave-5.md](./waves/wave-5.md). Gated on Wave 4; P3-A additionally on RLS test accounts. P3-B/P3-C follow in Wave 6 — P3-B shares the detail page with P3-A; P3-C is held there as a pacing choice |

## Phase 4 — what remains of v1 scope _(added 2026-09-05)_

Phases 1–3 and Wave 7 are closed. These are the v1 items in
[scope.md](./scope.md) that no phase has claimed, plus the defects the first
cited drafts exposed. Ordered by consequence, not effort; the top three are
the ones that cost the most left undone.

### P4-A — Schema round for the cited drafts · **DONE** _(2026-09-05)_

- [x] A representable "no IFRA Standard, checked against amendment N" —
      `material_ifra_absences` (migration `0004`), rendered as a cited fact by
      `components/material/safety-panel.tsx`; the empty state now means only
      "not researched".
- [x] `source_id` on identity fields and synonyms
      (`materials.identity_source_id`, `material_synonyms.source_id`;
      `0004` nullable → live re-seed → `0005` NOT NULL) and
      `lib/db/materials.ts`'s citation walk starting with them.
- [ ] Wherever the maker decides physical properties, registry identifiers,
      substantivity and non-IFRA maxima live — **still open**, tracked in
      [database-schema.md](./database-schema.md).

Shipped as three concurrent agents over disjoint file sets (contract first,
then ingestion / read side / data files). The remaining unticked box is an
editorial-shape decision, not a defect.

### P4-B — Seed the real corpus · **BLOCKED: maker review of the drafts**

- [ ] `npm run db:seed -- <perfumers-codex-data> --prune` replaces the four
      synthetic materials. First real content on the live detail page — the
      trigger for making the repo public (maker-todo item 9).

### P4-C — Rate limiting · **BLOCKED: maker (Upstash via the Vercel Marketplace)**

- [ ] Signup, login, search, note saves, account mutations — the Week 18 pass
      deferred since Wave 4. Must land before public signup.

### P4-D — Substructure / chemical-class filter · **DONE** _(2026-09-05)_

- [x] Nine structural classes precomputed at seed time into
      `material_chemical_classes` (migration `0006`), filtered in SQL at
      `/materials?class=…`, composing with the family filter.
- [x] `/structure` for arbitrary SMARTS, client-side, degrading to the
      precomputed class links without scripting.
- [x] Every class pattern tested against known molecules with negative
      controls (`scripts/classify.test.ts`, `components/structure-search/match.test.ts`).

The split from cheminformatics.md's original "runs client-side over the
corpus's SMILES" is recorded there with its reasoning. Worth revisiting once
P4-B lands and the corpus is real rather than two structure-bearing
fixtures.

### P4-E — Privacy policy, terms of service, `/blog` MDX route · **READY** _(copy is MAKER)_

### P4-F — Admin dashboard `/admin` + submit-a-correction form · **READY**

Locked to the maker's email; reads `search_queries`. Worth little until real
users produce queries.

### P4-G — Caching pass · **BLOCKED: P4-B**

Deferred since Wave 4 for the same reason it is still deferred: tuning
`cacheLife` against fixtures is tuning against noise.

### P4-H — Structure–odor experiment · **BLOCKED: maker licence review**

Lives in `perfumers-codex-data`; the app side is the labelled module over
`odor_predictions`, which already exists in the schema.

### P4-I — Sentry at launch · **BLOCKED: maker account**
