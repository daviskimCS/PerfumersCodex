import { Skeleton } from '@/components/ui/skeleton'

/**
 * The `/volatility` loading boundary (docs/architecture.md D4). The segment
 * has no children, so the skeleton claims the page's real layout: heading,
 * the two paragraphs, the chart's frame, the table heading and a few rows.
 * Heights follow the type scale in globals.css (text-3xl is h-9, body h-5).
 */
export default function VolatilityLoading() {
  return (
    <div className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      <Skeleton className="h-9 w-56 max-w-full" />
      <div className="mt-3 max-w-measure">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="mt-1.5 h-5 w-full" />
        <Skeleton className="mt-1.5 h-5 w-2/3" />
      </div>
      <div className="mt-3 max-w-measure">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mt-1.5 h-4 w-5/6" />
      </div>

      {/* The chart: the wide layout's 760 × 460 frame, the narrow one's
          340 × 400 on a phone. */}
      <Skeleton className="mt-10 hidden aspect-[760/460] w-full max-w-[760px] sm:block" />
      <Skeleton className="mt-10 aspect-[340/400] w-full max-w-[340px] sm:hidden" />
      <Skeleton className="mt-4 h-4 w-72 max-w-full" />

      <Skeleton className="mt-12 h-7 w-56 max-w-full" />
      <div className="mt-4 max-w-2xl">
        {Array.from({ length: 5 }, (_, row) => (
          <Skeleton key={row} className="mt-2 h-8 w-full" />
        ))}
      </div>
    </div>
  )
}
