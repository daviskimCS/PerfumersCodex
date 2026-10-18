import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import {
  requestPasswordReset,
  signIn,
  signOut,
  signUp,
} from '@/app/(auth)/actions'
import {
  changeEmail,
  changePassword,
  deleteAccount,
  resetPassword,
} from '@/app/account/actions'
import { GET as confirmRoute } from '@/app/auth/confirm/route'
import { RESET_LINK_NEEDED_MESSAGE } from '@/lib/validation/password-reset'

import { Browser, activate } from './browser'
import {
  PASSWORD,
  admin,
  createConfirmedUser,
  emailLinkTokenHash,
  env,
  followDefaultTemplateLink,
  form,
  hasSessionCookie,
  redirectOf,
  sentTokenHash,
  signedInClient,
  sql,
  testMaterialId,
  uniqueEmail,
} from './helpers'

/**
 * Email/password accounts end to end: the real server actions and route
 * handlers, the real Supabase Auth server, the real database. Only the Next
 * runtime around them is stood in for (setup.ts).
 */

function confirmUrl(
  tokenHash: string,
  type: string,
  next?: string
): NextRequest {
  const url = new URL('/auth/confirm', env.siteUrl)
  url.searchParams.set('token_hash', tokenHash)
  url.searchParams.set('type', type)
  if (next) url.searchParams.set('next', next)
  return new NextRequest(url)
}

/** Sign `email` in through the real sign-in action, in a fresh browser. */
async function signedInBrowser(email: string, password = PASSWORD) {
  const browser = activate(new Browser())
  const target = await redirectOf(signIn({}, form({ email, password })))
  expect(target).toBe('/account')
  expect(hasSessionCookie(browser.names())).toBe(true)
  return browser
}

describe('sign-up and email confirmation', () => {
  it('creates an unconfirmed account that cannot sign in until the link is opened', async () => {
    const email = uniqueEmail('signup')
    activate(new Browser())

    const state = await signUp({}, form({ email, password: PASSWORD }))
    expect(state).toEqual({ sentTo: email })

    const { data } = await admin.auth.admin.listUsers()
    const user = data.users.find((u) => u.email === email)
    expect(user, 'the account exists').toBeDefined()
    expect(user?.email_confirmed_at ?? null).toBeNull()

    const refused = await signIn({}, form({ email, password: PASSWORD }))
    expect(refused.formError).toMatch(/hasn’t been confirmed/)
  })

  it('signs the reader in when the confirmation link is opened', async () => {
    const email = uniqueEmail('confirm')
    activate(new Browser())
    await signUp({}, form({ email, password: PASSWORD }))

    const browser = activate(new Browser()) // the link may open anywhere
    // Exactly the link the documented "Confirm signup" template renders.
    const tokenHash = await sentTokenHash(email, 'confirmation_token')
    const target = await redirectOf(
      confirmRoute(confirmUrl(tokenHash, 'email'))
    )

    expect(target).toBe('/account')
    expect(hasSessionCookie(browser.names())).toBe(true)
  })

  it('handles a link from the DEFAULT template opened in the same browser', async () => {
    const email = uniqueEmail('defaultsame')
    const browser = activate(new Browser())
    await signUp({}, form({ email, password: PASSWORD }))

    const landing = await followDefaultTemplateLink(
      await sentTokenHash(email, 'confirmation_token'),
      'signup',
      new URL('/auth/confirm', env.siteUrl).toString()
    )
    expect(landing.searchParams.get('code')).toBeTruthy()

    const target = await redirectOf(confirmRoute(new NextRequest(landing)))
    expect(target).toBe('/account')
    expect(hasSessionCookie(browser.names())).toBe(true)
  })

  it('says "confirmed, sign in" for a DEFAULT-template link opened in another browser', async () => {
    const email = uniqueEmail('defaultother')
    activate(new Browser())
    await signUp({}, form({ email, password: PASSWORD }))

    const landing = await followDefaultTemplateLink(
      await sentTokenHash(email, 'confirmation_token'),
      'signup',
      new URL('/auth/confirm', env.siteUrl).toString()
    )
    const browser = activate(new Browser()) // no PKCE verifier here
    const target = await redirectOf(confirmRoute(new NextRequest(landing)))

    // Not "invalid or expired": Supabase did confirm the address.
    expect(target).toBe('/login?notice=confirmed')
    expect(hasSessionCookie(browser.names())).toBe(false)
    await expect(signedInClient(email)).resolves.toBeDefined()
  })

  it('sends a used or forged confirmation link to /login with a notice', async () => {
    activate(new Browser())
    const target = await redirectOf(
      confirmRoute(confirmUrl('not-a-real-token-hash', 'signup'))
    )
    expect(target).toBe('/login?error=confirm')
  })

  it('rejects field errors server-side without calling Supabase', async () => {
    activate(new Browser())
    const state = await signUp({}, form({ email: 'nope', password: 'short' }))
    expect(state.fieldErrors?.email).toBeDefined()
    expect(state.fieldErrors?.password).toBeDefined()
  })
})

