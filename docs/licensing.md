# Licensing

## Locked decision

- **Code:** MIT License
- **Data:** CC-BY-SA 4.0
- **Contributions:** Editorial-controlled in v1 (maker is the only writer; users can submit corrections via form)

## Why this combination

### MIT for code
- Most permissive widely-used license
- Anyone can fork, modify, sell, integrate — must keep the copyright notice
- Same license used by most modern web frameworks (React, Next.js libs, most of npm)
- Anyone can read the code freely
- Maximally aligned with the maker's "build something useful for people" ethos

### CC-BY-SA 4.0 for data
- Anyone can use the dataset, including commercially
- Attribution required (preserves authorship and credit)
- Share-alike: any derivative dataset must be released under the same license
- Wikipedia model — proven, well-understood, community-friendly
- Lets commercial actors contribute back, preventing improvements from being locked behind paywalls
- Cleaner than CC-BY-NC-SA, which has murky "what counts as commercial" ambiguity

### Editorial-controlled contributions
- Maker is the sole writer in v1
- Users can submit corrections/additions through a structured form
- Maker reviews and accepts (or doesn't)
- Keeps the dataset's quality bar high — quality is the project's entire differentiator
- Plans for future trusted-contributor tiers (v3+), like Wikipedia editor levels

## Counter-arguments considered

### Pure CC-BY (no share-alike)
**Considered:** maximally permissive, friendliest to all uses.
**Rejected:** allows a commercial player to ingest the dataset, improve it, and never contribute back. Share-alike protects the commons without restricting use.

### CC-BY-NC-SA (non-commercial)
**Considered:** more protective against commercial extraction.
**Rejected:** "non-commercial" is ambiguous (is a perfumer with an Etsy shop "commercial"?), unfriendly to legitimate small-scale use, and the maker explicitly chose pro-community over protective.

### Closed/proprietary
**Considered:** maker retains all rights, decides commercial fate later.
**Rejected:** explicitly counter to maker's stated values; reduces portfolio signal; reduces community engagement.

### Apache 2.0 for code
**Considered:** adds patent grant clause.
**Rejected:** for a web app like this, the patent considerations don't meaningfully apply, and MIT's simplicity is preferable. (If the project had ML/algorithmic novelty, Apache would be the answer.)

## Practical implementation

### In the code repo
- `LICENSE` file at root containing MIT license text
- Clear copyright line: `Copyright (c) 2026 Davis Kim`
- Mention in README that code is MIT-licensed

### For the dataset
- Separate `LICENSE-DATA` file referencing CC-BY-SA 4.0
- README explicitly states: "Code is MIT-licensed. Material data is licensed CC-BY-SA 4.0 — attribute and share-alike."
- Footer of every page on the live site: "Data licensed CC-BY-SA 4.0 — attribute Perfumers Codex / Davis Kim"
- Each page that displays data could include a small "Cite this page" affordance — useful for academic/journalistic users, and signals seriousness

### Attribution requested format

When others use the dataset, request attribution in this form:

> Material data from Perfumers Codex (https://perfumerscodex.com), licensed CC-BY-SA 4.0.

## Things this decision does not preclude

- Commercializing a hosted SaaS later (the standard "open-source code, paid hosting" model)
- Adding a paid pro tier with proprietary v2 features (formulation logs, advanced analytics) — that code can stay closed
- Selectively licensing the dataset under different terms to a commercial partner who wants to avoid share-alike (as long as the maker is the sole copyright holder, dual-licensing is possible)
- Eventually relicensing the dataset more permissively if the community/project evolves that direction

## Things this decision does preclude

- Suing someone who "steals" the data and credits properly under CC-BY-SA — by design, that use is allowed
- Forcing commercial users to pay or contribute code back — share-alike applies to *data* derivatives only, not code that uses the data
- Walking back to closed-source after publishing — the licenses are perpetual
