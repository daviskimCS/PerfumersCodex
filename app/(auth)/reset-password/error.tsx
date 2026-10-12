'use client'

import { useEffect } from 'react'
import { CircleAlert } from 'lucide-react'

import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'

/**
 * Error boundary for /reset-password (D4). Reached only when the auth service
 * could not be asked who is signed in; an expired or missing reset session is
 * not an error and renders its own notice on the page.
 */
export default function ResetPasswordError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error('[reset-password] failed to load:', error)
  }, [error])

  return (
    <div className="flex flex-1 items-center justify-center px-gutter py-section md:px-gutter-lg">
      <EmptyState
        headingLevel={1}
        icon={CircleAlert}
        title="Couldn’t open the reset page"
        description="Something went wrong while checking your reset link. It’s likely temporary — your account and password are unchanged."
        action={
          <Button variant="outline" size="lg" onClick={() => unstable_retry()}>
            Try again
          </Button>
        }
      />
    </div>
  )
}
