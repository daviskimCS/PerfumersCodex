import { isIP } from 'node:net'

import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

import { env } from '@/lib/env'

/**
 * Server client for the Supabase Auth calls that Supabase rate-limits per IP
 * address: sign-up, password sign-in (including the current-password check on
 * /account) and the password-reset email. Nothing else.
 *
 * These calls run in server actions, so without help Supabase would see
 * Vercel's handful of outgoing addresses instead of the reader's. Every reader
 * would then share one rate-limit bucket, and one person hammering the sign-in
 * form could lock everyone out. Supabase's fix is the `Sb-Forwarded-For`
 * header, which it trusts only on requests made with the secret key, and only
 * once "IP Address Forwarding" is switched on (Authentication → Rate Limits).
 * Until then the header is ignored and nothing changes.
 *
 * The secret key bypasses row-level security, so this client must never read
 * or write data. Use lib/supabase/server.ts for everything else.
 */
export async function createAuthClient() {
  const cookieStore = await cookies()
  const readerIp = clientIp(await headers())

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SECRET_KEY,
    {
      global: {
        headers: readerIp ? { 'sb-forwarded-for': readerIp } : {},
      },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

/**
 * The reader's IP address as Vercel reports it. Vercel sets both headers
 * itself and overwrites any value the browser sent, so they can be trusted
 * there. Anything that is not a plain IP address is dropped, and Supabase
 * falls back to the address the request came from.
 */
export function clientIp(requestHeaders: Headers): string | null {
  const candidates = [
    requestHeaders.get('x-real-ip'),
    requestHeaders.get('x-forwarded-for')?.split(',')[0],
  ]
  for (const candidate of candidates) {
    const ip = candidate?.trim()
    if (ip && isIP(ip) !== 0) return ip
  }
  return null
}
