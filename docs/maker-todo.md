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

### 0. Apply migrations 0007 and 0008, then deploy (2026-10-02)

Two migrations are written but not applied. Both live only on the
`claude/eloquent-pasteur-rg57zs` branch until it merges, so **run
`npm run db:migrate` from a checkout of that branch** (or of `main` after the
merge). From an older checkout it reports success and applies nothing.

**Order matters:** migrate first, then merge and deploy. The new code reads
columns that 0008 adds, so code deployed before the migration errors on every
page, including any Vercel preview of this branch that points at the live
database. The migration on its own is harmless to the code running now.

**0008: the review gate.** Nothing on the site has been reviewed by you, so
nothing should be on it. Once the new code is deployed, a material reaches
readers only after you have read everything its page would show and
published that exact version. The fingerprint covers what the page renders,
including shared data: family names, IFRA category names, hazard statements,
structural classes, full citation rows and similar materials. If any of it
changes later, from any writer, the page hides itself until you review it
again. The first deploy hides every live material and every family at once;
no data is deleted. Verified end to end on a local Postgres with the
fixtures, through the real seed, the real queries and the running built app.

**Do items 1–3 first**, while the materials are still visible behind the site
password: they need a material page to bookmark and annotate. After the gate
deploys, no page exists until you publish a real material.

**How:**

1. Check 0007's exposure (below), then `npm run db:migrate` from this branch.
   Confirm it landed: `npm run db:review list` must print a table, not
   "migration 0008 … is not applied".
2. `npm run db:review refresh` fingerprints every live material. No re-seed
   is needed, so this works even while the six 2026-09-13 entries still fail
   validation. Every material is listed as "awaiting review".
3. Merge and deploy. The site now shows "No materials published yet" and no
   families.
4. **Replace the `PROPOSED — maker to replace` families** in your
   `families.json` and re-seed. `publish` refuses any material whose family
   name still says PROPOSED.
5. For each material, after reviewing the JSON, the dossier and its open
   questions:
   ```bash
   npm run db:review show iso-e-super        # everything the page would show
   npm run db:review publish iso-e-super 1a2b3c4d5e6f7a8b   # the fingerprint `show` printed
   npm run db:review revoke javanol          # take one back down
   npm run db:review list                    # where everything stands
   ```
   No dashes on the verbs: npm swallows `--flags` and the command refuses
   them. `publish` only succeeds if nothing the page shows has changed since
   `show` printed that fingerprint.
6. The four synthetic fixtures stay hidden unless you publish them. Prune
   them whenever you like (item 8). Never run the fixture seed against live.

**After the gate is live, don't undo it by accident.** The gate lives in the
app code, so an older deployment against the live database shows everything
unreviewed. Don't Instant-Rollback production past this deploy, keep
`SITE_GATE_PASSWORD` set on Preview, and close or rebase old branches whose
previews use the live database. Seed only from checkouts that contain this
change: an older seed doesn't refresh fingerprints. Detail pages still hide
themselves, because they re-check on every request, but list entries can
stay stale until the next `refresh`.

**0007: the search view is probably public.** Migration 0002 enabled RLS on every _table_, but
`material_search_view` (0001) is a materialized view, which cannot carry
RLS, and Supabase's default privileges grant anon access to every relation
in `public`. So the Data API very likely serves slug, canonical name and CAS
number for every live material to anyone holding the publishable key, which
ships in the client bundle. That gets around the pre-launch gate. Supabase's
security advisor flags this pattern ("materialized view in API").

`0007_search-view-revoke-api` revokes it. Tested on a local Postgres 16 with
Supabase-style default grants, where all eight migrations applied cleanly:
anon could SELECT the view before 0007 and is refused after, the revoke
survives `REFRESH`, and the `postgres` role the app uses keeps access.
Not yet applied live — an agent has no credentials.

**How (0007):**

1. Before applying, confirm the exposure (expect rows):
   ```bash
   curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/material_search_view?select=slug" \
     -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
   ```
2. `npm run db:migrate` (applies 0008 too).
3. Re-run the curl: expect a permission error, not rows.
4. After deploying, publish one reviewed material and run a search for it:
   it must appear.
5. Optional: the dashboard's Security Advisor should no longer list the view.

### 0b. Migration 0009 (structure drawings) — before you publish anything

PR #24 stores each 2D structure diagram, so it adds a field to what every
material page renders. That changes every material's review fingerprint.
Nothing is published yet, so this costs nothing if done in this order:

