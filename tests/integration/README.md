# Integration tests: accounts and sign-in

`npm test` stays database-free. This suite is the other half: the real server
actions and route handlers for sign-up, sign-in, sign-out, password change and
reset, email change, account deletion and Google sign-in, plus the data-export
builder (`buildAccountExport`, called directly, not through its route), run
against a real Supabase auth server and database on your machine or the CI
runner. Only the Next.js runtime around them is stood in for (`setup.ts`:
`cookies()`, `redirect()`, `revalidatePath()`).

It never touches production. `env.ts` refuses to start unless every URL is a
loopback address, and there is no override.

## What it proves

| File                                 | Proves                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `email-password.integration.test.ts` | Sign-up needs the emailed link before sign-in works; the link, as the documented template writes it, signs you in; a link from Supabase's default template also works (signs you in in the same browser, says "confirmed, sign in" in another, and works for reset); wrong password and unknown address get the same answer; sign-out clears the cookie; password change needs the current password; email change stays pending until the links to both addresses are opened, then takes effect; a reset link sets a new password without the old one, and an ordinary session cannot use the reset page to skip the current-password check; deletion removes the account, its sessions and identities, and every row in every `public` table with a `user_id`. |
| `rls.integration.test.ts`            | With two real accounts: neither can read, change, delete, forge or re-point the other's bookmarks or notes through the Data API; a signed-out visitor reads and writes nothing, including the editorial tables and the search view; `lib/db` and the data export return only the caller's rows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `google.integration.test.ts`         | "Continue with Google" stores a PKCE verifier and hands off to Supabase, which forwards to Google asking for `email` and `profile` only, with our callback as the destination; an off-site `next` is dropped; every failed return (cancelled, wrong browser, forged code, bare visit) lands on `/login` with a notice and no session.                                                                                                                                                                                                                                                                                                                                                                                                                           |

## Run it locally

Needs Docker and the Supabase CLI (`npx supabase@2.110.0 …` works without
installing it).

```bash
supabase start -x studio,imgproxy,storage-api,realtime,edge-runtime,logflare,vector,supavisor,postgres-meta
supabase status -o env        # note API_URL, PUBLISHABLE_KEY, SECRET_KEY, DB_URL

export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # PUBLISHABLE_KEY
export SUPABASE_SECRET_KEY=sb_secret_...                         # SECRET_KEY
export TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Once per fresh stack, before the migrations (why: the comment in the file).
psql "$TEST_DATABASE_URL" -f tests/integration/supabase-legacy-grants.sql
DIRECT_URL="$TEST_DATABASE_URL" npm run db:migrate

npm run test:integration
```

These are the local stack's well-known development keys, not secrets. Never
put production values in these variables; the suite will refuse them anyway.

`supabase stop --no-backup` throws the stack away.

## What only a person can check: real Google sign-in

Google's consent screen cannot be driven by a test, and the local stack uses a
fake Google client on purpose. After Google is enabled in the production
dashboard (docs/maker-todo.md item 4), do this once on a Vercel preview or on
production, and again whenever the Google or Supabase settings change:

1. Signed out, press **Continue with Google** on `/login`. Google's consent
   screen names Perfumers Codex, shows the privacy policy and terms links, and
   asks only for name, email address and profile picture.
2. Approve. You land on `/account`, signed in, with your Google address shown,
   no password section, and "Download your data" listing a `google` sign-in
   method.
3. Press the button again and cancel on Google's screen. You land on `/login`
   with "Google sign-in was cancelled".
4. Sign out. Create an email/password account with a Google address you own,
   confirm it, sign out, then **Continue with Google** with that address. It
   signs you into the same account (Supabase links verified emails), and the
   password section is still there.
5. Delete the test account from `/account`. Then, in the Supabase SQL editor:
   `select count(*) from auth.users where email = '<that address>';` is `0`.
6. In your Google account's "Third-party connections", remove Perfumers Codex.
