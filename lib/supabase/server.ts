import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { env } from '@/lib/env'

// Server client — for Server Components, Server Actions, and Route Handlers.
// Verify auth with supabase.auth.getClaims() for reads and gating (verifies
// the token's signature locally) and supabase.auth.getUser() before sensitive
// writes (asks the auth server, so a revoked session is refused at once).
// Never getSession(), which reads the cookie unverified. See AGENTS.md.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component, where cookies can't be written.
            // Safe to ignore: the proxy refreshes sessions for those requests.
          }
        },
      },
    }
  )
}
