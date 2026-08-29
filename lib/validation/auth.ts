import { z } from 'zod'

/**
 * Auth form schemas (docs/architecture.md D6): one schema per form, imported
 * by BOTH the client form (inline errors on blur) and the server action
 * (`safeParse` before any effect) — "server matches client" holds by
 * construction.
 *
 * Deliberately thin. Supabase's own password policy is the authority on
 * password rules; the only client-side requirement is a minimum length, with
 * no strength theater (no digit/symbol/case regexes). The minimum here must
 * mirror the Supabase dashboard's "minimum password length" setting — if the
 * maker changes that setting, change this in the same breath.
 */

const emailSchema = z
  .string({ error: 'Enter your email address.' })
  .trim()
  .min(1, { error: 'Enter your email address.' })
  .pipe(z.email({ error: 'Enter a valid email address.' }))

export const signUpSchema = z.object({
  email: emailSchema,
  // Mirrors the Supabase password policy (minimum length 8). No trim —
  // leading/trailing spaces are legal password characters.
  password: z
    .string({ error: 'Enter a password.' })
    .min(8, { error: 'Use at least 8 characters.' }),
})

export const signInSchema = z.object({
  email: emailSchema,
  // Sign-in never re-states the signup policy: an account created under an
  // older/looser policy must still be able to log in. Presence only.
  password: z.string({ error: 'Enter your password.' }).min(1, {
    error: 'Enter your password.',
  }),
})

export type SignUpInput = z.infer<typeof signUpSchema>
export type SignInInput = z.infer<typeof signInSchema>

/** Shape of `z.flattenError(...).fieldErrors` for both auth forms. */
export type AuthFieldErrors = {
  email?: string[]
  password?: string[]
}

/**
 * Result state returned by the auth server actions and consumed via
 * `useActionState` (docs/waves/wave-3.md W3-A). Exactly one of the optional
 * members is set on any non-idle result:
 *
 * - `fieldErrors` — safeParse failure, rendered inline under each field (D6)
 * - `formError`  — the submission was valid but auth itself failed (wrong
 *   password, unconfirmed email …), rendered above the fields in plain
 *   language, never raw Supabase internals
 * - `sentTo`     — signup accepted with email confirmation ON: a
 *   confirmation link went to this address; render "check your email" and do
 *   not pretend a session exists
 *
 * Success on sign-in/sign-out never reaches this state — those actions
 * redirect instead.
 */
export type AuthFormState = {
  fieldErrors?: AuthFieldErrors
  formError?: string
  sentTo?: string
}

export const initialAuthFormState: AuthFormState = {}
