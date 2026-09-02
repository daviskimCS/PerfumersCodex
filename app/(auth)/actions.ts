'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isAuthError } from '@supabase/supabase-js'
import { z } from 'zod'

import { env } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'
import {
  googleSignInSchema,
  signInSchema,
  signUpSchema,
  type AuthFormState,
} from '@/lib/validation/auth'

/**
 * Auth server actions (W3-A). Server Functions are reachable via direct
 * POST, so nothing here trusts client-side validation: every action
 * re-parses its input with `safeParse` (D6) before touching Supabase.
 *
 * Rate limiting on signup/login is deferred to Week 18 (Upstash) — recorded
 * in docs/waves/wave-3.md; do not bolt it on here. `signInWithGoogle` below
 * is covered by the same deferral: starting an OAuth round trip is as cheap
 * to spam as a login POST, and it gets the same Upstash bucket in Week 18.
 */

/**
 * Map a Supabase auth failure to plain language. Never echo the raw error —
 * its message is API internals, not copy. Unknown codes get a generic line;
 * the real error is logged server-side for diagnosis.
 */
function formErrorFor(error: unknown): string {
  console.error('[auth] Supabase auth error:', error)

  const code = isAuthError(error) ? error.code : undefined
  switch (code) {
    case 'invalid_credentials':
      return 'Incorrect email or password.'
    case 'email_not_confirmed':
      return 'This email address hasn’t been confirmed yet. Use the link in your confirmation email — or sign up again to get a new one.'
    case 'user_already_exists':
    case 'email_exists':
      return 'An account with this email already exists. Try signing in instead.'
    case 'weak_password':
      return 'That password is too easy to guess. Try a longer one.'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Too many attempts in a short time. Wait a few minutes, then try again.'
    case 'email_address_invalid':
    case 'validation_failed':
      return 'That email address can’t be used. Check it for typos.'
    case 'signup_disabled':
      return 'Sign-ups are switched off at the moment.'
    default:
      return 'Something went wrong on our end. Please try again.'
  }
}

export async function signUp(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Where the confirmation email may send the user afterwards. Must be
      // registered in the Supabase dashboard's redirect allow-list (maker's
      // email-template step). The route itself defaults onward to /account.
      emailRedirectTo: new URL(
        '/auth/confirm',
        env.NEXT_PUBLIC_SITE_URL
      ).toString(),
    },
  })

  if (error) {
    return { formError: formErrorFor(error) }
  }

  // Email confirmation is ON, so a successful signUp means "link sent", not
  // "session exists". Note Supabase also reports success (with a stub user)
  // when the address already belongs to a confirmed account — deliberate
  // enumeration protection, and "check your email" stays truthful either way.
  return { sentTo: parsed.data.email }
}

export async function signIn(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return { formError: formErrorFor(error) }
  }

  // The session cookie changed, so anything cached per-visitor is stale.
  revalidatePath('/', 'layout')
  redirect('/account')
}

/**
 * Plain language for a failure in the OAuth *start*, kept separate from
 * `formErrorFor` on purpose: the two share codes that mean different things
 * here. `validation_failed` on a password form means a malformed email; on
 * `/authorize` it is what Supabase returns for a provider that is switched
 * off ("Unsupported provider: provider is not enabled"), and telling someone
 * to check their email address for typos would be a lie.
 */
function oauthErrorFor(error: unknown): string {
  console.error('[auth] Google sign-in could not be started:', error)

  const code = isAuthError(error) ? error.code : undefined
  switch (code) {
    case 'provider_disabled':
    case 'validation_failed':
      return GOOGLE_UNAVAILABLE
    case 'over_request_rate_limit':
      return 'Too many attempts in a short time. Wait a few minutes, then try again.'
    default:
      return 'We couldn’t start Google sign-in. Try again, or use your email and password.'
  }
}

const GOOGLE_UNAVAILABLE =
  'Google sign-in isn’t available right now. Use your email and password instead.'

/**
 * The shape of `GET /auth/v1/settings` that we care about. Unlisted keys are
 * dropped rather than rejected, so Supabase adding providers cannot break the
 * parse.
 */
const authSettingsSchema = z.object({
  external: z.object({ google: z.boolean() }),
})

