import { AuthError } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The sign-in actions' own decisions, with Supabase stubbed. The real round
 * trips are in tests/integration/; these pin the branches a live server will
 * not readily produce (a disabled Google provider, a failed probe) and the
 * exact arguments handed to Supabase.
 */

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.test')
vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://perfumerscodex.test')

const auth = {
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth }),
}))
vi.mock('@/lib/supabase/auth-server', () => ({
  createAuthClient: async () => ({ auth }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error('redirect'), { url })
  },
}))

const { requestPasswordReset, signIn, signInWithGoogle } =
  await import('@/app/(auth)/actions')

function form(fields: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

async function redirectOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    return (error as { url: string }).url
  }
  throw new Error('expected a redirect')
}

function settings(google: boolean | 'error') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      google === 'error'
        ? Promise.reject(new Error('network down'))
        : new Response(JSON.stringify({ external: { google, email: true } }))
    )
  )
}

beforeEach(() => {
  for (const fn of Object.values(auth)) fn.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('signInWithGoogle', () => {
  it('refuses up front when Supabase reports the provider off, without starting a flow', async () => {
    settings(false)
    const state = await signInWithGoogle({}, form({}))
    expect(state.formError).toMatch(/isn’t available right now/)
    expect(auth.signInWithOAuth).not.toHaveBeenCalled()
  })

  it('fails open when the settings probe itself fails', async () => {
    settings('error')
    auth.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://project.supabase.test/auth/v1/authorize?x' },
      error: null,
    })
    expect(await redirectOf(signInWithGoogle({}, form({})))).toBe(
      'https://project.supabase.test/auth/v1/authorize?x'
    )
  })

  it('asks for the callback on this site, carrying a safe next', async () => {
    settings(true)
    auth.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://go' },
      error: null,
    })
    await redirectOf(
      signInWithGoogle({}, form({ next: '/materials/iso-e-super' }))
    )

    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo:
          'https://perfumerscodex.test/auth/callback?next=%2Fmaterials%2Fiso-e-super',
      },
    })
  })

  it('drops an unsafe next rather than failing', async () => {
    settings(true)
    auth.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://go' },
      error: null,
    })
    await redirectOf(signInWithGoogle({}, form({ next: '//evil.example' })))
    expect(auth.signInWithOAuth.mock.calls[0][0].options.redirectTo).toBe(
      'https://perfumerscodex.test/auth/callback'
    )
  })

  it('reports a failed start in plain language', async () => {
    settings(true)
    auth.signInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: new AuthError('x', 429, 'over_request_rate_limit'),
    })
    const state = await signInWithGoogle({}, form({}))
    expect(state.formError).toMatch(/Too many attempts/)
  })
})

describe('signIn', () => {
  it.each([
    ['invalid_credentials', 'Incorrect email or password.'],
    ['email_not_confirmed', /hasn’t been confirmed/],
    ['over_request_rate_limit', /Too many attempts/],
    ['some_future_code', 'Something went wrong on our end. Please try again.'],
  ])(
    'maps %s to reader-facing copy, never the raw message',
    async (code, copy) => {
      auth.signInWithPassword.mockResolvedValue({
        error: new AuthError('raw internals', 400, code),
      })
      const state = await signIn({}, form({ email: 'a@b.co', password: 'x' }))
      expect(state.formError).toMatch(copy)
      expect(state.formError).not.toContain('raw internals')
    }
  )

  it('redirects to /account on success', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null })
    expect(
      await redirectOf(signIn({}, form({ email: 'a@b.co', password: 'x' })))
    ).toBe('/account')
  })
})

describe('requestPasswordReset', () => {
  it('sends the link through /auth/confirm onward to /reset-password', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null })
    const state = await requestPasswordReset(
      {},
      form({ email: ' Reader@Example.com ' })
    )

    expect(state).toEqual({ sentTo: 'Reader@Example.com' })
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'Reader@Example.com',
      {
        redirectTo:
          'https://perfumerscodex.test/auth/confirm?next=%2Freset-password',
      }
    )
  })

  it('returns field errors for a malformed address without calling Supabase', async () => {
    const state = await requestPasswordReset(
      {},
      form({ email: 'not-an-email' })
    )
    expect(state.fieldErrors?.email).toBeDefined()
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('reports a send limit in plain language', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({
      error: new AuthError('x', 429, 'over_email_send_rate_limit'),
    })
    const state = await requestPasswordReset({}, form({ email: 'a@b.co' }))
    expect(state.formError).toMatch(/Too many attempts/)
  })
})
