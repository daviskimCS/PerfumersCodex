import { isAuthRetryableFetchError } from '@supabase/supabase-js'

import { buildAccountExport } from '@/lib/db/account-export'
import { createClient } from '@/lib/supabase/server'

/**
 * `GET /account/export` — "Download your data" on `/account`.
 *
 * `getUser()`, not `getClaims()`, although this is a read: it hands over
 * everything the account holds, so a session revoked elsewhere must be
 * refused now rather than within the hour a locally-verified token stays
 * valid. It is a once-in-a-while request, so the round trip the getClaims
 * rule exists to save does not matter here.
 *
 * Cross-site requests cannot read the response (no CORS headers), and a
 * cross-site link only downloads the reader's own file to the reader's own
 * machine, so a GET is safe.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error && isAuthRetryableFetchError(error)) {
    return new Response(
      'We couldn’t reach the sign-in service just now. Try again in a moment.',
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }
  if (!data.user) {
    return new Response('Sign in to download your data.', {
      status: 401,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  let body: string
  try {
    body = JSON.stringify(await buildAccountExport(data.user), null, 2)
  } catch (cause) {
    console.error('[account] export failed:', cause)
    return new Response(
      'Your data could not be gathered just now. Nothing was changed; try again in a moment.',
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const day = new Date().toISOString().slice(0, 10)
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="perfumers-codex-account-${day}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
