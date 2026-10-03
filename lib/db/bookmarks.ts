import { cache } from 'react'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'

import { listMaterialsByIds } from '@/lib/db/materials'
import { createClient } from '@/lib/supabase/server'
import type { MaterialSummary } from '@/lib/types'

/**
 * Bookmarks — the user-owned side of the data boundary (W5-B / P3-A).
 *
 * **Every touch of `user_saved_materials` in this file goes through the
 * Supabase server client, and that is the whole point.** Drizzle connects as
 * the `postgres` role and bypasses Row-Level Security entirely: one Drizzle
 * query against this table would make migration 0002's owner policies silently
 * do nothing and turn every reader's shelf into public data. So this file
 * imports no Drizzle client and no `db/schema.ts` — deliberately, permanently.
 *
 * The policies this code lives inside (migration `0002_rls-deny-by-default`,
 * already applied) are SELECT / INSERT / DELETE for the `authenticated` role,
 * each `(select auth.uid()) = user_id`, INSERT via `WITH CHECK`. There is no
 * UPDATE policy, by design: a bookmark is created or deleted, never edited.
 * Two consequences shape the code below —
 *
 * - an upsert here must resolve to `ON CONFLICT DO NOTHING`; anything that
 *   updated would be refused outright;
 * - a DELETE that does not match the policy affects zero rows *without
 *   erroring*, so "no error came back" is never proof that a row went away.
 *
 * Returns `lib/types.ts` shapes only (architecture D1).
 */

/** The one table this file is allowed to touch. */
const TABLE = 'user_saved_materials'

/** The single column the id reads select; never leaves this file. */
interface SavedRow {
  material_id: string
}

/**
 * What a write reports back. Writes return a result rather than throwing:
 * a bookmark that would not save is a failed control, not a failed page, and
 * should not throw the material page to its error boundary.
 */
export type BookmarkWriteResult =
  { ok: true } | { ok: false; reason: 'unauthenticated' | 'failed' }

/**
 * The signed-in user's id, from a verified token — or null when nobody is
 * signed in.
 *
 * `getClaims()`, never `getSession()`: `getSession()` trusts whatever the
 * cookie claims, `getClaims()` verifies the token's signature against the
 * project's public signing keys before believing its `sub` (AGENTS.md, auth
 * and security). It is the read-side check: it decides what the page SHOWS
 * (the header's links, the save button's state, which note to load), and RLS
 * — which PostgREST enforces from the same token — decides what the reader can
 * actually touch. A token revoked elsewhere stays verifiable until it expires
 * (an hour at most); the writes where that hour matters (`app/account/`) call
 * `getUser()` themselves.
 *
 * Until asymmetric signing keys are turned on (docs/maker-todo.md item 11)
 * the token is HS256 and the client falls back to `getUser()` internally, so
 * this is never less safe than the old call — only faster once it can be.
 *
 * Wrapped in React's `cache()` so the header, the save button and the note
 * editor — all on one material page — share one verification per request.
 *
 * Throws **only** when the auth service itself is unreachable — "no session"
 * is not an error, it is `null`. That distinction is `app/account/page.tsx`'s
 * and it is kept here: `/saved` lets the throw reach `error.tsx` rather than
 * bouncing a signed-in reader to `/login` over a network blip, while the
 * public material page catches it and degrades to the signed-out control.
 */
export const getCurrentUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error && isAuthRetryableFetchError(error)) {
    throw new Error('Could not reach the authentication service', {
      cause: error,
    })
  }

  return data?.claims.sub ?? null
})

/**
 * The ids on the caller's shelf, most recently saved first.
 *
 * The ordering is the contract `/saved` reads: `listMaterialsByIds` preserves
 * the order it is given, so the sort decided here survives all the way to the
 * page. Signed out, this is empty — RLS would return nothing anyway, and
 * asking is pointless.
 */
