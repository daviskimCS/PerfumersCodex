'use client'

import { Button } from '@/components/ui/button'

/**
 * The app-wide error boundary (docs/architecture.md D4).
 *
 * It backs the homepage, which now fetches, and — sitting at the app root —
 * anything below that ships no `error.tsx` of its own. Every segment written
 * so far ships one, so this is a floor rather than the usual case, which is
 * why the copy names nothing in particular (wave-5.md, W5-A's root-segment
 * caveat).
 *
 */

// Plain language plus a retry, never the raw error or a stack trace — the
// server already logs the real failure. The retry is `unstable_retry()` per
// D4: `reset()` only re-renders WITHOUT re-fetching (see
// node_modules/next/dist/docs/.../file-conventions/error.md), so a failed DB
// read would instantly re-throw.
export default function AppError({
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-gutter py-section md:px-gutter-lg">
      <div className="mx-auto flex w-full max-w-measure flex-col items-center py-12 text-center">
        <h1 className="text-xl">This page didn&apos;t load</h1>
        <p className="mt-2 text-balance text-muted-foreground">
          Something went wrong on our side. This is usually temporary — trying
          again often fixes it.
        </p>
        <div className="mt-6">
          <Button variant="outline" size="lg" onClick={() => unstable_retry()}>
            Try again
          </Button>
        </div>
      </div>
    </div>
  )
}
