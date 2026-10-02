import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'
import { safeInternalPath } from '@/lib/validation/auth'

/**
 * Email-confirmation landing (W3-A), per current Supabase SSR guidance:
 * the Supabase email templates link here with a token hash, this handler
 * verifies it server-side, and the session cookies are set on the redirect.
 *
 * Expected URL shape (the maker points the confirm-email template at this):
 *
 *   /auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}
 *
 * Optional `next=/some/path` overrides the post-confirm destination
 * (same-site paths only); it defaults to /account. Failure — missing
 * params, expired or reused link — lands on /login with a readable notice,
 * never a raw error.
 */

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  // EmailOtpType is an open union (it admits any string), so this cast is
  // honest: an unrecognized type simply fails verifyOtp with an error.
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeInternalPath(searchParams.get('next')) ?? '/account'

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    })
    if (!error) {
      redirect(next)
    }
    console.error('[auth] Email confirmation failed:', error)
  }

  // /login reads this flag and shows the plain-language explanation.
  redirect('/login?error=confirm')
}
