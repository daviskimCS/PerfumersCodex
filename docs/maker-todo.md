# Maker to-do — what only Davis can do

Everything here is blocked on a human: an account, a dashboard, a payment, a
judgment call, or editorial writing. Nothing on this list can be dispatched
to an agent, and several items block work that otherwise looks finished.

Sorted by consequence, not by effort. Last reviewed **2026-09-04** (items 5 and 6 are done — the font swap and the sources key both shipped; items 1–4 are the last things between this and a verified, fully signed-in personal layer).

Companion to [CHECKLIST.md](./CHECKLIST.md), which tracks the agent-side work.
Personal planning (career framing, time budget, milestone dates) lives in the
Obsidian vault, not here.

---

## 🔴 Blocking — something is wrong or unproven until these are done

### 1. Verify account deletion actually deletes

**Why it matters:** deletion is irreversible, and `ON DELETE CASCADE` is the
only thing standing between "account deleted" and "rows orphaned in a
database you told a user was wiped". That is a GDPR promise, not a feature.
No agent can test it, because creating an account is not an action available
to one.

`/account` now has the delete form (Wave 6, shipped 2026-09-02), so this is
testable today.

**How:** sign up a throwaway account, save a bookmark and write a note on any
material, then delete the account from `/account`. Then confirm the rows are
gone — the orchestrator can run the check against the database if you say the
word, or in the Supabase SQL editor:

```sql
select
  (select count(*) from user_saved_materials) as bookmarks,
  (select count(*) from user_notes)           as notes,
  (select count(*) from auth.users where email = 'your-throwaway@address') as account;
```

All three must be `0`. If bookmarks or notes survive, the cascade is broken
and deletion is a lie — stop and fix before launch.

### 2. Verify the signed-in bookmark and note round trips

**Why it matters:** the RLS boundary is proven (a forged write is refused
`42501` while a legitimate one passes RLS and is stopped only by the foreign
key — the pair is what makes it conclusive). What is **not** proven is the
wiring above it: that the button toggles, survives a reload, and that
`/saved` lists what you saved. Same reason as #1 — it needs a real session.

**Where:** the PR preview deployment is ideal — it runs the PR's exact code
against the real database, and you are already authenticated to Vercel.

### 3. Two throwaway accounts for cross-account RLS verification

**Why it matters:** #2 proves your own data round-trips. This proves someone
_else's_ does not leak into it. Sign in as A, save something; sign in as B,
confirm A's shelf is invisible.

**Or:** tell the orchestrator in writing that it may create them through the
admin API, and it will run the scripted probe and delete them afterwards. It
has the harness ready but will not create accounts without that sentence.

### 4. Configure Google as a sign-in provider

**Why it matters:** the "Continue with Google" button ships in the app but is
**dormant** until this is done — clicking it returns "Google sign-in isn't
available right now". The code is finished; this is the switch. Same pattern
as the email-confirm route, which shipped before its template was pointed at
it.

Three steps, ~15 minutes, all in dashboards:

1. **Google Cloud Console** → APIs & Services → Credentials → _Create OAuth
   client ID_ → **Web application**. Under _Authorized redirect URIs_ add
   exactly:

   ```
   https://mwqaakwwpbmjejbfzbxj.supabase.co/auth/v1/callback
   ```

   That is Supabase's callback, not ours — the app's own `/auth/callback` is
   where Supabase sends the browser afterwards, and Google never sees it.
   Getting this wrong is the usual cause of `redirect_uri_mismatch`.

2. You will also need an **OAuth consent screen**. While it is in "Testing"
   only accounts you list can sign in; publishing it is what makes it work
   for everyone. Scopes: the default `email` and `profile` are enough — do
   not request more, since the app stores nothing beyond the account.

3. **Supabase dashboard** → Authentication → Providers → **Google** → enable,
   paste the client ID and client secret, save.

Then confirm **Authentication → URL Configuration** lists the redirects the
app actually uses, or the callback is rejected:

```
https://perfumerscodex.com/**
https://www.perfumerscodex.com/**
http://localhost:3000/**
```

**Worth knowing before you enable it:** Supabase links accounts by verified
email by default, so signing in with Google using an address that already has
a password account attaches to that same account rather than creating a
second one. That is the behaviour you want; it is also worth testing once,
because it is the kind of thing that surprises people at launch.

### 5. ~~Share-card font~~ — DONE 2026-09-04 (JetBrains Mono)

Shipped on the same day it was decided. JetBrains Mono v2.304 is committed
under `assets/fonts/jetbrains-mono` (OFL-1.1) and is now the one family for
the site (`next/font/local`, variable file, weights 100–800 declared) and for
the share cards (static Regular passed to `ImageResponse`). Geist is gone.

