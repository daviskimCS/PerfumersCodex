import { AuthError, AuthRetryableFetchError } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RESET_LINK_NEEDED_MESSAGE } from '@/lib/validation/password-reset'

/**
 * The account actions' guards, with Supabase stubbed: whose account a delete
 * can touch, what a Google-only account is told, and when the reset path is
 * open. tests/integration/email-password.integration.test.ts runs the same
 * actions against a real auth server and database.
 */

const auth = {
  getUser: vi.fn(),
  getClaims: vi.fn(),
  signInWithPassword: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}
const deleteUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth }),
}))
vi.mock('@/lib/supabase/auth-server', () => ({
  createAuthClient: async () => ({ auth }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ auth: { admin: { deleteUser } } }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error('redirect'), { url })
  },
}))

const { changePassword, deleteAccount, resetPassword } =
  await import('@/app/account/actions')

function form(fields: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

const passwordUser = {
  id: 'caller-id',
  email: 'reader@example.com',
  identities: [{ provider: 'email' }],
  app_metadata: { providers: ['email'] },
}
const googleUser = {
  id: 'google-id',
  email: 'reader@gmail.com',
  identities: [{ provider: 'google' }],
  app_metadata: { providers: ['google'] },
}

beforeEach(() => {
  for (const fn of [...Object.values(auth), deleteUser]) fn.mockReset()
  auth.signOut.mockResolvedValue({ error: null })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('deleteAccount', () => {
  const nowS = () => Math.floor(Date.now() / 1000)
  const withPassword = { confirmation: 'DELETE', currentPassword: 'mine' }

  function signedInAs(user: object) {
    auth.getUser.mockResolvedValue({ data: { user }, error: null })
  }

  it('deletes the id the auth server returned, never one from the form', async () => {
    signedInAs(passwordUser)
    auth.signInWithPassword.mockResolvedValue({ error: null })
    deleteUser.mockResolvedValue({ error: null })

    await expect(
      deleteAccount(
        {},
        form({
          ...withPassword,
          userId: 'victim',
          user_id: 'victim',
          id: 'victim',
        })
      )
    ).rejects.toMatchObject({ url: '/' })

    expect(deleteUser).toHaveBeenCalledTimes(1)
    expect(deleteUser).toHaveBeenCalledWith('caller-id')
    expect(auth.signOut).toHaveBeenCalled()
  })

  it('asks a password account for its password before anything else', async () => {
    signedInAs(passwordUser)
    const state = await deleteAccount({}, form({ confirmation: 'DELETE' }))
    expect(state.fieldErrors?.currentPassword).toEqual(['Enter your password.'])
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('deletes nothing when the password is wrong', async () => {
    signedInAs(passwordUser)
    auth.signInWithPassword.mockResolvedValue({
      error: new AuthError('bad', 400, 'invalid_credentials'),
    })
    const state = await deleteAccount({}, form(withPassword))
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'reader@example.com',
      password: 'mine',
    })
    expect(state.fieldErrors?.currentPassword).toEqual([
      'That isn’t your current password.',
    ])
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('deletes nothing when the password check is rate-limited', async () => {
    signedInAs(passwordUser)
    auth.signInWithPassword.mockResolvedValue({
      error: new AuthError('slow down', 429, 'over_request_rate_limit'),
    })
    const state = await deleteAccount({}, form(withPassword))
    expect(state.formError).toMatch(/Too many attempts/)
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('sends a Google-only account with an old sign-in back to Google', async () => {
    signedInAs(googleUser)
    auth.getClaims.mockResolvedValue({
      data: {
        claims: { amr: [{ method: 'oauth', timestamp: nowS() - 86_400 }] },
      },
      error: null,
    })
    // A password in the form is no way round it: the account has none.
    const state = await deleteAccount({}, form(withPassword))
    expect(state.reauthRequired).toBe(true)
    expect(state.formError).toMatch(/confirm it’s you with Google/)
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('refuses a Google-only account whose token carries no sign-in time', async () => {
    signedInAs(googleUser)
    auth.getClaims.mockResolvedValue({ data: null, error: new Error('x') })
    const state = await deleteAccount({}, form({ confirmation: 'DELETE' }))
    expect(state.reauthRequired).toBe(true)
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('deletes a Google-only account that just signed in with Google', async () => {
    signedInAs(googleUser)
    auth.getClaims.mockResolvedValue({
      data: { claims: { amr: [{ method: 'oauth', timestamp: nowS() - 60 }] } },
      error: null,
    })
    deleteUser.mockResolvedValue({ error: null })
    await expect(
      deleteAccount({}, form({ confirmation: 'DELETE' }))
    ).rejects.toMatchObject({ url: '/' })
    expect(deleteUser).toHaveBeenCalledWith('google-id')
  })

  it('deletes nothing when the session cannot be verified', async () => {
    auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthError('expired', 401, 'session_expired'),
    })
    const state = await deleteAccount({}, form(withPassword))
    expect(state.formError).toMatch(/not signed in/)
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('does not call a network blip "signed out", and deletes nothing', async () => {
    auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthRetryableFetchError('fetch failed', 0),
    })
    const state = await deleteAccount({}, form(withPassword))
    expect(state.formError).toMatch(/couldn’t reach the sign-in service/)
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('does not claim nothing happened when the delete response is lost', async () => {
    signedInAs(passwordUser)
    auth.signInWithPassword.mockResolvedValue({ error: null })
    deleteUser.mockResolvedValue({ error: new Error('timeout') })
    const state = await deleteAccount({}, form(withPassword))
    expect(state.formError).toMatch(/couldn’t confirm/)
  })
})

describe('changePassword', () => {
  const fields = {
    currentPassword: 'old password',
    newPassword: 'new password!',
    confirmPassword: 'new password!',
  }

  it('tells a Google-only account it has no password, without a doomed password check', async () => {
    auth.getUser.mockResolvedValue({ data: { user: googleUser }, error: null })
    const state = await changePassword({}, form(fields))
    expect(state.formError).toMatch(/signs in with Google/)
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('checks the current password against the verified caller’s address', async () => {
    auth.getUser.mockResolvedValue({
      data: { user: passwordUser },
      error: null,
    })
    auth.signInWithPassword.mockResolvedValue({
      error: new AuthError('bad', 400, 'invalid_credentials'),
    })
    const state = await changePassword({}, form(fields))
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'reader@example.com',
      password: 'old password',
    })
    expect(state.fieldErrors?.currentPassword).toBeDefined()
    expect(auth.updateUser).not.toHaveBeenCalled()
  })
})

describe('resetPassword', () => {
  const fields = {
    newPassword: 'fresh password',
    confirmPassword: 'fresh password',
  }
  const nowS = () => Math.floor(Date.now() / 1000)

  it('refuses a session that a reset link did not create', async () => {
    auth.getUser.mockResolvedValue({
      data: {
        user: { ...passwordUser, recovery_sent_at: new Date().toISOString() },
      },
      error: null,
    })
    auth.getClaims.mockResolvedValue({
      data: { claims: { amr: [{ method: 'password', timestamp: nowS() }] } },
      error: null,
    })
    const state = await resetPassword({}, form(fields))
    expect(state).toEqual({ formError: RESET_LINK_NEEDED_MESSAGE })
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('sets the password for a fresh recovery session', async () => {
    const sentAt = new Date(Date.now() - 60_000).toISOString()
    auth.getUser.mockResolvedValue({
      data: { user: { ...passwordUser, recovery_sent_at: sentAt } },
      error: null,
    })
    auth.getClaims.mockResolvedValue({
      data: { claims: { amr: [{ method: 'otp', timestamp: nowS() - 10 }] } },
      error: null,
    })
    auth.updateUser.mockResolvedValue({ error: null })

    expect(await resetPassword({}, form(fields))).toEqual({ changed: true })
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'fresh password' })
  })

  it('validates before touching the session', async () => {
    const state = await resetPassword(
      {},
      form({ newPassword: 'short', confirmPassword: 'other' })
    )
    expect(state.fieldErrors?.newPassword).toBeDefined()
    expect(state.fieldErrors?.confirmPassword).toBeDefined()
    expect(auth.getUser).not.toHaveBeenCalled()
  })
})
