# Perfumers Codex

A curated, citation-driven aromachemical reference for working perfumers.

Checking one material means switching between IFRA Standards, supplier pages, safety data sheets and scent databases. Perfumers Codex aims to put that in one searchable reference. Identity, IFRA usage limits, GHS hazards and landmark uses each cite a source. Olfactive descriptions and usage guidance, as they are written, come from bench experience.

**Status:** in development, behind a pre-launch password gate. Public launch planned for Spring 2027. No material has been reviewed and published yet. As of 2026-09-05 the database held three drafts researched by AI agents from primary sources, with placeholder olfactive families, plus four synthetic test fixtures. All of them stay hidden from readers until the maker reviews them (see the review gate below). No real olfactive descriptions have been written yet.

## What exists today

- **Search:** a Cmd/Ctrl-K palette and a `/search` page. Exact CAS numbers short-circuit to their material. Names, synonyms and trade names match with trigram similarity, which tolerates typos and catches most prefixes. Short prefixes of long names can miss.
- **Material pages:** citations as numbered superscripts that link to their sources, a lazy-loaded 2D structure, structurally similar materials, and computed properties. A clearly labeled experimental odor-prediction module is in place, but no model exists yet.
- **Browsing:** by olfactive family and by structural class (for example macrocyclic ketone or lactone). `/structure` accepts an arbitrary SMARTS pattern.
- **Accounts:** email/password sign-in, bookmarks, private per-material notes, changing email or password, and account deletion. A "Continue with Google" button is built but dormant: until the provider is configured, it shows an "unavailable" notice.
- **Draft privacy policy and terms**, pending review.
- **CI:** typecheck, lint and unit tests on every pull request and every push to `main`.

## Design principles

- **Citations required by the schema.** Material identity, synonyms, IFRA limits, verified IFRA absences, GHS hazards and landmark uses each require a source (`NOT NULL` foreign keys). Olfactive descriptions and usage guidance may be uncited by design.
- **"No IFRA Standard" is its own fact.** A verified absence is a cited row, so the page can tell "checked: no Standard exists" apart from "not yet researched".
- **Amendment-stamped regulatory data.** Each IFRA limit row carries an amendment label and a verification timestamp, and rows for different amendments can sit side by side.
- **Computed values carry provenance, not citations.** Structural classes, similarity scores and computed properties are recomputed from each structure and stamped with the RDKit version that produced them.
- **Model output stays separate.** Odor predictions live in their own table with a model version, render only in the labeled experimental module, and never mix with editorial descriptions.
- **Row-level security on every table.** User-owned data (bookmarks, notes) is only read through the RLS-enforced client. A materialized view cannot carry row-level security, so views are closed to the public Data API by revoking access instead (migration `0007`).
- **Nothing is published unreviewed.** A material reaches readers only after the maker runs `npm run db:review` on it, and only in the exact form reviewed. The seed records a fingerprint of each material's data; a later change hides the material again until it is re-reviewed. Families with no published material are hidden too.
- **Validate before writing.** The seed validates the whole input set before it opens a database connection.

## Known gaps

What is not built or not yet verified:

- **Migrations `0007` and `0008` are written but not yet applied** to the live database. Until 0007 is, the search view (material names and CAS numbers) is likely readable through the public Data API. Until 0008 is applied and this code deployed, the review gate is not in force.
- **Performance is unmeasured.** The search budget is 150 ms p95, but nothing has been measured, and pages render per request with no caching layer.
- **Signed-in flows are unverified end to end.** Bookmarks, notes, and the cleanup of user data on account deletion have not been run with real accounts. Row-level security was probed for anonymous access and forged inserts. Isolation between two real accounts, and the notes UPDATE policy, are not yet verified.
- **No rate limiting anywhere:** sign-up, login, search, note saves, account changes, and the gate's unlock form are all unthrottled.
- **No password reset, no admin dashboard or correction form, and no error monitoring** yet.
- **Search-log retention:** rows are kept indefinitely; the planned purge job is not built.
- **Search tests are database-free.** The ranking tests run on synthetic evidence; there is no end-to-end search test against the real corpus. One gold-set case (an odour phrase) depends on descriptions that do not exist yet, so it cannot pass against the live corpus.
- **The structure–odor experiment is not built.**

## How it's built

Built by one developer working with AI coding agents. [`AGENTS.md`](./AGENTS.md) is the rulebook every session starts from: architecture boundaries, data rules, and what must never be generated. Olfactive descriptions are written only by the maker. Cited facts are researched by agents from primary sources, each one confirmed by two independent checker agents, and are published only after the maker reviews them.

Work is planned in waves ([`docs/waves/`](./docs/waves/)). The wave 3–5 plans were reviewed by a separate agent before implementation. Agents check results against the build output and the database where they can. Items that need a real person are marked done with the caveat recorded, and are tracked in [`docs/maker-todo.md`](./docs/maker-todo.md).

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind CSS v4 + shadcn/ui · Postgres on Supabase · Drizzle ORM · Supabase Auth (`@supabase/ssr`) · Postgres full-text search + pg_trgm · RDKit (WebAssembly) · Vitest · Vercel

Design documents live in [`docs/`](./docs/); start with [`docs/architecture.md`](./docs/architecture.md).

## Development

```bash
npm install
cp .env.example .env.local   # fill in Supabase project values
npm run dev
```

| Script                        | Purpose                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| `npm run dev`                 | Dev server (Turbopack)                                                                     |
| `npm run typecheck`           | TypeScript, no emit                                                                        |
| `npm run lint`                | ESLint                                                                                     |
| `npm run test`                | Vitest unit tests                                                                          |
| `npm run db:generate`         | Generate Drizzle migration from schema                                                     |
| `npm run db:migrate`          | Apply migrations (uses `DIRECT_URL`)                                                       |
| `npm run db:seed -- <dir>`    | Validate and seed a data directory; `--prune` soft-deletes materials absent from the input |
| `npm run db:review -- <slug>` | Publish a reviewed material (`--list` shows status, `--revoke` hides it again)             |
| `npm run db:studio`           | Drizzle Studio against `DIRECT_URL`                                                        |

Note: the app runtime uses the pooled transaction-mode connection (`DATABASE_URL`, port 6543). Migrations use `DIRECT_URL` on port 5432; prefer Supabase's session pooler there, because the true direct host is IPv6-only. Both are required in `.env.local`. `SITE_GATE_PASSWORD` turns on the pre-launch password gate; leave it unset locally — unset means off.

Seeding replaces each material's fact rows with what its data file says, so keep superseded IFRA amendments in the file if their history should stay in the database. `scripts/fixtures` is for empty databases only: it overwrites reference rows such as IFRA category names by id.

## Licensing

- **Code:** [MIT](./LICENSE)
- **Material data published by this project:** [CC BY-SA 4.0](./LICENSE-DATA) — attribute and share-alike. The source dataset lives in a separate `perfumers-codex-data` repository.

## Author

Davis Kim
