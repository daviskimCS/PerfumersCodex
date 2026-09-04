'use client'

import { useActionState, useState } from 'react'
import { z } from 'zod'

import { unlock } from '@/app/unlock/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { initialGateFormState, unlockSchema } from '@/lib/validation/gate'

/**
 * The pre-launch gate's password form.
 *
 * A client component for the same reasons the auth forms are: an inline error
 * on blur rather than on every keystroke, a submit that cannot fire on an
 * empty field, and a visible pending state while the server thinks. None of
 * that is load-bearing for safety — `app/unlock/actions.ts` re-parses with the
 * same schema and does the only check that counts (D6).
 *
 * It lives here, and not in `app/unlock/page.tsx`, so that the page can stay a
 * Server Component and export `metadata` — the same split
 * `components/auth/login-form.tsx` documents.
 *
 * The form never says what is behind the gate, and the failure message never
 * says which part of the attempt failed.
 */
export function UnlockForm() {
  const [password, setPassword] = useState('')
  // Written on blur only. `undefined` defers to the server's verdict; `[]`
  // means "locally valid now" and clears an error the visitor has since fixed.
  const [localErrors, setLocalErrors] = useState<string[] | undefined>(
    undefined
  )
  const [state, formAction, pending] = useActionState(
    unlock,
    initialGateFormState
  )

  const clientErrors = (value: string): string[] => {
    const parsed = unlockSchema.safeParse({ password: value })
    if (parsed.success) return []
    return z.flattenError(parsed.error).fieldErrors.password ?? []
  }

  const errors = localErrors ?? state.fieldErrors?.password ?? []
  const error = errors[0]
  const valid = unlockSchema.safeParse({ password }).success

  return (
    <div className="flex flex-1 items-center justify-center px-gutter py-section md:px-gutter-lg">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl">Perfumers Codex</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This site isn’t open yet. Enter the password to continue.
        </p>

        <form
          action={formAction}
          // Fresh submission, fresh verdict: drop the stale local override so
          // whatever the server returns is what shows.
          onSubmit={() => setLocalErrors(undefined)}
          noValidate
          aria-busy={pending}
          className="mt-8 flex flex-col gap-6"
        >
          {state.formError ? (
            // `role="alert"` because this is inserted after the submit, once
            // focus has already left the field it relates to.
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {state.formError}
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="gate-password">Password</Label>
            <Input
              id="gate-password"
              name="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                // An error never appears mid-keystroke, but a visible one
                // disappears the moment the field becomes valid again.
                if (
                  errors.length > 0 &&
                  clientErrors(event.target.value).length === 0
                ) {
                  setLocalErrors([])
                }
              }}
              onBlur={() => setLocalErrors(clientErrors(password))}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'gate-password-error' : undefined}
            />
            {error ? (
              <p
                id="gate-password-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={pending || !valid}
            className="w-full"
          >
            {pending ? 'Checking…' : 'Continue'}
          </Button>
        </form>
      </div>
    </div>
  )
}
