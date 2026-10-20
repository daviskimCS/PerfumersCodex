# Perfumers Codex

A curated, citation-driven aromachemical reference for working perfumers.

Checking one material means switching between IFRA Standards, supplier pages, safety data sheets and scent databases. Perfumers Codex aims to put that in one searchable reference. Identity, IFRA usage limits, GHS hazards and landmark uses each cite a source. Olfactive descriptions and usage guidance, as they are written, come from bench experience.

**Status:** live at [perfumerscodex.com](https://perfumerscodex.com), open to the public since October 2026. The database holds drafts researched by AI agents from primary sources, plus four synthetic test fixtures. Every one stays hidden from readers until the maker reviews it (see the review gate below), and the first real materials are going through that review now.

## What exists today

- **Search:** a Cmd/Ctrl-K palette and a `/search` page. Exact CAS numbers short-circuit to their material. Names, synonyms and trade names match from their first letter, and trigram similarity tolerates typos.
- **Material pages:** citations as numbered superscripts that link to their sources, a 2D structure drawn once at seed time and inlined as SVG (no WebAssembly on the page), structurally similar materials scored by Tanimoto similarity (matches below 0.3 are hidden, and the page says so), and computed properties. Long synonym lists fold away, and the IFRA table stays readable on a phone. A clearly labeled experimental odor-prediction module is in place, but no model exists yet.
- **Browsing:** by olfactive family and by structural class (for example macrocyclic ketone or lactone). `/structure` accepts an arbitrary SMARTS pattern and loads RDKit's WebAssembly build only there.
- **Accounts:** email/password sign-in, password reset, bookmarks, private per-material notes, changing email or password, a self-serve export of everything the account holds (`/account/export`), and account deletion that removes every row the account owns. A "Continue with Google" button is built but dormant: until the provider is configured, it shows an "unavailable" notice.
- **Draft privacy policy and terms**, pending review.
- **Production basics:** security headers on every response, `robots.txt`, and a sitemap that lists published materials only.
- **CI:** typecheck, lint and unit tests on every pull request and every push to `main`, plus an integration job that runs the real account actions against a local Supabase stack.

## Design principles

- **Citations required by the schema.** Material identity, synonyms, IFRA limits, verified IFRA absences, GHS hazards and landmark uses each require a source (`NOT NULL` foreign keys). Olfactive descriptions and usage guidance may be uncited by design.
- **"No IFRA Standard" is its own fact.** A verified absence is a cited row, so the page can tell "checked: no Standard exists" apart from "not yet researched".
- **Amendment-stamped regulatory data.** Each IFRA limit row carries an amendment label and a verification timestamp, and rows for different amendments can sit side by side.
- **Computed values carry provenance, not citations.** Structural classes, similarity scores and computed properties are recomputed from each structure and stamped with the RDKit version that produced them.
- **Model output stays separate.** Odor predictions live in their own table with a model version, render only in the labeled experimental module, and never mix with editorial descriptions.
- **Row-level security on every table.** User-owned data (bookmarks, notes) is only read through the RLS-enforced client. A materialized view cannot carry row-level security, so views are closed to the public Data API by revoking access instead (migration `0007`).
- **Nothing is published unreviewed.** A material reaches readers only after the maker reviews everything its page would show (`npm run db:review show`) and publishes that exact version. Any later change to what the page shows, including shared data such as family names, IFRA category names, hazard statements or a citation, hides it again until it is re-reviewed. Families with no published material are hidden too.
- **Validate before writing.** The seed validates the whole input set before it opens a database connection.

## Known gaps

What is not built or not yet verified:

- **Performance is not measured in production.** The search budget is 150 ms p95. Signed-in page views make fewer Supabase Auth round trips than they did, but pages still render per request with no data cache: a cache could serve a page after the review gate has hidden it, because reviews run outside the Next.js runtime and cannot invalidate it.
- **The browser half of signed-in flows is unverified.** The integration suite proves the server side with real accounts (sign-up through deletion, and two-account isolation for bookmarks and notes), but it runs no browser, so the bookmark button, `/saved` and real Google sign-in are checked by hand only.
- **Rate limiting is partial.** The sign-in, sign-up and password-reset forms carry a Cloudflare Turnstile check and forward each reader's IP to Supabase so its per-IP limits apply per reader, but both stay off until the keys and the Supabase setting are in place. Search has no rate limit in code.
- **No admin dashboard, correction form or error monitoring** yet.
- **Search-log retention:** rows are kept indefinitely; the planned purge job is not built.
- **Search is tested against Postgres on synthetic rows, not the real corpus.** The ranking tests run on synthetic evidence and the integration job runs the search SQL on fixture materials. One gold-set case (the odour phrase "amber wood") depends on description text the live corpus does not contain, so it would not pass against it.
- **The structure–odor experiment is not built.**
- **Similarity scores are not reproducible from the repositories yet.** They arrive precomputed in the data files (three materials so far), produced by a research script that is not committed, and the RDKit version stamp does not record the fingerprint parameters. Computed properties are: the seed derives them from each structure.
- **The review gate has edges.** It lives in app code, so an older deployment pointed at the live database would show unreviewed material. List entries rely on a stored fingerprint that the seed refreshes, so a writer that skips that refresh can leave a list entry stale until the next refresh; detail pages re-check on every request. Structural-class names and descriptions are shown on the class filter and `/structure` without review. The open engineering findings are ranked in [`docs/engineering-backlog.md`](./docs/engineering-backlog.md).

## How it's built

Built by one developer working with AI coding agents. [`AGENTS.md`](./AGENTS.md) is the rulebook every session starts from: architecture boundaries, data rules, and what must never be generated. Olfactive descriptions are written only by the maker. Cited facts are researched by agents from primary sources, each one confirmed by two independent checker agents, and are published only after the maker reviews them.

Work ships as reviewed pull requests with CI green (typecheck, lint, unit and integration tests). Agents check results against the build output and the database where they can; anything only a person can verify is recorded as unverified rather than claimed, and the maker's open items are in [`docs/maker-todo.md`](./docs/maker-todo.md).

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind CSS v4 + shadcn/ui · Postgres on Supabase · Drizzle ORM · Supabase Auth (`@supabase/ssr`) · Postgres full-text search + pg_trgm · RDKit (WebAssembly) · Vitest · Vercel

Design documents live in [`docs/`](./docs/); start with [`docs/architecture.md`](./docs/architecture.md).

## Development

```bash
npm install
cp .env.example .env.local   # fill in Supabase project values
npm run dev
```

| Script                     | Purpose                                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `npm run dev`              | Dev server (Turbopack)                                                                                          |
| `npm run typecheck`        | TypeScript, no emit                                                                                             |
| `npm run lint`             | ESLint                                                                                                          |
| `npm run test`             | Vitest unit tests (no database)                                                                                 |
| `npm run test:integration` | Account and RLS tests against a local Supabase stack; see [`tests/integration/`](./tests/integration/README.md) |
| `npm run db:generate`      | Generate Drizzle migration from schema                                                                          |
| `npm run db:migrate`       | Apply migrations (uses `DIRECT_URL`)                                                                            |
| `npm run db:seed -- <dir>` | Validate and seed a data directory; `--prune` soft-deletes materials absent from the input                      |
| `npm run db:review <verb>` | Review gate: `list`, `show <slug>`, `publish <slug> <fingerprint>`, `revoke <slug>`, `refresh`                  |
| `npm run db:studio`        | Drizzle Studio against `DIRECT_URL`                                                                             |

Note: the app runtime uses the pooled transaction-mode connection (`DATABASE_URL`, port 6543). Migrations use `DIRECT_URL` on port 5432; prefer Supabase's session pooler there, because the true direct host is IPv6-only. Both are required in `.env.local`.

Seeding replaces each material's fact rows with what its data file says, so keep superseded IFRA amendments in the file if their history should stay in the database. `scripts/fixtures` is for empty databases only: it overwrites reference rows such as IFRA category names by id.

## Licensing

- **Code:** [MIT](./LICENSE)
- **Material data published by this project:** [CC BY-SA 4.0](./LICENSE-DATA) — attribute and share-alike. The source dataset lives in a separate `perfumers-codex-data` repository.

Security reports: see [`SECURITY.md`](./SECURITY.md).

## Author

Davis Kim
