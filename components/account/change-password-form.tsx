'use client'

import { useActionState, useEffect } from 'react'

import { changePassword } from '@/app/account/actions'
import { Field, FormNotice } from '@/components/account/form-parts'
import { useAccountForm } from '@/components/account/use-account-form'
import { Button } from '@/components/ui/button'
import {
  changePasswordSchema,
  initialChangePasswordState,
} from '@/lib/validation/account'

/**
 * Change the account password (W6-B / P3-C).
 *
 * The current password is required, and the server proves it before changing
 * anything — Supabase's own `updateUser({ password })` would not, so the check
 * is explicit in `app/account/actions.ts`. A wrong current password comes back
 * as a field error on that field, not as a form-level failure, because it is
 * something the reader can correct in place.
 *
 * Unlike the email change, this one is immediate: when the action reports
 * success, the password really has changed.
 */
export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePassword,
    initialChangePasswordState
  )
  const form = useAccountForm({
    schema: changePasswordSchema,
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    serverErrors: state.fieldErrors,
  })

  const { reset } = form
  const changed = state.changed
  useEffect(() => {
    // Three password fields left populated after a successful change are three
    // passwords sitting in the DOM for the next person at the bench.
    if (changed) reset()
  }, [changed, reset])

  return (
    <>
      {/* Stable live region — see the note in change-email-form.tsx. */}
      <div aria-live="polite" className="mt-6 empty:mt-0">
        {changed ? (
          <FormNotice tone="info">
            Your password has been changed. Use the new one next time you sign
            in.
          </FormNotice>
        ) : null}
      </div>

      <form
        action={formAction}
        onSubmit={form.clearLocalErrors}
        noValidate
        aria-busy={pending}
        className="mt-6 flex flex-col gap-6"
      >
        {state.formError ? (
          <FormNotice tone="error">{state.formError}</FormNotice>
        ) : null}

        <Field
          id="account-current-password"
          label="Current password"
          type="password"
          autoComplete="current-password"
          {...form.fieldProps('currentPassword')}
        />

        <Field
          id="account-new-password"
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          {...form.fieldProps('newPassword')}
        />

        <Field
          id="account-confirm-password"
          label="Repeat new password"
          type="password"
          autoComplete="new-password"
          {...form.fieldProps('confirmPassword')}
        />

        <div>
          <Button type="submit" disabled={pending || !form.isValid}>
            {pending ? 'Changing…' : 'Change password'}
          </Button>
        </div>
      </form>
    </>
  )
}
