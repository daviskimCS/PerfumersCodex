import { z } from 'zod'

/**
 * Password-reset schemas (docs/architecture.md D6): one per form, imported by
 * the client form and re-parsed by the server action.
 *
 * The rules mirror `lib/validation/auth.ts` (email) and the new-password half
 * of `lib/validation/account.ts`, for the same reason that file gives: if the
 * Supabase password policy moves, every copy moves in the same breath.
 */

const emailSchema = z
  .string({ error: 'Enter your email address.' })
  .trim()
  .min(1, { error: 'Enter your email address.' })
  .pipe(z.email({ error: 'Enter a valid email address.' }))

// ---------------------------------------------------------------------------
// Ask for a reset link
// ---------------------------------------------------------------------------

export const requestPasswordResetSchema = z.object({ email: emailSchema })

export type RequestPasswordResetState = {
  fieldErrors?: { email?: string[] }
  formError?: string
  /**
   * Set on every accepted request, whether or not an account uses the
   * address. Saying "no account with that email" would tell anyone which
   * addresses have accounts; Supabase answers both cases the same way for the
   * same reason.
   */
  sentTo?: string
}

export const initialRequestPasswordResetState: RequestPasswordResetState = {}

// ---------------------------------------------------------------------------
// Set the new password (after following the link)
// ---------------------------------------------------------------------------

export const resetPasswordSchema = z
  .object({
    // The signup policy. No trim: surrounding spaces are legal characters.
    newPassword: z
      .string({ error: 'Enter a new password.' })
      .min(8, { error: 'Use at least 8 characters.' }),
    confirmPassword: z
      .string({ error: 'Repeat the new password.' })
      .min(1, { error: 'Repeat the new password.' }),
  })
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
  })

export type ResetPasswordFieldErrors = {
  newPassword?: string[]
  confirmPassword?: string[]
}

export type ResetPasswordState = {
  fieldErrors?: ResetPasswordFieldErrors
  formError?: string
  changed?: boolean
}

export const initialResetPasswordState: ResetPasswordState = {}

/**
 * Why the reset page refuses a session. Lives here rather than in the action
 * module because a `'use server'` file may export only async functions, and
 * the page shows the same sentence up front.
 */
export const RESET_LINK_NEEDED_MESSAGE =
  'This page only works straight after you open a password-reset link. Ask for a new link and use it within 30 minutes.'
