# Wave 4 — Data in, search out, detail page real

**Status: REVIEWED — dispatch when entry criteria clear.** Written and
independently reviewed 2026-08-27 (verdict: dispatch after fixes — all
findings applied). Orchestrator-owned; subagents read it, only the
orchestrator edits it. House rules, protocol, and the standing constraints
are exactly those of [wave-3.md](./wave-3.md) — every prompt carries wave-3's
standing constraints verbatim, plus this wave's additions below.

## Entry criteria

- [ ] **Wave 3 committed and smoke-tested**: auth flows (P1-E), material
      routes (P1-F), and the search query layer (P2-E) are on the branch, the
      full suite passes, and the orchestrator has smoke-tested search and auth
      against the live database.
- [x] **shadcn primitives added by the orchestrator** — _done 2026-08-28:
      `tabs.tsx` + `skeleton.tsx` landed, `package.json` verified unchanged_:
      `npx shadcn@latest add tabs skeleton`. W4-C needs Tabs; every `loading.tsx`
      since Wave 2 has hand-rolled what Skeleton should provide. `radix-ui` is
      already installed, so this should add no dependency — the orchestrator
      verifies `package.json` is unchanged (any change = a maker ask first).
- [x] **TypeScript-runner decision made by the maker** — _approved and installed 2026-08-28: `tsx` 4.23.12 (dev dependency; alias resolution verified)_ (needed by W4-A's
      live run): executing `scripts/seed.ts` needs a runner (`tsx` as a dev
      dependency is the default recommendation). A new dependency, so
      maker-approved, orchestrator-installed alongside the `db:seed` script.
- [x] **`@rdkit/rdkit` install decision made by the maker** — _approved and installed 2026-08-28: 2025.3.4-1.0.0. The WASM payload is **6.6 MB**, so W4-C's lazy-load discipline is not optional — it is the whole Lighthouse budget. Verified absent from the client bundle until something imports it._ (needed by
      W4-C's structure module). RDKit.js is locked stack in `AGENTS.md`, but
      installing is still a dependency change. If withheld or deferred, W4-C
      dispatches anyway with the structure module descoped to a slot rendering
      nothing (still provable by build) and the module becomes its own later
      item — say which.
- [ ] **Maker's five hand-cited materials exist** in `perfumers-codex-data`
      as JSON _(needed only for the real seed run, not for dispatch)_: W4-A is
      written and tested against obviously-synthetic fixtures; the real-data run
      is a maker+orchestrator step after merge. Dispatch does not wait for this
      box.

**Partial dispatch:** W4-A needs boxes 1 and 3. W4-B needs box 1. W4-C needs
boxes 1, 2, and 4.

**Early dispatch (2026-08-28):** W4-A's validation half — the input format,
Zod schemas, tests, and synthetic fixtures — is DB-free and was dispatched
ahead of the entry criteria; it also unblocks the maker's own data authoring
(the five-materials JSON needs the format to exist). `scripts/seed.ts`
remains gated on the maker schema (P1-A) and the runner decision, and is the
only W4-A file still outstanding.

## Wave shape

| Item                      | Checklist ID | Exclusive files                                                                                                                                                                                                                                                          | Proves it is done                                                                        |
| ------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| W4-A Seed pipeline        | P1-G         | `scripts/seed.ts`, `lib/validation/material-data.ts`, `lib/validation/material-data.test.ts`, `scripts/fixtures/` (synthetic JSON)                                                                                                                                       | `npm test -- lib/validation && npm run typecheck` + orchestrator live run later          |
| W4-B Search UX            | P2-F         | `components/site-header.tsx`, `components/search-command.tsx`, `app/api/search/route.ts`, `app/search/page.tsx`, `app/search/loading.tsx`, `app/search/error.tsx`, `lib/search/recent.ts`                                                                                | `npm run typecheck && npm run lint && npm run build` + orchestrator browser verification |
| W4-C Material detail page | P2-G         | `app/materials/[slug]/page.tsx`, `app/materials/[slug]/loading.tsx`, `app/materials/[slug]/error.tsx`, `components/material/` (new directory: tabs composition, citation superscripts, structure viewer, similar-materials module, experimental odor-predictions module) | same as W4-B                                                                             |

Disjointness notes: W4-B takes over `components/site-header.tsx` (untouched
since P2-C); W4-C takes over the `app/materials/[slug]/` segment files W3-B
created. No file appears in two lists. `package.json` (the `db:seed` script,
the runner, any dependency) and `components/ui/*` additions are
orchestrator-only, as ever.

## Wave-specific constraints (in addition to wave-3's standing set)