Two measurements closed it, both with controls. fontTools: α β γ δ present in
every committed file, all four absent from `next/og`'s bundled Geist. A fetch
wrapper on the card render: three calls to `fonts.googleapis.com` /
`fonts.gstatic.com` with no font supplied, zero with it. Output tracing lists
the font in both card routes' `route.js.nft.json`, so it reaches Vercel with
no config change — but **eyeball one per-material card on the next preview
deployment** anyway; a traced file and a deployed file are two different
claims, and only the second one matters.

The history, for the record: IBM Plex Mono was chosen first on the
orchestrator's wrong premise that IBM's "complete" build carried Greek.
fontTools proved no Plex Mono build has α β γ δ; the agent stopped at that
gate without touching the repo, which is exactly right.

### 6. ~~`sources` needs a `key` column~~ — DONE 2026-09-04

Decided 2026-09-02, shipped as migration `0003_sources-key` and applied to the
live database 2026-09-04. Sources now resolve by a global `key`, so a book
cited by three materials is one row. The re-seed proved both paths on live
data: URL sources seeded under the old design were adopted by the backfill
and now carry keys, and a shared key resolved to exactly one row referenced
by two materials. The one row nothing could identify (the old url-less test
book) was removed under a referential check across every foreign-key table.

Validation now also rejects one key naming two different documents (same key,
different `url` or `title`) before any write.

---

## 🟡 Do before launch

### 7. Make the apex the primary domain in Vercel

`NEXT_PUBLIC_SITE_URL` and every `og:url` advertise `perfumerscodex.com`, but
Vercel has `www` as primary and 308-redirects the apex to it. The site
currently advertises a URL that redirects. Dashboard fix, no code change.

### 8. Synthetic test materials — now behind the gate; prune before launch

Four obviously-fake materials (`Test Material Alpha` / `Beta` / `Gamma` /
`Delta`) are in the **live** database. Since 2026-09-03 they sit behind your
password gate, so the public sees only the construction page and this is no
longer urgent — but they must not survive launch. When the real corpus is
seeded, prune them:

```bash
npm run db:seed -- <real-data-dir> --prune
```

`--prune` soft-deletes materials absent from the input and refuses to run if
the input is under half the live corpus without `--force-prune`, so a typo'd
path cannot empty the database.

### 9. Make the repo public

Your own public-from-day-one constraint, still unmet. `LICENSE` and
`LICENSE-DATA` are in place. One reasonable trigger: flip it the day the
first real material renders on the live detail page — "public with real
content" is a stronger first impression than an empty shell.

### 10. Align the Supabase minimum password length

The dashboard allows 6; `lib/validation/auth.ts` requires 8. Our forms
enforce 8, so this only matters for flows that bypass them. Set the dashboard
to 8 so the two agree.

---

## 🟢 Scheduled / not yet urgent

| When            | What                                                                                                                                                                                                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Now, ongoing    | **Review the cited material drafts** (below) and author the rest of the five. Format: `lib/validation/material-data.ts`; worked example: `scripts/fixtures/test-material-alpha.json`. The drafts cut the writing time but **not** the reviewing time — every one carries open questions only you can settle. **This is still the critical path.** |
| ~end Nov 2026   | IFRA 52nd Amendment notification. Keep stamping "51st" until then; afterwards insert new rows stamped "52nd", never overwrite. Folds into the Week 19 data push.                                                                                                                                                                                  |
| Before Week 19a | Review the structure–odor training-data licences (Leffingwell / GoodScents-derived). Never redistribute as project data.                                                                                                                                                                                                                          |
| Week 20         | Resend SMTP (the built-in sender is rate-limited to a handful of auth emails per hour — it breaks on launch day), upgrade Supabase to Pro, `hello@perfumerscodex.com` alias.                                                                                                                                                                      |
| Anytime         | LinkedIn project paragraph; the cheminformatics and odor-map spikes.                                                                                                                                                                                                                                                                              |

---

## Cited material drafts — awaiting your review

Researched 2026-09-04/05 into `/Users/daviskim/Desktop/WorkDir/project/perfumers-codex-data`
(**not a git repo yet** — creating it, and choosing its licence, is still
yours; until then these files are unversioned and an accidental overwrite is
unrecoverable). Each material has a `<slug>.json` that validates against
`materialFileSchema` and a `dossier-<slug>.md` recording every fact with its
URL and verbatim quote, every **dropped** fact with the refuters' reasons,
everything unavailable, and the odor quotes.

The whole set passes the seed's validation pass: _"seed: validated 3
materials, 3 families, 11 usage categories, 5 hazard codes"_.

