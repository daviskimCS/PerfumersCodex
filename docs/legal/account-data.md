# Account data: what is held, what the law asks, what is done

Written 2026-10-12 from the code and from a local Supabase auth server, not
from a template. **This is an engineer's map, not legal advice.** Every item
marked ⚖️ is one a lawyer should confirm before launch; everything else is a
fact about the system or a step with an owner.

## 1. What an account holds, and where

| Data                                                                         | Where                                                            | Written by       | Goes on account deletion?                                                                                      |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------- |
| Email, password hash, created / confirmed / last-sign-in times               | `auth.users` (Supabase)                                          | Supabase Auth    | Yes                                                                                                            |
| Google profile: name, email, picture URL, Google `sub` (Google sign-in only) | `auth.identities.identity_data`, `auth.users.raw_user_meta_data` | Supabase Auth    | Yes                                                                                                            |
| Sessions: IP address, user agent, timestamps                                 | `auth.sessions`, `auth.refresh_tokens`                           | Supabase Auth    | Yes (verified: integration test)                                                                               |
| **Audit log: email, IP address, action, time**                               | `auth.audit_log_entries`                                         | Supabase Auth    | **No.** Not keyed to the user; the deletion event itself records the email. Verified on GoTrue v2.179 locally. |
| Saved materials (user id, material id, time)                                 | `public.user_saved_materials`                                    | App, through RLS | Yes (`ON DELETE CASCADE`, verified)                                                                            |
| Notes (user id, material id, text, times)                                    | `public.user_notes`                                              | App, through RLS | Yes (verified)                                                                                                 |
| Search log (query text, result count, time)                                  | `public.search_queries`                                          | App              | Not personal data: no user id, IP or session column                                                            |
| Request logs (IP, URL, user agent)                                           | Vercel and Supabase platform logs                                | The platforms    | Platform retention (short on free plans)                                                                       |
| Page-view counts                                                             | Vercel Web Analytics                                             | Vercel           | Cookieless, no IP stored                                                                                       |
| Theme, recent searches                                                       | Browser `localStorage`                                           | Browser          | Never leaves the device                                                                                        |

Not held anywhere: payment data, phone numbers, addresses, Google tokens
(Supabase does not persist the provider token), anything from Google beyond
`email` and `profile` scopes (Supabase's defaults: `signInWithGoogle`
requests no extra scopes, and `tests/integration/google.integration.test.ts`
asserts the default).

## 2. What applies

| Regime                                                        | Applies?                        | Why                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GDPR / UK GDPR**                                            | ⚖️ Probably, for EU/UK sign-ups | Davis is not established in the EU/UK, so it turns on Art. 3(2): offering a service to people there. A free English-language site open to everyone is a grey zone; the safe course, and the one taken, is to meet the obligations anyway. They cost little for this data set. |
| **EU/UK representative (Art. 27)**                            | ⚖️ Likely exempt                | Exemption for occasional, low-risk processing that excludes special-category data. Notes are free text, so a reader _could_ write health data into one; the Terms ask them not to.                                                                                            |
| **CCPA / CPRA**                                               | No                              | Thresholds: $25M+ revenue, or 100k+ California consumers' data bought/sold/shared a year, or 50%+ revenue from selling data. None is close. Re-check if the site ever earns money.                                                                                            |
| **US state breach-notification laws**                         | Yes                             | Every state has one. Several (California among them) count _email + password_ as personal information, so a credentials breach triggers notice duties regardless of size.                                                                                                     |
| **COPPA**                                                     | No, by design                   | Not directed to children and no actual knowledge of under-13 users. Accounts are 16+ (Terms), which also clears GDPR Art. 8.                                                                                                                                                  |
| **Google API Services User Data Policy + OAuth verification** | Yes, once Google sign-in is on  | Privacy policy must disclose Google data use and the Limited Use statement; consent screen needs app name, home page, privacy and terms URLs, authorised domain; scopes must be the minimum.                                                                                  |
| **ePrivacy / cookie consent**                                 | No banner needed                | All three cookies are strictly necessary (gate, auth session, PKCE verifier).                                                                                                                                                                                                 |

