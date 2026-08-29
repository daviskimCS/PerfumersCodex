'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isAuthError } from '@supabase/supabase-js'
import { z } from 'zod'

import { env } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'
import {
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
 * in docs/waves/wave-3.md; do not bolt it on here.
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
