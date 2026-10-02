import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { env } from '@/lib/env'

// Session refresh for the root proxy.ts (Next 16's renamed middleware).
// Server Components can't write cookies, so expired auth tokens are
// refreshed here and passed both to the server (request) and the browser
// (response).
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and auth.getClaims() —
  // it can cause hard-to-debug random logouts.
  //
  // `getClaims()`, not `getUser()` (AGENTS.md, auth and security). Both
  // refresh an expired access token first; the difference is what happens on
  // the ~59 minutes out of every hour when it is not expired. `getUser()`
  // asks the auth server on EVERY request, so a signed-in reader paid one
  // Supabase round trip here before a single byte of any page rendered.
  // `getClaims()` verifies the token's signature locally against the
  // project's public JWKS (fetched once, cached for ten minutes in the
  // auth client) — no round trip. Until the project's asymmetric signing
  // keys are turned on (docs/maker-todo.md item 11) the token is HS256 and
  // the client falls back to `getUser()` on its own, so this is never less
  // safe than before, only faster once the dashboard switch is flipped.
  //
  // The proxy only needs "is there a session to keep alive", which is
  // exactly what a locally-verified token answers. Anything that needs to
  // know the session is still valid *right now* (account deletion, email
  // and password changes) calls `getUser()` itself.
  await supabase.auth.getClaims()

  // If a response is ever constructed manually here, the supabaseResponse
  // cookies must be copied over, or sessions will desync.
  return supabaseResponse
}
