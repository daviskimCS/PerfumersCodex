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
- **3D model ("View in 3D").** The seed computes one low-energy conformer per
  material in Node with OpenChemLib (`scripts/conformer.ts`: up to 20
  candidates from its torsion database with a fixed seed, each minimised with
  MMFF94s+, lowest energy kept, explicit hydrogens, turned broadside to the
  reader) and stores the molfile in `material_conformers` with its
  `openchemlib_version`. Every stereocentre and double bond the SMILES
  specifies is read back from the 3D coordinates and compared before the
  model is stored, so it can never show the wrong isomer. A stored conformer is
  kept, not recomputed, while its SMILES, toolkit version and method are
  unchanged, so a Node upgrade cannot move a coordinate and hide a reviewed
  page. Macrocycles (a ring of 12 or more atoms, such as Civetone) and
  molecules with more than five rotatable bonds get no model: one shape of a
  floppy molecule would mislead, so their pages show no button. The page
  loads 3Dmol.js only when the reader presses the button and labels the model
  "one computed low-energy shape, not the only one". OpenChemLib is a
  development dependency of the seed and never reaches a browser.
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
- **Volatility map.** `/volatility` plots every published material with a
  structure by molecular weight (cited, from the identity record) against
  computed logP: a server-rendered SVG, no chart library, no script, with a
  table of the same points. The copy calls it a proxy for top, heart and
  base, not a measurement. Each plotted value is already in its own
  material's reviewed record, so the page adds no fingerprint field; for the
  same reason it is linked from a material page (`?highlight=<slug>`), never
  embedded in one.

## Provenance

Computed values carry the RDKit version that produced them instead of a
citation: they are deterministic recomputations, not cited facts.

Computed properties (Crippen logP, TPSA, heavy atoms) are derived by the
seed for every material with a SMILES (`scripts/properties.ts`), from the same
RDKit load that classifies and draws. logP is rounded to four places and TPSA
to two, which reproduces exactly the values the old research script wrote for
Iso E Super, Javanol and Civetone, so a re-seed leaves their reviewed
fingerprints unchanged (`scripts/properties.test.ts` holds that). A data file
may still carry a `computed_properties` block; the seed refuses one that
disagrees with what it computes.

Similarity still arrives precomputed in the data files; the seed only writes
it. It was produced with RDKit.js 2025.03.4 in Node (Tanimoto over folded
2048-bit Morgan fingerprints) by a research script that is **not in either
repository**, and only Iso E Super, Javanol and Civetone have it so far. The version stamp
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
