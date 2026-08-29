'use client'

import { Button } from '@/components/ui/button'

// Route-level error boundary (docs/architecture.md D4): plain language plus a
// retry, never the raw error or a stack trace — the server already logs the
// real failure. The retry is `unstable_retry()` per D4: `reset()` only
// re-renders WITHOUT re-fetching (see node_modules/next/dist/docs
// .../error.md), so a failed DB read would instantly re-throw.
// (An unknown slug never lands here — that is `notFound()`, not an error.)
export default function MaterialError({
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-gutter py-section md:px-gutter-lg">
      <div className="mx-auto flex w-full max-w-measure flex-col items-center py-12 text-center">
        <h1 className="text-xl">This material didn&apos;t load</h1>
        <p className="mt-2 text-balance text-muted-foreground">
          Something went wrong while fetching this entry. This is usually
          temporary — trying again often fixes it.
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
