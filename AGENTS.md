<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Perfumers Codex — agent rules

This file defines the rules of this codebase. When in doubt, follow these rules over general best practices.

## Project context

A curated, public, open-source aromachemical reference web app for working perfumers. Citation-driven, editorially curated, polished. Solo-built by Davis Kim. Live at perfumerscodex.com (once deployed). Deeper design docs live in `/docs`.

## Stack

- Next.js 16 (App Router, Turbopack), TypeScript strict
- Tailwind CSS v4 (design tokens in `@theme` in globals.css — no tailwind.config.js) + shadcn/ui (components copied to /components/ui — they are owned, not vendored)
- Postgres on Supabase + Drizzle ORM (table definitions in `db/schema.ts`; all access via `lib/db/` — see below)
- Supabase Auth via `@supabase/ssr` (email/password + Google OAuth) — never use the deprecated auth-helpers packages
- Supabase API keys: new-style `sb_publishable_` / `sb_secret_` only
- Row-Level Security on **every** public table (deny-by-default since migration 0002, 2026-08-30) — Supabase grants anon full DML over PostgREST by default, so a table without RLS is world-writable once the site is live. Editorial tables carry no policies (the app reads them through Drizzle, which bypasses RLS); user tables carry owner-scoped policies
- Vercel deployment (function region matches Supabase region)
- Upstash Redis (Vercel Marketplace) for rate limiting only — not a cache
- Vitest for unit tests (node environment, colocated `*.test.ts`)
- Zod for validation — one schema per form, shared by client and server
- GitHub Actions for typecheck + tests on PRs
- Python data ingestion in separate repo: perfumers-codex-data
- RDKit (Python, in perfumers-codex-data): fingerprints, Tanimoto similarity precompute, computed properties — stamped with rdkit_version
- RDKit.js (WASM, lazy-loaded, client-side): 2D structure rendering + substructure search — never in the critical path

## Architectural rules

- All DB access goes through `lib/db/`. No inline SQL in route handlers or components.
- **Module layout (docs/architecture.md D1):** `db/` declares the database shape (`schema.ts`, generated `migrations/`); `lib/db/` is the only place that imports the Drizzle client, a Supabase client, or `db/schema.ts` — except `scripts/` build tooling, which may import `db/schema.ts` directly (it still takes its client from `lib/db/`). Pages and components call `lib/db/` functions and receive `lib/types.ts` shapes — never raw Drizzle rows. Imports use the `@/` alias.
- **Type contracts:** `lib/types.ts` is contract-locked. It is hand-written from `docs/database-schema.md`, not inferred from Drizzle, so UI and schema work stay decoupled. Conform to it; don't edit it.
- **Search boundary (docs/architecture.md D2):** SQL returns _evidence_ (match flags, similarities, ts_rank), TypeScript assigns _rank_. `lib/search/{normalize,rank}.ts` stay pure and database-free so the gold set runs without Postgres.
- **Page states (docs/architecture.md D4):** every data-fetching route segment ships `loading.tsx` (skeleton matching final layout) and `error.tsx` (plain language + `unstable_retry()` — not `reset()`, which re-renders without re-fetching — never a raw error or stack trace). Unknown slugs call `notFound()`. Empty states are content passed to the shared `components/empty-state.tsx`, never new bespoke components. Never catch-and-render-blank — a silent empty section lies about the data.
- **Data-access boundary:** editorial/public data (materials, families, sources, search) is read through Drizzle. User-owned data (bookmarks, notes) goes through the Supabase client so RLS is enforced — Drizzle connects as the `postgres` role and silently bypasses RLS. Never touch user tables through Drizzle.
- Drizzle migrations run against the direct connection (5432); the app runs against the pooled connection (6543, `prepare: false`).
- Server components by default. Client components only when needed (interaction, browser APIs).
- Every fact-bearing row in materials data has a `source_id`. Non-nullable. Enforced at schema level.
- URLs use slugs, not IDs. e.g. `/materials/iso-e-super` not `/materials/uuid`.
- Citations display as numbered superscripts linking to source URLs.
- Database constraints (NOT NULL, FK, CHECK) liberally applied. They are documentation the DB enforces.
- All schema changes are migrations. No ad-hoc DB edits.
- Soft-delete (deleted_at) for editorial content. Hard-delete for user data (GDPR).
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
- Server-side, verify the caller with `supabase.auth.getUser()` — never `getSession()`, which trusts unvalidated cookie data.
- All user-data tables have RLS policies. Test with multiple accounts before merging.
- Account deletion _actually deletes_ data. No soft-deletes for user-owned rows. It runs through the Supabase admin API with the secret key in a server action (the logged-in client cannot delete itself); `ON DELETE CASCADE` on user tables does the cleanup — verify it with a throwaway account.
- Rate limit: signup, login, search.
- No secrets in client bundle. Verify before deploy.
- **Validation (docs/architecture.md D6):** one Zod schema per form/domain in `lib/validation/`, imported by both the client form and the server action — "server matches client" holds by construction. Server actions always re-parse with `safeParse`; a parse failure returns field-keyed errors, never a thrown 500.
- Environment variables are read only through `lib/env.ts` (Zod-parsed once at module load). No raw `process.env` elsewhere — a missing var should fail loudly at boot.

## Aesthetic

- Minimalist, editorial. Reference: Apple developer docs, not a startup landing page.
- Generous whitespace. Thoughtful typography hierarchy.
- Imagery is limited to chemical structure diagrams (hotlinked from PubChem with attribution).
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

- **Phase:** Phases 1–2 (build). Phase 0 closed 2026-08-29 except repo visibility (below).
- **Last completed (2026-08-30):** infrastructure review — RLS enabled on all 19 tables with owner policies on user tables (migration 0002, verified against the live Data API); site live at perfumerscodex.com (Vercel + Supabase, auth working in production, CI green); design pass merged (monospaced type, Noctua-brown palette, seamless grain background, inverted light-mode chrome — PRs #1–#5)
- **Maker's blocking items live in `docs/maker-todo.md`** — human-only work (accounts, dashboards, editorial). Check it before assuming something is unfinished for a code reason.
- **Waves 4 and 5 complete (2026-09-01):** seed pipeline (P1-G), search UX (P2-F), material detail with lazy RDKit (P2-G), browse/homepage/families (P2-H), bookmarks (P3-A). The app is feature-complete against a seeded corpus of 3 synthetic materials.
- **In progress:** Wave 6 dispatched 2026-09-02 (P3-B private notes, P3-C account management — concurrent; file sets disjoint). Maker authoring the first five materials + `perfumers-codex-data` repo.
- **Blockers:** none

## Known issues / debt

- **Canonical-domain mismatch:** `NEXT_PUBLIC_SITE_URL` and og:url advertise the apex (`perfumerscodex.com`), but Vercel has `www` as the primary domain and 308-redirects apex → www. Fix in the Vercel dashboard (make the apex primary so www redirects to it) — no code change. Until then the site advertises a URL that redirects.
- **Repo is still private** — the public-from-day-one constraint is unmet. Flip visibility when ready; LICENSE/LICENSE-DATA are already in place.
- Vercel project email/alias (`hello@perfumerscodex.com`) still pending; nothing blocks on it until Week 20 (Resend).

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
