# Data Strategy

The data is the project. The code is replaceable; the curated dataset is the moat. This document covers sourcing, legal handling, and curation philosophy.

## Curation philosophy

- **Quality > coverage.** 50 deeply-cited materials beats 500 shallow ones.
- **Editorial voice.** Olfactive descriptions are written from personal experience, in the maker's voice, citing influences. Not aggregated from sources.
- **Provenance everywhere.** Every fact-bearing row has a `source_id`. Enforced at the schema level.
- **Versioned regulatory data.** IFRA limits are stamped with the amendment they were verified against. Re-verification is part of maintenance.
- **No hidden AI generation.** If a description is AI-assisted, it's reviewed, edited, and owned by the maker. No "ChatGPT wrote this" content. Structured *extraction* and clearly-labeled model *predictions* (below) are explicitly not editorial content — the boundary is enforced in the schema.

## Data layers (separation matters)

| Layer | Source | Effort | Legal posture |
|---|---|---|---|
| Canonical (CAS, IUPAC, molecular data) | PubChem API, ChemSpider | Low | Free, open, citable |
| Structural (SMILES, fingerprints, computed properties) | PubChem SMILES + RDKit computation | Low (scripted) | Deterministic, recomputable; stamped with RDKit version |
| Regulatory (IFRA limits, GHS codes) | IFRA standards site (linked), supplier SDSes | High | Hand-entered, linked, never republished verbatim |
| Olfactive (descriptions, families, facets) | Maker's own writing, hand-curated | High | Original work, owned by maker |
| Provenance (landmark uses) | Public interviews, books, perfumer disclosures | Medium | Hand-curated, cited |
| Personal (user stock, notes) | User-entered | N/A | Private to each user, RLS-enforced |

This separation also matters for the open-source story: code + data can be open-licensed without the *editorial* layer being trivially forkable, because the editorial value is in the judgment, not the bytes.

## Source-by-source treatment

### IFRA Standards (safety/usage limits)
- The 51st Amendment is the current notified standard (still true as of June 2026)
- **Heads-up — 52nd Amendment timing collides with launch.** The 52nd Amendment public consultation ran Dec 2025 – June 2026; formal notification is expected late 2026, i.e. right around this project's Month-6 launch. It proposes ~51 new Restriction Standards, revises 18 existing ones, and consolidates the furocoumarin policy. Consequences: (1) the schema's `ifra_amendment_version` + `verified_at` design is not optional polish — it is load-bearing; (2) plan a re-verification pass over all entered limits as the *first post-launch maintenance task* (insert new rows stamped "52nd", never overwrite "51st" rows); (3) display the amendment version prominently on every safety tab so users know what they're reading
- Standards themselves are publicly readable as PDFs per material on IFRA's site
- They are copyrighted; IFRA enforces against republication
- **Treatment:** hand-enter category limits (numbers — facts aren't copyrightable), link to the official IFRA standard page, stamp with amendment version, never reproduce their formatted tables verbatim
- **Don't:** scrape and rehost PDFs, copy entire tables, imply the tool is an authoritative substitute

### GHS / SDS data (hazard codes, sensitization)
- GHS codes themselves are a universal standard, not copyrighted
- Suppliers' SDS documents are freely distributed (Sigma-Aldrich, Perfumer's Apprentice, Pell Wall, Hermitage Oils all publish)
- **Treatment:** parse H-codes from supplier SDSes, display with link to original SDS, use a structured GHS code table for descriptions
- This is a manageable scraping/parsing problem; PDFs are annoying but tractable

### CAS numbers, IUPAC names, molecular data
- PubChem (open, government-run, rock-solid API) is the primary source
- ChemSpider and CAS Common Chemistry as secondary verification
- **Treatment:** pull via API, cache locally, refresh periodically, attribute clearly

