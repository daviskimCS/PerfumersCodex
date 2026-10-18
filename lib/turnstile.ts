import { headers } from 'next/headers'

import { env } from '@/lib/env'
import { clientIp } from '@/lib/supabase/auth-server'
import { TURNSTILE_FIELD } from '@/lib/validation/turnstile'

const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export const TURNSTILE_FAILED_MESSAGE =
  'We couldn’t confirm this request came from a person. Wait a moment, then try again.'

/**
 * Check the Cloudflare Turnstile token a form sent
 * (components/auth/turnstile.tsx).
 *
 * The server actions check it themselves rather than handing it to Supabase.
 * They call Supabase Auth with the secret key (lib/supabase/auth-server.ts,
 * so Supabase sees the reader's IP address), and Supabase skips its own
 * CAPTCHA for secret-key calls. Supabase's CAPTCHA setting still guards the
 * other way in: bots sending passwords straight to Supabase with the public
 * key.
 *
 * Returns true when the check passes or is switched off (TURNSTILE_SECRET_KEY
 * unset). Fails closed: if Cloudflare cannot be reached, the form asks the
 * reader to try again instead of letting the request through.
 */
export async function passesTurnstile(formData: FormData): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET_KEY
  if (!secret) return true

  const token = formData.get(TURNSTILE_FIELD)
  if (typeof token !== 'string' || token === '') return false

  const body = new URLSearchParams({ secret, response: token })
  const ip = clientIp(await headers())
  if (ip) body.set('remoteip', ip)

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) {
      console.error('[turnstile] siteverify answered', response.status)
      return false
    }
    const result = (await response.json()) as {
      success?: boolean
      'error-codes'?: string[]
    }
    if (!result.success) {
      console.warn('[turnstile] token refused:', result['error-codes'])
    }
    return result.success === true
  } catch (error) {
    console.error('[turnstile] siteverify unreachable:', error)
    return false
  }
}
