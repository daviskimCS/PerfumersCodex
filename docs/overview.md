# Overview and scope

## What it is

A curated, citation-driven aromachemical reference for working perfumers: one
searchable place for the identity, safety data, olfactive character, usage
guidance and landmark uses of the materials used in modern perfumery.

## Why it exists

A perfumer checking one material today keeps five to eight tabs open: IFRA's
Standards, a supplier page, The Good Scents Company, Fragrantica, an SDS PDF.
The information is scattered, often unsourced and often out of date.

What sets this one apart:

- **Citation-driven.** Every cited fact links to its source, and the schema
  refuses a fact row without one.
- **Structure-aware.** 2D structures, structural similarity and substructure
  search: a search axis the free perfumery references lack.
- **Curated, not aggregated.** A small set of deeply cited materials, with
  olfactive descriptions written from bench experience.
- **Open.** MIT code, CC BY-SA data ([licensing.md](./licensing.md)).

## Who it is for

- **Primary:** indie perfumers working with aromachemicals, from serious
  hobbyists to small commercial brands.
- **Secondary:** perfumery students, fragrance writers, newcomers who want a
  trustworthy starting point.

## What it is not

- Not a substitute for the IFRA Standards: it links to them.
- Not a marketplace, supplier directory or perfume-rating site.
- Not comprehensive: quality over coverage.
- Not a formulation log (v2).

## v1 scope and status

| Area                                                                                   | Status                                                              |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Search: names, synonyms, trade names, IUPAC, CAS short-circuit, typo tolerance         | Built                                                               |
| Material pages: identity, safety (IFRA, GHS), olfactive, usage, landmark uses, sources | Built                                                               |
| Browse by olfactive family and by structural class                                     | Built                                                               |
| 2D structures, similar materials, computed properties                                  | Built                                                               |
| Arbitrary SMARTS search (`/structure`)                                                 | Built                                                               |
| Accounts: bookmarks, private notes, export, change email/password, deletion            | Built                                                               |
| Google sign-in                                                                         | Built, dormant until the provider is configured                     |
| Privacy policy and terms                                                               | Drafts awaiting the maker's values                                  |
| Review gate (nothing public until the maker publishes it)                              | Built                                                               |
| Rate limiting on sign-up, sign-in and search                                           | Not built                                                           |
| Structure–odor experiment (labelled, model-versioned predictions)                      | Not built; the table and the labelled module exist                  |
| Admin dashboard, submit-a-correction form                                              | Not built; the tables exist                                         |
| Error monitoring                                                                       | Not built                                                           |
| Analytics                                                                              | Vercel Web Analytics (cookieless, no IPs)                           |
| Corpus                                                                                 | 35–50 materials at launch; launch publishes the first reviewed ones |

## Deferred to v2 (no commitment)

- **Personal layer:** formulation logs, stock tracking, session journal.
- **Community:** trusted contributors, per-material discussion.
- **Discovery:** pairings, accord views; an interactive UMAP odor map
  (stretch goal, ask first).
- **v1.1:** an MCP server exposing the reference to LLM clients; IFRA
  amendment diffing.
- **Later:** embeddings / pgvector retrieval, internationalization, native
  app, a bench companion device.

## Decisions

- **Bookmarks and notes are the only personal features in v1.** Public
  sign-up with nothing to sign up for is pointless; the full personal layer
  would triple the scope and needs a phone-first design.
- **Cheminformatics is in v1.** Similarity, substructure search and
  rendering are deterministic (nothing to hallucinate), absent from the free
  references, and cheap to serve. The structure–odor experiment is the
  opposite bet: a mediocre model is the likely outcome, so the deliverable is
  the published evaluation, not the predictions ([cheminformatics.md](./cheminformatics.md)).
- **Curated, not comprehensive.** Fifty fully cited materials beat five
  hundred shallow ones; coverage can grow after launch.
- **English only.** Shared components avoid hard-coded English where it is
  cheap, but there is no localization pipeline.
