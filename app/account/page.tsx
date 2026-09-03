import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'

import { signOut } from '@/app/(auth)/actions'
import { ChangeEmailForm } from '@/components/account/change-email-form'
import { ChangePasswordForm } from '@/components/account/change-password-form'
import { DeleteAccountForm } from '@/components/account/delete-account-form'
import { FormNotice } from '@/components/account/form-parts'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/server'

/**
 * The signed-in account page (W3-A, extended by W6-B / P3-C).
 *
 * Server component. The auth check is `supabase.auth.getUser()` — it validates
 * the token against the Supabase auth server rather than trusting cookie
 * contents the way `getSession()` would.
 *
 * Four sections: the address on the account and how to move it, the password,
 * signing out of this browser, and deleting the account outright. The three
 * forms are client components because the per-form checklist needs interaction;
 * each one's server action re-parses with the same schema (D6), so nothing
 * rendered here is load-bearing for safety.
 */

// `getUser()` reads cookies, so this route is dynamic in practice already;
// declaring it keeps that a decision rather than an accident, and matches every
// other data-fetching route in the app. The deliberate caching pass is a later
// item — and a per-reader page would need care there in any case.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Account',
  // A personal page; nothing here belongs in a search index.
  robots: { index: false },
}

export default async function AccountPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  // Two very different failures (D4): the auth server being unreachable is a
  // genuine error — throw to error.tsx rather than bouncing a signed-in
  // user to /login over a network blip. Anything else (no session, expired
  // session) simply means "not signed in".
  if (error && isAuthRetryableFetchError(error)) {
    throw new Error('Could not reach the authentication service', {
      cause: error,
    })
  }
  if (!data.user) {
    redirect('/login')
  }

  const currentEmail = data.user.email ?? ''
  /**
   * An email change that has been requested but not yet confirmed.
   *
   * Supabase sets `new_email` when `updateUser({ email })` succeeds and clears
   * it once the confirmation links have been followed, so this is the account's
   * own account of what is outstanding — not a flag this app maintains, and not
   * something a page reload can get wrong.
   */
  const pendingEmail = data.user.new_email

  return (
    <div className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      <div className="mx-auto w-full max-w-measure">
        <h1 className="text-3xl">Account</h1>
        <p className="mt-2 text-muted-foreground">
          How you sign in to Perfumers Codex.
        </p>

        <Separator className="my-8" />

        <section aria-labelledby="account-email-heading">
          <h2 id="account-email-heading" className="text-xl">
            Email
          </h2>

          <dl className="mt-4">
            <dt className="text-sm text-muted-foreground">
              Current email address
            </dt>
            <dd className="mt-1 text-base break-words">{currentEmail}</dd>
          </dl>

          {pendingEmail ? (
            // The pending state is the honest state: the address above is
            // still the account's until the confirmation links are followed.
            <FormNotice tone="info" className="mt-4">
              A change to{' '}
              <strong className="font-medium text-foreground break-words">
                {pendingEmail}
              </strong>{' '}
              is waiting for confirmation. It takes effect only once the emailed
              link is opened — until then you sign in with the address above.
              Requesting a different address below replaces this one.
            </FormNotice>
          ) : null}

          <ChangeEmailForm currentEmail={currentEmail} />
        </section>

        <Separator className="my-10" />

        <section aria-labelledby="account-password-heading">
          <h2 id="account-password-heading" className="text-xl">
            Password
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You&apos;ll need your current password to set a new one.
          </p>

          <ChangePasswordForm />
        </section>

        <Separator className="my-10" />

        <section aria-labelledby="account-session-heading">
          <h2 id="account-session-heading" className="text-xl">
            Sign out
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Ends this session in this browser. Your account and everything in it
            stay exactly as they are.
          </p>

          <form action={signOut} className="mt-6">
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </section>

        <Separator className="my-10" />

        <section
          aria-labelledby="account-delete-heading"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 md:p-6"
        >
          <h2 id="account-delete-heading" className="text-xl text-destructive">
            Delete account
          </h2>
          {/* Plain and true: exactly what goes, and that it is final. The two
              user-owned tables both cascade off the account row, so this list
              is the whole of it — there is nothing left behind and nothing to
              restore from. */}
          <p className="mt-2 text-sm text-muted-foreground">
            This deletes your sign-in, your saved materials and your private
            notes, immediately and for good. There is no undo and no way for us
            to recover any of it afterwards.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            The codex itself is unaffected — it stays public and free to read
            without an account.
          </p>

          <DeleteAccountForm />
        </section>
      </div>
    </div>
  )
}
