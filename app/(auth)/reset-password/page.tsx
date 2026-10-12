import type { Metadata } from 'next'
import Link from 'next/link'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'

import { FormNotice } from '@/components/account/form-parts'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'
import { isRecoverySessionNow } from '@/lib/account/identity'
import { createClient } from '@/lib/supabase/server'
import { RESET_LINK_NEEDED_MESSAGE } from '@/lib/validation/password-reset'

/**
 * `/reset-password` — where a reset link lands, via `/auth/confirm`.
 *
 * The page checks up front what the action re-checks on submit: is this a
 * session a reset link just created? If not, it says so before the reader
 * types a password that would only be refused. The action's check is the one
 * that counts; this one is courtesy.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Choose a new password',
  robots: { index: false },
}

export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error && isAuthRetryableFetchError(error)) {
    throw new Error('Could not reach the authentication service', {
      cause: error,
    })
  }

  let recovering = false
  if (data.user) {
    const { data: claimsData } = await supabase.auth.getClaims()
    recovering = isRecoverySessionNow(
      claimsData?.claims.amr,
      data.user.recovery_sent_at
    )
  }

  return (
    <div className="flex flex-1 items-center justify-center px-gutter py-section md:px-gutter-lg">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl">Choose a new password</h1>
        {recovering ? (
          <ResetPasswordForm />
        ) : (
          <div className="mt-6 flex flex-col gap-4">
            <FormNotice tone="error">{RESET_LINK_NEEDED_MESSAGE}</FormNotice>
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-brand underline decoration-brand-muted underline-offset-4 hover:decoration-brand"
            >
              Send a new reset link
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
