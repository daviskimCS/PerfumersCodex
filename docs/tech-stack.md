# Tech Stack

## Locked stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack default) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | Postgres (hosted on Supabase) |
| ORM | Drizzle |
| Auth | Supabase Auth via `@supabase/ssr` (email/password + Google OAuth) |
| Hosting | Vercel (app) + Supabase (DB) |
| Search | Postgres full-text search + synonym table + pg_trgm |
| Cheminformatics (pipeline) | RDKit (Python, in `perfumers-codex-data`) — fingerprints, similarity precompute, computed properties |
| Cheminformatics (client) | RDKit.js (WASM, lazy-loaded) — structure rendering + substructure search |
| ML experiment | scikit-learn + RDKit fingerprints (in `perfumers-codex-data`) — structure→odor classifier + eval |
| Rate limiting | Upstash Redis via Vercel Marketplace (`@upstash/ratelimit`) |
| Transactional email | Resend SMTP (custom domain) wired into Supabase Auth before launch |
| Testing | Vitest (unit, focused on core logic) |
| CI | GitHub Actions (typecheck + tests) |
| Data ingestion | Python scripts in separate repo, output JSON |
| Error tracking | Sentry (added at launch) |
| Analytics | Plausible, $9/mo (added at launch) |

> **Updated June 2026** after a currency review: Next.js 14 → 16, Tailwind v3 → v4, Vercel KV → Upstash (Vercel KV was discontinued Dec 2024), Supabase auth-helpers → `@supabase/ssr`, and Resend pulled forward from v1.1 to pre-launch (see Supabase section below).

> **Updated August 2026:** cheminformatics (RDKit / RDKit.js) and the structure–odor experiment added to v1 scope — see [scope.md](./scope.md) and [cheminformatics.md](./cheminformatics.md). Embeddings/pgvector, an MCP server, and the UMAP odor map are explicitly deferred (table below).

## Reasoning by choice

### Next.js 16 (App Router)
Already familiar to the maker, and the modal stack at modern startups in 2026. Server components + streaming + built-in routing make it the right choice for a content-heavy reference app. As of June 2026 the current stable is Next.js 16.2 (LTS): Turbopack is the default for dev and build, React 19 with the React Compiler is stable, and `cacheLife`/`cacheTag` are stable — target 16 from day one, do not start on 14/15.

**Push:** App Router has a real learning curve if previously only used Pages Router, and the caching model changed meaningfully in 15/16. Budget 5–10 hrs of focused docs reading on *current* docs — older App Router tutorials (2023–2024) will actively mislead on caching and route handlers.

### TypeScript strict mode
Non-negotiable. Eliminates entire bug categories. Required for the project's quality bar.

### Tailwind v4 + shadcn/ui
Maker is familiar. Tailwind handles utilities, shadcn provides primitives that get copied into the codebase (no dependency, you own the code). Fastest path to polished UI without sacrificing quality. Tailwind v4 is CSS-first: design tokens live in `globals.css` under the `@theme` directive (no `tailwind.config.js` by default), and shadcn's CLI fully supports v4 + React 19 with OKLCH color variables. This actually fits the "own your design tokens" push below better than v3 did.

**Push:** "shadcn-overload" is a real failure mode where every project ends up looking the same. Customize the design tokens (typography scale, color palette, spacing) in `@theme` so it feels like *this* app, not a default shadcn site. Note older Tailwind tutorials describe the v3 JS-config world — use current docs.

### Postgres + Drizzle
Postgres because the data model is highly relational (materials, families, citations, usage limits per category, synonyms). Drizzle over Prisma because it stays closer to SQL — better for learning, slightly better at scale, the direction the ecosystem is heading.

**Push:** Drizzle has a steeper start than Prisma if SQL isn't already comfortable. Worth the investment.

