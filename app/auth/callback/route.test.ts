import {
  AuthError,
  AuthPKCECodeVerifierMissingError,
} from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The OAuth landing's own logic, with Supabase stubbed: which notice each
 * failure maps to, and that `next` can never send the reader off-site. The
 * same route runs against a real Supabase Auth server in
 * tests/integration/google.integration.test.ts.
 */

const exchangeCodeForSession = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession } }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error('redirect'), { url })
  },
}))

const { GET } = await import('@/app/auth/callback/route')

async function land(query: string): Promise<string> {
  try {
    await GET(new NextRequest(`http://localhost:3000/auth/callback${query}`))
  } catch (error) {
    return (error as { url: string }).url
  }
  throw new Error('expected a redirect')
}

const codeError = (code: string) => new AuthError('nope', 400, code)

beforeEach(() => {
  exchangeCodeForSession.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('/auth/callback', () => {
  it('exchanges the code and goes to /account by default', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null })
    expect(await land('?code=abc')).toBe('/account')
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc')
  })

  it('honours a same-site next', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null })
    expect(await land('?code=abc&next=%2Fsaved')).toBe('/saved')
  })

  it.each(['//evil.example', 'https://evil.example', '/\\evil.example'])(
    'ignores the off-site next %j',
    async (next) => {
      exchangeCodeForSession.mockResolvedValue({ error: null })
      expect(await land(`?code=abc&next=${encodeURIComponent(next)}`)).toBe(
        '/account'
      )
    }
  )

  it.each([
    ['access_denied', null, 'google_cancelled'],
    ['server_error', 'provider_disabled', 'google_unavailable'],
    ['server_error', 'flow_state_expired', 'google_expired'],
    ['server_error', 'something_new', 'google_failed'],
  ])('provider error %s / %s → %s', async (error, code, notice) => {
    const query = new URLSearchParams({ error })
    if (code) query.set('error_code', code)
    expect(await land(`?${query}`)).toBe(`/login?error=${notice}`)
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('a request carrying both an error and a code is treated as the error', async () => {
    expect(await land('?error=access_denied&code=abc')).toBe(
      '/login?error=google_cancelled'
    )
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it.each([
    [new AuthPKCECodeVerifierMissingError(), 'google_expired'],
    [codeError('flow_state_not_found'), 'google_expired'],
    [codeError('provider_disabled'), 'google_unavailable'],
    [codeError('unexpected_failure'), 'google_failed'],
  ])('exchange failure %#  → %s', async (error, notice) => {
    exchangeCodeForSession.mockResolvedValue({ error })
    expect(await land('?code=abc')).toBe(`/login?error=${notice}`)
  })

  it('a bare visit is google_failed', async () => {
    expect(await land('')).toBe('/login?error=google_failed')
  })
})
