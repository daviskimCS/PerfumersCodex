'use client'

import { useEffect } from 'react'
import { CircleAlert } from 'lucide-react'

import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'

/**
 * Error boundary for /saved (docs/architecture.md D4): plain language plus a
 * retry, never a raw error or a stack trace. What lands here is a genuine
 * failure — the auth service unreachable, or the shelf query failing.
 * "Not signed in" never reaches this; it redirects to /login. An empty shelf
 * never reaches it either; that is an EmptyState on the page.
 *
 * The retry is Next 16's `retry()` per D4, which re-fetches and
 * re-renders the segment. `reset()` only clears the error state without
 * re-fetching, so it cannot recover from a failed server read.
 */
export default function SavedError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    // Server-side details stay server-side; this is the client-visible echo
    // for local debugging. No error text is rendered to the page.
    console.error('[saved] failed to load:', error)
  }, [error])

  return (
    <div className="flex flex-1 items-center justify-center px-gutter py-section md:px-gutter-lg">
      <EmptyState
        headingLevel={1}
        icon={CircleAlert}
        title="Couldn’t load your saved materials"
        description="Something went wrong while fetching your list. It’s likely temporary — nothing you saved has been lost."
        action={
          <Button variant="outline" size="lg" onClick={() => retry()}>
            Try again
          </Button>
        }
      />
    </div>
  )
}