**Trap (connection strings):** Supabase exposes a *direct* connection (port 5432) and a *pooled* one (port 6543, transaction mode). Run `drizzle-kit` migrations against the direct connection; run the app against the pooled one with `prepare: false` (prepared statements don't survive transaction-mode pooling). Getting this wrong is the classic Week 1 time sink.

**Boundary rule (RLS):** Drizzle connects as the `postgres` role and **bypasses RLS entirely**. So: editorial/public reads go through Drizzle; user-owned data (bookmarks, notes) goes through the Supabase client so RLS is actually enforced. Never read/write user tables through Drizzle in route handlers — it silently turns RLS into decoration. This rule goes in CLAUDE.md.

### Supabase
Bundles Postgres + Auth + Storage + Realtime. Pays for the integration tax up front. Lock-in is mild — Supabase is just Postgres under the hood, so leaving is possible if needed.

**Push:** Don't let Supabase's helpers obscure SQL. Understand the queries, even when using their wrappers.

**Currency notes (June 2026):**
- Auth integration uses `@supabase/ssr` (browser client + server client + token-refresh middleware). The old `auth-helpers` packages are deprecated — never mix the two.
- Use the new API keys (`sb_publishable_...` / `sb_secret_...`) from day one; legacy `anon`/`service_role` JWT keys are deprecated end of 2026.
- **Email gotcha:** Supabase's built-in auth email sender is rate-limited to a handful of emails per hour — fine for solo dev, fatal on launch day when strangers sign up. Wire Resend SMTP (free tier: 3k emails/mo) with the custom domain into Supabase Auth during Phase 4, not v1.1 as originally planned.
- **Free-tier pause:** free projects pause after ~7 days of inactivity. Fine during the build; upgrade to Pro (~$25/mo) at launch for no-pause reliability and daily backups. Budget decision: accepted (June 2026).
- **Region:** pick the Supabase region to match the Vercel function region at project creation (region is effectively permanent). The <150ms search budget dies if every query crosses the country.

### Vercel
Built for Next.js. `git push` to deploy. Free tier covers initial users. Will likely cost ~$20/month after launch as traffic grows — budget for it. Set the function region to match the Supabase region (see above).

### Postgres FTS (full-text search)
Sufficient for v1 dataset size. Avoids adding Meilisearch/Typesense as a separate service to manage. Synonym table handles the perfumer-friendly aliasing (CAS numbers, IUPAC names, trade names) which is the actual differentiator.

Three implementation notes (details in [database-schema.md](./database-schema.md)):
- Use the `'simple'` FTS config for names/synonyms (English stemming mangles trade names like "Hedione"), `'english'` only for descriptions.
- CAS numbers are an exact-match short-circuit in `lib/search.ts`, not an FTS concern — tsvector tokenizes `54464-57-2` unreliably.
- Add `pg_trgm` (one `CREATE EXTENSION` on Supabase) for prefix and typo matching — perfumery names get misspelled constantly ("galaxolide"/"galoxolide"), and FTS alone can't serve ranking rule 3.

### Vitest, focused
Test the parts that benefit from tests: search logic, synonym resolution, data normalization, citation handling. Skip tests for trivial CRUD, plain component renders, and other low-value targets. 30–50 focused tests beats 200 shallow ones.

### Python (separate repo) for data ingestion
Python's data tooling (pdfplumber, BeautifulSoup, pandas, pydantic) is significantly better than JS for parsing SDS PDFs and PubChem responses. Separating ingestion from the app is the correct architecture.

### RDKit + RDKit.js (added August 2026)
RDKit (free, mature) does the heavy lifting in the Python data repo: Morgan/ECFP fingerprints, Tanimoto similarity (precomputed top-N per material at seed time), and computed properties — every computed row stamped with the RDKit version. RDKit.js compiles the same core to WASM, so 2D structure rendering and substructure filtering run entirely client-side: zero server cost at this corpus size, and deterministic besides.

**Push:** the RDKit.js WASM bundle is heavy (multiple MB). Lazy-load it on the pages that need it and keep it out of the critical path, or the Lighthouse >90 budget dies.

### Structure–odor experiment tooling (added August 2026)
Plain scikit-learn on RDKit fingerprints, in the data repo. Deliberately boring tooling — the value is the evaluation discipline (held-out gold set, per-descriptor metrics, honest failure analysis), not model novelty. Training data (Leffingwell / GoodScents-derived public sets) stays in the experiment repo under its own licenses.

### Structured extraction in the data pipeline (added August 2026)
The pipeline may use an LLM with structured output / constrained decoding to parse unstructured source text (SDS PDFs, supplier pages) into schema-valid JSON. Every extracted record is human-reviewed against the source before commit — extraction assists data entry; it never replaces verification and never writes editorial content.

## Explicitly dropped / deferred

| Tool | Reason |
|---|---|
| Playwright (E2E tests) | Solo project, manual testing covers it for v1; saves ~10 hrs |
| Meilisearch / Typesense | Postgres FTS is enough for the dataset size |
| Supabase Realtime | Reference app doesn't need real-time |
| Image storage (Supabase Storage) | Hotlinking PubChem images with attribution avoids it entirely |
| ElasticSearch | Operationally heavy, overkill |
| MongoDB / document stores | Data is highly relational |
| GraphQL | REST + Next.js server actions are simpler and sufficient |
| Redis / caching layer | Postgres handles read load at this scale (Upstash Redis is used *only* for rate limiting — it is not a cache) |
| Docker / containerization | Vercel handles this |
| Microservices | Monolith is correct |
| NextAuth / Auth.js | Historically painful to debug; Supabase Auth is bundled |
| Storybook | Solo project, no design-system consumers |
| Internationalization | English-only in v1 |
| PWA / mobile app | Responsive web is enough |
| pgvector / embeddings retrieval | Deferred — FTS + pg_trgm + synonyms covers a ~50-material corpus; revisit when it doesn't |
| MCP server | v1.1 — cheap and worth doing, but after launch |
| UMAP odor map | Stretch goal at launch, otherwise first post-launch feature |

## Boring quality essentials (these stay)

- TypeScript strict mode
- ESLint + Prettier configured
- Database constraints (NOT NULL, FK, CHECK) liberally applied
- Drizzle migrations (no ad-hoc DB edits)
- Structured logging on API routes
- Real README with architecture diagram
- Privacy policy + terms of service
- Open Graph tags + favicon + metadata
- Lighthouse score >90 on key pages
- Color contrast audit (Chrome DevTools)
- Mobile responsive on real devices
- Empty / loading / error states on every page
