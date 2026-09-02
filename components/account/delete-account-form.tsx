'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

import { deleteAccount } from '@/app/account/actions'
import { Field, FormNotice } from '@/components/account/form-parts'
import { useAccountForm } from '@/components/account/use-account-form'
import { Button } from '@/components/ui/button'
import {
  DELETE_CONFIRMATION,
  deleteAccountSchema,
  initialDeleteAccountState,
} from '@/lib/validation/account'

/**
 * Delete the account, permanently (W6-B / P3-C).
 *
 * Two gates, deliberately. The section opens as a description and a single
 * button that only *reveals* the form — so the destructive control is never one
 * stray click from a page the reader opened to change their email. The form it
 * reveals then requires the word `DELETE`, typed in capitals: a gate that
 * cannot be cleared by muscle memory or by a mis-aimed Enter.
 *
 * The copy states what actually goes: the account itself, the saved list, and
 * the private notes — the two user-owned tables, both of which cascade off the
 * `auth.users` row. It says the change cannot be undone, because it cannot:
 * `app/account/actions.ts` hard-deletes, and there is no soft-delete to restore
 * from for user data (GDPR, AGENTS.md).
 *
 * Nothing on this side of the wire decides anything. The button's own state,
 * the typed word, the revealed form — all of it is convenience. The server
 * re-parses the confirmation and re-derives the caller from the session, so a
 * forged POST gets the same treatment as a careless click.
 */
export function DeleteAccountForm() {
  const [armed, setArmed] = useState(false)
  const [state, formAction, pending] = useActionState(
    deleteAccount,
    initialDeleteAccountState
  )
  const form = useAccountForm({
    schema: deleteAccountSchema,
    initialValues: { confirmation: '' },
    serverErrors: state.fieldErrors,
  })

  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    // Revealing a form and leaving focus on a button that just vanished
    // strands anyone navigating by keyboard.
    if (armed) inputRef.current?.focus()
  }, [armed])

  if (!armed) {
    return (
      <div className="mt-6">
        <Button
          type="button"
          variant="destructive"
          onClick={() => setArmed(true)}
        >
          Delete account…
        </Button>
      </div>
    )
  }

  return (
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
        ref={inputRef}
        id="account-delete-confirmation"
        label={`Type ${DELETE_CONFIRMATION} to confirm`}
        type="text"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        hint={
          <>
            Exactly{' '}
            <strong className="font-medium">{DELETE_CONFIRMATION}</strong>, in
            capitals.
          </>
        }
        {...form.fieldProps('confirmation')}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          variant="destructive"
          disabled={pending || !form.isValid}
        >
          {pending ? 'Deleting…' : 'Delete my account permanently'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            form.reset()
            setArmed(false)
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
