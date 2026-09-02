import { getCurrentUserId } from '@/lib/db/bookmarks'
import { createClient } from '@/lib/supabase/server'

/**
 * Private notes — the user-owned side of the data boundary (W6-A / P3-B).
 *
 * **Every touch of `user_notes` in this file goes through the Supabase server
 * client, and that is the whole point.** Drizzle connects as the `postgres`
 * role and bypasses Row-Level Security entirely: one Drizzle query against this
 * table would make migration 0002's owner policies silently do nothing and turn
 * every reader's private notes into public data — while looking completely
 * correct in review. So this file imports no Drizzle client and no
 * `db/schema.ts`, deliberately and permanently, exactly as
 * `lib/db/bookmarks.ts` does not.
 *
 * The policies this code lives inside (migration `0002_rls-deny-by-default`,
 * already applied — this item writes no SQL) are SELECT / INSERT / UPDATE /
 * DELETE for the `authenticated` role, each `(select auth.uid()) = user_id`,
 * with UPDATE carrying **both** `USING` and `WITH CHECK` so a row cannot be
 * re-pointed at another user. Two consequences shape the code below —
 *
 * - the UPDATE policy is what makes a real upsert legal here. `user_notes` has
 *   `UNIQUE (user_id, material_id)`, so the write resolves to
 *   `ON CONFLICT DO UPDATE` and needs the INSERT and UPDATE policies together;
 *   this is the difference from bookmarks, where the absence of an UPDATE
 *   policy forces `ON CONFLICT DO NOTHING`.
 * - a DELETE that does not match the policy affects zero rows *without
 *   erroring*, so "no error came back" is never proof that a row went away.
 *   The cross-account probe has to re-read as the owner to prove anything.
 *
 * Notes are plain strings, not a domain object, so there is no `lib/types.ts`
 * shape to map to — D3 deliberately left Phase 3 types out, and `getNote`
 * returning `string | null` is the whole contract.
 */

/** The one table this file is allowed to touch. */
const TABLE = 'user_notes'

/** The single column the read selects; never leaves this file. */
interface NoteRow {
  body: string
}

/**
 * What a write reports back. Writes return a result rather than throwing: a
 * note that would not save is a failed control on a working page, not a failed
 * page, and must not throw the cited material page to its error boundary.
 */
export type NoteWriteResult =
  { ok: true } | { ok: false; reason: 'unauthenticated' | 'failed' }

/**
 * The caller's note on one material, or null when there isn't one.
 *
 * `getCurrentUserId` is imported from `lib/db/bookmarks.ts` rather than
 * reimplemented: it is the same `getUser()` read (validated against the auth
 * server, never `getSession()`), and it is `cache()`-deduped, so a page that
 * gates the save button and the note editor on a session pays for one round
 * trip rather than two.
 *
 * Signed out, this is null without asking — RLS would return nothing anyway.
 *
 * Throws on a read failure rather than returning null. The distinction matters
 * more here than anywhere else in the app: "you have no note" and "we could not
 * read your note" render identically as an empty textarea, and the second one
 * would invite the reader to type over a note that still exists. The caller
 * catches this and says so instead (D4: never catch-and-render-blank).
 */
export async function getNote(materialId: string): Promise<string | null> {
  const userId = await getCurrentUserId()
  if (userId === null) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from(TABLE)
    .select('body')
    // Redundant under the SELECT policy and stated anyway: the policy is the
    // fence, this is the lock. Neither alone is trusted to be the only one.
    .eq('user_id', userId)
    .eq('material_id', materialId)
    .maybeSingle()

  if (error) {
    throw new Error('notes: could not read the private note', { cause: error })
  }

  const row: NoteRow | null = data
  return row?.body ?? null
}

/**
 * Write the caller's note on one material, replacing whatever was there.
 *
 * `UNIQUE (user_id, material_id)` is what makes one-note-per-material true in
 * the database rather than only in the UI, and this upsert names that
 * constraint: a second tab, a double blur, or a stale client all converge on
 * one row instead of racing to insert two. Unlike the bookmark upsert this one
 * *resolves* the conflict — the default (`ignoreDuplicates: false`) is what
 * PostgREST turns into `ON CONFLICT DO UPDATE`, which the UPDATE policy above
 * permits for the caller's own row and refuses for anyone else's.
 *
 * `user_id` is the id `getUser()` just validated — never a value from the
 * client — and `WITH CHECK` on both INSERT and UPDATE independently refuses any
 * row whose `user_id` is not the caller's, so the row can only ever be the
 * caller's own and cannot be re-pointed at someone else's account.
 *
 * `updated_at` is set here because nothing sets it otherwise: there is no
 * trigger on this table, so an unstated timestamp would sit at its insert-time
 * default forever. `created_at` is deliberately *absent* from the payload — on
 * the conflict path PostgREST writes only the columns it is given, so leaving
 * it out is what preserves the original creation time.
 *
 * Rate limiting is the Week 18 Upstash pass (wave-6.md, constraint 4). It
 * belongs at the action boundary, not here, and is deferred, not dropped.
 */
export async function upsertNote(
  materialId: string,
  body: string
): Promise<NoteWriteResult> {
  const userId = await getCurrentUserId()
  if (userId === null) return { ok: false, reason: 'unauthenticated' }

  const supabase = await createClient()
  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: userId,
      material_id: materialId,
      body,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,material_id' }
  )

  if (error) {
    console.error('[notes] save failed:', error)
    return { ok: false, reason: 'failed' }
  }

  return { ok: true }
}

/**
 * Remove the caller's note on one material. Idempotent: deleting a note that is
 * not there succeeds and changes nothing, which is what clearing an already
 * empty textarea produces.
 *
 * This is the *only* way a note goes away, and it is a hard delete — user-owned
 * rows are never soft-deleted (AGENTS.md, GDPR). A cleared note is an absent
 * note, so the action routes a blank body here rather than storing `''`.
 *
 * Note what the DELETE policy does and does not do: a row belonging to another
 * account is *filtered out*, so the delete matches zero rows and returns no
 * error. Nothing here can distinguish "removed" from "was not yours".
 */
export async function deleteNote(materialId: string): Promise<NoteWriteResult> {
  const userId = await getCurrentUserId()
  if (userId === null) return { ok: false, reason: 'unauthenticated' }

  const supabase = await createClient()
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('user_id', userId)
    .eq('material_id', materialId)

  if (error) {
    console.error('[notes] delete failed:', error)
    return { ok: false, reason: 'failed' }
  }

  return { ok: true }
}
