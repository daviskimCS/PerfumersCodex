# Tech stack

## The stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack), React 19 |
| Language | TypeScript, strict |
| Styling | Tailwind CSS v4 (tokens in `@theme` in `app/globals.css`) + shadcn/ui (copied into `components/ui/`, owned) |
| Typography | JetBrains Mono, self-hosted (`assets/fonts/`, OFL) through `next/font/local`; the same file feeds the Open Graph cards |
| Database | Postgres on Supabase |
| ORM | Drizzle |
| Auth | Supabase Auth via `@supabase/ssr` (email/password; Google built, dormant) |
| Search | Postgres full-text search + synonym table + `pg_trgm` |
| Cheminformatics | RDKit.js (WebAssembly): in Node at seed time for structure drawings and class membership; in the browser only on `/structure` |
| Hosting | Vercel (functions in the Supabase region), daily keep-alive cron (`vercel.json`) |
| Analytics | Vercel Web Analytics (cookieless, no IPs) |
| Testing | Vitest: unit tests with no database; integration tests against a local Supabase stack |
| CI | GitHub Actions: typecheck, lint, unit tests, integration tests |
| Data | A separate repository of cited JSON files, validated and written by `npm run db:seed` |

Not in place yet: rate limiting, error monitoring, transactional email through
a custom SMTP sender (needed before strangers can sign up: Supabase's built-in
sender only reaches the project team).

## Why these choices

**Next.js App Router.** Server components and streaming suit a content-heavy
reference. Next 16 changed caching and renamed middleware to `proxy.ts`;
older tutorials mislead, so read `node_modules/next/dist/docs/` first.

**Postgres + Drizzle.** The data is highly relational (materials, families,
citations, per-category limits, synonyms). Drizzle stays close to SQL.
Supabase exposes two connections: migrations run on port 5432 (the session
pooler; the true direct host is IPv6-only), the app on the transaction-mode
pooler at 6543 with `prepare: false`, since prepared statements do not survive
transaction pooling.

**The RLS boundary.** Drizzle connects as `postgres` and bypasses row-level
security. Editorial reads go through Drizzle; user-owned rows (bookmarks,
notes) go through the Supabase client, so RLS is enforced. Using Drizzle on a
user table silently turns RLS into decoration.

**Supabase.** Postgres plus Auth in one service, with mild lock-in (it is
Postgres underneath). New-style keys only (`sb_publishable_…`,
`sb_secret_…`); the legacy JWT keys are deprecated at the end of 2026. The
free tier pauses after about a week idle, which the keep-alive cron prevents,
and has no backups.

**Postgres FTS over a search service.** Enough for a corpus of tens to
hundreds of materials, and one less service. The synonym table is the real
differentiator. Names use the `'simple'` config (English stemming mangles
trade names), descriptions `'english'`; CAS numbers are an exact-match
short-circuit (tokenizers split `54464-57-2` unpredictably); `pg_trgm`
handles typos and prefixes ("galoxolide").

**RDKit.js at seed time.** A 2D drawing is a deterministic function of the
SMILES and the RDKit version, so the seed draws it once and pages inline the
SVG. That keeps the 6.6 MB WebAssembly off every material page; only a
reader-typed SMARTS pattern on `/structure` needs it in the browser.

**Vitest, focused.** Search ranking, normalization, citation handling,
validation and auth-adjacent logic. No component-render or browser tests.

## Deliberately not used

| Tool | Reason |
| --- | --- |
| Playwright / browser E2E | Solo project; the integration suite covers the server side |
| Meilisearch, Typesense, Elasticsearch | Postgres FTS is enough at this size |
| A data cache (Redis, `cacheLife`) | The review gate hides a changed page at once, and `db:review` runs outside Next, where it could not invalidate a cache |
| GraphQL | Server components and server actions are enough |
| Supabase Realtime, Storage | Nothing real-time; structures are drawn, not stored as images |
| Docker, microservices | Vercel and a monolith are right for this |
| NextAuth / Auth.js | Supabase Auth is bundled |
| Storybook | No design-system consumers |
| PWA, native app, i18n | Out of v1 scope |
| pgvector / embeddings, MCP server, UMAP odor map | Deferred; ask before starting ([cheminformatics.md](./cheminformatics.md)) |
