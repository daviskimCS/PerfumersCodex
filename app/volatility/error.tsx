'use client'

import { Button } from '@/components/ui/button'

// Route-level error boundary (docs/architecture.md D4): plain language plus a
// retry, never the raw error or a stack trace. `retry()`, not `reset()`,
// which re-renders without re-fetching and would re-throw at once.
export default function VolatilityError({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-gutter py-section md:px-gutter-lg">
      <div className="mx-auto flex w-full max-w-measure flex-col items-center py-12 text-center">
        <h1 className="text-xl">The volatility map didn&apos;t load</h1>
        <p className="mt-2 text-balance text-muted-foreground">
          Something went wrong while fetching the materials to plot. This is
          usually temporary — trying again often fixes it.
        </p>
        <div className="mt-6">
          <Button variant="outline" size="lg" onClick={() => retry()}>
            Try again
          </Button>
        </div>
      </div>
    </div>
  )
}