export async function getSavedMaterialIds(): Promise<string[]> {
  const userId = await getCurrentUserId()
  if (userId === null) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from(TABLE)
    .select('material_id')
    // Redundant under the SELECT policy and stated anyway: the policy is the
    // fence, this is the lock. Neither alone is trusted to be the only one.
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    // D4 failure posture for reads: let it throw to error.tsx rather than
    // rendering an empty shelf, which would lie about the data.
    throw new Error('bookmarks: could not read the saved materials', {
      cause: error,
    })
  }

  const rows: SavedRow[] = data ?? []
  return rows.map((row) => row.material_id)
}

/**
 * Whether one material is on the caller's shelf — the material page's
 * question, asked as a single primary-key lookup instead of loading an entire
 * shelf to test one membership.
 */
export async function isMaterialSaved(materialId: string): Promise<boolean> {
  const userId = await getCurrentUserId()
  if (userId === null) return false

  const supabase = await createClient()
  const { data, error } = await supabase
    .from(TABLE)
    .select('material_id')
    .eq('user_id', userId)
    .eq('material_id', materialId)
    .maybeSingle()

  if (error) {
    throw new Error('bookmarks: could not read the saved state', {
      cause: error,
    })
  }

  return data !== null
}

/**
 * The caller's shelf as the browse surfaces render it, newest save first.
 *
 * ── The seam between the two halves of the data boundary ──────────────────
 * The bookmark half is user-owned and is read above through the Supabase
 * client, so RLS decides what is visible. The material half is public
 * editorial data and stays in `lib/db/materials.ts`, the file that owns
 * Drizzle. This is a *function import* across that line, not a second query
 * layer: `listMaterialsByIds` preserves input order, de-dupes, and drops ids
 * that match nothing or a soft-deleted row — so a material retired after it
 * was bookmarked simply falls out of the list instead of rendering a hole.
 */
export async function getSavedMaterials(): Promise<MaterialSummary[]> {
  const ids = await getSavedMaterialIds()
  return listMaterialsByIds(ids)
}

/**
 * Put a material on the caller's shelf. Idempotent: saving something already
 * saved is a no-op, which is what a double click or a second open tab
 * produces.
 *
 * `user_id` is the id `getUser()` just validated — never a value from the
 * client — and the `WITH CHECK` policy independently refuses any row whose
 * `user_id` is not the caller's, so the row can only ever be the caller's own.
 * `ignoreDuplicates` is what keeps the upsert on the `ON CONFLICT DO NOTHING`
 * path; a resolution that updated would need the UPDATE policy this table
 * deliberately does not have.
 */
export async function saveMaterial(
  materialId: string
): Promise<BookmarkWriteResult> {
  const userId = await getCurrentUserId()
  if (userId === null) return { ok: false, reason: 'unauthenticated' }

  const supabase = await createClient()
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      { user_id: userId, material_id: materialId },
      { onConflict: 'user_id,material_id', ignoreDuplicates: true }
    )

  if (error) {
    console.error('[bookmarks] save failed:', error)
    return { ok: false, reason: 'failed' }
  }

  return { ok: true }
}

/**
 * Take a material off the caller's shelf. Idempotent in the same way: removing
 * something that is not there succeeds and changes nothing.
 *
 * Note what the DELETE policy does and does not do: a row belonging to another
 * account is *filtered out*, so the delete matches zero rows and returns no
 * error. Nothing here can distinguish "removed" from "was not yours" — which
 * is why the cross-account probe in the RLS protocol has to re-read the row as
 * its owner instead of asserting that the delete errored.
 */
export async function unsaveMaterial(
  materialId: string
): Promise<BookmarkWriteResult> {
  const userId = await getCurrentUserId()
  if (userId === null) return { ok: false, reason: 'unauthenticated' }

  const supabase = await createClient()
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('user_id', userId)
    .eq('material_id', materialId)

  if (error) {
    console.error('[bookmarks] unsave failed:', error)
    return { ok: false, reason: 'failed' }
  }

  return { ok: true }
}
