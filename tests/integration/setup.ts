import { vi } from 'vitest'

import { currentCookieStore } from './browser'
import { integrationEnv } from './env'
import { RedirectSignal } from './redirect-signal'

/**
 * Per-file setup: replace the three Next.js runtime modules the auth code
 * touches with stand-ins, so the real server actions and route handlers run
 * outside a Next request.
 *
 * - `next/headers` `cookies()` is backed by the active test "browser"
 *   (`browser.ts`), so the Supabase SSR client reads and writes a real cookie
 *   jar and a session carries from one call to the next, as it would across
 *   requests.
 * - `redirect()` throws a `RedirectSignal` the tests can read the target from
 *   (Next's own throws an opaque NEXT_REDIRECT digest).
 * - `revalidatePath()` is a no-op: there is no cache to invalidate.
 *
 * Nothing else is mocked. Supabase Auth, PostgREST and Postgres are real.
 */

integrationEnv() // fail fast, before any test, if the stack is not local

vi.mock('next/headers', () => ({
  cookies: async () => currentCookieStore(),
  // The reader's address as Vercel would report it (a documentation-range
  // IP). lib/supabase/auth-server.ts forwards it to Supabase on sign-in.
  headers: async () => new Headers({ 'x-real-ip': '203.0.113.7' }),
}))

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new RedirectSignal(url)
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: () => {},
}))