## 3. Obligations, and their status

### Done in this change

- **Transparency (GDPR Art. 13):** `/privacy` now names the controller,
  states purpose and legal basis per data type (contract for the account,
  legitimate interest for sign-in security records), where data is stored,
  transfers, retention, rights incl. complaint to a regulator, breach
  promise, children. It also corrects a false claim: it used to say no IP
  address was stored anywhere, but Supabase Auth stores them for signed-in
  sessions and in its audit log.
- **Google disclosures:** `/privacy` lists exactly what Google sends, states
  it is used only for sign-in, and carries Google's Limited Use sentence.
- **Notice at collection:** `/signup` and `/login` say an account is under the
  Terms and link the Privacy notice. A notice, not a checkbox: consent is not
  the legal basis for an account, so a box would add nothing.
- **Access and portability (Art. 15, 20):** self-serve "Download your data"
  on `/account` (`/account/export`, JSON), covering the account record, every
  sign-in method with its provider profile, saved materials and notes. It
  says inside what it leaves out and why.
- **Erasure (Art. 17):** self-serve delete already existed; now proved by an
  automated test that deletes a real account and checks every `public`
  table with a `user_id` column, plus `auth.sessions`, `auth.identities`,
  `auth.refresh_tokens`. The audit-log gap is disclosed on `/privacy` and on
  the delete section of `/account` until it is closed (below).
- **Security of processing (Art. 32):** cross-account isolation (RLS) proved
  with two real accounts on every PR; password reset can no longer be used
  to bypass the current-password check; Google-only accounts are handled
  correctly.
- **Age:** Terms require 16+.

### Davis: before launch

