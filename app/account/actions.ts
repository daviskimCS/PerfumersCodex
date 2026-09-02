'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  isAuthError,
  isAuthRetryableFetchError,
  type User,
} from '@supabase/supabase-js'
import { z } from 'zod'

import { env } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  changeEmailSchema,
  changePasswordSchema,
  deleteAccountSchema,
  type ChangeEmailState,
  type ChangePasswordState,
  type DeleteAccountState,
} from '@/lib/validation/account'

/**
 * Account-management server actions (W6-B / P3-C).
 *
 * Every action here follows the two rules `app/(auth)/actions.ts` and
 * `app/saved/actions.ts` already follow, and one more that only applies here.
 *
 * **Nothing from the client is trusted.** Server Functions are reachable by
 * direct POST, not only through the forms on `/account`, so each action
 * re-parses its input with the shared Zod schema (D6) before any effect.
 *
 * **Raw Supabase errors never reach the page.** They are API internals, not
 * copy: they are logged server-side and mapped to plain language by
 * `formErrorFor` below.
 *
 * **The caller is always re-derived server-side.** Every action asks
 * `supabase.auth.getUser()` — which validates the token against the auth
 * server — rather than `getSession()`, which would believe whatever the cookie
 * claimed (AGENTS.md, auth and security). On `deleteAccount` that is not a
 * style preference: an id taken from the request instead of from `getUser()`
 * would make this an account-deletion endpoint for arbitrary users.
 *
 * Rate limiting on these three mutations is the **Week 18 Upstash pass**
 * (docs/waves/wave-6.md, constraint 4). This comment is the deferral record —
 * do not bolt it on here, and do not drop it from AGENTS.md's obligations.
 * Supabase applies its own send-rate limits to the confirmation email in the
 * meantime, which is why `over_email_send_rate_limit` is mapped below.
 */

/** Shown when the session is gone by the time an action runs. */
const SIGNED_OUT_MESSAGE =
  'You’re not signed in any more. Sign in again, then try that once more.'

/**
 * Shown when the auth service could not be reached at all. Distinct from the
 * message above on purpose: "you were logged out" is a false and alarming way
 * to describe a network blip.
 */
const UNREACHABLE_MESSAGE =
  'We couldn’t reach the sign-in service just now. Nothing was changed — try again in a moment.'

/**
 * Map a Supabase failure to plain language.
 *
 * Same shape and the same rule as `app/(auth)/actions.ts`'s mapper — the real
 * error is logged server-side, an unknown code gets a generic line, and the
 * reader never sees an API internal. The codes differ because these are the
 * failures the account surfaces can actually produce.
 */
function formErrorFor(error: unknown): string {
  console.error('[account] Supabase error:', error)

  const code = isAuthError(error) ? error.code : undefined
  switch (code) {
    case 'email_exists':
    case 'user_already_exists':
      return 'An account already uses that email address.'
    case 'email_address_invalid':
    case 'validation_failed':
      return 'That email address can’t be used. Check it for typos.'
    case 'email_address_not_authorized':
      return 'That email address can’t be used here.'
    case 'same_password':
      return 'That is already your password. Choose a different one.'
    case 'weak_password':
      return 'That password is too easy to guess. Try a longer one.'
    case 'reauthentication_needed':
    case 'reauthentication_not_valid':
      return 'For security, sign out and sign back in, then try that again.'
    case 'session_expired':
    case 'session_not_found':
    case 'bad_jwt':
    case 'user_not_found':
      return SIGNED_OUT_MESSAGE
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Too many attempts in a short time. Wait a few minutes, then try again.'
    case 'email_provider_disabled':
    case 'provider_disabled':
      return 'Email sign-in is switched off at the moment.'
    default:
      return 'Something went wrong on our end. Please try again.'
  }
}

