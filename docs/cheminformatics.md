# Cheminformatics and the structure–odor experiment

Every discrete-molecule material carries a SMILES string from PubChem.
Naturals are mixtures and carry none, and every feature below skips a
NULL-SMILES material rather than erroring.

## What is built

- **2D structures.** The seed draws each structure with RDKit.js in Node
  (`scripts/draw.ts`), stores the SVG in `material_structure_drawings` with
  its `rdkit_version`, and the material page inlines it in the server render.
  Readers never download the 6.6 MB WebAssembly to see a picture that only
  changes when the seed runs.
- **Structural classes.** "Ester", "macrocyclic ketone", "contains a lactone
  ring". Each class is a SMARTS pattern in the data repo's
  `chemical-classes.json`; the seed computes membership
  (`scripts/classify.ts`) into `material_chemical_classes`, stamped with
  `rdkit_version`. Browsing is a SQL filter on `/materials?class=…`: server
  rendered, shareable, works without scripting, composes with `?family=`.
  Membership is derived, never authored, so a data file cannot claim a class
  its structure does not support. Two measured traps: an empty pattern
  compiles to a valid query that matches nothing, so validation rejects it;
  ring-size queries (`[r{12-}]`) do work in RDKit.js, which is what makes
  "macrocyclic" expressible.
- **Arbitrary SMARTS search.** `/structure` lazy-loads RDKit.js in the
  browser for a pattern the reader types, the one case that cannot be
  precomputed. Without scripting or the WebAssembly it falls back to the
  precomputed class links.
- **Similar materials and computed properties.** Tanimoto similarity over
  Morgan fingerprints, and logP, TPSA and heavy-atom count as
  volatility-adjacent context (never presented as measured fact). The page
  hides matches below 0.3 as noise and says so.

## Provenance

Computed values carry the RDKit version that produced them instead of a
citation: they are deterministic recomputations, not cited facts.

Similarity and computed properties arrive precomputed in the data files; the
seed only writes them. They were produced with RDKit.js 2025.03.4 in Node
(Crippen logP, TPSA, heavy atoms, Tanimoto over folded 2048-bit Morgan
fingerprints) by a research script that is **not in either repository**, and
only Iso E Super, Javanol and Civetone have them so far. The version stamp
alone does not record fingerprint parameters, so a regeneration with
different settings would produce different numbers under the same stamp. The
fix, when this is rebuilt: commit the script and record the fingerprint
parameters beside `rdkit_version`.

## Structure–odor experiment (not built)

A fingerprint → odor-descriptor classifier trained on public labelled
datasets (Leffingwell, GoodScents-derived), whose licences must be reviewed
before use and which are never redistributed as project data.

The deliverable is the evaluation, not the model: olfaction is the hardest
modality in ML, the datasets are small and noisy, and structure–odor cliffs
are real, so a mediocre model is the likely outcome.

- Held-out split first; per-descriptor AUROC/F1, not one flattering
  aggregate; a written failure analysis.
- Predictions go in `odor_predictions` with a `model_version` and render only
  in the clearly labelled experimental module
  (`components/material/odor-predictions.tsx`, already built, showing nothing
  until rows exist), never mixed with `material_descriptions`.

## Evaluation discipline

Search is held to the same standard: a gold set of query → expected-material
pairs (`lib/search/gold-set.ts`) asserted in Vitest, and zero-result
production queries feed it.

## Deferred

| Item                                                         | When                                              |
| ------------------------------------------------------------ | ------------------------------------------------- |
| Interactive odor map (UMAP over fingerprints or descriptors) | Stretch goal; ask first                           |
| MCP server exposing the reference to LLM clients             | v1.1                                              |
| IFRA amendment diffing                                       | v1.1, with the 52nd Amendment re-verification     |
| Embeddings / pgvector retrieval                              | When the corpus outgrows FTS + trigram + synonyms |
