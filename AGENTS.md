<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Perfumers Codex — agent rules

This file defines the rules of this codebase. When in doubt, follow these rules over general best practices.

## Project context

A curated, public, open-source aromachemical reference web app for working perfumers. Citation-driven, editorially curated, polished. Solo-built by Davis Kim. Deployed at perfumerscodex.com. Deeper design docs live in `/docs`.

## Stack

- Node 24 (`engines.node: "24.x"` in package.json — Vercel and CI both read it; odd-numbered releases like 23 are EOL and unsupported on Vercel)
- Next.js 16 (App Router, Turbopack), TypeScript strict
- Tailwind CSS v4 (design tokens in `@theme` in globals.css — no tailwind.config.js) + shadcn/ui (components copied to /components/ui — they are owned, not vendored)
- Postgres on Supabase + Drizzle ORM (table definitions in `db/schema.ts`; all access via `lib/db/` — see below)
- Supabase Auth via `@supabase/ssr` (email/password + Google OAuth) — never use the deprecated auth-helpers packages
- Supabase API keys: new-style `sb_publishable_` / `sb_secret_` only
- Row-Level Security on **every** public table (deny-by-default since migration 0002, 2026-08-30) — Supabase grants anon full DML over PostgREST by default, so a table without RLS is world-writable once the site is live. Editorial tables carry no policies (the app reads them through Drizzle, which bypasses RLS); user tables carry owner-scoped policies. Views and materialized views cannot carry RLS, so every one created in `public` must `REVOKE ALL … FROM anon, authenticated` in the same migration (`material_search_view`: migration 0007, applied live 2026-10-03)
- Vercel deployment (function region matches Supabase region)
- Vitest for unit tests (node environment, colocated `*.test.ts`)
- Zod for validation — one schema per form, shared by client and server
- GitHub Actions on every PR and push to main: typecheck, lint, unit tests, and an `integration` job against a local Supabase stack
- Material data lives in a separate repo, daviskimCS/PerfumersCodexData: cited JSON files plus research dossiers, read by `npm run db:seed -- <dir>`. No ingestion or RDKit code is committed there; similarity and computed properties arrive precomputed in the files (RDKit.js 2025.03.4, stamped with rdkit_version, so far only for Iso E Super, Javanol and Civetone)
- Vercel Cron calls `/api/keep-alive` daily (`vercel.json`, `CRON_SECRET`) so the free Supabase project never pauses; security headers on every response in `next.config.ts`
- RDKit.js (WASM): the seed draws each 2D structure once in Node (`scripts/draw.ts` → `material_structure_drawings`, stamped with rdkit_version, migration 0009) and material pages inline that SVG server-side. The browser loads the WASM only on `/structure`, for patterns a reader types (lazy-loaded, never in the critical path). Never load it on a material page to redraw what the seed stored

## Architectural rules

