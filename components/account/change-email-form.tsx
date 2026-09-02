'use client'

import { useActionState, useEffect } from 'react'

import { changeEmail } from '@/app/account/actions'
import { Field, FormNotice } from '@/components/account/form-parts'
import { useAccountForm } from '@/components/account/use-account-form'
import { Button } from '@/components/ui/button'
import {
  changeEmailSchema,
  initialChangeEmailState,
} from '@/lib/validation/account'

/**
 * Change the address the account signs in with (W6-B / P3-C).
 *
 * **The pending state is the honest state.** Supabase does not move the
 * address when this form is submitted — it emails a confirmation link (to both
 * the old and the new address while "Secure email change" is on, which is the
 * default) and changes nothing until those links are followed. So this form
 * says a link was sent and stops there. The account page, one level up, keeps
 * showing the *current* address and a standing "waiting on confirmation" note
 * for as long as `user.new_email` is set. Nothing on this surface is allowed to
 * report the new address as the account's address before it is.
 */
export function ChangeEmailForm({
  currentEmail,
}: {
  /** The address on the account right now, for the "already yours" check. */
  currentEmail: string
}) {
  const [state, formAction, pending] = useActionState(
    changeEmail,
    initialChangeEmailState
  )
  const form = useAccountForm({
    schema: changeEmailSchema,
    initialValues: { email: '' },
    serverErrors: state.fieldErrors,
  })

  const { reset } = form
  const sentTo = state.confirmationSentTo
  useEffect(() => {
    // The request is in flight to an inbox now; leaving the address sitting in
    // the box invites a second, identical submission.
    if (sentTo) reset()
  }, [sentTo, reset])

  return (
    <>
      {/* Stable live region: on the page from the first render, so the notice
          that appears inside it is announced rather than silently swapped in.
          Outside the form — the same placement signup uses — so that while it
          is empty it contributes no box and no gap. */}
      <div aria-live="polite" className="mt-6 empty:mt-0">
        {sentTo ? (
          <FormNotice tone="info">
            Confirmation sent to{' '}
            <strong className="font-medium text-foreground">{sentTo}</strong>.
            Your address is still{' '}
            <strong className="font-medium text-foreground">
              {currentEmail}
            </strong>{' '}
            and stays that way until the link is opened — check both inboxes, as
            the old address may be asked to approve the change too.
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
          id="account-new-email"
          label="New email address"
          type="email"
          autoComplete="email"
          hint="We’ll send a confirmation link there. Nothing changes until you open it."
          {...form.fieldProps('email')}
        />

        <div>
          <Button type="submit" disabled={pending || !form.isValid}>
            {pending ? 'Sending…' : 'Send confirmation link'}
          </Button>
        </div>
      </form>
    </>
  )
}
