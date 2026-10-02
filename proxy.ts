import { NextResponse, type NextRequest } from 'next/server'

import {
  GATE_COOKIE_NAME,
  PRELAUNCH_PATH,
  isGateAllowlisted,
  isGateEnabled,
  verifyGateToken,
} from '@/lib/gate'
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
 *
 * This list is checked AFTER the gate, deliberately. The gate is what keeps
 * material names off an un-launched site, and a search endpoint that skipped
 * it would hand them out one query at a time. Only the session refresh is
 * skipped here, never the password.
 */
const SESSIONLESS_PATHNAMES = new Set(['/api/search'])

export const config = {
  matcher: [
    // All paths except static assets and images.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}

/**
 * Two jobs, in a fixed order: the pre-launch gate, then Supabase session
 * refresh.
 *
 * The gate composes with session refresh rather than replacing it — an
 * unlocked request still runs `updateSession`, or every signed-in visitor gets
 * quietly logged out the moment their access token expires. A GATED request
 * deliberately skips it: there is no session to keep alive behind a page that
 * shows a visitor nothing, and it keeps an anonymous flood off Supabase.
 *
 * REWRITE, NOT REDIRECT. The URL the visitor typed stays in the address bar
 * and the response is the pre-launch page, so the gate never confirms which
 * paths exist — a redirect to /coming-soon would announce the gate on every
 * 404 as loudly as on every real route.
 *
 * ENVIRONMENT READS. `lib/env.ts` reads `process.env[key]` dynamically, which
 * only works where the environment exists at RUNTIME. That holds here because
 * Next 16 runs Proxy on the Node.js runtime by default and the `runtime`
 * option is not configurable (node_modules/next/dist/docs/01-app/
 * 03-api-reference/03-file-conventions/proxy.md, "Runtime"). It is also why
 * `next build` can run with the gate off and the same build can serve a gated
 * site: nothing about the gate is baked in at build time.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isGateEnabled() && !isGateAllowlisted(pathname)) {
    const unlocked = await verifyGateToken(
      request.cookies.get(GATE_COOKIE_NAME)?.value
    )

    if (!unlocked) {
      const destination = request.nextUrl.clone()
      destination.pathname = PRELAUNCH_PATH
      // The query string rides along untouched. The pre-launch page ignores
      // it, and stripping it would also strip the `_rsc` cache-buster Next
      // puts on client-navigation requests.
      return NextResponse.rewrite(destination)
    }
  }

  // Past the gate. A route that never reads the session skips the refresh:
  // `updateSession` costs nothing for an anonymous visitor (no cookie, no
  // network), but a signed-in reader's expired token would otherwise be
  // refreshed against Supabase on a request whose handler then ignores it.
  if (SESSIONLESS_PATHNAMES.has(pathname)) {
    return NextResponse.next({ request })
  }

  return await updateSession(request)
}
