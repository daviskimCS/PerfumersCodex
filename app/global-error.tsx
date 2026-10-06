'use client'

import './globals.css'

import { Button } from '@/components/ui/button'

/**
 * The last-resort boundary: it catches errors in the root layout itself,
 * which `app/error.tsx` cannot (it renders inside that layout).
 *
 * It replaces the whole document, so it brings its own <html>, <body> and
 * stylesheet, and none of the layout's font, theme script or chrome. The
 * copy and the retry match `app/error.tsx` (docs/architecture.md D4).
 * `metadata` is not supported in a client boundary, hence the bare <title>.
 */
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center bg-background px-gutter text-foreground">
        <title>Perfumers Codex</title>
        <main className="mx-auto flex w-full max-w-measure flex-col items-center text-center">
          <h1 className="text-xl">This page didn&apos;t load</h1>
          <p className="mt-2 text-balance text-muted-foreground">
            Something went wrong on our side. This is usually temporary — trying
            again often fixes it.
          </p>
          <div className="mt-6">
            <Button variant="outline" size="lg" onClick={() => retry()}>
              Try again
            </Button>
          </div>
        </main>
      </body>
    </html>
  )
}
