import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import {
  isAuthError,
  isAuthPKCECodeVerifierMissingError,
} from '@supabase/supabase-js'

import type { GoogleAuthNoticeCode } from '@/components/auth/google-button'
import { createClient } from '@/lib/supabase/server'
import { safeInternalPath } from '@/lib/validation/auth'

/**
 * OAuth landing (W7-A) — the `redirectTo` that `signInWithGoogle` hands to
 * Supabase, modelled on `app/auth/confirm/route.ts` and sharing its failure
 * posture: nothing here ever renders, it only redirects, and every way of
 * failing lands on `/login` with a notice a person can read.
 *
 * Expected URL shape on success:
 *
 *   /auth/callback?code={auth code}[&next=/some/path]
 *
 * Optional `next=/some/path` overrides the destination (same-site paths
 * only); it defaults to /account.
 *
 * The PKCE half: `signInWithGoogle` stored a code verifier in a cookie on the
 * way out, `exchangeCodeForSession` reads it back here and trades it plus
 * `code` for a session, and `@supabase/ssr` writes the session cookies on
 * this response. That cookie is why the round trip has to finish in the same
 * browser it started in — hence the distinct `google_expired` notice rather
 * than a catch-all "something went wrong".
 *
 * DORMANT until the maker enables Google on the Supabase project — same
 * situation as the confirm route, which shipped before the email template
 * pointed at it. Until then nothing reaches this handler with a `code`; the
 * button short-circuits with "isn't available right now" one step earlier.
 */

// Reads the query string and the session cookies, and can never be a
// meaningful static render. Explicit rather than inferred, matching the other
// touched routes; the deliberate caching pass is a later item's.
export const dynamic = 'force-dynamic'

/**
 * Map a provider-side failure to one of the notices `/login` knows how to
 * render. Supabase reports these as query parameters on the redirect —
 * `error` (the OAuth-level reason), `error_code` (Supabase's own code) and a
 * human-ish `error_description` we deliberately do not show: it is API prose,
 * not copy, and it is attacker-influenced text arriving in a URL.
 */
function noticeForProviderError(
  error: string,
  errorCode: string | null
): GoogleAuthNoticeCode {
  // Cancelling at Google's consent screen is the common, blameless case.
  if (error === 'access_denied') return 'google_cancelled'

  switch (errorCode) {
    case 'provider_disabled':
    case 'validation_failed':
      return 'google_unavailable'
    case 'flow_state_expired':
    case 'flow_state_not_found':
      return 'google_expired'
    default:
      return 'google_failed'
  }
}

/** Map a failed code exchange the same way. */
function noticeForExchangeError(error: unknown): GoogleAuthNoticeCode {
  // The verifier cookie this browser stored on the way out is gone: the trip
  // finished somewhere it did not start, or cookies were cleared or blocked.
  // Detected with auth-js's own predicate rather than a string literal — the
  // error's `code` is `pkce_code_verifier_not_found`, which is easy to write
  // down from memory as `…_missing` (the class name) and get silently wrong.
  if (isAuthPKCECodeVerifierMissingError(error)) return 'google_expired'

  const code = isAuthError(error) ? error.code : undefined
  switch (code) {
    case 'flow_state_expired':
    case 'flow_state_not_found':
      return 'google_expired'
    case 'provider_disabled':
      return 'google_unavailable'
    default:
      return 'google_failed'
  }
}

function loginWith(notice: GoogleAuthNoticeCode): never {
  redirect(`/login?error=${notice}`)
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const next = safeInternalPath(searchParams.get('next')) ?? '/account'

  // Provider-side failure. Checked before `code` because Supabase sends one
  // or the other, and a request carrying both is not one we should trust.
  const providerError = searchParams.get('error')
  if (providerError !== null) {
    console.error('[auth] OAuth provider returned an error:', {
      error: providerError,
      errorCode: searchParams.get('error_code'),
      errorDescription: searchParams.get('error_description'),
    })
    loginWith(
      noticeForProviderError(providerError, searchParams.get('error_code'))
    )
  }

  const code = searchParams.get('code')
  if (code === null) {
    // No code and no error: a bare visit, a stale bookmark, or a link someone
    // followed twice. Nothing went wrong that we can name, so say the general
    // thing rather than inventing a cause.
    console.error('[auth] OAuth callback reached with neither code nor error.')
    loginWith('google_failed')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth] OAuth code exchange failed:', error)
    loginWith(noticeForExchangeError(error))
  }

  // The session cookie changed, so anything cached per-visitor is stale —
  // the same reasoning `signIn` applies after a password login.
  revalidatePath('/', 'layout')
  redirect(next)
}