/**
 * Is the Google provider actually enabled on this Supabase project?
 * `true`/`false` when we know, `null` when the probe itself failed.
 *
 * This exists because `signInWithOAuth` CANNOT tell us. It performs no
 * network call — it only builds the `/authorize` URL and stores a PKCE
 * verifier — so it returns `{ error: null }` whether or not the provider is
 * configured. The failure surfaces one hop later, and Supabase answers a
 * disabled provider at `/authorize` with a raw JSON 400
 * (`{"error_code":"validation_failed","msg":"Unsupported provider: provider
 * is not enabled"}`), NOT with a redirect back to `redirectTo` carrying
 * `error` parameters. Without this probe the reader would be dropped on a
 * JSON blob at supabase.co with no way back — the white screen the acceptance
 * criteria forbid. `/auth/v1/settings` is the public endpoint that reports
 * exactly this, so we ask it before starting a flow that cannot finish.
 *
 * Deliberately fail-OPEN: a probe that errors returns `null` and the caller
 * proceeds. An inconclusive probe means we do not know, and refusing a
 * working provider because a health check blipped is the worse failure once
 * the maker has turned Google on.
 */
async function googleProviderEnabled(): Promise<boolean | null> {
  try {
    const response = await fetch(
      new URL('/auth/v1/settings', env.NEXT_PUBLIC_SUPABASE_URL),
      {
        headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
        // Provider configuration is a live fact about the project, and this
        // is the deliberate exception to the deferred caching pass: a cached
        // "disabled" would outlive the maker enabling it.
        cache: 'no-store',
      }
    )
    if (!response.ok) return null

    const parsed = authSettingsSchema.safeParse(await response.json())
    return parsed.success ? parsed.data.external.google : null
  } catch (error) {
    console.error('[auth] Could not read Supabase auth settings:', error)
    return null
  }
}

/**
 * Start "Continue with Google" (W7-A).
 *
 * Server-side PKCE, per current `@supabase/ssr` guidance: `signInWithOAuth`
 * generates a code verifier and stores it through the server client's cookie
 * adapter, then hands back the `/authorize` URL to send the browser to.
 * `createServerClient` buffers most storage writes until an auth event, but
 * it special-cases every key ending in `-code-verifier` and flushes those to
 * `Set-Cookie` immediately — which is the only reason this works from a
 * Server Action, and the reason the verifier must be written here rather than
 * anywhere the cookie store is read-only. `app/auth/callback/route.ts` reads
 * that cookie back to complete the exchange.
 *
 * `redirect()` throws, so it stays outside any try/catch, and the Set-Cookie
 * headers written above ride out on its 303.
 *
 * MAKER, before this stops being dormant: enable Google in the Supabase
 * dashboard (with Google Cloud Console OAuth credentials), and add the
 * callback to the redirect allow-list. A `next` path is carried as a query
 * parameter on `redirectTo`, and Supabase matches allow-list entries against
 * the query string too — so the entry needs to be
 * `https://perfumerscodex.com/auth/callback**`, not the bare path, or
 * deep-link returns will be rejected while the plain one works.
 */
export async function signInWithGoogle(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  // Sanitizing parse: an unsafe or missing `next` becomes `undefined` and the
  // callback falls back to /account. There is no field error to render here,
  // so a parse failure degrades to the same default rather than a 500 (D6).
  const parsed = googleSignInSchema.safeParse({ next: formData.get('next') })
  const next = parsed.success ? parsed.data.next : undefined

  const callbackUrl = new URL('/auth/callback', env.NEXT_PUBLIC_SITE_URL)
  if (next !== undefined) {
    callbackUrl.searchParams.set('next', next)
  }

  // Ask before starting: a flow begun against a disabled provider ends on
  // Supabase's JSON error page, not back on this site.
  if ((await googleProviderEnabled()) === false) {
    console.error(
      '[auth] Google sign-in attempted while the provider is disabled on the Supabase project.'
    )
    return { formError: GOOGLE_UNAVAILABLE }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callbackUrl.toString() },
  })

  if (error || !data.url) {
    return { formError: oauthErrorFor(error) }
  }

  redirect(data.url)
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()
  if (error) {
    // Sign-out failing (already-expired session, network blip) still ends at
    // the same place for the user; log it and continue to the redirect —
    // createServerClient has already cleared the local cookies.
    console.error('[auth] Supabase sign-out error:', error)
  }

  revalidatePath('/', 'layout')
  redirect('/login')
}
