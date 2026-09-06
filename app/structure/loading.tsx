import { Skeleton } from '@/components/ui/skeleton'

/**
 * The `/structure` segment's loading boundary (docs/architecture.md D4).
 *
 * Unlike `app/materials/loading.tsx` this segment has no children, so the
 * skeleton can safely claim the page's real layout: heading, the two-sentence
 * explanation, the pattern box, the preset row, the corpus note.
 *
 * What it deliberately does NOT claim is a grid of result cards. The server
 * renders no results on this page — matching happens in the browser after
 * WASM arrives — so a card grid here would promise something the swap could
 * not deliver. The results region's own busy state (a three-card skeleton,
 * shown only when a pattern is actually being matched) lives in
 * `structure-search.tsx`, where it knows whether results are coming.
 *
 * Heights are line-heights off the type scale in globals.css: text-3xl is h-9,
 * body text h-5, Label h-4, Input and Button size="lg" both h-9.
 */
export default function StructureLoading() {
  return (
    <div className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      <Skeleton className="h-9 w-64 max-w-full" />

      {/* The explanation — three lines at the reading measure. */}
      <div className="mt-3 max-w-measure">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="mt-1.5 h-5 w-full" />
        <Skeleton className="mt-1.5 h-5 w-3/4" />
      </div>

      {/* The pattern box: label, then field plus submit. */}
      <div className="mt-8 max-w-measure">
        <Skeleton className="h-4 w-32" />
        <div className="mt-2 flex items-center gap-2">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-20" />
        </div>
        {/* The hint under the box (two lines) and the reserved message row. */}
        <Skeleton className="mt-2 h-5 w-full" />
        <Skeleton className="mt-1.5 h-5 w-2/3" />
      </div>

      {/* Presets: the uppercase label, a row of class buttons, the corpus
          note beneath them. */}
      <div className="mt-8">
        <Skeleton className="h-4 w-16" />
        <div className="mt-3 flex flex-wrap items-center gap-1">
          {Array.from({ length: 4 }, (_, preset) => (
            <Skeleton key={preset} className="h-9 w-28" />
          ))}
        </div>
        <Skeleton className="mt-3 h-5 w-72 max-w-full" />
      </div>

      {/* The results region's status line, and nothing below it. */}
      <Skeleton className="mt-8 h-5 w-48 max-w-full" />
    </div>
  )
}