### Olfactive descriptions
- The Good Scents Company has descriptions written by Tony Burfield et al. — copyrighted
- Fragrantica's TOS prohibits scraping
- Basenotes posts are individually copyrighted
- Supplier descriptions (Perfumer's Apprentice, Pell Wall, Hermitage) are marketing copy
- **Treatment:** maker writes original short olfactive descriptions based on personal experience with the materials. Cites influences. Over time, the maker's own session notes become the most valuable data in the tool.

### Landmark uses ("Iso E Super in Terre d'Hermès")
- Sources: public interviews, perfumer disclosures, Luca Turin reviews, Bois de Jasmin, Fragrantica (legally murky for scraping)
- **Treatment:** hand-curated short list of well-documented landmark uses. Each entry cited. Don't try to match Fragrantica's coverage. The pitch is "the canonical examples a working perfumer should know," not "every perfume ever."

### Pricing / supplier data
- Prices change, suppliers vary, MOQs differ
- **Treatment:** don't automate. v2 personal layer lets users enter their own supplier prices manually. v1 doesn't include pricing.

### SMILES and computed structural data (added August 2026)
- SMILES pulled from PubChem alongside CAS/IUPAC; naturals are mixtures and carry none
- Fingerprints, Tanimoto similarity, and computed properties (logP, TPSA) are deterministic RDKit output — provenance is the recorded RDKit version, not a citation
- Structure–odor training data (Leffingwell, GoodScents-derived public datasets) lives in the experiment repo under its own licenses; it is **not** merged into the CC-BY-SA dataset

### LLM-assisted structured extraction (added August 2026)
- The data pipeline may use an LLM under structured output / constrained decoding to parse unstructured source text (SDS PDFs, supplier pages) into schema-valid JSON records
- Every extracted record is human-reviewed against the original source before it is committed — extraction assists data entry, it never replaces verification
- The editorial layer is untouched: olfactive descriptions and landmark-use judgments remain human-written; model odor predictions are stored and displayed separately, clearly labeled with a model version

## V1 starter material list (suggested ~40)

Pick from these based on what the maker actually has or works with:

- **Synthetic ambers:** Iso E Super, ambroxan, Cashmeran, Ambermax/cetalox
- **Synthetic musks:** galaxolide, habanolide, ambrettolide, Velvione
- **Aldehydes:** C-10 (decanal), C-11 (undecanal), C-12 MNA, C-12 lauric
- **Floral synthetics:** hedione, methyl ionone (alpha + beta), lyral substitutes (Lilial alternatives)
- **Sweet/gourmand:** vanillin, ethyl vanillin, ethyl maltol, coumarin
- **Marine/ozonic:** calone, helional, dihydromyrcenol
- **Naturals (key ones):** bergamot, lavender, vetiver, oud (note variants), rose absolute, jasmine sambac
- **Woods:** Iso E + cedarwood Virginia, sandalwood synthetics (Javanol, Ebanol)
- **Aromatic:** linalool, geraniol, citral, eugenol, isoeugenol
- **Other key:** benzyl salicylate, methyl anthranilate, indole, civettone

Final list belongs to the maker and should reflect what's actually in active use.

## Per-material data targets (the "deep" profile)

For each material:

- **Identity:** canonical name, CAS, IUPAC, molecular formula, molecular weight, ≥3 synonyms (including supplier trade names)
- **Safety:** IFRA category limits (all 11 categories where applicable), GHS hazard codes, sensitization notes, photosensitivity flag
- **Olfactive:** maker's original description (3–6 sentences), olfactive family + sub-family, tenacity rating, projection rating, key facets (3–5 tags)
- **Usage:** typical % range (in EDP), threshold of perception note, common dilution recommendation
- **Landmark uses:** 2–4 cited canonical perfumes featuring the material
- **Sources:** every fact above has a citation

A complete profile takes 2–3 hours per material if cited honestly. Don't underestimate this.

## Time budget for data work

- Phase 1 (Weeks 1–4): 5 materials seeded
- Phase 2 (Weeks 5–10): +15 materials → 20 total
- Phase 3 (Weeks 11–16): +15 materials → 35 total
- Phase 4 (Weeks 17–22): +15 materials → 50 total

Total: ~100 hours of pure data work across 6 months. About half the project budget. This is correct — the data is the project.

## Anti-patterns to avoid

- "I'll just scrape Fragrantica" — don't, both ethically and operationally
- "Let me auto-generate descriptions" — destroys the editorial differentiator
- "I'll add 200 materials in v1" — quality drops, citations get sloppy, project loses its point
- "I'll skip citations for the obvious facts" — the "every fact cited" promise is the differentiator; don't break it for convenience
- "The model's prediction looks right, ship it as the description" — predictions never masquerade as editorial content
