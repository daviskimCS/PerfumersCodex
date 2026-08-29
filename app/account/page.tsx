import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'

import { signOut } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/server'

/**
 * The signed-in account page (W3-A): shows who is logged in, offers
 * sign-out. Email change, password change, and account deletion are Week 13
 * — not here.
 *
 * Server component. The auth check is `supabase.auth.getUser()` — it
 * validates the token against the Supabase auth server rather than trusting
 * cookie contents the way `getSession()` would.
 */

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

  return (
    <div className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      <div className="mx-auto w-full max-w-measure">
        <h1 className="text-3xl">Account</h1>
        <p className="mt-2 text-muted-foreground">
          How you sign in to Perfumers Codex.
        </p>

        <Separator className="my-8" />

        <dl>
          <dt className="text-sm text-muted-foreground">Email</dt>
          <dd className="mt-1 text-base">{data.user.email}</dd>
        </dl>

        <form action={signOut} className="mt-8">
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </div>
    </div>
  )
}