describe('sign-in and sign-out', () => {
  it('refuses a wrong password in plain language', async () => {
    const email = uniqueEmail('wrongpw')
    await createConfirmedUser(email)
    activate(new Browser())

    const state = await signIn(
      {},
      form({ email, password: 'not the password' })
    )
    expect(state).toEqual({ formError: 'Incorrect email or password.' })
  })

  it('gives an unknown address the same answer as a wrong password', async () => {
    activate(new Browser())
    const state = await signIn(
      {},
      form({ email: uniqueEmail('nobody'), password: PASSWORD })
    )
    expect(state).toEqual({ formError: 'Incorrect email or password.' })
  })

  it('signs in, and signing out clears the session cookie', async () => {
    const email = uniqueEmail('inout')
    await createConfirmedUser(email)
    const browser = await signedInBrowser(email)

    expect(await redirectOf(signOut())).toBe('/login')
    expect(hasSessionCookie(browser.names())).toBe(false)
  })
})

describe('changing the password', () => {
  it('requires the current password, then swaps old for new', async () => {
    const email = uniqueEmail('changepw')
    await createConfirmedUser(email)
    await signedInBrowser(email)

    const wrong = await changePassword(
      {},
      form({
        currentPassword: 'not it',
        newPassword: 'a brand new password',
        confirmPassword: 'a brand new password',
      })
    )
    expect(wrong.fieldErrors?.currentPassword).toEqual([
      'That isn’t your current password.',
    ])

    const ok = await changePassword(
      {},
      form({
        currentPassword: PASSWORD,
        newPassword: 'a brand new password',
        confirmPassword: 'a brand new password',
      })
    )
    expect(ok).toEqual({ changed: true })

    await expect(signedInClient(email, PASSWORD)).rejects.toThrow()
    await expect(
      signedInClient(email, 'a brand new password')
    ).resolves.toBeDefined()
  })
})

describe('changing the email address', () => {
  it('records the new address as pending, not as changed', async () => {
    const email = uniqueEmail('changeemail')
    const user = await createConfirmedUser(email)
    await signedInBrowser(email)

    const next = uniqueEmail('moved')
    const state = await changeEmail({}, form({ email: next }))
    expect(state).toEqual({ confirmationSentTo: next })

    const { data } = await admin.auth.admin.getUserById(user.id)
    expect(data.user?.email).toBe(email)
    expect(data.user?.new_email).toBe(next)
  })

  it('changes the address once the links to BOTH addresses are opened', async () => {
    const email = uniqueEmail('bothlinks')
    const user = await createConfirmedUser(email)
    await signedInBrowser(email)
    const next = uniqueEmail('arrived')
    await changeEmail({}, form({ email: next }))

    // "Secure email change" mails both addresses; the documented "Change
    // email address" template renders each with its own token hash.
    const toCurrent = await sentTokenHash(email, 'email_change_token_current')
    const toNew = await sentTokenHash(email, 'email_change_token_new')

    expect(
      await redirectOf(confirmRoute(confirmUrl(toCurrent, 'email_change')))
    ).toBe('/account')
    const halfway = await admin.auth.admin.getUserById(user.id)
    expect(halfway.data.user?.email, 'one link is not enough').toBe(email)

    expect(
      await redirectOf(confirmRoute(confirmUrl(toNew, 'email_change')))
    ).toBe('/account')
    const done = await admin.auth.admin.getUserById(user.id)
    expect(done.data.user?.email).toBe(next)
  })
})

describe('password reset', () => {
  it('answers the same for an address with no account (no enumeration)', async () => {
    activate(new Browser())
    const missing = uniqueEmail('missing')
    expect(await requestPasswordReset({}, form({ email: missing }))).toEqual({
      sentTo: missing,
    })
  })

  it('lets a reset link set a new password without the old one', async () => {
    const email = uniqueEmail('reset')
    await createConfirmedUser(email)
    activate(new Browser())
    expect(await requestPasswordReset({}, form({ email }))).toEqual({
      sentTo: email,
    })

    // The link is opened, possibly on another device.
    activate(new Browser())
    const tokenHash = await emailLinkTokenHash('recovery', email)
    const target = await redirectOf(
      confirmRoute(confirmUrl(tokenHash, 'recovery', '/reset-password'))
    )
    expect(target).toBe('/reset-password')

    const state = await resetPassword(
      {},
      form({
        newPassword: 'reset to this one',
        confirmPassword: 'reset to this one',
      })
    )
    expect(state).toEqual({ changed: true })
    await expect(
      signedInClient(email, 'reset to this one')
    ).resolves.toBeDefined()
    await expect(signedInClient(email, PASSWORD)).rejects.toThrow()
  })

  it('accepts a reset link from the DEFAULT template, opened in the same browser', async () => {
    const email = uniqueEmail('resetdefault')
    await createConfirmedUser(email)
    activate(new Browser())
    await requestPasswordReset({}, form({ email }))

    const redirectTo = new URL('/auth/confirm', env.siteUrl)
    redirectTo.searchParams.set('next', '/reset-password')
    const landing = await followDefaultTemplateLink(
      await sentTokenHash(email, 'recovery_token'),
      'recovery',
      redirectTo.toString()
    )
    expect(await redirectOf(confirmRoute(new NextRequest(landing)))).toBe(
      '/reset-password'
    )

    const state = await resetPassword(
      {},
      form({
        newPassword: 'default template reset',
        confirmPassword: 'default template reset',
      })
    )
    expect(state).toEqual({ changed: true })
  })

  it('refuses an ordinary signed-in session, so it cannot bypass the current-password check', async () => {
    const email = uniqueEmail('resetbypass')
    await createConfirmedUser(email)
    await signedInBrowser(email)
    // Even with a reset requested for the account, a password session is
    // not the session the reset link creates.
    await requestPasswordReset({}, form({ email }))

    const state = await resetPassword(
      {},
      form({
        newPassword: 'hijacked password',
        confirmPassword: 'hijacked password',
      })
    )
    expect(state).toEqual({ formError: RESET_LINK_NEEDED_MESSAGE })
    await expect(signedInClient(email, PASSWORD)).resolves.toBeDefined()
  })

  it('sends a bad reset link to /login with reset-specific wording', async () => {
    activate(new Browser())
    const target = await redirectOf(
      confirmRoute(confirmUrl('forged', 'recovery', '/reset-password'))
    )
    expect(target).toBe('/login?error=reset')
  })
})

