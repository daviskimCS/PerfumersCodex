import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Session refresh for the root proxy.ts (Next 16's renamed middleware).
// Server Components can't write cookies, so expired auth tokens are
// refreshed here and passed both to the server (request) and the browser
// (response).
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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

  // Do not run code between createServerClient and auth.getUser() —
  // it can cause hard-to-debug random logouts.
  await supabase.auth.getUser()

  // If a response is ever constructed manually here, the supabaseResponse
  // cookies must be copied over, or sessions will desync.
  return supabaseResponse
}
