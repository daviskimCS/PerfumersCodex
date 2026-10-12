import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'
import { safeInternalPath } from '@/lib/validation/auth'

/**
 * Email-link landing (W3-A), per current Supabase SSR guidance: the Supabase
 * email templates link here with a token hash, this handler verifies it
 * server-side, and the session cookies are set on the redirect.
 *
 * Expected URL shapes, one per template (docs/legal/account-data.md has the
 * exact values the maker pastes in; Supabase templates have no `{{ .Type }}`
 * variable, so each template spells its own type out):
 *
 *   Confirm signup        /auth/confirm?token_hash={{ .TokenHash }}&type=email
 *   Change email address  /auth/confirm?token_hash={{ .TokenHash }}&type=email_change
 *   Reset password        /auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
 *
 * Optional `next=/some/path` overrides the post-confirm destination
 * (same-site paths only); it defaults to /account. Failure — missing
 * params, expired or reused link — lands on /login with a readable notice,
 * never a raw error.
 *
 * Supabase's DEFAULT templates link to its own `/auth/v1/verify` instead,
 * which checks the token and then sends the reader here with `?code=…` (the
 * `emailRedirectTo` / `redirectTo` the actions pass). That is handled too, so
 * a template left at its default degrades to "confirmed, please sign in"
 * rather than claiming a link that worked was invalid.
 */

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  // EmailOtpType is an open union (it admits any string), so this cast is
  // honest: an unrecognized type simply fails verifyOtp with an error.
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const next = safeInternalPath(searchParams.get('next')) ?? '/account'
  const isReset = type === 'recovery' || next === '/reset-password'

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    })
    // With "Secure email change" on, the first of the two email-change links
    // succeeds without a session; /account still shows the change as pending
    // until the second one is opened.
    if (!error) {
      redirect(next)
    }
    console.error('[auth] Email confirmation failed:', error)
  } else if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      redirect(next)
    }
    // Supabase issues a code only after it has accepted the emailed token, so
    // the address is confirmed. What failed is signing THIS browser in: the
    // code needs the verifier cookie set where the request was made, and the
    // link was opened somewhere else. A reset still needs a fresh link.
    console.error('[auth] Email link code exchange failed:', error)
    redirect(isReset ? '/login?error=reset' : '/login?notice=confirmed')
  }

  // /login reads this flag and shows the plain-language explanation. A
  // failed reset link gets its own wording: "sign up again" is the wrong
  // advice for someone who already has an account and forgot the password.
  redirect(isReset ? '/login?error=reset' : '/login?error=confirm')
}
