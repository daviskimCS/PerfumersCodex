import { isAuthorizedCronRequest } from '@/lib/cron'
import { pingDatabase } from '@/lib/db/keep-alive'
import { env } from '@/lib/env'

/**
 * Daily keep-alive for the Supabase free tier, called by Vercel Cron
 * (vercel.json). A paused database shows readers a broken site.
 *
 * Exempt from the pre-launch gate (lib/gate.ts), because a cron job cannot type
 * a password, so this handler is its own guard: without CRON_SECRET it answers
 * 401 to everyone, and it never returns data either way.
 */

// Never prerendered or cached: the whole point is a live query.
export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  if (
    !isAuthorizedCronRequest(
      request.headers.get('authorization'),
      env.CRON_SECRET
    )
  ) {
    return new Response(null, { status: 401 })
  }

  await pingDatabase()

  return Response.json(
    { ok: true },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
