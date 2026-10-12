'use client'

import Link from 'next/link'
import { useActionState, useEffect } from 'react'

import { resetPassword } from '@/app/account/actions'
import { Field, FormNotice } from '@/components/account/form-parts'
import { useAccountForm } from '@/components/account/use-account-form'
import { Button } from '@/components/ui/button'
import {
  initialResetPasswordState,
  resetPasswordSchema,
} from '@/lib/validation/password-reset'

/**
 * Choose a new password after following a reset link. No current-password
 * field: the reset link is the proof, and the server action refuses any
 * session that a reset link did not just create (`isRecentRecoverySession`).
 */
export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(
    resetPassword,
    initialResetPasswordState
  )
  const form = useAccountForm({
    schema: resetPasswordSchema,
    initialValues: { newPassword: '', confirmPassword: '' },
    serverErrors: state.fieldErrors,
  })

  const { reset } = form
  const changed = state.changed
  useEffect(() => {
    if (changed) reset()
  }, [changed, reset])

  if (changed) {
    return (
      <div aria-live="polite" className="mt-6 flex flex-col gap-4">
        <FormNotice tone="info">
          Your password has been changed, and you’re signed in.
        </FormNotice>
        <Link
          href="/account"
          className="text-sm font-medium text-brand underline decoration-brand-muted underline-offset-4 hover:decoration-brand"
        >
          Go to your account
        </Link>
      </div>
    )
  }

  return (
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
        id="reset-new-password"
        label="New password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
        {...form.fieldProps('newPassword')}
      />

      <Field
        id="reset-confirm-password"
        label="Repeat new password"
        type="password"
        autoComplete="new-password"
        {...form.fieldProps('confirmPassword')}
      />

      <Button
        type="submit"
        size="lg"
        disabled={pending || !form.isValid}
        className="w-full"
      >
        {pending ? 'Saving…' : 'Set new password'}
      </Button>
    </form>
  )
}