1. **Fixtures are synthetic, loudly.** W4-A's test fixtures use names like
   `"Test Material Alpha"` and CAS-shaped strings like `00-00-0`. The seed
   pipeline is the single most dangerous place in the project to hallucinate
   perfumery data — a plausible-looking fixture that leaks into the real DB
   becomes a fake cited fact.
2. **Rate limiting on the search endpoint is the Week 18 pass** (Upstash).
   This sentence is the deferral record; do not bolt it on, do not drop it.
3. **Caching stays `force-dynamic`** on all touched routes. The deliberate
   caching pass (`cacheLife`/`cacheTag`) comes after seeding settles — not
   this wave.

## W4-A — Seed pipeline (P1-G)

**Verbatim item:** "TypeScript seed script reading the data repo's JSON into
Postgres, idempotent, refreshing the search view at the end."

Acceptance criteria:

- **Input format** (this item defines it; the data repo conforms):
  - one JSON file per material;
  - **every source carries a stable `key`** (maker-chosen slug). This is the
    idempotency key for sources: `sources.url` is nullable and its unique
    index is partial, so url-less sources (books, interviews) have no
    natural key without it;
  - reference files, seeded **before** any material transaction:
    `families.json` (the taxonomy, including `parent_family_id` hierarchy —
    maker content, not agent-written), `usage-categories.json` (IFRA's 11),
    `hazard-codes.json` (GHS codes + descriptions). Without these, the first
    limit/hazard/family insert dies on a foreign key.
- `lib/validation/material-data.ts`: Zod schemas for all of the above,
  mirroring `docs/database-schema.md`. Validation runs over the **entire
  input set first** — including cross-file referential checks (a similarity
  target or family slug that resolves to no input material/family fails
  validation by name, before any write). A parse failure names the file and
  field; the seed aborts before touching the DB.
- `scripts/seed.ts`: directory path from argv (no hardcoded maker-machine
  paths). Write order: reference tables → all materials → relation tables
  (`material_similarity` last — its cross-material FKs mean a one-pass
  per-material write fails on forward references). Within a material,
  child rows (synonyms, limits, hazards, landmark uses, guidance,
  descriptions, computed) are **replaced inside the transaction**
  (delete-and-reinsert) — the schema gives synonyms and landmark uses no
  natural key, so upsert semantics cannot deliver idempotency; replacement
  can. Re-running on the same input yields zero duplicates and zero drift.
- **Pruning is opt-in and guarded.** Soft-deleting materials absent from the
  input happens only under a `--prune` flag, refuses to run if the input set
  is smaller than half the live corpus without an additional
  `--force-prune`, and logs every slug it will soft-delete before acting.
  A typo'd path must not be able to silently empty the corpus.
- Ends with `REFRESH MATERIALIZED VIEW CONCURRENTLY material_search_view;`
  issued outside any transaction.
- Tests cover the validation schemas (happy path, missing source key,
  missing `source_id` on a fact row, out-of-range percentages, malformed
  CAS, dangling similarity reference) against synthetic fixtures only. No
  test touches Postgres — the DB half is proven by the orchestrator's live
  run (run twice; second run must be a no-op).
- `search_queries`, `correction_submissions`, and all user tables are out of
  scope — the seed never touches them.

## W4-B — Search UX (P2-F)

**Verbatim item:** "Debounced instant search (~150ms), Cmd/Ctrl-K focus,
arrow-key navigation, rank-aware results page, genuinely helpful no-results
state, recent searches in localStorage."

Acceptance criteria:

- `app/api/search/route.ts`: thin GET handler — parse `q`, call
  `searchMaterials`, return JSON. No SQL, no ranking logic (D1/D2). Empty or
  whitespace `q` returns an empty result set without touching the DB.
- `components/search-command.tsx` (client): replaces the header's inert
  slot. Debounced ~150ms **with stale responses aborted or discarded**
  (`AbortController` or a request sequence check — a slow early response
  must never overwrite a fast later one); Cmd/Ctrl-K focuses from anywhere;
  arrows navigate, Enter opens, Escape closes; visible focus states from
  the existing tokens; result count announced via `aria-live="polite"`.
  Compose `components/ui/*` primitives.
- **Public open contract:** the palette listens for a documented
  `open-search` CustomEvent on `window` (dispatching it opens/focuses the
  palette). Wave 5's homepage uses this instead of reaching into this
  component. One line of JSDoc documents it.
- **Header auth affordance** (picks up the handoff recorded in wave-3/W3-A):
  the header shows "Sign in" when signed out and "Account" when signed in,
  checked server-side in the header's server component via `getUser()`. The
  toggle-style client scoping stays — do not make the header a client
  component.
- Rank-aware display: tier-2 hits show their matched synonym ("matched:
  OTNE") via `SearchResult.matchedSynonym`; CAS hits (tier 0) render the
  CAS number in the mono face. No tier numbers shown to users.
- `app/search/page.tsx`: server-rendered results for `?q=` (the sharable /
  no-JS path), same rank-aware display, `loading.tsx` skeleton matching the
  final list (compose the Skeleton primitive), `error.tsx` per D4.
- No-results state goes through `components/empty-state.tsx` and is
  genuinely helpful: show the query, suggest checking trade-name spelling,
  offer browse links. (Synonym _suggestions_ need data that does not exist
  yet — do not fake them; the zero-result log is already the improvement
  loop.)
- `lib/search/recent.ts` (client-only module, imported by the palette):
  last ~5 searches in localStorage, shown when the palette opens empty,
  clearable; storage access wrapped in try/catch (private windows); never
  able to break search.
- Mobile: the palette becomes a full-screen overlay below `sm`; the header
  shows a search icon button there (the slot itself is hidden below `sm`,
  P2-C's decision).

## W4-C — Material detail page (P2-G)

**Verbatim item:** "Hero with client-side RDKit.js 2D structure
(lazy-loaded, skipped when `smiles` is null), Safety/Olfactive/Usage/Sources
tabs, numbered citation superscripts, matching loading skeletons,
per-section empty states, real mobile layout."

Acceptance criteria:

- Hero: canonical name (display face), material type, CAS in the mono face,
  families. **The hero markup stays in `page.tsx`** — Wave 5's save button
  mounts there, and factoring the hero into a component this wave would turn
  that mount into an out-of-list edit.
- Structure viewer: `page.tsx` statically imports the client wrapper
  `components/material/structure.tsx`; the wrapper itself does
  `next/dynamic(() => import('./structure-canvas'), { ssr: false })` of the
  inner RDKit component. (`ssr: false` directly from a server component is a
  hard error in Next 16 — the wrapper indirection is required, both files in
  `components/material/`.) WASM loads only on mount, never in the critical
  path (AGENTS.md). Load failure renders a quiet fallback, never an error
  page. `smiles: null` renders no structure UI at all — not a broken frame.
  If the maker withheld the dependency, ship the slot rendering nothing and
  mark the module dormant.
- Tabs (Safety / Olfactive / Usage / Sources) from the Tabs primitive the
  orchestrator added pre-dispatch; URL-addressable (`?tab=safety`);
  keyboard operable per the primitive's contract. On mobile, tabs become
  stacked sections or a scrollable tab bar — a deliberate layout, not a
  shrunken desktop.
- Safety tab: IFRA limits table with `restriction_type` rendered honestly
  (prohibition ≠ "no limit"), the amendment version displayed prominently
  per `docs/data-strategy.md`, GHS hazards with codes + descriptions.
- Citations: numbered superscripts per the pinned rule (order of first
  reference, walking `MaterialDetail` fields in declaration order, deduped;
  superscript = index in `sources` + 1). Superscripts link to the Sources
  tab entry; source entries link out to their URLs.
- Experimental module: renders only when `odorPredictions` is non-empty,
  visually separated, labeled "Experimental — model {modelVersion}" using
  the **latest model version only** (the unique key is per
  material+descriptor+version, so the array can mix versions — filter to
  the newest), never intermixed with the human-written description
  (AGENTS.md hard rule).
- Computed properties (logP, TPSA, heavy atoms) shown with their
  `rdkitVersion`, framed as computed context, never as cited fact.
- Per-section empty states are content through `components/empty-state.tsx`
  ("No landmark uses recorded yet"); `loading.tsx` composes the Skeleton
  primitive and matches the final layout so there is no jump.
- Sets the route `title` (exercises the layout's `title.template`) and a
  per-material description for metadata.

## After the wave (orchestrator)

Full suite; combined diff review; browser verification of search UX and the
detail page in both modes at 375px and desktop; `npm run db:seed` against a
synthetic fixture directory into the live DB, **run twice** (second run must
be a no-op), then hand the real-data run to the maker; crosscheck against
architecture D1/D2/D4, `AGENTS.md` (labeled-experimental rule especially),
`docs/data-strategy.md` (amendment version display), `docs/cheminformatics.md`
(lazy-load + Lighthouse budget); Lighthouse on the detail page (>90 with the
WASM lazy-loaded); one commit per item; tick P1-G, P2-F, P2-G.
