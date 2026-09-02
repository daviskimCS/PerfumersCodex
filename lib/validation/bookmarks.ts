import { z } from 'zod'

/**
 * Bookmark schema (docs/architecture.md D6): one schema for the one input the
 * bookmark actions take, imported by both the server actions (`safeParse`
 * before any effect) and — as a type — by the client component that calls
 * them.
 *
 * This "form" has a single field and no visible input: the material id comes
 * from a server-rendered prop, not from anything a person types. That does not
 * make the parse optional. Server Functions are reachable by direct POST, so
 * the id crossing the network is untrusted like any other input, and an
 * unvalidated string reaching a `uuid` column raises a Postgres syntax error —
 * a 500 where a refusal belongs.
 *
 * There are no field-keyed errors for the same reason: with nothing to correct
 * on screen, a failed parse means tampering or a bug, not a typo, so it comes
 * back through the same single message channel as every other failure.
 */

export const bookmarkSchema = z.object({
  materialId: z.uuid({ error: 'That material could not be identified.' }),
})

export type BookmarkInput = z.infer<typeof bookmarkSchema>

/**
 * What the bookmark server actions return.
 *
 * `message` is plain language for the reader — never a Supabase or Postgres
 * error, which is API internals (the same rule `app/(auth)/actions.ts`
 * follows). The real failure is logged server-side.
 */
export type BookmarkActionResult = { ok: true } | { ok: false; message: string }
