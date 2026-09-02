import { Skeleton } from '@/components/ui/skeleton'

// Skeleton for the search results page (docs/architecture.md D4). It mirrors
// page.tsx block for block — h1, the search form row, the result-count line,
// then the divided list — so the swap to real results doesn't jump.
export default function SearchLoading() {
  return (
    <div className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      {/* h1 is text-3xl → 2.25rem line height */}
      <Skeleton className="h-9 w-40 max-w-full" />

      {/* The form row: field (h-9, flex-1) + submit button (h-9). */}
      <div className="mt-6 flex w-full max-w-measure items-center gap-2">
        <Skeleton className="h-9 min-w-0 flex-1" />
        <Skeleton className="h-9 w-24 shrink-0" />
      </div>

      <div className="mt-10">
        {/* The "N results for …" line. */}
        <Skeleton className="h-5 w-56 max-w-full" />
        <div className="mt-4 divide-y divide-border border-y border-border">
          {Array.from({ length: 6 }, (_, row) => (
            <div
              key={row}
              className="flex items-center justify-between gap-4 py-3"
            >
              <Skeleton className="h-5 w-64 max-w-full" />
              <Skeleton className="h-4 w-24 shrink-0 max-sm:hidden" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
