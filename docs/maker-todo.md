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

Researched 2026-09-04 into `/Users/daviskim/Desktop/WorkDir/project/perfumers-codex-data`
(not a git repo yet — creating it, and choosing its licence, is still yours).
Each material has a `<slug>.json` that validates against `materialFileSchema`
and a `dossier-<slug>.md` recording every fact with its URL and verbatim
quote, every fact that was **dropped** with the reasons, everything
unavailable, and the odor quotes.

**How the drafts were made, so you know what to trust.** Every fact was
fetched from a primary source and then re-fetched by two independent
adversarial checkers whose default stance was to refute; a fact needed both
to confirm it. Anything either one could not confirm was dropped from the
JSON and recorded in the dossier instead. Nothing was filled in from model
memory. `description` is `null` in every file — olfactive descriptions are
yours to write, and the dossiers collect the source quotes to write from.

### Iso E Super — drafted

89 facts verified, 71 dropped. Sources: PubChem CID 108242, IFRA Standard 068
(OTNE), the IFF safety data sheet, The Good Scents Company. All 11 IFRA
category limits, 4 GHS codes, 32 synonyms.

The dossier ends with **13 open questions**. Four matter before this is
publishable:

1. **Subcategory floors.** IFRA splits Categories 5 and 10 into subcategories
   with different limits, and the table stores one value per category. The
   draft stores the most restrictive (5D 0.19 %, 10A 2.4 %) with the full
   breakdown in notes. Safe, but it under-states what a body lotion (5A,
   5.1 %) or a household spray (10B, 6.6 %) may carry. The alternative is a
   schema change. **Your call, and it applies to every material.**
2. **Amendment label.** The Standard is Amendment 49, current in the 51st
   Amendment index. The draft stamps "49th". Whichever you choose, the
   convention has to hold across all materials, because the unique key is
   (category, amendment).
3. **Category 12 is unrepresentable.** `usage_categories` runs 1–11, and
   OTNE's Standard says "No Restriction" for 12, so nothing is lost here. It
   will matter for a material whose Standard restricts Category 12.
4. **H401.** Stored from the IFF SDS; ECHA's harmonised classification does
   not carry it. Keep it, or restrict hazards to the CLP set?

Also: the family is a placeholder (`proposed-iso-e-super-family` — every
source says woody, with amber/ambergris), and the manufacturer's page was
unreachable to the checkers, so its 16 facts were all dropped. If you can
open iff.com yourself, the typical use level "Up to 10 %" and the olfactive
description are worth promoting by hand.

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
