# Scope: V1 vs V2

## V1 — what ships at launch (Month 6)

> **Status 2026-09-05.** Built and live behind the pre-launch gate: search,
> material detail, browse, families, bookmarks, notes, account management,
> Google sign-in (dormant until configured), share cards, the seed pipeline.
> Not yet built from the list below: the substructure / chemical-class
> filter, the structure–odor experiment, the admin dashboard, the correction
> form, privacy/terms pages, the blog, rate limiting, Sentry. Tracked as
> Phase 4 in [CHECKLIST.md](./CHECKLIST.md).

### Public, anonymous browsing

- Search by name, synonym, CAS number, IUPAC name
- Material detail pages with: hero, safety, olfactive, usage, sources tabs
- Browse by olfactive family
- Citations on every fact, linked to original source

### Cheminformatics (added August 2026)

- 2D structure rendering on every discrete-molecule material page (client-side via RDKit.js/WASM; naturals are mixtures and show none)
- "Structurally similar materials" module — Morgan/ECFP fingerprints + Tanimoto similarity, precomputed in the data pipeline
- Substructure / chemical-class filtering ("all esters", "macrocyclic musks", "contains a lactone ring") — client-side over the corpus's SMILES
- Computed properties (logP, TPSA, heavy atoms) as volatility-adjacent context, stamped with the RDKit version

### Structure–odor experiment (added August 2026)

- Fingerprint → odor-descriptor classifier trained on public labeled datasets, with a published, honest evaluation write-up (where it works, where it fails, the activity cliffs it can't cross)
- Predictions surfaced on material pages as a clearly-labeled experimental module (model version shown), always separate from the human-written descriptions
- Framed as an experiment with published metrics, not a product feature

### Authenticated features (signup required)

- Bookmark materials ("save")
- Private free-text notes per material
- Account management (change email/password, delete account)

### Admin/internal

- Private admin dashboard at `/admin` (locked to maker's email): signup count, search count, top searches, error rate
- Submit-a-correction form for users to suggest data fixes (editorial-controlled review by maker)

### Operational

- Public GitHub repo
- Custom .com domain, HTTPS
- Privacy policy, terms of service
- Sentry error tracking (added at launch); Vercel Web Analytics (shipped Aug 2026 — Plausible is the fallback, see tech-stack.md)
- 35–50 hand-curated materials

## V2 — deferred features (post-launch, no commitment yet)

### Personal layer (the major v2 push)

- Stock/inventory tracking (what materials you own, where bought, current quantity)
- Formulation logs (recipes, ratios, dates, smell-test notes)
- Session journal (free-form notes from perfumery sessions, linkable to materials)
- Use-by-date tracking and rotation reminders

### Community layer

- Trusted-contributor system with tiered edit permissions
- Public discussion threads per material (carefully moderated)
- User-submitted "I've used this in:" entries

### Discovery

- Recommended pairings ("materials that work well with X")
- Family/accord exploration views
- "Smell-alike" comparisons

### Deferred additions (August 2026)

- Interactive odor map — UMAP projection of materials by fingerprint or descriptor vector, zoomable, clustered. Stretch goal at launch, otherwise the first post-launch feature (highest demo-value-per-hour on the roadmap)
- MCP server exposing the reference as queryable tools for LLM clients (v1.1) — turns the site into infrastructure other things call
- IFRA amendment diffing — what changed between amendments, which materials are affected (v1.1; pairs with the 52nd Amendment re-verification pass)
- Embeddings / pgvector hybrid retrieval — deferred until the corpus outgrows FTS + trigram + synonyms

### Optional embedded companion (originally Part 2, dropped from v1)

- Bench device that lights up the corresponding bottle when a material is opened on the laptop
- Defer until v1 is shipped and proves out — may never happen, that's fine

## Decisions and reasoning

### Why personal layer is partly in v1 (bookmarks + notes only)

Originally personal layer was fully v2. Pulled forward to a _minimal_ form because public signup with no logged-in value is meaningless. Bookmarks + notes is the lightest possible "reason to sign up" without triggering the v2 scope explosion.

Full personal layer (formulation logs, stock, session journal) stays v2 because:

- Triples v1 implementation scope (per-user data shapes, sync, mobile-first entry, privacy auditing)
- Mobile UX matters much more for those features (perfumer at the bench with phone, not laptop)
- Better to ship the public reference well than the personal app poorly

### Why no embedded companion in v1

Originally pitched as a "Part 2" satellite device. Dropped because:

- Maker chose "polished software over all"
- Splitting attention between web app polish and a hardware project would compromise both
- Can be added as a separate small project later if desired

### Why cheminformatics is in v1 (August 2026)

Structure similarity, substructure search, and rendering are deterministic (no hallucination surface), genuinely absent from the free perfumery references, and cheap to serve — RDKit.js runs client-side, similarity is precomputed at seed time. The structure–odor experiment is the opposite bet: olfaction is the hardest modality in ML, the public datasets are small and noisily labeled, and structure–odor cliffs are real, so a mediocre model is the likely outcome. It ships anyway because the deliverable is the _evaluation_ — published metrics and an honest failure analysis. Both are committed for the v1 release.

### Why curated, not comprehensive

50 materials hand-curated with full citations beats 500 materials with shallow data. Quality is the differentiator. Coverage can grow forever after launch.

### Why English-only

Adding i18n triples copywriting work and adds significant engineering complexity. Most of the international perfumery community reads English. English-only doesn't preclude i18n later — designs should not depend on hardcoded English in shared components, but no localization pipeline in v1.
