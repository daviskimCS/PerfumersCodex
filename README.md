# Perfumers Codex

A curated, citation-driven aromachemical reference for working perfumers.

One searchable, cited, modern source of truth for the safety data, olfactive
properties, usage guidance, and landmark uses of the materials used in modern
perfumery — built by a working perfumer, for working perfumers.

**Status:** pre-flight (Phase 0). Nothing to see yet — v1 targets 35–50
hand-curated materials, real search (names, synonyms, CAS numbers), and a
light personal layer (bookmarks + private notes).

Soon at [perfumerscodex.com](https://perfumerscodex.com).

## Principles

- **Citation-driven.** Every fact links to its source — enforced at the
  schema level, not by convention.
- **Curated, not aggregated.** Hand-selected materials, descriptions written
  from experience. Quality over coverage.
- **Open.** Code is MIT-licensed; material data is CC BY-SA 4.0.

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind CSS v4 + shadcn/ui ·
Postgres on Supabase · Drizzle ORM · Supabase Auth · Vercel

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## License

- **Code:** [MIT](./LICENSE)
- **Material data:** [CC BY-SA 4.0](./LICENSE-DATA) — attribute and
  share-alike