- All DB access goes through `lib/db/`. No inline SQL in route handlers or components.
- **Module layout (docs/architecture.md D1):** `db/` declares the database shape (`schema.ts`, generated `migrations/`); `lib/db/` is the only place that imports the Drizzle client, a Supabase client, or `db/schema.ts` — except `scripts/` build tooling, which may import `db/schema.ts` directly (it still takes its client from `lib/db/`), and the auth and account flows (`app/(auth)/`, `app/auth/`, `app/account/`), which call Supabase Auth through `lib/supabase/` directly. Their data rows still go through `lib/db/`. Pages and components call `lib/db/` functions and receive `lib/types.ts` shapes — never raw Drizzle rows. Imports use the `@/` alias.
- **Type contracts:** `lib/types.ts` is contract-locked. It is hand-written from `docs/database-schema.md`, not inferred from Drizzle, so UI and schema work stay decoupled. Conform to it; don't edit it.
- **Search boundary (docs/architecture.md D2):** SQL returns _evidence_ (match flags, similarities, ts_rank), TypeScript assigns _rank_. `lib/search/{normalize,rank}.ts` stay pure and database-free so the gold set runs without Postgres.
- **Page states (docs/architecture.md D4):** every data-fetching route segment ships `loading.tsx` (skeleton matching final layout) and `error.tsx` (plain language + `retry()` — not `reset()`, which re-renders without re-fetching; it was `unstable_retry()` before Next 16.3 — never a raw error or stack trace). Unknown slugs call `notFound()`. Empty states are content passed to the shared `components/empty-state.tsx`, never new bespoke components. Never catch-and-render-blank — a silent empty section lies about the data.
- **Data-access boundary:** editorial/public data (materials, families, sources, search) is read through Drizzle. User-owned data (bookmarks, notes) goes through the Supabase client so RLS is enforced — Drizzle connects as the `postgres` role and silently bypasses RLS. Never touch user tables through Drizzle.
- Drizzle migrations run against the direct connection (5432); the app runs against the pooled connection (6543, `prepare: false`).
- Server components by default. Client components only when needed (interaction, browser APIs).
- Every fact-bearing row in materials data has a `source_id`. Non-nullable. Enforced at schema level.
- URLs use slugs, not IDs. e.g. `/materials/iso-e-super` not `/materials/uuid`.
- Citations display as numbered superscripts linking to source URLs.
- Database constraints (NOT NULL, FK, CHECK) liberally applied. They are documentation the DB enforces.
- All schema changes are migrations. No ad-hoc DB edits.
- Soft-delete (deleted_at) for editorial content. Hard-delete for user data (GDPR).
- **Review gate (migration 0008):** nothing reaches readers unreviewed. A material is public only when `deleted_at IS NULL AND reviewed_hash = content_hash` — use `materialIsPublished()` from `lib/db/published.ts` in every public read of `materials`, never a bare `deleted_at IS NULL`. Both hold a fingerprint of what the page renders (`lib/review/fingerprint.ts`, over `MaterialDetail`), so anything a page shows must come through `MaterialDetail` or it is not covered. The seed refreshes `content_hash`; only `npm run db:review publish` (the maker, with the fingerprint `db:review show` printed) writes `reviewed_hash`; `getMaterialBySlug` re-checks the fingerprint on every request. No agent, seed flag or data file may publish a material. Families with no published material are hidden.
- Model output (odor predictions) lives in `odor_predictions` with a `model_version`, renders only in a clearly-labeled experimental module, and never mixes with `material_descriptions`.
- Computed values (logP, similarity) carry `rdkit_version` as provenance — they are deterministic recomputations, not cited facts.
- `smiles` is nullable — naturals are mixtures and carry none. Every cheminformatics feature (similarity, substructure, computed properties, 2D render) skips NULL-SMILES materials rather than erroring.
- Structure–odor training data (Leffingwell / GoodScents-derived) stays under its own license in the experiment repo. Review the license before use; never redistribute it as project data.

## Search philosophy

- Postgres full-text search with synonym table + materialized view + pg_trgm.
- Name matches always rank above description matches.
- Search must feel instant: <150ms p95.
- Synonym table covers: trade names, IUPAC, common names, abbreviations, supplier names.
- CAS number search is an exact-match short-circuit on the `cas_number` column — CAS numbers are never in the tsvector.
- FTS config: `'simple'` for names/synonyms (no English stemming of trade names), `'english'` for descriptions only.
- Prefix and typo matching via pg_trgm trigram indexes, not FTS.
- Every query is logged to `search_queries` (query + result_count only — no user_id, no IP).

## Auth and security