1. `npm run db:migrate` (applies 0009). Before the deploy, or every material
   page fails on the missing table.
2. Merge and deploy PR #24.
3. Re-seed from `perfumers-codex-data` (writes the drawings and fresh hashes).
4. Only then `npm run db:review show` / `publish`.

Anything published between 2 and 3 hides itself after the re-seed.

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

### 6b. The search-log purge does not exist

`db/schema.ts` and `docs/database-schema.md` both said search-query rows are
"purged by a Supabase scheduled job" after ~90 days. Checked against the live
database on 2026-09-05: **no `pg_cron` extension, no `cron` schema, no job,
and the oldest row still there.** Both comments are corrected, and `/privacy`
says plainly that entries are kept indefinitely today rather than promising a
retention period nothing enforces.

Two ways to close it, your call:

1. **Build it.** Enable `pg_cron` in the Supabase dashboard and schedule
   `delete from search_queries where created_at < now() - interval '90 days'`
   daily. Then update the two comments and the privacy policy together — they
   are now cross-referenced so they cannot drift apart again.
2. **Drop the intent** and keep the log indefinitely. It carries no user id,
   no IP and no session, so it is not personal data; the case for purging is
   tidiness rather than privacy.

Worth doing before launch either way, because the privacy policy currently
describes option 2 and the docs used to describe option 1.

### 7. Make the apex the primary domain in Vercel

`NEXT_PUBLIC_SITE_URL` and every `og:url` advertise `perfumerscodex.com`, but
Vercel has `www` as primary and 308-redirects the apex to it. The site
currently advertises a URL that redirects. Dashboard fix, no code change.

### 8. Synthetic test materials — now beside the real ones; prune before launch

**Update 2026-09-05:** Iso E Super, Javanol and Civetone are seeded into the
live database (additively, behind the gate) so you can review them rendered.
The four synthetic materials are still there beside them. **Nobody should
re-seed `scripts/fixtures` against the live database now** — its
`usage-categories.json` shares ids 1–11 with the real IFRA list and the seed
upserts by id, so it would rename every real category to "Test Category N".
A guard in the seed (refuse to overwrite a reference row's name without
`--force`) is worth adding before the corpus grows; noted as debt.

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

### ✅ Both blocking defects are fixed (2026-09-05)

They were app defects, not data defects, and neither could be fixed by
editing a JSON file. Both shipped as P4-A.

**1. A verified IFRA absence is now a fact on the page.** `material_ifra_absences`
holds one row per material per amendment. Javanol's and Civetone's pages will
read _"No IFRA Standard — checked against the complete index of IFRA Standards
for the 51st Amendment on …: this material is not the subject of any
restriction, prohibition or specification"_, with a citation to the index.
A material with no limits **and** no absence still gets the old empty state,
which now means exactly "nobody has looked yet". Validation refuses a file
claiming both a Standard and an absence for the same amendment.

**2. Identity facts are cited.** The CAS in the hero and the Identity panel
carry the record they came from; every synonym carries its own document. The
page's citation list is built starting from those, so Iso E Super will show
all 4 of its sources rather than 2, and PubChem and The Good Scents Company
keep the citations for its CAS and 32 synonyms.

Your three data files were updated to match: every synonym now names its
source. Two Civetone synonyms were **removed** rather than guessed — the bare
"9-Cycloheptadecen-1-one" (which PubChem attaches to a different record) and
"Civettone Neat (Firmenich)" (evidenced only by a reseller page that is not a
declared source). Worth a glance when you review.

**Still yours to verify:** these were proven against synthetic fixtures on the
live database. The real pages cannot be seen until you review the drafts and
the corpus is seeded (P4-B).

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

- ~~**Two different source keys with the same URL**~~ — **closed 2026-10-02.**
  It bit on 2026-09-13: six research entries failed to seed because each
  cited IFRA's index under a per-material key and the second collided on
  `sources_url_uniq` mid-transaction. `checkSharedSourceUrls` in
  `lib/validation/material-data.ts` now rejects one url under two keys
  (across files or within one) before any write, naming the key to reuse.
  **Your action:** the affected files in `perfumers-codex-data/` will now fail
  validation instead of failing mid-seed. For each error, do what it says:
  across files, change the repeated source's key to the one named, copy that
  source's title exactly, and point the file's `source_key` references at it;
  within one file, delete the repeated entry and re-point its references.
  The key named is always the first declaration in input order, which is the
  one already in the database. Residual: the check sees only the input set,
  so a url already in the database under a key no input file declares still
  fails at write time.
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
