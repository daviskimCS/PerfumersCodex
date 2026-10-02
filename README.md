# Perfumers Codex

A curated, citation-driven aromachemical reference for working perfumers.

Checking one material means switching between IFRA Standards, supplier pages, safety data sheets and scent databases. Perfumers Codex aims to put that in one searchable reference where every safety fact is cited: identity, IFRA usage limits, GHS hazards, and, as they are written, olfactive descriptions, usage guidance and landmark uses.

**Status:** in development, behind a pre-launch password gate. Public launch planned for Spring 2027. The database holds three researched materials awaiting editorial review, alongside four synthetic test fixtures. No olfactive descriptions have been written yet.

## What exists today

- **Search:** a Cmd/Ctrl-K palette and a `/search` page, covering names, synonyms and trade names, exact CAS numbers, and typo-tolerant prefixes.
- **Material pages:** citations render as numbered superscripts that link to their sources, and a lazy-loaded 2D structure renders client-side.
- **Browsing:** by olfactive family and by structural class (for example macrocyclic ketone or lactone); `/structure` accepts an arbitrary SMARTS pattern.
- **Accounts:** email/password sign-in, bookmarks, private per-material notes, and account deletion. Google sign-in is built but switched off until the provider is configured.
- **Draft privacy policy and terms**, pending review.

## Design principles

- **Cited where it matters, enforced by the schema.** Material identity, synonyms, IFRA limits, verified IFRA absences, GHS hazards and landmark uses each require a source (`NOT NULL` foreign keys). Olfactive descriptions and usage guidance may be uncited by design: they are written from bench experience.
- **"No IFRA Standard" is its own fact.** A verified absence is a cited row, so the page can tell "checked: no Standard exists" apart from "not yet researched".
- **Amendment-stamped regulatory data.** Each IFRA limit records the amendment and the date it was verified against, and limits from different amendments can sit side by side.
- **Computed values carry provenance, not citations.** Structural classes are computed from each structure at seed time and stamped with the RDKit version that produced them.
- **Model output stays separate.** Any future odor prediction lives in its own table with a model version, renders only in a labeled experimental module, and never mixes with editorial descriptions.
- **Deny by default.** Row-level security is enabled on every table. User-owned data (bookmarks, notes) is only read through the RLS-enforced client.

## Known gaps

What is not built or not yet verified:

- **Performance is unmeasured.** The search budget is 150 ms p95, but nothing has been measured yet, and pages are rendered per request with no caching layer.
- **Signed-in flows are unverified end to end.** Bookmarks, notes, and the cleanup of user data on account deletion have not been verified with real accounts. Row-level security was checked with database-level probes.
- **No rate limiting** yet on sign-up, login or search.
- **Search tests are database-free.** The ranking tests run on synthetic evidence; there is no end-to-end search test against the real corpus yet.
- **The structure–odor experiment is not built.**

## How it's built

Built by one developer working with AI coding agents. [`AGENTS.md`](./AGENTS.md) is the rulebook every session starts from: architecture boundaries, data rules, and what must never be generated (olfactive descriptions and cited safety data are human work). Work is planned in waves ([`docs/waves/`](./docs/waves/)). The wave 3–5 plans were reviewed by a separate agent before implementation, and results are checked against the build output and the database before they are marked done. Anything only a person can verify is tracked in [`docs/maker-todo.md`](./docs/maker-todo.md) rather than assumed.

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind CSS v4 + shadcn/ui · Postgres on Supabase · Drizzle ORM · Supabase Auth (`@supabase/ssr`) · Postgres full-text search + pg_trgm · RDKit (WebAssembly) · Vitest · Vercel

Design documents live in [`docs/`](./docs/); start with [`docs/architecture.md`](./docs/architecture.md).

## Development

```bash
npm install
cp .env.example .env.local   # fill in Supabase project values
npm run dev
```

| Script                     | Purpose                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `npm run dev`              | Dev server (Turbopack)                                                                     |
| `npm run typecheck`        | TypeScript, no emit                                                                        |
| `npm run lint`             | ESLint                                                                                     |
| `npm run test`             | Vitest unit tests                                                                          |
| `npm run db:generate`      | Generate Drizzle migration from schema                                                     |
| `npm run db:migrate`       | Apply migrations (uses `DIRECT_URL`)                                                       |
| `npm run db:seed -- <dir>` | Validate and seed a data directory; `--prune` soft-deletes materials absent from the input |
| `npm run db:studio`        | Drizzle Studio against the direct connection                                               |

Note: the app runtime uses the pooled connection (`DATABASE_URL`, port 6543); migrations use the direct connection (`DIRECT_URL`, port 5432). Both are required in `.env.local`. `SITE_GATE_PASSWORD` turns on the pre-launch password gate; leave it unset locally — unset means off.

Seeding replaces each material's fact rows with what its data file says, so keep superseded IFRA amendments in the file if their history should stay in the database.

## Licensing

- **Code:** [MIT](./LICENSE)
- **Material data:** [CC BY-SA 4.0](./LICENSE-DATA) — attribute and share-alike

## Author

Davis Kim