1. **Bound the audit log to 30 days.** Keep writing it to the database
   (switching it off leaves only the platform's own auth logs, kept about a
   day on the free plan: too short to investigate a takeover reported a week
   later). GDPR allows keeping security logs for a defined, disclosed period.
   In the SQL editor (Database → Extensions → enable `pg_cron` first):

   ```sql
   select cron.schedule(
     'purge-auth-audit-log', '23 3 * * *',
     $$delete from auth.audit_log_entries where created_at < now() - interval '30 days'$$
   );
   ```

   The first nightly run is also the one-off purge of everything older,
   which cannot be undone. Then replace the retention placeholder in
   `/privacy` (#retention) with "30 days".

2. **Turn on a real email sender before inviting anyone.** Supabase's
   built-in sender only delivers to members of the project's team and is
   rate-limited ("not meant for production use", Supabase docs, _Configuring
   a custom SMTP provider_). Until this is done, nobody else gets a
   confirmation or reset email, so nobody else can finish signing up.
   Recommended: Resend (already the Week 20 plan; its free tier covers a
   small user base, check the current limits). Steps: add the domain
   `auth.perfumerscodex.com` in Resend; add the DNS records Resend shows
   (an MX and an SPF `TXT` on its `send` subdomain, and a DKIM `TXT` at
   `resend._domainkey`), plus a DMARC `TXT` at `_dmarc.perfumerscodex.com`
   (`v=DMARC1; p=none; rua=mailto:<your inbox>` to start); wait for
   "Verified"; then Supabase → Authentication → SMTP settings: host
   `smtp.resend.com`, port 465, user `resend`, password a Resend API key,
   sender `no-reply@auth.perfumerscodex.com`. Supabase then caps sending at
   30 per hour; raise it under Authentication → Rate Limits if needed.
3. **Point all three email templates at `/auth/confirm`** (after step 2, so
   the emails can actually leave). Supabase → Authentication → Emails →
   Templates. In each, replace `{{ .ConfirmationURL }}` in the link with the
   value below. These are the only values to use, for every email:

   | Template             | Link                                                                                         |
   | -------------------- | -------------------------------------------------------------------------------------------- |
   | Confirm signup       | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`                         |
   | Change email address | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change`                  |
   | Reset password       | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password` |

   Type the `type=` value out as shown. Supabase templates have **no**
   `{{ .Type }}` variable: it renders as nothing, the link arrives as
   `type=`, and every confirmation lands on "invalid or expired" (checked
   against the auth server's template code and by rendering it). With "Secure
   email change" on, the Change email address template goes to both the old
   and the new address, each with its own token, so the one link value covers
   both. If a template is left at its default the app still copes (it
   confirms the address and asks the reader to sign in when the link is opened
   in another browser), but the values above sign the reader straight in.

4. **Auth settings, once steps 2 and 3 are done** (turning on Confirm email
   before real email works locks out everyone outside the team):
   - Sign In / Providers → Email: **Confirm email** on, **Secure email
     change** on, **minimum password length 8** (the app's own forms and
     validation already require 8).
   - URL Configuration: Site URL `https://perfumerscodex.com`; Redirect URLs
     only `https://perfumerscodex.com/**` and `https://www.perfumerscodex.com/**`
     (no `*.vercel.app` wildcard). The app's email links and the Google
     callback all live under these.
   - The local `supabase/config.toml` mirrors these and is what the tests run
     against; it is never pushed to production.

5. **Fill the placeholders on `/privacy` and `/terms`:** contact email (a
   real inbox you read), the Supabase project region (Project Settings →
   General), governing law. Then read both end to end and remove the draft
   notice (`components/legal/legal-page.tsx`).
6. **Accept the processor terms:** Supabase's DPA (offered from the
   dashboard's organization settings and at supabase.com/legal/dpa) and
   Vercel's DPA (part of its terms; keep a copy for your records).
7. **Google consent screen** (with maker-todo item 4): app name "Perfumers
   Codex", support email, home page `https://perfumerscodex.com`, privacy
   `https://perfumerscodex.com/privacy`, terms
   `https://perfumerscodex.com/terms`, authorised domain
   `perfumerscodex.com`, and no scopes beyond the defaults Supabase asks for
   (`email`, `profile`; Google shows them as name, email address and profile
   picture). These scopes are non-sensitive, so verification is brand verification only (no
   security assessment). The gate must be down, or Google's reviewers cannot
   open the privacy page.
8. **Keep a breach plan** (below) somewhere you will find it.

### ⚖️ For a lawyer (one short review covers all of it)

- Whether GDPR/UK GDPR applies at all (Art. 3(2)), and whether the Art. 27
  representative exemption holds.
- The legal-basis wording in `/privacy` #basis.
- The transfer wording in `/privacy` #where once the region is filled in.
- Governing law and venue in `/terms`.
- The 16+ age line.
- Liability limitation wording in `/terms` (unchanged here, but never
  reviewed).

## 4. Breach plan (one page, keep it)

1. **Contain.** Rotate the Supabase secret key and, if relevant, the Google
   client secret; invalidate every session by rotating and then revoking the
   JWT signing key; put the site behind the gate.
2. **Establish what leaked:** which tables, which users, which time window.
   The integration suite's RLS file is a quick check that isolation still
   holds.
3. **Notify.** Users affected: by email, without undue delay, saying what was
   exposed and what to do (change the password elsewhere if reused). UK/EU
   regulators within 72 hours of becoming aware, if GDPR applies and there
   is a risk to people. US states: per the affected users' states;
   credentials breaches generally require notice.
4. **Record it** (date, scope, actions) even if no notice was required: GDPR
   Art. 33(5) asks for a record of every breach.

## 5. Where the proof lives

- `tests/integration/` — accounts, deletion, RLS, Google, run in CI against a
  local Supabase stack (`.github/workflows/ci.yml`, job `integration`).
- `tests/integration/README.md` — the manual Google check, the one leg no test
  can drive.
- `app/privacy/page.tsx` — header comment maps every claim to its code.
