'use client'

import { useEffect } from 'react'
import { CircleAlert } from 'lucide-react'

import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'

/**
 * Error boundary for /account (D4): plain language plus a retry, never a raw
 * error or stack trace. This catches real failures of the `getUser()` fetch
 * — "not signed in" never lands here, it redirects to /login instead.
 *
 * The retry is Next 16.2's `retry()` per D4, which re-fetches and
 * re-renders the segment. `reset()` only clears error state without
 * re-fetching, so it cannot recover from a failed server fetch.
 */
export default function AccountError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    // Server-side details stay server-side; this is the client-visible echo
    // for local debugging. No error text is rendered to the page.
    console.error('[account] failed to load:', error)
  }, [error])

  return (
    <div className="flex flex-1 items-center justify-center px-gutter py-section md:px-gutter-lg">
      <EmptyState
        headingLevel={1}
        icon={CircleAlert}
        title="Couldn’t load your account"
        description="Something went wrong while checking who’s signed in. It’s likely temporary — your account itself is fine."
        action={
          <Button variant="outline" size="lg" onClick={() => retry()}>
            Try again
          </Button>
        }
      />
    </div>
  )
}