/**
 * The signed-in user, verified against the auth server — or the plain-language
 * reason there isn't one.
 *
 * Deliberately not shared with `lib/db/bookmarks.ts`'s cached
 * `getCurrentUserId`: these actions need the whole user (the email, to
 * re-verify a password against), and a mutation should ask for the caller
 * itself rather than read a value memoised for some earlier render in the same
 * request.
 *
 * It keeps the distinction `app/account/page.tsx` and `lib/db/bookmarks.ts`
 * both draw — the auth service being unreachable is not the same thing as
 * being signed out, and telling a signed-in reader they have been logged out
 * because of a network blip is a lie about their session. Unlike those two, a
 * mutation reports it as a form-level message rather than throwing: throwing
 * would replace the form with the error boundary and lose what was typed.
 */
type Caller = { ok: true; user: User } | { ok: false; message: string }

async function verifiedCaller(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Caller> {
  const { data, error } = await supabase.auth.getUser()
  if (error) {
    console.error('[account] getUser failed:', error)
    return {
      ok: false,
      message: isAuthRetryableFetchError(error)
        ? UNREACHABLE_MESSAGE
        : SIGNED_OUT_MESSAGE,
    }
  }
  if (!data.user) {
    return { ok: false, message: SIGNED_OUT_MESSAGE }
  }
  return { ok: true, user: data.user }
}

// ---------------------------------------------------------------------------
// Change email
// ---------------------------------------------------------------------------

/**
 * Ask Supabase to move the account to a new address.
 *
 * **This does not change the address.** Supabase emails a confirmation link
 * (to both the old and the new address while "Secure email change" is on, which
 * is the default), and the account keeps its current email until those links
 * are followed. The success value is therefore named `confirmationSentTo`, and
 * the form renders it as "we sent a link", never as "your email is now …".
 *
 * The link lands on `/auth/confirm`, the route W3-A already ships: it passes
 * `type` through to `verifyOtp` generically, so the `email_change` type it will
 * carry needs no new handling.
 */
export async function changeEmail(
  _prevState: ChangeEmailState,
  formData: FormData
): Promise<ChangeEmailState> {
  const parsed = changeEmailSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const supabase = await createClient()
  const caller = await verifiedCaller(supabase)
  if (!caller.ok) {
    return { formError: caller.message }
  }

  // Addresses are case-insensitive for this purpose; asking Supabase to send a
  // confirmation for the address already on the account is a wasted email and
  // a confusing one.
  if (caller.user.email?.toLowerCase() === parsed.data.email.toLowerCase()) {
    return {
      fieldErrors: { email: ['That is already your email address.'] },
    }
  }

  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    {
      // Must be registered in the Supabase dashboard's redirect allow-list —
      // the same maker step W3-A's signup redirect depends on.
      emailRedirectTo: new URL(
        '/auth/confirm',
        env.NEXT_PUBLIC_SITE_URL
      ).toString(),
    }
  )

  if (error) {
    return { formError: formErrorFor(error) }
  }

  // The page reads `user.new_email` to show the pending banner, so the server
  // render has to be redone for the banner to appear.
  revalidatePath('/account')
  return { confirmationSentTo: parsed.data.email }
}

// ---------------------------------------------------------------------------
// Change password
// ---------------------------------------------------------------------------

/**
 * Change the password, having first proved the current one.
 *
 * Supabase's `updateUser({ password })` does **not** require the current
 * password unless the project has "Secure password change" switched on, so the
 * requirement in the acceptance criteria is enforced here rather than assumed:
 * the current password is checked with `signInWithPassword` against the address
 * `getUser()` just returned, and a failure stops the action before
 * `updateUser` is reached. That call also refreshes the session cookies for
 * the same user, which is harmless and keeps the caller signed in.
 */
