# Maker to-do

Open work only Davis can do: dashboards, accounts, editorial judgment. Item
numbers are stable because code comments cite them; finished items are
removed (their history is in git). The ordered launch sequence, with exact
clicks and values, is kept outside the repository in the project's launch
checklist; this file holds what the code depends on.

## Publishing

- **Review and publish.** `npm run db:review show <slug>`, read the page it
  prints, then `npm run db:review publish <slug> <fingerprint>` with the
  fingerprint _your_ screen printed. Launch scope: Iso E Super and Javanol.
  Run `db:` commands only from a checkout that matches `origin/main`.
- **Replace the PROPOSED families.** `publish` refuses a material whose
  family is still a `proposed-*` placeholder, so every material other than
  the first three waits on this.
- **Write the remaining olfactive descriptions** (Civetone and the eleven
  later drafts have none).
- **Ship the IFRA category codes** (migration 0012, fingerprint v2). In
  this order: (1) dump the database, then from a fresh worktree of the PR's
  branch `npm ci && npm run db:migrate`; (2) re-seed from the data
  repository's PR branch; (3) merge both PRs; (4) `db:review show` and
  `publish` each material again. Never merge before step 1: the new code
  fails on a table without `sort_order`. The old code on the new table only
  hides pages whose fingerprint changed (tested), so steps 1 to 3 need not
  be rushed. Every published material stays hidden until its step 4.
- **Choose a licence file for the data repository.** The site publishes the
  data under CC BY-SA 4.0 (`LICENSE-DATA` here), but `PerfumersCodexData` has
  no licence file.

### 4. Configure Google as a sign-in provider

The button ships dormant: until this is done it says "Google sign-in isn't
available right now".

1. Google Cloud Console → APIs & Services → Credentials → create an OAuth
   client ID (Web application). Authorized redirect URI, exactly:
   `https://mwqaakwwpbmjejbfzbxj.supabase.co/auth/v1/callback` (Supabase's
   callback, not the app's; a mismatch is the usual `redirect_uri_mismatch`).
2. OAuth consent screen: default `email` and `profile` scopes only. While it
   is in "Testing" only listed accounts can sign in; publishing it needs
   `/privacy` public. Consent-screen values: `docs/legal/account-data.md`.
3. Supabase → Authentication → Providers → Google: enable, paste the client
   ID and secret.

Supabase links accounts by verified email, so Google sign-in with an address
that already has a password account joins that account. Test it once.

### 8. Prune the four synthetic fixtures before launch

`Test Material Alpha` to `Delta` are in the live database (hidden by the
review gate). Prune with `npm run db:seed -- <data-repo> --prune`, which
soft-deletes materials absent from the input and refuses if the input is
under half the live corpus without `--force-prune`. **Never seed
`scripts/fixtures` into the live database:** its usage categories share
codes with the real IFRA list and would rename every real category.

## Supabase and Vercel settings

### 6b. Decide the search-log retention

`search_queries` rows are kept indefinitely; no purge job exists, and
`/privacy` says so. Either schedule a daily `pg_cron` delete of rows older
than 90 days and update `/privacy`, `db/schema.ts` and
`docs/database-schema.md` together, or keep the log (it holds no user id, IP
or session).

### 7. Make the apex the primary domain in Vercel

`NEXT_PUBLIC_SITE_URL` and `og:url` advertise `perfumerscodex.com`, but
Vercel serves `www` as primary and redirects the apex to it.

### 10. Supabase minimum password length: 8

The forms require 8 (`lib/validation/auth.ts`); set the dashboard to match so
flows that bypass the forms agree.

### 11. Turn on asymmetric JWT signing keys

Project Settings → JWT Keys → create an ECC P-256 key → Rotate. Until then
`getClaims()` falls back to an auth-server round trip on every signed-in
read. Check: a session token's header reads `"alg":"ES256"` with a `"kid"`.
Revoked sessions then stay verifiable for up to an hour; the sensitive writes
still call `getUser()`.

### 12. Account data before launch

Details and exact values: `docs/legal/account-data.md` section 3.

1. Schedule a 30-day purge of `auth.audit_log_entries` (deletion does not
   clear it) and put "30 days" in `/privacy`.
2. Configure a custom SMTP sender; the built-in one reaches only the project
   team.
3. Point all three email templates at `/auth/confirm`, then turn on Confirm
   email and Secure email change, and limit redirect URLs to the two site
   domains.
4. Fill the `/privacy` and `/terms` blanks, remove the draft notice, accept
   Supabase's and Vercel's data processing agreements.
5. One lawyer review of the items marked ⚖️ there.

## Later

- **IFRA 52nd Amendment** (expected late November 2026): re-check every
  limit and every verified absence; add rows stamped "52nd", never overwrite.
- **Structure–odor training data:** review the licences before any use.
- **Settle the data-shape backlog** (S1–S5 in the data repo's
  `DATA-DECISIONS.md`) before the corpus grows; each change to what a page
  renders re-fingerprints every material.
