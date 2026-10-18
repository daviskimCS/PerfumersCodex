import { NextResponse, type NextRequest } from 'next/server'

import { contentSecurityPolicy, createNonce } from '@/lib/csp'
import { updateSession } from '@/lib/supabase/proxy'

/**
 * Routes that answer the same way signed in or out, so a session refresh on
 * them is a wasted round trip.
 *
 * `/api/search` is the one that matters: the command palette calls it on
 * every debounced keystroke (components/search-command.tsx), and it reads no
 * cookie — the pipeline logs query + result count only (AGENTS.md). The
 * search *budget* is <150ms p95; an auth round trip in front of each call
 * would spend most of it before the query ran.
 */
const SESSIONLESS_PATHNAMES = new Set(['/api/search'])

export const config = {
  matcher: [
    // All paths except static assets and images.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}

/**
 * Two jobs on every page request: a fresh script nonce and the policy that
 * names it (lib/csp.ts), and the Supabase session refresh, so a signed-in
 * reader is not quietly logged out when their access token expires.
 *
 * Until 2026-10-17 this also ran the pre-launch password gate, which
 * rewrote every route to a construction page. The site is public now, and
 * the gate went with it (git history has it: `lib/gate.ts`). What keeps
 * unreviewed material off the site was never the gate but the review gate
 * (`lib/db/published.ts`), which every public read goes through.
 */
export async function proxy(request: NextRequest) {
  // A route that never reads the session skips the refresh:
  // `updateSession` costs nothing for an anonymous visitor (no cookie, no
  // network), but a signed-in reader's expired token would otherwise be
  // refreshed against Supabase on a request whose handler then ignores it.
  // It returns JSON, so it needs no script policy either.
  if (SESSIONLESS_PATHNAMES.has(request.nextUrl.pathname)) {
    return NextResponse.next({ request })
  }

  const nonce = createNonce()
  const policy = contentSecurityPolicy({
    nonce,
    pathname: request.nextUrl.pathname,
    dev: process.env.NODE_ENV === 'development',
  })
  // On the request, Next.js reads the nonce out of the policy and puts it on
  // every script it renders; app/layout.tsx reads `x-nonce` for the theme
  // script. updateSession forwards these request headers to the render.
  request.headers.set('x-nonce', nonce)
  request.headers.set('content-security-policy', policy)

  const response = await updateSession(request)
  response.headers.set('content-security-policy', policy)
  return response
}