- Supabase Auth handles auth flows. Don't roll custom auth.
- Server-side, verify the caller with `supabase.auth.getClaims()` for reads and gating (the proxy's session refresh, the header, "is this reader signed in", bookmark and note reads): it verifies the token's signature locally against the project's JWKS, no auth-server round trip. Use `supabase.auth.getUser()` before sensitive writes (account deletion, email and password changes): it asks the auth server, so a session revoked elsewhere is refused at once, where a locally-verified token stays valid until it expires (an hour at most). Never `getSession()`, which trusts unvalidated cookie data. `/account` and `/account/export` also use `getUser()`, so they show the account as the auth server holds it. The local check needs asymmetric signing keys (maker-todo item 11); until then `getClaims()` falls back to a round trip on its own.
- All user-data tables have RLS policies. Test with multiple accounts before merging.
- Account deletion _actually deletes_ data. No soft-deletes for user-owned rows. It runs through the Supabase admin API with the secret key in a server action (the logged-in client cannot delete itself); `ON DELETE CASCADE` on user tables does the cleanup — verify it with a throwaway account.
- Sign-up, sign-in, password reset and the current-password check on `/account` pass Cloudflare Turnstile (`lib/turnstile.ts`, verified in the server action, fails closed) and call Supabase Auth through `createAuthClient()` (`lib/supabase/auth-server.ts`), which sends the reader's IP as `Sb-Forwarded-For` so Supabase's per-IP limits count readers rather than Vercel. That client holds the secret key: auth calls only, never data. Both are dormant until the Turnstile keys are set and Supabase's IP Address Forwarding is on. Search is not rate-limited in code (no Redis: see Forbidden).
- No secrets in client bundle. Verify before deploy.
- **Validation (docs/architecture.md D6):** one Zod schema per form/domain in `lib/validation/`, imported by both the client form and the server action — "server matches client" holds by construction. Server actions always re-parse with `safeParse`; a parse failure returns field-keyed errors, never a thrown 500.
- Server-side environment variables are read only through `lib/env.ts` (Zod, parsed per variable on first access, then cached), so a missing var fails loudly where it is first needed while `next build` needs none. Exceptions: the literal `process.env.NEXT_PUBLIC_*` reads in the browser Supabase client and `components/auth/turnstile.tsx` (inlined at build) and build tooling (`drizzle.config.ts`, `scripts/`, `tests/integration/`).

## Aesthetic

- Minimalist, editorial. Reference: Apple developer docs, not a startup landing page.
- Generous whitespace. Thoughtful typography hierarchy.
- Imagery is limited to chemical structure diagrams, drawn by RDKit at seed time.
- Light + dark mode, both first-class.
- Consistent spacing scale, type scale, color tokens. No one-off styles.

## Forbidden

- Don't add new dependencies without asking the maker first.
- Don't write inline SQL in route files.
- Don't skip RLS policies on new user-data tables.
- Don't add features marked v2 (formulation logs, stock tracking, session journal, real-time collaboration).
- Don't generate olfactive descriptions or cited safety data — those are human-written. Model odor predictions are the schema-separated, clearly-labeled exception — never present them as editorial content.
- Don't add pgvector/embeddings retrieval, the MCP server, or the UMAP odor map in v1 without asking — deferred, see docs/cheminformatics.md.
- Don't add Storybook, GraphQL, Redis, microservices, Docker, or PWA in v1.
- Don't add E2E tests in v1 (Vitest unit tests only on core logic).

## Testing philosophy

Test the parts that benefit from tests:

- Search ranking and synonym resolution
- Data normalization
- Citation handling
- Auth-adjacent business logic

Skip tests for:

- Trivial component renders
- Plain CRUD endpoints
- Anything that's just "calls the database and returns it"

## Boring quality essentials (always check)

- Empty / loading / error state on every page
- Form validation (client + server, inline messages)
- Keyboard navigation (tab order, focus indicators, Cmd-K patterns)
- ARIA labels and color contrast
- Mobile responsive on real devices, not just devtools
- Real metadata: Open Graph, favicon, descriptions
- Lighthouse >90 on key pages

## Current state

- **Built (2026-10-18):** every v1 route except the admin dashboard, correction form, blog and the structure–odor experiment; search rate limiting and error monitoring are not built (sign-in forms have Turnstile and per-reader IP limits, dormant until configured). Status by area: `docs/overview.md`.
- **Maker's open items live in `docs/maker-todo.md`** — human-only work (dashboards, editorial). Check it before assuming something is unfinished for a code reason.
- **Pre-launch password gate REMOVED (2026-10-17):** the app-level fence (`proxy.ts` rewrite, `lib/gate.ts`, `/coming-soon`, `/unlock`, the `pc_gate` cookie, `SITE_GATE_*` env vars) is deleted; git history has it (`f67399b` added it). The site is public, and the review gate (`lib/db/published.ts`) is what keeps unreviewed material off it. Old branches still contain the gate code, so keep `SITE_GATE_PASSWORD` set on **Preview** in Vercel: their previews read the live database. With D4 (perfumerscodex.com in the environment's Allowed domains) agents can probe production directly.
- **Live database:** 18 materials (14 researched drafts, 4 synthetic fixtures), all fingerprinted and `awaiting review`, 0 published, so readers see none until the maker publishes. Migrations 0000–0009 are applied live; 0010 (note length cap) is the maker's to apply. Last re-seed 2026-10-11 from PerfumersCodexData `c2dd854`. Only Iso E Super and Javanol carry the maker's olfactive descriptions. 15 `PROPOSED — maker to replace` families are still live, and `publish` refuses a material whose family is PROPOSED.
- **Never run `npm run db:seed -- scripts/fixtures` against the live database:** `usage_categories` upserts by id, and the fixture file would rename all eleven real IFRA categories "Test Category N". Prune the four fixtures with `--prune` when the maker says so (maker-todo item 8).
- **Renaming a source key** in the data repo collides on `sources_url_uniq` until the live row is renamed to match: the seed adopts a same-URL row only when its key is NULL.
- **Seed input rules:** every material needs `identity_source_key` and a `source_key` per synonym; validation refuses a Standard and a verified absence for the same amendment, and one URL under two keys. Class membership is derived by the seed, never authored.
- **No data cache over editorial reads:** the review gate hides a changed page at once, and `npm run db:review` runs outside the Next runtime, where it could not invalidate a cache.
- **Tests:** `npm test` is database-free; `npm run test:integration` runs the real auth and account actions, and the search SQL, against a local Supabase stack (CI job `integration`; `tests/integration/README.md`).
- **Unverified:** the browser half of bookmarks and notes (button, `/saved`), and real Google sign-in (manual check in `tests/integration/README.md`). Account deletion leaves Supabase's auth audit log rows behind (maker-todo item 12).
- **Blockers:** none

## Known issues / debt

- **Canonical-domain mismatch:** `NEXT_PUBLIC_SITE_URL` and og:url advertise the apex (`perfumerscodex.com`), but Vercel has `www` as the primary domain and 308-redirects apex → www. Fix in the Vercel dashboard (make the apex primary so www redirects to it) — no code change. Until then the site advertises a URL that redirects.
- **Repo is still private** — the public-from-day-one constraint is unmet. Flip visibility when ready; LICENSE/LICENSE-DATA are already in place.
- No custom SMTP sender yet: Supabase's built-in sender reaches only the project team, so sign-up and reset emails cannot reach the public until it exists (maker-todo item 12).

## V2 backlog (do not implement now)

- Formulation logs
- Stock / inventory tracking
- Session journal
- Trusted contributor permissions
- Public discussion threads per material
- Real-time collaboration
- Optional embedded bench companion
- Internationalization
- Native mobile app
- MCP server (v1.1)
- IFRA amendment diffing (v1.1)
- Embeddings / pgvector hybrid retrieval
- UMAP odor map (stretch — ask before starting)

## Useful prompts (reusable)

- "Audit this page for missing empty/loading/error states. Fix what's missing."
- "Review this RLS policy by simulating queries from two different user accounts. Find any leaks."
- "Generate a Vitest table for this search ranking function. Cover happy path, edge cases, 2 adversarial inputs."
- "Audit this form for accessibility (focus indicators, ARIA labels, keyboard navigation). Fix issues found."
- "Run EXPLAIN ANALYZE on the queries in this file. Suggest indexes if any plan shows sequential scans on big tables."

## When in doubt

- Defer to the rules above
- Use plan mode for schema, auth, RLS, or multi-file changes
- Ask the maker before adding dependencies or features
- Prefer fewer changes that are correct over many changes that are nearly correct
