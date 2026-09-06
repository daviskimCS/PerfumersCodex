# Perfumers Codex

A curated, citation-driven aromachemical reference for working perfumers.

Working perfumers typically keep 5–8 tabs open during a formulation session — IFRA standards, supplier pages, SDS PDFs, scent databases. Perfumers Codex consolidates that into one searchable, cited, modern reference: safety data, olfactive properties, usage guidance, and landmark uses for the materials of modern perfumery.

**Status:** in development. Public launch planned for Spring 2027.

## Principles

- **Citation-driven.** Every fact-bearing row links to a primary source — enforced at the database schema level, not by convention.
- **Curated, not aggregated.** Hand-selected materials, descriptions written from bench experience. Quality over coverage.
- **Versioned regulatory data.** IFRA limits are stamped with the amendment they were verified against and never overwritten.
- **Open.** MIT-licensed code, CC BY-SA 4.0 data.

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind CSS v4 + shadcn/ui · Postgres on Supabase · Drizzle ORM · Supabase Auth (`@supabase/ssr`) · Postgres full-text search + pg_trgm · Vitest · Vercel

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

## Licensing

- **Code:** [MIT](./LICENSE)
- **Material data:** [CC BY-SA 4.0](./LICENSE-DATA) — attribute and share-alike

## Author

Davis Kim — built by a working perfumer, for working perfumers.
