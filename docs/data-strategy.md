# Data strategy

The curated, cited dataset is the project; the code is replaceable.

## Principles

- **Quality over coverage.** Fifty deeply cited materials beat five hundred
  shallow ones.
- **Every fact row has a source.** Identity, synonyms, IFRA limits, verified
  IFRA absences, GHS hazards and landmark uses each require a `source_id`
  (`NOT NULL` in the schema).
- **Olfactive descriptions are the maker's own,** written from bench
  experience. They may be uncited; they are never generated.
- **Regulatory data is versioned.** IFRA rows carry their amendment and a
  verification time, and a new amendment adds rows beside the old ones.
- **Nothing reaches readers unreviewed.** The maker publishes each material
  page through the review gate ([database-schema.md](./database-schema.md)).

## How material data is produced

Material files live in the separate data repository (`PerfumersCodexData`):
one JSON file per material, validated by `lib/validation/material-data.ts`,
plus a dossier recording every fact with its URL and a verbatim quote.

Cited facts are researched by AI agents from primary sources. Each fact is
then re-fetched by two independent checker agents told to refute it; a fact
is stored only if both confirm it, and dropped facts are recorded in the
dossier with the reasons. Nothing comes from model memory. The maker then
reviews the rendered page and publishes it. How facts are represented (one
CAS for an isomer mixture, majority GHS classifications only, and so on) is
the data repo's `DATA-DECISIONS.md`.

## Data layers

| Layer                                                | Source                                  | Treatment                                             |
| ---------------------------------------------------- | --------------------------------------- | ----------------------------------------------------- |
| Identity (CAS, IUPAC, formula, weight, SMILES)       | PubChem, registries, manufacturers      | Cited, one identity source per material               |
| Computed (drawings, classes, similarity, properties) | RDKit                                   | Recomputed, stamped with `rdkit_version`, no citation |
| Regulatory (IFRA, GHS)                               | IFRA Standards, ECHA, SDSs              | Facts entered and linked, never republished verbatim  |
| Olfactive (description, families, facets)            | The maker                               | Original writing                                      |
| Landmark uses                                        | Interviews, books, perfumer disclosures | Hand-curated, cited                                   |
| Personal (bookmarks, notes)                          | Readers                                 | Private to each account, RLS-enforced                 |

## Source-by-source

- **IFRA Standards** are copyrighted and IFRA enforces against republication.
  Enter the numbers (facts are not copyrightable), link the official
  Standard, stamp the amendment, never copy tables or rehost PDFs, never
  imply the site replaces the Standards. The 51st Amendment is current; the
  52nd is expected around late November 2026, after which every limit and
  every verified absence is re-checked and new rows are added.
- **GHS / SDS:** H-codes are a public standard. Store only the CLP-coded,
  majority classification and link the source.
- **Olfactive text elsewhere** (The Good Scents Company, Fragrantica,
  Basenotes, supplier copy) is copyrighted or marketing; it is quoted in the
  dossiers as research, never republished as the description.
- **Landmark uses:** a short list of well-documented examples, each cited.
  Not Fragrantica's coverage.
- **Pricing:** not in v1.
- **Structure–odor training data** stays under its own licence, outside the
  CC BY-SA dataset.

## Per-material target

Identity with at least three synonyms; IFRA limits for every category (or a
verified absence); GHS hazards; the maker's description (3–6 sentences),
family, tenacity, projection and 3–5 facets; typical use range, threshold and
dilution notes; 2–4 cited landmark uses.

## Anti-patterns

- Scraping Fragrantica.
- Auto-generating descriptions, or presenting a model prediction as one.
- Skipping a citation because a fact is "obvious".
- Growing the corpus faster than it can be reviewed.
