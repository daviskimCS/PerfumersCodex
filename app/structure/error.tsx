'use client'

import { Button } from '@/components/ui/button'

// Route-level error boundary (docs/architecture.md D4): plain language plus a
// retry, never the raw error or a stack trace — the server already logs the
// real failure. The retry is `retry()` per D4: `reset()` only
// re-renders WITHOUT re-fetching (see node_modules/next/dist/docs
// .../error.md), so a failed DB read would instantly re-throw.
//
// This boundary catches the *server* half only — fetching the candidates and
// the class list. Nothing the matcher does can land here: an unreadable
// pattern, an unparseable SMILES, and a WASM module that never loads are all
// handled inside `components/structure-search/`, calmly and in place.
export default function StructureError({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-gutter py-section md:px-gutter-lg">
      <div className="mx-auto flex w-full max-w-measure flex-col items-center py-12 text-center">
        <h1 className="text-xl">Structure search didn&apos;t load</h1>
        <p className="mt-2 text-balance text-muted-foreground">
          Something went wrong while fetching the materials to match against.
          This is usually temporary — trying again often fixes it.
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
