'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { deleteNote, upsertNote } from '@/lib/db/notes'
import {
  noteSchema,
  type NoteActionResult,
  type NoteFieldErrors,
} from '@/lib/validation/notes'

/**
 * Private-note server action (W6-A / P3-B).
 *
 * Three rules govern everything here.
 *
 * **Nothing from the client is trusted.** Server Functions are reachable by
 * direct POST, not only through the textarea, so both arguments are re-parsed
 * with the shared Zod schema (D6) and the *caller* is re-derived server-side
 * from the session cookie — `supabase.auth.getUser()`, inside `lib/db/notes.ts`
 * via `getCurrentUserId()`, validated against the auth server rather than read
 * out of the cookie the way `getSession()` would. The editor's `signedIn` prop
 * decides nothing on this side of the wire; a forged POST claiming to be signed
 * in gets the same refusal as a signed-out one. That check lives one call down
 * rather than being repeated here so the id used for the write is the same id
 * that was verified — two separate `getUser()` calls would be two round trips
 * and two chances to drift apart. RLS is the second fence behind it: even a
 * write that got past this function could only ever land on the caller's row.
 *
 * **A cleared note is an absent note.** Whether text is stored or the row is
 * deleted is decided *here*, from the trimmed parse output, not by the client
 * choosing which endpoint to call. One entry point, one decision, no way for a
 * caller to ask for a blank row.
 *
 * **Failures come back as values, not exceptions.** A note that would not save
 * is a failed control on a working page; the editor rolls its optimistic state
 * back, keeps every character the reader typed, and says what happened. Raw
 * Supabase errors never reach the page — they are logged server-side and mapped
 * to plain language, the rule `app/(auth)/actions.ts` follows.
 *
 * Rate limiting on note saves is the Week 18 Upstash pass (wave-6.md,
 * constraint 4) and this is where it will attach. Deferred, not dropped, and
 * deliberately not bolted on early.
 */

const SIGNED_OUT_MESSAGE = 'Sign in to keep a note on this material.'
const FAILED_MESSAGE = 'That didn’t save. Your text is still here — try again.'
const CLEAR_FAILED_MESSAGE =
  'That didn’t clear. Your text is still here — try again.'
const UNPARSEABLE_MESSAGE = 'That note could not be saved.'

/**
 * Save, or clear, the caller's note on one material.
 *
 * `revalidatePath` takes the route-pattern form because it is required for a
 * dynamic segment and this action knows the material's id, not its slug.
 * Over-revalidating material pages costs nothing — they are `force-dynamic`, so
 * there is no cached render to throw away. What it clears is the client
 * router's copy, which is what would otherwise show a stale note on a
 * back-navigation to a page just edited.
 */
export async function saveNoteAction(
  materialId: string,
  body: string
): Promise<NoteActionResult> {
  const parsed = noteSchema.safeParse({ materialId, body })
  if (!parsed.success) {
    const fieldErrors: NoteFieldErrors = z.flattenError(
      parsed.error
    ).fieldErrors
    return {
      ok: false,
      message:
        fieldErrors.body?.[0] ??
        fieldErrors.materialId?.[0] ??
        UNPARSEABLE_MESSAGE,
      fieldErrors,
    }
  }

  // Already trimmed by the schema, so this is the real question: is there
  // anything left to keep?
  const stored = parsed.data.body.length > 0
  const result = stored
    ? await upsertNote(parsed.data.materialId, parsed.data.body)
    : await deleteNote(parsed.data.materialId)

  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === 'unauthenticated'
          ? SIGNED_OUT_MESSAGE
          : stored
            ? FAILED_MESSAGE
            : CLEAR_FAILED_MESSAGE,
    }
  }

  revalidatePath('/materials/[slug]', 'page')
  return { ok: true, stored }
}
