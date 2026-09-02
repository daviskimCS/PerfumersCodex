import { z } from 'zod'

/**
 * Private-note schema (docs/architecture.md D6): one schema for the one form
 * the note editor is, imported by **both** the client textarea (which parses on
 * blur before it sends anything) and the server action (`safeParse` before any
 * effect). "Server matches client" holds by construction because there is
 * exactly one schema and one cap.
 *
 * Two fields, and they are untrusted for different reasons. `body` is typed by
 * a person, so it gets a length cap and a field-keyed message the editor can
 * render under the box. `materialId` comes from a server-rendered prop and has
 * no visible input — but Server Functions are reachable by direct POST, so the
 * id crossing the network is as untrusted as the text, and an unvalidated
 * string reaching a `uuid` column raises a Postgres syntax error: a 500 where a
 * refusal belongs.
 *
 * **The trim is load-bearing, not tidiness.** A cleared note is an absent note
 * (wave-6.md W6-A): the body is trimmed here, once, and a body that trims to
 * nothing tells the action to *delete* the row rather than store a blank one.
 * Deciding that in the schema is what keeps the client and the server agreeing
 * on what "empty" means — the client can ask the same question of the same
 * parser instead of reimplementing it and drifting.
 */

/**
 * Longest note the editor will save.
 *
 * There is no length constraint on `user_notes.body` in the database — it is a
 * plain `text` column — so this cap exists to keep a runaway paste from
 * becoming an unbounded write, and to give the reader a number before the
 * request rather than an error after it. Counted against the *raw* text, so the
 * character counter in the textarea and the refusal from the server are the
 * same arithmetic.
 */
export const NOTE_MAX_LENGTH = 4000

export const noteSchema = z.object({
  materialId: z.uuid({ error: 'That material could not be identified.' }),
  body: z
    .string({ error: 'A note has to be text.' })
    .max(NOTE_MAX_LENGTH, {
      error: `A note can be at most ${NOTE_MAX_LENGTH} characters.`,
    })
    // Applied after the cap so the limit is measured on what was typed.
    .transform((value) => value.trim()),
})

/** Post-parse shape: `body` is already trimmed, so `''` means "delete it". */
export type NoteInput = z.infer<typeof noteSchema>

/** Shape of `z.flattenError(...).fieldErrors` for the note form. */
export type NoteFieldErrors = {
  materialId?: string[]
  body?: string[]
}

/**
 * What the note server action returns.
 *
 * `stored` distinguishes the two successful outcomes — text was written, or a
 * cleared note was deleted — so the editor's live region can say which one
 * happened instead of announcing "Saved" over a deletion.
 *
 * `message` is plain language for the reader, never a Supabase or Postgres
 * error (the rule `app/(auth)/actions.ts` and `app/saved/actions.ts` both
 * follow); the real failure is logged server-side. `fieldErrors` carries the
 * same text keyed by field, for rendering under the box (D6).
 */
export type NoteActionResult =
  | { ok: true; stored: boolean }
  | { ok: false; message: string; fieldErrors?: NoteFieldErrors }
