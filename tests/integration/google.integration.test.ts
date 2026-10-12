import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import { signInWithGoogle } from '@/app/(auth)/actions'
import { GET as callbackRoute } from '@/app/auth/callback/route'

import { Browser, activate } from './browser'
import { env, form, hasSessionCookie, redirectOf } from './helpers'

/**
 * "Continue with Google" against the real Supabase Auth server, with Google
 * itself stubbed out by construction: the local stack's Google provider has a
 * fake client id (supabase/config.toml), so the flow can be driven up to the
 * hand-off to Google and back from a callback, but no real Google account is
 * ever involved. The one leg that cannot be automated, Google's consent
 * screen and the account it returns, is the manual check in
 * tests/integration/README.md.
 *
 * What this proves:
 * - the start leg: our action asks Supabase for a PKCE flow, stores the code
 *   verifier in this browser, and sends the reader to Supabase's /authorize,
 *   which forwards to Google with only the `email` and `profile` scopes and
 *   with our callback as the eventual destination;
 * - the return leg: every way the callback can fail lands on /login with a
 *   notice the page knows how to word, and never creates a session.
 */

const VERIFIER_COOKIE = /^sb-.+-auth-token-code-verifier$/

function callback(params: Record<string, string>): NextRequest {
  const url = new URL('/auth/callback', env.siteUrl)
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value)
  return new NextRequest(url)
}

describe('starting Google sign-in', () => {
  it('stores a PKCE verifier and sends the reader to Supabase /authorize', async () => {
    const browser = activate(new Browser())
    const target = new URL(
      await redirectOf(signInWithGoogle({}, form({ next: '/saved' })))
    )

    expect(target.origin).toBe(new URL(env.supabaseUrl).origin)
    expect(target.pathname).toBe('/auth/v1/authorize')
    expect(target.searchParams.get('provider')).toBe('google')
    expect(target.searchParams.get('code_challenge_method')).toBe('s256')
    expect(target.searchParams.get('code_challenge')).toBeTruthy()

    const redirectTo = new URL(target.searchParams.get('redirect_to')!)
    expect(redirectTo.origin + redirectTo.pathname).toBe(
      new URL('/auth/callback', env.siteUrl).toString()
    )
    expect(redirectTo.searchParams.get('next')).toBe('/saved')

    expect(browser.names().some((name) => VERIFIER_COOKIE.test(name))).toBe(
      true
    )
    expect(hasSessionCookie(browser.names())).toBe(false)
  })

  it('drops an off-site `next` instead of carrying it to the callback', async () => {
    activate(new Browser())
    const target = new URL(
      await redirectOf(signInWithGoogle({}, form({ next: '//evil.example' })))
    )
    const redirectTo = new URL(target.searchParams.get('redirect_to')!)
    expect(redirectTo.searchParams.has('next')).toBe(false)
  })

  it('is forwarded to Google asking only for email and profile', async () => {
    activate(new Browser())
    const authorize = await redirectOf(signInWithGoogle({}, form({})))

    const response = await fetch(authorize, {
      redirect: 'manual',
      headers: { apikey: env.publishableKey },
    })
    expect(response.status).toBe(302)
    const google = new URL(response.headers.get('location')!)

    expect(google.hostname).toBe('accounts.google.com')
    expect(google.searchParams.get('scope')?.split(' ').sort()).toEqual([
      'email',
      'profile',
    ])
    expect(google.searchParams.get('redirect_uri')).toBe(
      `${env.supabaseUrl}/auth/v1/callback`
    )
  })
})

describe('coming back to /auth/callback', () => {
  it('a cancelled consent screen says so', async () => {
    activate(new Browser())
    expect(
      await redirectOf(
        callbackRoute(
          callback({ error: 'access_denied', error_code: 'access_denied' })
        )
      )
    ).toBe('/login?error=google_cancelled')
  })

  it('a code from a flow this browser did not start is refused', async () => {
    // The verifier lives in the browser that pressed the button. Arriving
    // with a code in a different browser (or with cookies cleared) cannot
    // complete, and must not.
    const browser = activate(new Browser())
    expect(
      await redirectOf(callbackRoute(callback({ code: crypto.randomUUID() })))
    ).toBe('/login?error=google_expired')
    expect(hasSessionCookie(browser.names())).toBe(false)
  })

  it('a forged code is refused by Supabase even with a real verifier present', async () => {
    const browser = activate(new Browser())
    await redirectOf(signInWithGoogle({}, form({})))

    const target = await redirectOf(
      callbackRoute(callback({ code: crypto.randomUUID() }))
    )
    // Supabase answers flow_state_not_found, which the route words as "start again".
    expect(target).toBe('/login?error=google_expired')
    expect(hasSessionCookie(browser.names())).toBe(false)
  })

  it('a bare visit with neither code nor error lands on /login', async () => {
    activate(new Browser())
    expect(await redirectOf(callbackRoute(callback({})))).toBe(
      '/login?error=google_failed'
    )
  })
})
