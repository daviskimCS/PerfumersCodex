# Cheminformatics & ML

Added to v1 scope August 2026. Two committed release features, the evaluation
discipline behind them, and an explicitly-deferred tail. Priority order is by
expected reward, and the first two are non-negotiable for the v1 release.

## 1. Cheminformatics (RDKit) — committed for v1

Every discrete-molecule material carries a SMILES string (from PubChem;
naturals are mixtures and carry none). RDKit — free, mature, deterministic —
turns that into a search axis no free perfumery reference has:

- **Structural similarity.** Morgan/ECFP fingerprints → Tanimoto similarity →
  "structurally similar materials" on every material page. Precomputed top-N
  in the data pipeline at seed time; served as plain rows.
- **Substructure / class search.** "All esters," "macrocyclic musks,"
  "contains a lactone ring." **Split in two, 2026-09-05** (P4-D). The fixed
  class list is _precomputed at seed time_ into `material_chemical_classes`
  and filtered in SQL at `/materials?class=…`; only arbitrary SMARTS queries
  run client-side in RDKit.js (WASM), on `/structure`.

  This revises the original "runs client-side over the corpus's SMILES".
  Browsing "all macrocyclic musks" is the common path, and as rows it is
  server-rendered, paginated, shareable, crawlable, works with scripting off,
  and composes with the family filter — everything `/materials` already is
  and would have forfeited. No reader should download 6.6 MB of WebAssembly
  to see a list of names. Membership is also exactly the kind of value this
  project already governs: a deterministic recomputation, so it is stamped
  with `rdkit_version` and carries no citation, beside computed properties
  and similarity. An arbitrary pattern genuinely cannot be precomputed, so
  that — and only that — pays for the WASM, and when it fails to load the
  page falls back to the precomputed class links rather than to nothing.

  The class SMARTS live in `chemical-classes.json` and are validated by
  compiling them before any write. Two traps, both measured: an empty pattern
  compiles to a _valid_ query that matches nothing, so it would define a
  permanently empty class rather than failing loudly; and ring-size queries
  (`[r{12-}]`) do work in RDKit.js, which is what makes "macrocyclic"
  expressible at all.

- **Computed properties.** logP, TPSA, heavy-atom count — volatility-adjacent
  context (loose correlates of top/heart/base behavior), never presented as
  measured fact. Stamped with the RDKit version that produced them.
- **2D structure rendering.** Table stakes for a chemical reference. Rendered
  client-side from SMILES via RDKit.js, replacing hotlinked images as the
  primary structure display.

Split of labor: RDKit (Python) computes in `perfumers-codex-data`; RDKit.js
renders and filters in the browser. The WASM bundle is heavy — it is
lazy-loaded and kept out of the critical path (Lighthouse >90 stands).

The first three cited drafts (2026-09-05) were computed with RDKit.js
2025.03.4 in Node as a stopgap — Crippen logP, TPSA, heavy atoms, and
Tanimoto over folded 2048-bit Morgan fingerprints. When the Python pipeline
exists, regenerate from it and record the fingerprint parameters beside
`rdkit_version`; the version stamp alone does not distinguish two fingerprint
configurations.

## 2. Structure–odor experiment — committed for v1

A fingerprint → odor-descriptor classifier, trained on public labeled
datasets (Leffingwell, GoodScents-derived; kept under their own licenses in
the experiment repo), predicting odor character from structure.

Honesty is the design constraint. Olfaction is the hardest modality in ML:
the public datasets are small and noisily labeled, and structure–odor cliffs
are real — near-identical molecules can smell completely different. A
mediocre model is the likely outcome, and that is fine, because the
deliverable is the evaluation:

- **Published metrics** on a held-out set — per-descriptor scores, not one
  flattering aggregate.
- **A failure analysis** — where it fails and why, including the activity
  cliffs it cannot cross.
- **Labeled predictions in the app** — an "experimental" module on material
  pages showing predicted descriptors with the model version, always separate
  from the human-written description (schema-enforced: `odor_predictions`
  vs. `material_descriptions`). Where a human description exists, the
  side-by-side _is_ the demo of honest evaluation.

This is an experiment with published metrics, not a product feature, and it
is framed that way everywhere it appears.

## Evaluation methodology (applies project-wide)

The same discipline backs both search and the experiment:

- **Search:** a curated gold set of query → expected-material pairs (trade
  names, CAS numbers, abbreviations, misspellings like "galoxolide"),
  measured as recall@k and expected-rank assertions in Vitest. Zero-result
  production queries feed the gold set.
- **Structure–odor:** held-out split before anything else, per-descriptor
  AUROC/F1, and a written error analysis. No metric, no claim.

## Deferred (in priority order)

| Item                                                            | Status                                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Interactive odor map (UMAP over fingerprints/descriptors)       | Stretch at launch, else first post-launch feature — highest demo-value-per-hour |
| MCP server — the reference as queryable tools for LLM clients   | v1.1                                                                            |
| IFRA amendment diffing (what changed, which materials affected) | v1.1 — pairs with the 52nd Amendment re-verification                            |
| Embeddings / pgvector hybrid retrieval                          | When the corpus outgrows FTS + trigram + synonyms                               |

Synonym and name resolution — arguably the actual hard problem — is not on
this list because it is already core v1 scope: canonical IDs, the
`material_synonyms` alias table, and pg_trgm fuzzy matching.
