'use server'

import { revalidatePath } from 'next/cache'

import { saveMaterial, unsaveMaterial } from '@/lib/db/bookmarks'
import {
  bookmarkSchema,
  type BookmarkActionResult,
} from '@/lib/validation/bookmarks'

/**
 * Bookmark server actions (W5-B / P3-A).
 *
 * Two rules govern everything here.
 *
 * **Nothing from the client is trusted.** Server Functions are reachable by
 * direct POST, not only through the button, so the material id is re-parsed
 * with the shared Zod schema (D6) and the *caller* is re-derived server-side
 * from the session cookie — `supabase.auth.getUser()`, inside
 * `lib/db/bookmarks.ts`, validated against the auth server rather than read
 * out of the cookie the way `getSession()` would. The button's `signedIn`
 * prop decides nothing on this side of the wire; a forged POST claiming to be
 * signed in gets the same refusal as a signed-out one. The check lives one
 * call down rather than being repeated here so the id used for the write is
 * the same id that was verified — two separate `getUser()` calls would be two
 * round trips and two chances to drift apart.
 *
 * **Failures come back as values, not exceptions.** A bookmark that would not
 * save is a failed control on a working page; the button rolls its optimistic
 * state back and says so, and the reader keeps reading. Raw Supabase errors
 * never reach the page — they are logged server-side and mapped to plain
 * language, the same rule `app/(auth)/actions.ts` follows.
 *
 * Rate limiting is the Week 18 Upstash pass (wave-4.md). Not here.
 */

const SIGNED_OUT_MESSAGE = 'Sign in to save materials.'
const FAILED_MESSAGE = 'That didn’t save. Try again in a moment.'

/**
 * Both surfaces whose server-rendered output depends on a bookmark.
 *
 * `/saved` is the list itself. `/materials/[slug]` renders each save button's
 * initial state, and it takes the route-pattern form because `revalidatePath`
 * requires the `type` argument for a dynamic segment and this action knows the
 * material's id, not its slug. Over-revalidating material pages costs nothing:
 * they are `force-dynamic`, so there is no cached render to throw away — what
 * this clears is the client router's copy, which is what would otherwise show
 * a stale "Save" on a back-navigation to a page just saved from.
 */
function revalidateBookmarkSurfaces(): void {
  revalidatePath('/saved')
  revalidatePath('/materials/[slug]', 'page')
}

export async function saveMaterialAction(
  materialId: string
): Promise<BookmarkActionResult> {
  const parsed = bookmarkSchema.safeParse({ materialId })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message }
  }

  const result = await saveMaterial(parsed.data.materialId)
  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === 'unauthenticated'
          ? SIGNED_OUT_MESSAGE
          : FAILED_MESSAGE,
    }
  }

  revalidateBookmarkSurfaces()
  return { ok: true }
}

export async function unsaveMaterialAction(
  materialId: string
): Promise<BookmarkActionResult> {
  const parsed = bookmarkSchema.safeParse({ materialId })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message }
  }

  const result = await unsaveMaterial(parsed.data.materialId)
  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === 'unauthenticated'
          ? SIGNED_OUT_MESSAGE
          : 'That didn’t come off the list. Try again in a moment.',
    }
  }

  revalidateBookmarkSurfaces()
  return { ok: true }
}
