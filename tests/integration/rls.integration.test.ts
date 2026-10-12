import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { buildAccountExport } from '@/lib/db/account-export'
import { getSavedMaterialIds } from '@/lib/db/bookmarks'
import { getNote } from '@/lib/db/notes'

import { Browser, activate } from './browser'
import {
  admin,
  createConfirmedUser,
  env,
  form,
  redirectOf,
  signedInClient,
  testMaterialId,
  uniqueEmail,
} from './helpers'
import { signIn } from '@/app/(auth)/actions'

/**
 * Cross-account isolation: the publishable key ships in every browser, so
 * anyone can call the Data API directly with their own session. Row-Level
 * Security is the only thing between one reader and another's notes, and
 * this file is the proof, with two real accounts (docs/maker-todo.md item 3).
 */

// Material names come from the editorial side through Drizzle, which needs
// the pooled DATABASE_URL this suite does not run; the user-table reads under
// test do not depend on it.
vi.mock('@/lib/db/materials', () => ({
  listMaterialsByIds: async () => [],
}))

let materialId: string
let alice: { id: string; email: string; client: SupabaseClient }
let bob: { id: string; email: string; client: SupabaseClient }

async function account(label: string) {
  const email = uniqueEmail(label)
  const user = await createConfirmedUser(email)
  return { id: user.id, email, client: await signedInClient(email) }
}

beforeAll(async () => {
  materialId = await testMaterialId()
  alice = await account('alice')
  bob = await account('bob')

  const saved = await alice.client
    .from('user_saved_materials')
    .insert({ user_id: alice.id, material_id: materialId })
  expect(saved.error).toBeNull()
  const note = await alice.client
    .from('user_notes')
    .insert({ user_id: alice.id, material_id: materialId, body: 'alice only' })
  expect(note.error).toBeNull()
})

describe('another signed-in reader', () => {
  it('cannot read the bookmarks or notes', async () => {
    const saved = await bob.client.from('user_saved_materials').select('*')
    const notes = await bob.client.from('user_notes').select('*')
    expect(saved.error).toBeNull()
    expect(notes.error).toBeNull()
    expect(saved.data).toEqual([])
    expect(notes.data).toEqual([])
  })

  it('cannot change or delete them (zero rows, no error, data intact)', async () => {
    const update = await bob.client
      .from('user_notes')
      .update({ body: 'bob was here' })
      .eq('user_id', alice.id)
      .select()
    expect(update.data).toEqual([])

    await bob.client.from('user_notes').delete().eq('user_id', alice.id)
    await bob.client
      .from('user_saved_materials')
      .delete()
      .eq('user_id', alice.id)

    const notes = await alice.client.from('user_notes').select('body')
    const saved = await alice.client
      .from('user_saved_materials')
      .select('material_id')
    expect(notes.data).toEqual([{ body: 'alice only' }])
    expect(saved.data).toEqual([{ material_id: materialId }])
  })

  it('cannot write rows in their name', async () => {
    const forged = await bob.client
      .from('user_notes')
      .insert({ user_id: alice.id, material_id: materialId, body: 'forged' })
    expect(forged.error?.code).toBe('42501')

    const forgedSave = await bob.client
      .from('user_saved_materials')
      .insert({ user_id: alice.id, material_id: materialId })
    expect(forgedSave.error?.code).toBe('42501')
  })

  it('cannot re-point their own note at someone else', async () => {
    const own = await bob.client
      .from('user_notes')
      .insert({ user_id: bob.id, material_id: materialId, body: 'bob' })
      .select('id')
      .single()
    expect(own.error).toBeNull()

    const moved = await bob.client
      .from('user_notes')
      .update({ user_id: alice.id })
      .eq('id', own.data!.id)
    expect(moved.error?.code).toBe('42501')
  })
})

describe('a visitor who is not signed in', () => {
  const anon = () =>
    createClient(env.supabaseUrl, env.publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

  it('reads nothing', async () => {
    expect((await anon().from('user_notes').select('*')).data).toEqual([])
    expect(
      (await anon().from('user_saved_materials').select('*')).data
    ).toEqual([])
  })

  it('writes nothing', async () => {
    const insert = await anon()
      .from('user_notes')
      .insert({ user_id: alice.id, material_id: materialId, body: 'anon' })
    expect(insert.error?.code).toBe('42501')
  })

  it('cannot read the editorial tables or the search view through the Data API', async () => {
    // RLS with no policies (editorial tables) and the 0007 revoke (the view).
    expect((await anon().from('materials').select('id')).data).toEqual([])
    const view = await anon().from('material_search_view').select('slug')
    expect(view.error?.code).toBe('42501')
  })
})

describe('the app’s own reads, signed in through the real sign-in action', () => {
  async function as(email: string) {
    activate(new Browser())
    expect(
      await redirectOf(
        signIn({}, form({ email, password: 'correct horse battery' }))
      )
    ).toBe('/account')
  }

  it('lib/db returns only the caller’s rows', async () => {
    await as(bob.email)
    expect(await getSavedMaterialIds()).toEqual([])

    await as(alice.email)
    expect(await getSavedMaterialIds()).toEqual([materialId])
    expect(await getNote(materialId)).toBe('alice only')
  })

  it('the data export holds the caller’s rows and nobody else’s', async () => {
    await as(alice.email)
    const { data } = await admin.auth.admin.getUserById(alice.id)
    const file = await buildAccountExport(data.user!)

    expect(file.account.id).toBe(alice.id)
    expect(file.account.email).toBe(alice.email)
    expect(file.savedMaterials.map((s) => s.materialId)).toEqual([materialId])
    expect(file.notes.map((n) => n.body)).toEqual(['alice only'])
    expect(JSON.stringify(file)).not.toContain(bob.id)
  })
})