export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  })
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const supabase = await createClient()
  const caller = await verifiedCaller(supabase)
  if (!caller.ok) {
    return { formError: caller.message }
  }
  const email = caller.user.email
  if (!email) {
    // A verified caller with no email address is an identity that cannot be
    // re-verified by password at all (an OAuth-only account). Saying so beats
    // failing the password check it can never pass.
    return {
      formError:
        'This account doesn’t sign in with a password, so there is no password to change.',
    }
  }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.currentPassword,
  })
  if (reauthError) {
    console.error('[account] current-password check failed:', reauthError)
    // A wrong current password is a field to correct, not a form-level
    // failure, so it is reported where the reader can act on it.
    if (
      isAuthError(reauthError) &&
      reauthError.code === 'invalid_credentials'
    ) {
      return {
        fieldErrors: { currentPassword: ['That isn’t your current password.'] },
      }
    }
    return { formError: formErrorFor(reauthError) }
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  })
  if (error) {
    return { formError: formErrorFor(error) }
  }

  // The session cookies were just rotated twice; anything cached per-visitor
  // is stale.
  revalidatePath('/', 'layout')
  return { changed: true }
}

// ---------------------------------------------------------------------------
// Delete account
// ---------------------------------------------------------------------------

/**
 * Delete the caller's own account, permanently.
 *
 * ── The most destructive action in the codebase ───────────────────────────
 * Three properties make it safe, and all three are load-bearing:
 *
 * 1. **The id is never taken from the request.** There is no user id in the
 *    form, in the arguments, or in the URL. The only id this function can ever
 *    delete is the one `getUser()` returns on the line below, one statement
 *    before the delete. Adding a parameter for it would turn this into an
 *    endpoint that deletes arbitrary accounts.
 * 2. **`getUser()`, never `getSession()`.** `getSession()` reports whatever the
 *    cookie claims without validating it against the auth server. Here that
 *    difference is not a style preference — it is the difference between
 *    "deletes the caller" and "deletes whoever the cookie names".
 * 3. **The admin client stays on the server.** `lib/supabase/admin.ts` is
 *    imported by this `'use server'` module only. The secret key never enters a
 *    client component and never enters the browser bundle.
 *
 * The cleanup is the database's, not this function's: `ON DELETE CASCADE` on
 * the user tables removes the caller's bookmarks and notes when the `auth.users`
 * row goes. Nothing here hand-deletes rows — a hand-written list would silently
 * miss the next user table someone adds. That cascade is the thing standing
 * between "account deleted" and "rows orphaned", and it is verified against a
 * throwaway account by the maker (docs/waves/wave-6.md, "After the wave").
 *
 * `deleteUser(id)` defaults to a HARD delete (`shouldSoftDelete` defaults to
 * false) — which is the requirement, not an accident: user-owned data is
 * hard-deleted for GDPR (AGENTS.md). Soft-delete is for editorial content only.
 */
export async function deleteAccount(
  _prevState: DeleteAccountState,
  formData: FormData
): Promise<DeleteAccountState> {
  const parsed = deleteAccountSchema.safeParse({
    confirmation: formData.get('confirmation'),
  })
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const supabase = await createClient()
  const caller = await verifiedCaller(supabase)
  if (!caller.ok) {
    return { formError: caller.message }
  }

  // The one and only id this action will delete: the caller's own, as the auth
  // server just confirmed it. Never a form field, never an argument.
  const userId = caller.user.id

  const { error } = await createAdminClient().auth.admin.deleteUser(userId)
  if (error) {
    console.error('[account] account deletion failed:', error)
    // Careful with this copy. A failed *response* is not proof the deletion did
    // not happen — a timeout can lose the answer to a request that succeeded —
    // so this does not promise that nothing was removed. It sends the reader
    // somewhere they can see the truth for themselves.
    return {
      formError:
        'We couldn’t confirm that the account was deleted. Reload this page to see where things stand before trying again.',
    }
  }

  // The account is gone; the cookies in this browser still name it. auth-js
  // tolerates the 404 this sign-out gets back (the user no longer exists) and
  // clears the local session either way, which is the whole remaining job.
  const { error: signOutError } = await supabase.auth.signOut()
  if (signOutError) {
    console.error('[account] sign-out after deletion failed:', signOutError)
  }

  revalidatePath('/', 'layout')
  redirect('/')
}
