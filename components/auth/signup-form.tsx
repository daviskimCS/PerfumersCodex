'use client'

import Link from 'next/link'
import { useActionState, useState, type FormEvent } from 'react'
import { MailCheck } from 'lucide-react'
import { z } from 'zod'

import { signUp } from '@/app/(auth)/actions'
import { GoogleAuth } from '@/components/auth/google-button'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  initialAuthFormState,
  signUpSchema,
  type AuthFieldErrors,
} from '@/lib/validation/auth'

/**
 * Sign-up (W3-A). A client component for the same reason as /login: the form
 * checklist demands blur-timed inline errors, an invalid submit stopped
 * with focus on the first error, and a loading state. The server action re-parses with the same
 * schema (D6).
 *
 * Email confirmation is ON, so success is not a session — it renders the
 * "check your email" state and stops there.
 *
 * It lives here rather than in `app/(auth)/signup/page.tsx` so that the page
 * can stay a Server Component and export `metadata` — see the note in
 * `login-form.tsx` for the Next reference and the W7-B finding behind it.
 */

type Field = 'email' | 'password'

function clientErrorsFor(
  values: { email: string; password: string },
  field: Field
): string[] {
  const parsed = signUpSchema.safeParse(values)
  if (parsed.success) return []
  return z.flattenError(parsed.error).fieldErrors[field] ?? []
}

export function SignupForm() {
  const [values, setValues] = useState({ email: '', password: '' })
  // Written on blur only. For a given field, `undefined` defers to the
  // server's verdict; `[]` means "locally valid now" and clears a stale
  // server error the user has since fixed.
  const [localErrors, setLocalErrors] = useState<AuthFieldErrors>({})
  const [state, formAction, pending] = useActionState(
    signUp,
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

  // Submit stays enabled: a disabled button can't be focused, and a
  // screen-reader user is never told why it won't press. An invalid
  // submission is stopped here instead, every field's error shown, and focus
  // moved to the first one. A valid one drops stale local overrides so the
  // server's verdict is what shows.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    const errors = {
      email: clientErrorsFor(values, 'email'),
      password: clientErrorsFor(values, 'password'),
    }
    const firstInvalid = (['email', 'password'] as const).find(
      (field) => errors[field].length > 0
    )
    if (firstInvalid) {
      event.preventDefault()
      setLocalErrors(errors)
      document.getElementById(`signup-${firstInvalid}`)?.focus()
      return
    }
    setLocalErrors({})
  }

  const emailError = errorsFor('email')[0]
  const passwordError = errorsFor('password')[0]
  const sentTo = state.sentTo

  return (
    <div className="flex flex-1 items-center justify-center px-gutter py-section md:px-gutter-lg">
      <div className="w-full max-w-sm">
        {/* Stable live region: empty until signup succeeds, then announces
            the confirmation state that replaces the form. */}
        <div aria-live="polite">
          {sentTo ? (
            <EmptyState
              headingLevel={1}
              icon={MailCheck}
              title="Check your email"
              description={
                <>
                  We sent a confirmation link to{' '}
                  <strong className="font-medium text-foreground">
                    {sentTo}
                  </strong>
                  . Open it to finish creating your account. Until then, signing
                  in won&apos;t work — the link comes first.
                </>
              }
            />
          ) : null}
        </div>

        {sentTo ? null : (
          <>
            <h1 className="text-2xl">Create an account</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Save materials and keep private notes. Reading the codex never
              requires an account.
            </p>

            <form
              action={formAction}
              // Fresh submission, fresh verdict: drop stale local overrides
              // so whatever the server returns is what shows.
              onSubmit={handleSubmit}
              noValidate
              aria-busy={pending}
              className="mt-8 flex flex-col gap-6"
            >
              {/* Form-level failure, distinct from per-field errors. */}
              {state.formError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                >
                  {state.formError}
                </div>
              ) : null}

              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={values.email}
                  onChange={(event) =>
                    handleChange('email')(event.target.value)
                  }
                  onBlur={handleBlur('email')}
                  aria-invalid={emailError ? true : undefined}
                  aria-describedby={
                    emailError ? 'signup-email-error' : undefined
                  }
                />
                {/* `role="alert"` because the message is *inserted* on blur,
                    once focus has already moved to the next control — an
                    `aria-describedby` link alone is read only when the field
                    it describes takes focus, so nothing would reach a
                    screen-reader user who has moved on. Same mechanism as the
                    form-level notice above. */}
                {emailError ? (
                  <p
                    id="signup-email-error"
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {emailError}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={values.password}
                  onChange={(event) =>
                    handleChange('password')(event.target.value)
                  }
                  onBlur={handleBlur('password')}
                  aria-invalid={passwordError ? true : undefined}
                  aria-describedby={
                    passwordError
                      ? 'signup-password-error'
                      : 'signup-password-hint'
                  }
                />
                {passwordError ? (
                  <p
                    id="signup-password-error"
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {passwordError}
                  </p>
                ) : (
                  <p
                    id="signup-password-hint"
                    className="text-sm text-muted-foreground"
                  >
                    At least 8 characters.
                  </p>
                )}
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={pending}
                className="w-full"
              >
                {pending ? 'Creating account…' : 'Create account'}
              </Button>
            </form>

            <GoogleAuth />

            <p className="mt-6 text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link
                href="/login"
                className="font-medium text-brand underline decoration-brand-muted underline-offset-4 hover:decoration-brand"
              >
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
