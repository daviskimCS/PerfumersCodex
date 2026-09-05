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
  "contains a lactone ring." Runs client-side in RDKit.js (WASM) over the
  corpus's SMILES — zero server cost, instant at this corpus size.
- **Computed properties.** logP, TPSA, heavy-atom count — volatility-adjacent
  context (loose correlates of top/heart/base behavior), never presented as
  measured fact. Stamped with the RDKit version that produced them.
- **2D structure rendering.** Table stakes for a chemical reference. Rendered
  client-side from SMILES via RDKit.js, replacing hotlinked images as the
  primary structure display.

Split of labor: RDKit (Python) computes in `perfumers-codex-data`; RDKit.js
renders and filters in the browser. The WASM bundle is heavy — it is
lazy-loaded and kept out of the critical path (Lighthouse >90 stands).

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
