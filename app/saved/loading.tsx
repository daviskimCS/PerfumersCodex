import {
  MaterialCardGrid,
  MaterialCardSkeleton,
} from '@/components/material-card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Skeleton for /saved (docs/architecture.md D4).
 *
 * Shaped against the populated page block for block — title, the one-line
 * description, the count heading, the first row of cards — so the swap does
 * not jump. The empty shelf renders an EmptyState instead; a skeleton stands
 * in for the list, which is what the page is for.
 *
 * Heights are line-heights off the type scale in globals.css — text-sm is
 * 1.25rem (h-5), text-base 1.75rem (h-7), text-3xl 2.25rem (h-9) — rather
 * than eyeballed values.
 */
export default function SavedLoading() {
  return (
    <div className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      {/* h1 (text-3xl) */}
      <Skeleton className="h-9 w-32" />
      {/* Description (text-base) */}
      <Skeleton className="mt-3 h-7 w-96 max-w-full" />

      <div className="mt-12">
        {/* The count heading above the grid (text-sm) */}
        <Skeleton className="h-5 w-28" />
        <MaterialCardGrid className="mt-4">
          {Array.from({ length: 6 }, (_, card) => (
            <li key={card}>
              <MaterialCardSkeleton />
            </li>
          ))}
        </MaterialCardGrid>
      </div>
    </div>
  )
}
