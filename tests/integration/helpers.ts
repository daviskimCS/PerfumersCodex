import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { expect } from 'vitest'

import { integrationEnv } from './env'
import { TEST_MATERIAL_SLUG } from './fixtures'
import { RedirectSignal } from './redirect-signal'

export const env = integrationEnv()

/** Superuser connection, for assertions only (the app never connects so). */
export const sql = postgres(env.databaseUrl, { max: 2, onnotice: () => {} })

/** The admin API, as the server-side delete action uses it. */
export const admin = createClient(env.supabaseUrl, env.secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** A fresh address per test, so tests never collide or depend on order. */
export function uniqueEmail(label: string): string {
  return `${label}-${randomUUID().slice(0, 8)}@example.test`
}

export const PASSWORD = 'correct horse battery'

export function form(fields: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

/** Await something that must end in `redirect()`, and return the target. */
export async function redirectOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    if (error instanceof RedirectSignal) return error.url
    throw error
  }
  throw new Error('Expected a redirect, but the call returned normally.')
}

/** A confirmed email/password account, made through the admin API. */
export async function createConfirmedUser(email: string, password = PASSWORD) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error
  return data.user
}

/**
 * The token hash a confirmation or reset email would carry, as the email
 * template puts it into the `/auth/confirm` link. Read through the admin API
 * rather than from a mailbox, so the suite does not depend on the mail
 * catcher.
 */
export async function emailLinkTokenHash(
  type: 'signup' | 'recovery',
  email: string,
  password = PASSWORD
): Promise<string> {
  const { data, error } =
    type === 'signup'
      ? await admin.auth.admin.generateLink({ type, email, password })
      : await admin.auth.admin.generateLink({ type, email })
  if (error) throw error
  return data.properties.hashed_token
}

/** A browser-less supabase-js client signed in as `email`. */
export async function signedInClient(
  email: string,
  password = PASSWORD
): Promise<SupabaseClient> {
  const client = createClient(env.supabaseUrl, env.publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return client
}

export async function testMaterialId(): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    select id from materials where slug = ${TEST_MATERIAL_SLUG}`
  expect(row, 'global setup seeds the test material').toBeDefined()
  return row.id
}

/** Does any session cookie exist in this browser's jar? */
export function hasSessionCookie(names: string[]): boolean {
  return names.some((name) => /^sb-.+-auth-token(\.\d+)?$/.test(name))
}