describe('deleting the account', () => {
  it('refuses without the typed confirmation', async () => {
    const email = uniqueEmail('nodelete')
    const user = await createConfirmedUser(email)
    await signedInBrowser(email)

    const state = await deleteAccount(
      {},
      form({ confirmation: 'delete', currentPassword: PASSWORD })
    )
    expect(state.fieldErrors?.confirmation).toBeDefined()
    const { data } = await admin.auth.admin.getUserById(user.id)
    expect(data.user?.id).toBe(user.id)
  })

  it('refuses a signed-in browser that does not know the password', async () => {
    const email = uniqueEmail('borrowed')
    const user = await createConfirmedUser(email)
    const browser = await signedInBrowser(email)

    const missing = await deleteAccount({}, form({ confirmation: 'DELETE' }))
    expect(missing.fieldErrors?.currentPassword).toEqual([
      'Enter your password.',
    ])
    const wrong = await deleteAccount(
      {},
      form({ confirmation: 'DELETE', currentPassword: 'not it' })
    )
    expect(wrong.fieldErrors?.currentPassword).toEqual([
      'That isn’t your current password.',
    ])

    const { data } = await admin.auth.admin.getUserById(user.id)
    expect(data.user?.id).toBe(user.id)
    // A wrong guess does not sign the owner out of their own browser.
    expect(hasSessionCookie(browser.names())).toBe(true)
  })

  it('deletes the account and every row it owns, and signs the browser out', async () => {
    const email = uniqueEmail('delete')
    const user = await createConfirmedUser(email)
    const materialId = await testMaterialId()

    // Give the account something to lose, through RLS as the reader would.
    const client = await signedInClient(email)
    expect(
      (
        await client
          .from('user_saved_materials')
          .insert({ user_id: user.id, material_id: materialId })
      ).error
    ).toBeNull()
    expect(
      (
        await client
          .from('user_notes')
          .insert({ user_id: user.id, material_id: materialId, body: 'mine' })
      ).error
    ).toBeNull()

    const browser = await signedInBrowser(email)
    // The id in the form is ignored: only the caller's own account can go.
    const target = await redirectOf(
      deleteAccount(
        {},
        form({
          confirmation: 'DELETE',
          currentPassword: PASSWORD,
          user_id: SOMEONE_ELSE,
        })
      )
    )
    expect(target).toBe('/')
    expect(hasSessionCookie(browser.names())).toBe(false)

    const { data } = await admin.auth.admin.getUserById(user.id)
    expect(data.user).toBeNull()

    // Every public table with a user_id column, so a user table added later
    // without ON DELETE CASCADE fails here rather than in production.
    const tables = await sql<{ table_name: string }[]>`
      select table_name from information_schema.columns
      where table_schema = 'public' and column_name = 'user_id'`
    expect(tables.map((t) => t.table_name).sort()).toEqual([
      'user_notes',
      'user_saved_materials',
    ])
    for (const { table_name } of tables) {
      const [{ count }] = await sql<{ count: number }[]>`
        select count(*)::int as count from ${sql(table_name)} where user_id = ${user.id}`
      expect(count, `${table_name} rows left behind`).toBe(0)
    }

    // Supabase's own per-user auth rows go with the account too.
    // (auth.audit_log_entries is the exception: it is not keyed to the user
    // and keeps the address. See docs/legal/account-data.md.)
    for (const table of ['identities', 'sessions', 'refresh_tokens'] as const) {
      const [{ count }] = await sql<{ count: number }[]>`
        select count(*)::int as count from auth.${sql(table)}
        where user_id::text = ${user.id}`
      expect(count, `auth.${table} rows left behind`).toBe(0)
    }
  })
})

/** An id a forged form might carry; the action must never read it. */
const SOMEONE_ELSE = '00000000-0000-4000-8000-000000000000'
