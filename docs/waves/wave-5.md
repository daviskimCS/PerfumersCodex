# Wave 5 — Browse the corpus, own your shelf

**Status: COMPLETE — merged 2026-09-02 (PR #7).** Written and
independently reviewed 2026-08-27 (verdict: dispatch after fixes — all
findings applied). Orchestrator-owned. House rules, protocol, and standing
constraints are those of [wave-3.md](./wave-3.md), carried verbatim into
every prompt, plus [wave-4.md](./wave-4.md)'s rate-limiting and caching
deferral records, which remain in force.

This is the first wave that touches **user-owned data**. The RLS boundary
stops being documentation here and becomes the thing that keeps strangers
out of each other's shelves.

**This wave is sequential, not concurrent: dispatch W5-A first, then W5-B.**
W5-B consumes two things W5-A creates (`components/material-card.tsx` and
`listMaterialsByIds` in `lib/db/materials.ts`), so concurrent dispatch would
leave W5-B unable to typecheck.

## Entry criteria

- [ ] **Wave 4 committed and verified**, including the orchestrator's
      synthetic-fixture seed run against the live DB (run twice, second a
      no-op). The maker's real-data run may come later; "browse pages verified
      against seeded rows" means synthetic rows are acceptable for verification
      and are pruned via the seed's `--prune` path before launch.
- [ ] **Auth flows live** (W3-A merged and smoke-tested): W5-B is
      meaningless without sign-in.
- [ ] **`lib/types.ts` extended by the orchestrator** (pre-dispatch, D3's
      review gate): a `FamilySummary` shape (`slug`, `name`, `materialCount`,
      `parentSlug: string | null`) for browse surfaces. `FamilyRef` stays as-is
      for the shapes that embed it. (The schema has no family description
      column, so no description field — and no description slot in W5-A.)
- [ ] **Two throwaway test accounts exist** for RLS verification — created
      by the maker, or by the orchestrator via the admin API with the secret key
      if the maker approves that in writing. W5-B does not merge until the
      cross-account probes pass.
- [ ] **Family taxonomy seeded**: `families` rows exist from the seed run's
      `families.json` (maker content; the default is the standard
      fragrance-wheel taxonomy the maker chose in June 2026 — adapt as curation
      surfaces gaps).

**Partial dispatch:** W5-A needs boxes 1 and 3 (plus 5 for family pages to
show anything). W5-B needs every box **and W5-A merged**.

**Why P3-B (notes) and P3-C (account management) are NOT here:** P3-B edits
`app/materials/[slug]/page.tsx`, the same file W5-B's save button mounts in —
real overlap, so a different wave by protocol. P3-C has no file overlap with
this wave and could technically ride along; it is held to Wave 6 to keep this
wave at two items and to let the account surface change once, reviewed
together with notes. That is a pacing choice, recorded here.

## Wave shape

| Item                    | Checklist ID | Exclusive files                                                                                                                                                                                                                                                                                                                                                                                           | Proves it is done                                                                        |
| ----------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| W5-A Browse & discovery | P2-H         | `app/page.tsx`, `app/loading.tsx`, `app/error.tsx`, `app/materials/page.tsx`, `app/materials/loading.tsx`, `app/materials/error.tsx`, `app/families/[slug]/page.tsx`, `app/families/[slug]/loading.tsx`, `app/families/[slug]/error.tsx`, `lib/db/materials.ts`, `lib/db/families.ts`, `components/material-card.tsx`                                                                                     | `npm run typecheck && npm run lint && npm run build` + orchestrator browser verification |
| W5-B Bookmarks          | P3-A         | one custom RLS-policy migration (via `npx drizzle-kit generate --custom`, SQL **plus** its `db/migrations/meta/` journal entry), `lib/db/bookmarks.ts`, `components/save-button.tsx`, `app/materials/[slug]/page.tsx` (mount the button), `app/materials/[slug]/loading.tsx` (skeleton gains the button so D4's no-jump rule holds), `app/saved/page.tsx`, `app/saved/loading.tsx`, `app/saved/error.tsx` | same + the orchestrator's two-account RLS probes                                         |

Disjointness and takeovers: W5-A takes over `app/materials/page.tsx` + its
states (from W3-B), `app/page.tsx` (from the scaffold), and
`lib/db/materials.ts` (from W3-B — it needs real query changes this wave);
W5-B takes over `app/materials/[slug]/page.tsx` and its `loading.tsx` (from
W4-C). Sequenced as stated, no file is contested.

## W5-A — Browse & discovery (P2-H)

**Verbatim item:** "`/families/[slug]` pages, a real homepage, and a
browseable `/materials` index (sortable, filterable by family, paginated)."

Acceptance criteria:

- `lib/db/materials.ts` grows (existing signatures untouched):
  `listMaterials({ sort, familySlug, page, pageSize })` →
  `{ items: MaterialSummary[]; total: number }` (sort: name |
  recently-updated; filter by family slug; offset pagination),
  `listMaterialsByIds(ids: string[])` → `MaterialSummary[]` (input order
  preserved — W5-B's `/saved` consumes this), and `countMaterials()` →
  `number` (homepage stat). Drizzle only, soft-deletes excluded, still
  returning `lib/types.ts` shapes only.
- `lib/db/families.ts`: `listFamilies()` → `FamilySummary[]` (with counts)
  and `getFamilyBySlug(slug)` → `FamilySummary | null`. Unknown slug → the
  page calls `notFound()`.
- `/materials` index: server-rendered; sort, family filter, and pagination
  all via `searchParams` — the URL is the state, sharable and crawlable. No
  client-side data fetching. Empty corpus and empty filter results go
  through `components/empty-state.tsx`.
- `components/material-card.tsx`: one card (name, type, families, CAS in
  mono) reused by the index, family pages, and W5-B's `/saved` — the shared
  unit that keeps the three lists from diverging.
- `/families/[slug]`: family name, its materials as cards, sibling-family
  navigation from `listFamilies()`. D4 states on every segment.
- Homepage: replaces the placeholder — what this is (product copy from
  `docs/overview.md`'s value proposition, straight copy, no marketing
  voice), a search entry point that dispatches the documented `open-search`
  event (falling back to a link to `/search` — never reaching into the
  palette component), family links, and an honest "N materials, every fact
  cited" line from `countMaterials()`. **This retires the `px-6` gutter debt
  recorded in the checklist** — use the `gutter` tokens.
- `app/loading.tsx` + `app/error.tsx`: the homepage now fetches, so D4
  applies. **Root-segment caveat, decided here:** these files sit at the app
  root and therefore also back any future route that lacks its own —
  acceptable, since D4 wants every segment covered and deeper segments
  already ship their own. The skeleton matches the homepage layout; the
  error copy stays generic enough to serve as the app-wide fallback.
- Homepage sets no bespoke fonts/colors — tokens only, both modes.

## W5-B — Bookmarks (P3-A)

**Verbatim item:** "Save button on material pages (logged-in only), `/saved`
page listing the user's saved materials, `user_saved_materials` RLS policies
as a migration, all access via the Supabase client. Multi-account RLS
verification before merge."

Acceptance criteria:

- ~~Migration: RLS + policies on `user_saved_materials`~~ **Superseded
  2026-08-30:** migration `0002_rls-deny-by-default` already enables RLS on
  every table and creates the owner policies (SELECT/INSERT/DELETE via
  `auth.uid() = user_id`, INSERT as `WITH CHECK`, no UPDATE — a bookmark is
  created or deleted, never edited). W5-B therefore ships **no migration**;
  the verification protocol below is unchanged and still gates the merge.
- `lib/db/bookmarks.ts`: goes through the **Supabase server client** for
  every touch of `user_saved_materials` — this file must not import the
  Drizzle client or `db/schema.ts`. `getSavedMaterialIds()` (Supabase),
  `getSavedMaterials()` = ids → `listMaterialsByIds` from
  `lib/db/materials.ts` (a **function import** — the editorial read stays in
  the file that owns Drizzle; a comment names the seam), `saveMaterial(id)`,
  `unsaveMaterial(id)`. Returns `lib/types.ts` shapes only.
- `components/save-button.tsx` (client): receives signed-in state and
  initial saved state as **server-passed props** (no Supabase client in the
  component); optimistic toggle with rollback on failure via server actions;
  signed-out users see a sign-in link, not a dead button; `aria-pressed`
  reflects state; loading never blocks the page.
- `app/materials/[slug]/page.tsx`: mount the button in the hero (W4-C pinned
  the hero markup in this file for exactly this) — mounting and its data
  wiring are the only changes; restyling or restructuring W4-C's work is out
  of bounds. `loading.tsx` gains the button's skeleton so the layout doesn't
  jump.
- `/saved`: `getUser()`-gated like `/account`; lists via
  `components/material-card.tsx`; signed-in-but-empty state through
  `EmptyState` with a browse link; D4 states.
- Server actions re-validate auth server-side (`getUser()`, never trust the
  client) and revalidate the affected paths.

### RLS verification protocol (orchestrator, before W5-B merges)

With accounts A and B, probing **through the Supabase user client** (the
enforced path), never the dashboard:

1. A saves a material; as B, `getSavedMaterialIds()` returns nothing of A's.
2. As B, INSERT a row with `user_id = A` — must be **refused** (WITH CHECK
   raises).
3. As B, DELETE A's row — must affect **zero rows**, and A's row must still
   exist afterwards, verified as A. (RLS DELETE filters silently match
   nothing rather than erroring — asserting only "no error" would
   false-pass.)
4. As the anonymous client, all three operations fail or touch nothing.

Record the probe transcript in the item's commit message.

## After the wave (orchestrator)

Full suite; combined diff; browser verification (browse flows, save/unsave
round-trip, `/saved`, homepage — both modes, 375px and desktop); the RLS
protocol above; Lighthouse on the homepage and `/materials` index (>90 — they
are "key pages" per the quality bar); crosscheck against architecture D1/D4,
`AGENTS.md`'s auth/security section, `docs/database-schema.md`'s user-tables
section; confirm `lib/db/bookmarks.ts` imports no Drizzle; one commit per
item (W5-B's carrying the RLS probe transcript); tick P2-H, P3-A; prepare
Wave 6 (P3-B notes, then P3-C account management — sequential, P3-B shares
the detail page with nothing else while P3-C extends `/account`).
