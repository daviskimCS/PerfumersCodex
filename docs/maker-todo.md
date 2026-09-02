# Maker to-do — what only Davis can do

Everything here is blocked on a human: an account, a dashboard, a payment, a
judgment call, or editorial writing. Nothing on this list can be dispatched
to an agent, and several items block work that otherwise looks finished.

Sorted by consequence, not by effort. Last reviewed **2026-09-02** (after Wave 6 + Google OAuth — every v1 route now exists, so items 1–4 are the last things standing between this and a verified, fully signed-in personal layer).

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

### 5. `sources` needs a `key` column

**Why it matters:** the seed input format gives every source a stable `key`
as its idempotency anchor, but the table has nowhere to store it. URL-less
sources — books, interviews, exactly the ones a perfumery reference leans on
— therefore fall back to a per-material identity, so **a book cited by three
materials becomes three rows**. Fine for synthetic fixtures. Wrong for a
citation-driven reference, and wrong in a way that only shows up once real
data lands.

**Decision needed before the real data run.** The fix is a `key text` column
with a unique index and a one-line change to the seed's source resolution.
Say the word and it becomes a migration.

---

## 🟡 Do before launch

### 6. Make the apex the primary domain in Vercel

`NEXT_PUBLIC_SITE_URL` and every `og:url` advertise `perfumerscodex.com`, but
Vercel has `www` as primary and 308-redirects the apex to it. The site
currently advertises a URL that redirects. Dashboard fix, no code change.

### 7. Decide on the synthetic test materials

Three obviously-fake materials (`Test Material Alpha` / `Beta` / `Gamma`) are
in the **live** database and publicly visible. They were seeded to verify the
pipeline and they are what makes the browse pages reviewable.

Clear them whenever you want:

```bash
npm run db:seed -- ./scripts/fixtures --prune
```

### 8. Make the repo public

Your own public-from-day-one constraint, still unmet. `LICENSE` and
`LICENSE-DATA` are in place. One reasonable trigger: flip it the day the
first real material renders on the live detail page — "public with real
content" is a stronger first impression than an empty shell.

### 9. Align the Supabase minimum password length

The dashboard allows 6; `lib/validation/auth.ts` requires 8. Our forms
enforce 8, so this only matters for flows that bypass them. Set the dashboard
to 8 so the two agree.

---

## 🟢 Scheduled / not yet urgent

| When            | What                                                                                                                                                                                                                                                                                                                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Now, ongoing    | **Author the five hand-cited materials** + `families.json`, `usage-categories.json`, `hazard-codes.json`, and create the `perfumers-codex-data` repo. Format: `lib/validation/material-data.ts`; worked example: `scripts/fixtures/test-material-alpha.json`. Budget 2–3 hrs each. **This is the critical path** — everything else is scaffolding until it lands. |
| ~end Nov 2026   | IFRA 52nd Amendment notification. Keep stamping "51st" until then; afterwards insert new rows stamped "52nd", never overwrite. Folds into the Week 19 data push.                                                                                                                                                                                                  |
| Before Week 19a | Review the structure–odor training-data licences (Leffingwell / GoodScents-derived). Never redistribute as project data.                                                                                                                                                                                                                                          |
| Week 20         | Resend SMTP (the built-in sender is rate-limited to a handful of auth emails per hour — it breaks on launch day), upgrade Supabase to Pro, `hello@perfumerscodex.com` alias.                                                                                                                                                                                      |
| Anytime         | LinkedIn project paragraph; the cheminformatics and odor-map spikes.                                                                                                                                                                                                                                                                                              |

---

## Known debt (tracked, not blocking)

- **Every route is dynamically rendered.** The header's `getUser()` reads
  cookies, so `/`, `/login`, `/signup` lost static generation. Wave 4
  mandated the server-side check; this is its price. First item for the
  deferred caching pass, where partial prerendering can keep the shell static
  and stream just the auth affordance.
- **`notFound()` returns HTTP 200** on streamed routes, with `noindex` as the
  documented mitigation. Next behaviour, not ours.
- **Rate limiting is absent** on search, signup, login, note saves and the
  account mutations. Deliberately the Week 18 Upstash pass; the deferral is
  recorded in the code itself, not only in the wave docs.
