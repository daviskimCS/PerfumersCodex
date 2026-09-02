import { z } from 'zod'

/**
 * Account-management schemas (W6-B / P3-C, docs/architecture.md D6).
 *
 * Three forms, three schemas, each imported by BOTH the client form (inline
 * errors on blur) and the server action (`safeParse` before any effect), so
 * "server matches client" holds by construction rather than by vigilance.
 *
 * The email and password rules deliberately MIRROR `lib/validation/auth.ts`
 * rather than importing from it: that file is the signup/login contract and is
 * read-only to this item. The values are copied, not re-derived — if the
 * Supabase dashboard's password policy moves, both files change in the same
 * breath. (Known drift, already logged as a maker task: the dashboard minimum
 * is currently 6 while both schemas require 8. 8 is the stricter of the two
 * and is what ships; do not lower it to match.)
 */

/** Verbatim from `lib/validation/auth.ts` — see the note above. */
const emailSchema = z
  .string({ error: 'Enter an email address.' })
  .trim()
  .min(1, { error: 'Enter an email address.' })
  .pipe(z.email({ error: 'Enter a valid email address.' }))

/**
 * The signup policy, applied to the *new* password only. No trim —
 * leading/trailing spaces are legal password characters.
 */
const newPasswordSchema = z
  .string({ error: 'Enter a new password.' })
  .min(8, { error: 'Use at least 8 characters.' })

// ---------------------------------------------------------------------------
// Change email
// ---------------------------------------------------------------------------

export const changeEmailSchema = z.object({ email: emailSchema })

export type ChangeEmailInput = z.infer<typeof changeEmailSchema>

export type ChangeEmailFieldErrors = { email?: string[] }

/**
 * What the change-email action returns, consumed via `useActionState`.
 *
 * `confirmationSentTo` is the honest success state and is named for what
 * actually happened: Supabase sent a confirmation link. **The address has not
 * changed yet**, and nothing rendered from this field may say that it has.
 */
export type ChangeEmailState = {
  fieldErrors?: ChangeEmailFieldErrors
  formError?: string
  confirmationSentTo?: string
}

export const initialChangeEmailState: ChangeEmailState = {}

// ---------------------------------------------------------------------------
// Change password
// ---------------------------------------------------------------------------

export const changePasswordSchema = z
  .object({
    /**
     * Presence only, exactly as `signInSchema` does it: an account created
     * under an older, looser policy must still be able to prove itself. The
     * authority on whether this is *correct* is Supabase, not this schema.
     */
    currentPassword: z
      .string({ error: 'Enter your current password.' })
      .min(1, { error: 'Enter your current password.' }),
    newPassword: newPasswordSchema,
    confirmPassword: z
      .string({ error: 'Repeat the new password.' })
      .min(1, { error: 'Repeat the new password.' }),
  })
  // `superRefine` keeps the schema a ZodObject, so `flattenError().fieldErrors`
  // stays keyed by field and these cross-field issues render inline like any
  // other — not as a form-level error the reader has to map back to a box.
  .superRefine((values, ctx) => {
    if (
      values.confirmPassword.length > 0 &&
      values.newPassword !== values.confirmPassword
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Those two don’t match.',
      })
    }
    // Caught here so the reader is told plainly instead of round-tripping to
    // Supabase's `same_password` error.
    if (
      values.currentPassword.length > 0 &&
      values.newPassword.length > 0 &&
      values.currentPassword === values.newPassword
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['newPassword'],
        message: 'Choose a password different from your current one.',
      })
    }
  })

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

export type ChangePasswordFieldErrors = {
  currentPassword?: string[]
  newPassword?: string[]
  confirmPassword?: string[]
}

export type ChangePasswordState = {
  fieldErrors?: ChangePasswordFieldErrors
  formError?: string
  /** The password really did change — unlike email, this one is immediate. */
  changed?: boolean
}

export const initialChangePasswordState: ChangePasswordState = {}

// ---------------------------------------------------------------------------
// Delete account
// ---------------------------------------------------------------------------

/**
 * The word that has to be typed to arm account deletion.
 *
 * A single exported constant so the field, the copy that tells the reader what
 * to type, and the server's re-parse can never disagree. Capitals are required:
 * the point of the gate is that it cannot be produced by muscle memory.
 */
export const DELETE_CONFIRMATION = 'DELETE'

export const deleteAccountSchema = z.object({
  confirmation: z
    .string({ error: `Type ${DELETE_CONFIRMATION} to confirm.` })
    // Trims surrounding whitespace only — a stray space from a paste should
    // not read as a refusal. The word itself must be exact.
    .trim()
    .refine((value) => value === DELETE_CONFIRMATION, {
      error: `Type ${DELETE_CONFIRMATION} in capitals to confirm.`,
    }),
})

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>

export type DeleteAccountFieldErrors = { confirmation?: string[] }

/**
 * What the delete action returns *when it fails*. Success never reaches this
 * state — the action signs out and redirects, so there is no "deleted!" flag
 * to render on a page belonging to an account that no longer exists.
 */
export type DeleteAccountState = {
  fieldErrors?: DeleteAccountFieldErrors
  formError?: string
}

export const initialDeleteAccountState: DeleteAccountState = {}