**How the drafts were made, so you know what to trust.** Every fact was
fetched from a primary source, then re-fetched by two independent adversarial
checkers whose default stance was to refute; a fact needed **both** to
confirm it. Anything either could not confirm was dropped from the JSON and
recorded in the dossier instead. Nothing came from model memory. `description`
is `null` in all three — olfactive descriptions are yours, and the dossiers
collect the source quotes to write from.

| Material    | CAS         | Verified | Dropped | IFRA                            | Hazards                     | Synonyms |
| ----------- | ----------- | -------- | ------- | ------------------------------- | --------------------------- | -------- |
| Iso E Super | 54464-57-2  | 89       | 71      | Standard 068, all 11 categories | H315 H317 H401 H410         | 32       |
| Javanol     | 198404-98-7 | 87       | 4       | **no Standard** (verified)      | H400 H410                   | 10       |
| Civetone    | 542-46-1    | 80       | 9       | **no Standard** (verified)      | H315 (minority — see below) | 21       |

RDKit 2025.03.4 filled `computed_properties` and pairwise `similarity`.
Sanity checks pass: heavy-atom counts 17/16/18 match the formulae, and TPSA
separates the two ketones (17.07) from Javanol's alcohol (20.23). Civetone's
Crippen logP 5.59 sits below TGSC's published 6.31 — that is a method
difference, not a wrong structure.

---

### 🔴 Two blocking defects the drafts exposed in the app

Both are **app defects, not data defects**, and neither can be fixed by
editing a JSON file. I confirmed both in the code.

**1. A verified IFRA absence is indistinguishable from unfinished work.**
Javanol and Civetone genuinely have no IFRA Standard — established by
searching the complete 51st-Amendment index and showing the alphabetical
neighbourhood where an entry would fall. The only honest way to record that
today is `usage_limits: []`, and `components/material/safety-panel.tsx:76`
renders the empty case as _"No IFRA limits recorded yet … None have been
entered for this material."_ So the page tells a perfumer we did not do the
work, when in fact we did it and the answer is "unrestricted". That is the
silently-missing failure AGENTS.md forbids, and for safety data it is the
wrong way round: it under-claims where the truth is permissive.

There is nowhere to put the fact. Neither the file format nor the schema has
a "no Standard, checked against amendment N" field; it survives only as prose
in `sources.notes`, which `lib/types.ts` never exposes to the UI. **This
needs a schema decision before more materials are authored** — two of the
first three already hit it.

**2. Identity facts publish uncited, and most sources never reach the page.**
`cas_number`, `iupac_name`, `smiles`, `molecular_formula`, `molecular_weight`,
`material_type` and every synonym carry no `source_key` in the file format and
no `source_id` column in `db/schema.ts`. And `lib/db/materials.ts:419` builds
the page's citation list only from sourceId-bearing rows — its own comment
says _"sources referenced by no surviving row never appear."_

The result on the live page: **Iso E Super would show 2 of its 4 sources.**
PubChem and The Good Scents Company both vanish, taking the citation for the
CAS number and all 32 synonyms with them. Civetone would show 1 of 5, Javanol
2 of 5. This directly contradicts AGENTS.md: _"Every fact-bearing row in
materials data has a `source_id`. Non-nullable."_ It holds for the tables that
have the column; the identity fields never got one.

---

### 🟡 The recurring theme: verified facts with nowhere to live

All three materials turned up strong, well-cited data the schema cannot hold.
This is the thing worth settling **before** you author the remaining two,
because retrofitting is far more expensive than deciding now:

- **Physical properties** — melting/boiling point, flash point, refractive
  index, specific gravity, supplier logP.
- **Registry identifiers** — FEMA, JECFA, EC, UNII, CoE numbers.
- **Substantivity** — Civetone's _400 hours at 100 %_, Javanol's _"1 month +"_
  on a blotter. Exactly what a perfumer opens a reference to find. The
  schema's `tenacity` is a four-value enum for your judgment, not a place for
  a supplier's measured figure.
- **Non-IFRA recommended maxima** — TGSC recommends Civetone _up to 0.1 % in
  the concentrate_. `usage_limits` is for IFRA rows; putting a ceiling in
  `usage_guidance.typical_pct_max` would render a maximum as a typical dose
  (the refuters rejected exactly that). As drafted, the page shows **no usage
  figure at all** for a material that has published guidance.

### Per-material decisions

**Iso E Super** — 13 open questions; four matter before publishing:

1. **Subcategory floors.** IFRA splits Categories 5 and 10 into subcategories
   with different limits; the table holds one value per category. The draft
   stores the most restrictive (5D 0.19 %, 10A 2.4 %) with the breakdown in
   notes, which under-states what a body lotion (5A, 5.1 %) or a household
   spray (10B, 6.6 %) may carry. **Sets a precedent for every material.**
