import { z } from 'zod'

/**
 * The pre-launch gate's one form (docs/architecture.md D6): a single schema,
 * imported by BOTH the client form (`components/gate/unlock-form.tsx`) and the
 * server action (`app/unlock/actions.ts`), so "server matches client" holds by
 * construction rather than by vigilance.
 *
 * NOTHING SECRET LIVES HERE. This module is imported by a client component and
 * therefore ships in the browser bundle; the password itself is read only by
 * `lib/gate.ts`, which is server-only. Never add a password, a hash of one, or
 * a hint about its shape to this file.
 *
 * Presence only — deliberately no minimum length, no character rules. Any rule
 * here would be a public description of the password, and none of them would
 * stop a single guess: the only check that matters happens on the server
 * against the real value.
 */
export const unlockSchema = z.object({
  // No `.trim()`: spaces are legal password characters, and silently editing
  // what someone typed before checking it makes a wrong answer unexplainable.
  password: z.string({ error: 'Enter the password.' }).min(1, {
    error: 'Enter the password.',
  }),
})

export type UnlockInput = z.infer<typeof unlockSchema>

/**
 * The ONLY failure message the unlock form ever shows.
 *
 * One message for every server-side outcome that is not success — wrong
 * password, gate misconfigured, key derivation failed. A form that says
 * "incorrect password" where it might have said something else is telling an
 * attacker which of their assumptions was right, and there is nothing here a
 * legitimate visitor could do differently with the more specific answer.
 */
export const UNLOCK_FAILED_MESSAGE =
  'That didn’t work. Check the password and try again.'

/**
 * Result state for the unlock action, consumed through `useActionState` —
 * the same shape the auth forms use (`lib/validation/auth.ts`).
 *
 * Success never reaches this state: the action sets the cookie and redirects.
 */
export type GateFormState = {
  fieldErrors?: { password?: string[] }
  formError?: string
}

export const initialGateFormState: GateFormState = {}
