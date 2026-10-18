'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { requestPasswordReset } from '@/app/(auth)/actions'
import { TurnstileField } from '@/components/auth/turnstile'
import { Field, FormNotice } from '@/components/account/form-parts'
import { useAccountForm } from '@/components/account/use-account-form'
import { Button } from '@/components/ui/button'
import {
  initialRequestPasswordResetState,
  requestPasswordResetSchema,
} from '@/lib/validation/password-reset'

const LINK_CLASSNAME =
  'font-medium text-brand underline decoration-brand-muted underline-offset-4 hover:decoration-brand'

/**
 * Ask for a password-reset link. Reuses the `/account` form checklist
 * (`useAccountForm`, `Field`) rather than hand-rolling a fourth copy of the
 * blur-validation logic the login and signup forms carry.
 *
 * The success state never says whether an account exists for the address:
 * that would make this form a way to test which emails have accounts.
 */
export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialRequestPasswordResetState
  )
  const form = useAccountForm({
    schema: requestPasswordResetSchema,
    initialValues: { email: '' },
    serverErrors: state.fieldErrors,
  })

  return (
    <div className="flex flex-1 items-center justify-center px-gutter py-section md:px-gutter-lg">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl">Reset your password</h1>

        {state.sentTo ? (
          <div aria-live="polite" className="mt-6 flex flex-col gap-4">
            <FormNotice tone="info">
              If an account uses{' '}
              <strong className="font-medium text-foreground break-words">
                {state.sentTo}
              </strong>
              , a reset link is on its way. Open it within an hour, then choose
              a new password.
            </FormNotice>
            <p className="text-sm text-muted-foreground">
              Nothing arrived? Check spam, or{' '}
              <Link href="/forgot-password" className={LINK_CLASSNAME}>
                try again
              </Link>
              .
            </p>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              We’ll email you a link to choose a new one.
            </p>
            <form
              action={formAction}
              onSubmit={form.clearLocalErrors}
              noValidate
              aria-busy={pending}
              className="mt-8 flex flex-col gap-6"
            >
              {state.formError ? (
                <FormNotice tone="error">{state.formError}</FormNotice>
              ) : null}

              <Field
                id="forgot-email"
                label="Email"
                type="email"
                autoComplete="email"
                {...form.fieldProps('email')}
              />

              <TurnstileField action="password-reset" resetKey={state} />

              <Button
                type="submit"
                size="lg"
                disabled={pending || !form.isValid}
                className="w-full"
              >
                {pending ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
          </>
        )}

        <p className="mt-6 text-sm text-muted-foreground">
          Remembered it?{' '}
          <Link href="/login" className={LINK_CLASSNAME}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