2. **Amendment label.** The Standard is Amendment 49, current in the 51st
   index; the draft stamps "49th". The unique key is (category, amendment), so
   one convention must hold everywhere.
3. **Category 12 is unrepresentable** (`usage_categories` runs 1–11). Harmless
   here — OTNE's Category 12 is "No Restriction" — but not for the next
   material.
4. **H401** is on the IFF SDS but not in ECHA's harmonised classification.

The manufacturer's page was unreachable to the checkers, so all 16 of its
facts were dropped. If you can open iff.com yourself, the typical use level
_"Up to 10 %"_ and the olfactive description are worth promoting by hand.

**Javanol** — 9 open questions. Is **"Javanol Super"** a synonym or a separate
material? Givaudan gives it the same CAS and chemical name but a _different
olfactive profile_, and the schema has no concept of commercial grade. Also:
no ECHA corroboration was reachable (two 403s and a 502), so the hazards rest
on two distributor SDSs that agree with each other — worth one manual check.
The stored SMILES carries no stereochemistry, so the similarity numbers
describe a diastereomer mixture; the page should not imply otherwise.

**Civetone** — 7 open questions, two of them genuinely interesting:

1. **`material_type: "synthetic"` — confirm.** It occurs in African civet, but
   the commercial article is dsm-firmenich's synthetic molecule. `natural`
   would imply a civet-derived material nobody sells. The dossier calls this
   "the one uncomfortable call". Related, and worth your judgment: the
   animal-welfare story behind why the synthetic replaced the tincture is
   arguably the most interesting thing about this material, and a reference a
   perfumer respects would acknowledge it.
2. **H315 is a self-notified minority position** — 80 % of ECHA notifiers say
   "not classified", 20 % say skin irritant, and TGSC's OSHA section says
   "None found". The draft stores it, erring toward the warning, but rendering
   a flat _"H315 — causes skin irritation"_ would present a contested minority
   view as settled fact. Other materials will split the same way, so this may
   want a notifier-confidence column rather than a per-material fudge.

Also unresolved: whether commercial Civettone is a Z/E mixture and at what
ratio. No source gives one, so none was invented; the JSON stores the pure Z
structure.

### Before any of this goes live

- **Re-verify both IFRA absences against the current amendment.** They are
  stamped to the 51st (notified 2023-06-30). The 52nd's consultation closed
  12 June 2026 but was not notified as of this research. A material with no
  Standard today can acquire one, and the page asserts an absence.
- **Re-stamp `verified_at` / `accessed_at`** — they are research fetch times.
- **Replace the three placeholder families** (`proposed-*-family`).
- **Decide the similarity floor.** All three pairs are written, including
  Civetone↔Javanol at 0.0227, which is noise and will render as a "similar
  material" on both pages. Fine at three materials, wrong at three hundred.
- **Fingerprint provenance.** These Tanimotos come from RDKit.js's folded
  2048-bit Morgan fingerprints. AGENTS.md makes the Python pipeline in
  `perfumers-codex-data` canonical; if it uses different parameters it will
  produce different numbers under the same `rdkit_version` stamp, which will
  not disambiguate them.

## Known debt (tracked, not blocking)

- **Two different source keys with the same URL** are not caught before
  writing. The old design merged those by URL; the new one surfaces them as a
  `sources_url_uniq` violation mid-transaction on the citing material — loud,
  but not the pre-write validation error every other cross-file rule gives.
  A small follow-up in `lib/validation/material-data.ts` when it matters.
- **Every route is dynamically rendered.** The header's `getUser()` reads
  cookies, so `/`, `/login`, `/signup` lost static generation. Wave 4
  mandated the server-side check; this is its price. First item for the
  deferred caching pass, where partial prerendering can keep the shell static
  and stream just the auth affordance.
- **`notFound()` returns HTTP 200** on streamed routes, with `noindex` as the
  documented mitigation. Next behaviour, not ours.
- **The icon is SVG-only.** `favicon.ico` was create-next-app's default and is
  gone; `app/icon.svg` replaces it. Older Safari and some crawlers ignore SVG
  favicons. The obvious fix — a committed `icon1.png` — is deliberately NOT
  taken, because the mark inverts between light and dark browser chrome and a
  static bitmap would be wrong half the time. If a bitmap is ever wanted, it
  should be generated per scheme, not frozen.
- **Satori does not synthesise bold**, so all hierarchy on the OG cards comes
  from size, colour and letter-spacing. Not a defect, but worth knowing before
  anyone asks why the cards carry no bold weight. The family itself is
  settled (item 5): JetBrains Mono Regular, read from the repo.
- **Rate limiting is absent** on search, signup, login, note saves and the
  account mutations. Deliberately the Week 18 Upstash pass; the deferral is
  recorded in the code itself, not only in the wave docs.
