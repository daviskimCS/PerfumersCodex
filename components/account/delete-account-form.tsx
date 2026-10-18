'use client'

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react'

import { deleteAccount } from '@/app/account/actions'
import { Field, FormNotice } from '@/components/account/form-parts'
import { useAccountForm } from '@/components/account/use-account-form'
import { GoogleReauth } from '@/components/auth/google-button'
import { TurnstileField } from '@/components/auth/turnstile'
import { Button } from '@/components/ui/button'
import { REAUTH_WINDOW_SECONDS } from '@/lib/account/identity'
import {
  DELETE_CONFIRMATION,
  deleteAccountSchema,
  deleteGoogleAccountSchema,
  initialDeleteAccountState,
  type DeleteAccountState,
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
 * And a third, which is about who rather than how carefully: the owner proves
 * it is them. An account with a password types it; a Google-only account
 * confirms with Google first, unless it signed in within the last few
 * minutes (`isRecentSignIn`), and then has those minutes to delete.
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
export function DeleteAccountForm({
  hasPassword,
  recentSignIn,
}: {
  /** False for an account that signs in with Google only. */
  hasPassword: boolean
  /** Whether this session signed in recently enough to delete without a password. */
  recentSignIn: boolean
}) {
  const [armed, setArmed] = useState(false)
  const [state, formAction, pending] = useActionState(
    deleteAccount,
    initialDeleteAccountState
  )

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

  if (!hasPassword && (!recentSignIn || state.reauthRequired)) {
    return (
      <div className="mt-6 flex max-w-sm flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          This account signs in with Google, so confirm it’s you with Google
          first. You’ll come back to this page with {REAUTH_WINDOW_SECONDS / 60}{' '}
          minutes to delete the account.
        </p>
        <GoogleReauth next="/account#delete-account" />
        <div>
          <Button type="button" variant="ghost" onClick={() => setArmed(false)}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  const formProps = {
    state,
    formAction,
    pending,
    onCancel: () => setArmed(false),
  }
  return hasPassword ? (
    <PasswordDeleteForm {...formProps} />
  ) : (
    <GoogleDeleteForm {...formProps} />
  )
}

type ArmedFormProps = {
  state: DeleteAccountState
  formAction: (formData: FormData) => void
  pending: boolean
  onCancel: () => void
}

/** The word, the password, and the bot check the password check carries. */
function PasswordDeleteForm(props: ArmedFormProps) {
  const form = useAccountForm({
    schema: deleteAccountSchema,
    initialValues: { confirmation: '', currentPassword: '' },
    serverErrors: props.state.fieldErrors,
  })

  return (
    <DeleteFormShell {...props} form={form}>
      <ConfirmationField {...form.fieldProps('confirmation')} />
      <Field
        id="account-delete-password"
        label="Your password"
        type="password"
        autoComplete="current-password"
        {...form.fieldProps('currentPassword')}
      />
      <TurnstileField action="delete-account" resetKey={props.state} />
    </DeleteFormShell>
  )
}

/** The word only: the recent Google sign-in was checked on the way in. */
function GoogleDeleteForm(props: ArmedFormProps) {
  const form = useAccountForm({
    schema: deleteGoogleAccountSchema,
    initialValues: { confirmation: '' },
    serverErrors: props.state.fieldErrors,
  })

  return (
    <DeleteFormShell {...props} form={form}>
      <ConfirmationField {...form.fieldProps('confirmation')} />
    </DeleteFormShell>
  )
}

function DeleteFormShell({
  state,
  formAction,
  pending,
  onCancel,
  form,
  children,
}: ArmedFormProps & {
  form: { clearLocalErrors: () => void; reset: () => void; isValid: boolean }
  children: ReactNode
}) {
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

      {children}

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
            onCancel()
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

function ConfirmationField(
  props: Omit<ComponentProps<typeof Field>, 'id' | 'label'>
) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    // Revealing a form and leaving focus on a button that just vanished
    // strands anyone navigating by keyboard.
    inputRef.current?.focus()
  }, [])

  return (
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
          Exactly <strong className="font-medium">{DELETE_CONFIRMATION}</strong>
          , in capitals.
        </>
      }
      {...props}
    />
  )
}
