# Wave 7 — The quality bar

**Status: READY — dispatched 2026-09-02.** Orchestrator-owned; subagents read
it, only the orchestrator edits it. House rules, protocol and standing
constraints are [wave-3.md](./wave-3.md)'s, carried verbatim into every
prompt, plus wave-4's rate-limiting and caching deferral records.

Phases 1–3 are closed and every v1 route exists. This wave is the first that
adds no feature: it pays down [quality-checklist.md](../quality-checklist.md),
which AGENTS.md lists as always-check and which nothing has audited yet.

## Why now

Two findings made this the right next wave rather than the caching pass:

1. **The favicon is still create-next-app's default.** `app/favicon.ico` has
   not been touched since "Initial commit from Create Next App" — so
   perfumerscodex.com currently ships the Next.js logo as its identity. On a
   portfolio project that is a visible defect, not a nicety.
2. **There is no Open Graph artwork at all.** `app/layout.tsx` says so in a
   comment and deliberately omits `images`, because pointing at a file that
   does not exist is worse than omitting it. Every link to the site shares as
   a bare text card.

The caching pass stays deferred. Wave 4 put it "after seeding settles", and
seeding has not settled — the corpus is three synthetic materials. Tuning
`cacheLife` against fixture data would be tuning against noise.

## Entry criteria

- [x] **Wave 6 committed and verified** _(2026-09-02)_ — every v1 route exists.
- [x] **Google OAuth shipped** _(2026-09-02)_ — `/login` and `/signup` are in
      their final shape, so auditing them now is not auditing a moving target.
- [x] **Design tokens stable** (P2-B, plus the Noctua-brown pass) — the audit
      corrects contrast and focus against a settled palette.

## Wave shape

Two items, one subagent each, dispatched **concurrently**. File sets are
disjoint: W7-A creates only new files under Next's metadata file conventions,
W7-B edits existing components and pages. Neither touches `app/layout.tsx`,
`db/**`, package manifests or CI.

| Item                     | Exclusive files                                                                                                                                      | Proves it is done                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| W7-A Identity & OG cards | `app/icon.svg`, `app/apple-icon.tsx`, `app/opengraph-image.tsx`, `app/materials/[slug]/opengraph-image.tsx`, delete `app/favicon.ico`                | `npm run build` + the rendered images fetched and inspected                 |
| W7-B Accessibility audit | `components/*.tsx` (not `ui/`), `components/account/**`, `components/material/**`, `components/auth/**`, `app/**/page.tsx`, `app/(auth)/**/page.tsx` | `npm run typecheck && npm run lint && npm run build` + keyboard walkthrough |

`app/layout.tsx` stays orchestrator-owned. If either item needs a change
there — a `metadataBase` tweak, a `lang` fix — it reports the change rather
than making it.

## Wave-specific constraints

1. **No new dependencies.** `next/og` is built in; do not add an image
   library. If an OG image needs a webfont, it must not depend on a
   third-party host being up at request time — a missing font must degrade to
   a system fallback, never to a failed render.
2. **The audit fixes, it does not redesign.** W7-B corrects contrast, focus,
   labelling, heading order and keyboard traps. It does not restyle, move
   controls, or "improve" layout. Any visual change beyond what an
   accessibility defect forces is out of scope, and W7-A's brand work must
   stay inside the existing palette.
3. **Report the audit, not just the diff.** W7-B's value is as much the list
   of what it checked and found clean as the fixes.
4. Rate limiting is the Week 18 Upstash pass; caching stays `force-dynamic`.

## W7-A — Identity and share cards

Acceptance criteria:

- `app/icon.svg` replacing `app/favicon.ico`, which is deleted. Drawn from the
  project's own world (the codex, the bench, the grain), in the existing
  palette, legible at 16px — most marks are not. Works on light and dark
  browser chrome.
- `app/apple-icon.tsx` via `next/og` at 180×180.
- `app/opengraph-image.tsx` — the site-wide card, 1200×630: wordmark, the
  one-line description from `docs/overview.md`, the palette. No stock
  photography, no gradient mesh.
- `app/materials/[slug]/opengraph-image.tsx` — per-material card showing the
  canonical name and material type, read through `lib/db/materials.ts`. A
  missing material must render the generic card, never throw. **No fact that
  requires a citation goes on a share card** — no CAS, no IFRA limit, no
  safety data (AGENTS.md: cited facts belong next to their citation).
- Both must render if the database is unreachable — an OG route that throws
  gives a broken card in every social preview.

## W7-B — Accessibility and keyboard audit

Audit every shipped surface against `docs/quality-checklist.md`'s per-page and
per-form checklists: `/`, `/materials`, `/materials/[slug]`, `/families/[slug]`,
`/search`, `/saved`, `/account`, `/login`, `/signup`, `/not-found`.

Acceptance criteria:

- **Focus** visible on every interactive element in both modes; no focus trap;
  tab order matches visual order; the skip link works.
- **Icon-only controls** carry accessible names (the theme toggle, the mobile
  search trigger, the mobile account link already claim to — verify rather
  than assume).
- **Headings** form a sane outline per page: one `h1`, no skipped levels.
- **Forms** meet the per-form checklist; every input has a programmatic label;
  errors are associated via `aria-describedby` and announced.
- **Contrast** measured, not eyeballed, and measured over the composited
  texture where text sits on it — the grain darkens light mode and lightens
  dark mode, so a ratio taken against the flat token is wrong. Report figures.
- **Landmarks**: one `main`, header/footer as `banner`/`contentinfo`, no
  nested `main`.
- Fix what is broken; report what was already correct.

## After the wave (orchestrator)

Full suite; combined diff; fetch and eyeball the generated OG images at their
real sizes; Lighthouse on the homepage, `/materials` and a material detail
page (>90 is the bar, and Accessibility is the score this wave is judged on);
keyboard walkthrough of one full flow; verify the favicon actually changed on
a hard load; one commit per item.
