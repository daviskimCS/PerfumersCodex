# Licensing

- **Code:** MIT ([`LICENSE`](../LICENSE)).
- **Material data published by the project:** CC BY-SA 4.0
  ([`LICENSE-DATA`](../LICENSE-DATA)).
- **Contributions:** editorial control in v1. The maker is the only writer;
  readers send corrections by email until the correction form ships.

## Why

- **MIT for code:** the simplest permissive licence; anyone can read, fork,
  sell or integrate it with the copyright notice kept. Apache 2.0's patent
  grant buys nothing for a web app like this.
- **CC BY-SA for data:** anyone may use the dataset, commercially too, with
  attribution, and derivative datasets must stay under the same terms, so an
  improvement cannot be locked behind a paywall. Rejected: plain CC BY (lets a
  commercial player improve the data and never give back) and CC BY-NC-SA
  ("non-commercial" is ambiguous for a perfumer with an Etsy shop).
- **Editorial control:** the quality bar is the differentiator. Trusted
  contributor tiers are a v2 idea.

## In practice

- Every page's footer carries "Material data licensed CC BY-SA 4.0 —
  attribute Perfumers Codex / Davis Kim" and links the licence deed, which
  CC BY-SA requires (`components/site-footer.tsx`). Spell it "CC BY-SA 4.0",
  as Creative Commons does.
- Requested attribution: _Material data from Perfumers Codex
  (https://perfumerscodex.com), licensed CC BY-SA 4.0._
- Third-party data keeps its own terms: IFRA Standards are linked and their
  numbers entered, never republished; structure–odor training data stays
  under its own licence and is never relicensed as project data. Model
  predictions shown in the app would be project data; their training data is
  not.
- Bundled assets keep their own licences (JetBrains Mono: OFL, in
  `assets/fonts/`).

## What this allows and rules out

The maker, as sole copyright holder, can still offer paid hosting, keep
future v2 code closed, dual-license the data to a partner, or relicense it
more permissively later. What cannot happen: forbidding properly attributed
reuse, forcing code that merely uses the data to be open, or withdrawing the
licences once published (they are perpetual).
