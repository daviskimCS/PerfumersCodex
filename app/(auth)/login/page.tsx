'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useActionState, useState } from 'react'
import { z } from 'zod'

import { signIn } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  initialAuthFormState,
  signInSchema,
  type AuthFieldErrors,
} from '@/lib/validation/auth'

/**
 * Sign-in (W3-A). A client component because the form checklist demands
 * interaction: inline errors on blur (not keystroke), submit disabled while
 * invalid, a loading state while the action runs. The server action re-parses
 * with the same schema (D6), so nothing here is load-bearing for safety.
 */

type Field = 'email' | 'password'

function clientErrorsFor(
  values: { email: string; password: string },
  field: Field
): string[] {
  const parsed = signInSchema.safeParse(values)
  if (parsed.success) return []
  return z.flattenError(parsed.error).fieldErrors[field] ?? []
}

/**
 * Notice for a failed email-confirmation link (`/auth/confirm` redirects here
 * with `?error=confirm`). Separate component so the `useSearchParams` read
 * sits under its own Suspense boundary and the rest of the page stays
 * prerenderable.
 */
function ConfirmLinkNotice() {
  const searchParams = useSearchParams()
  if (searchParams.get('error') !== 'confirm') return null

  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      That confirmation link is invalid or has expired. Try signing in — or sign
      up again with the same email to get a fresh link.
    </div>
  )
}

export default function LoginPage() {
  const [values, setValues] = useState({ email: '', password: '' })
  // Written on blur only. For a given field, `undefined` defers to the
  // server's verdict; `[]` means "locally valid now" and clears a stale
  // server error the user has since fixed.
  const [localErrors, setLocalErrors] = useState<AuthFieldErrors>({})
  const [state, formAction, pending] = useActionState(
    signIn,
    initialAuthFormState
  )

  const errorsFor = (field: Field): string[] =>
    localErrors[field] ?? state.fieldErrors?.[field] ?? []

  const handleBlur = (field: Field) => () =>
    setLocalErrors((prev) => ({
      ...prev,
      [field]: clientErrorsFor(values, field),
    }))

  const handleChange = (field: Field) => (value: string) => {
    const next = { ...values, [field]: value }
    setValues(next)
    // Errors never appear mid-keystroke, but a visible one disappears the
    // moment the field becomes valid again.
    if (
      errorsFor(field).length > 0 &&
      clientErrorsFor(next, field).length === 0
    ) {
      setLocalErrors((prev) => ({ ...prev, [field]: [] }))
    }
  }

  const emailError = errorsFor('email')[0]
  const passwordError = errorsFor('password')[0]
  const formValid = signInSchema.safeParse(values).success

  return (
    <div className="flex flex-1 items-center justify-center px-gutter py-section md:px-gutter-lg">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick up where you left off.
        </p>

        <form
          action={formAction}
          // Fresh submission, fresh verdict: drop stale local overrides so
          // whatever the server returns is what shows.
          onSubmit={() => setLocalErrors({})}
          noValidate
          aria-busy={pending}
          className="mt-8 flex flex-col gap-6"
        >
          {/* Form-level notices, distinct from per-field errors. */}
          <Suspense fallback={null}>
            <ConfirmLinkNotice />
          </Suspense>
          {state.formError ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {state.formError}
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={(event) => handleChange('email')(event.target.value)}
              onBlur={handleBlur('email')}
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? 'login-email-error' : undefined}
            />
            {emailError ? (
              <p id="login-email-error" className="text-sm text-destructive">
                {emailError}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={values.password}
              onChange={(event) => handleChange('password')(event.target.value)}
              onBlur={handleBlur('password')}
              aria-invalid={passwordError ? true : undefined}
              aria-describedby={
                passwordError ? 'login-password-error' : undefined
              }
            />
            {passwordError ? (
              <p id="login-password-error" className="text-sm text-destructive">
                {passwordError}
              </p>
            ) : null}
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={pending || !formValid}
            className="w-full"
          >
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          No account yet?{' '}
          <Link
            href="/signup"
            className="font-medium text-brand underline decoration-brand-muted underline-offset-4 hover:decoration-brand"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
