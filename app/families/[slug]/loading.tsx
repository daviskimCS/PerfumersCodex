import {
  MaterialCardGrid,
  MaterialCardSkeleton,
} from '@/components/material-card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Skeleton for a family page (docs/architecture.md D4).
 *
 * Shaped block by block against `page.tsx` so the swap does not jump: the
 * breadcrumb, the "Olfactive family" label, the family name, the count line,
 * a first row of cards, and the family nav under its rule.
 *
 * Heights are line-heights off the type scale in globals.css — text-xs is
 * 1rem (h-4), text-sm 1.25rem (h-5), text-3xl 2.25rem (h-9), text-4xl 2.5rem
 * (h-10), Button size="lg" is h-9 — rather than eyeballed values.
 */
export default function FamilyLoading() {
  return (
    <div className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      {/* Breadcrumb (text-sm) */}
      <Skeleton className="h-5 w-24" />

      {/* "Olfactive family" label (text-xs) */}
      <Skeleton className="mt-6 h-4 w-32" />
      {/* Family name (text-3xl / md:text-4xl) */}
      <Skeleton className="mt-3 h-9 w-64 max-w-full md:h-10" />

      {/* The count line above the grid (text-sm) */}
      <div className="mt-12">
        <Skeleton className="h-5 w-28" />
        <MaterialCardGrid className="mt-4">
          {Array.from({ length: 6 }, (_, card) => (
            <li key={card}>
              <MaterialCardSkeleton />
            </li>
          ))}
        </MaterialCardGrid>
      </div>

      {/* "Browse another family" nav */}
      <div className="mt-16 border-t border-border pt-8">
        <Skeleton className="h-5 w-44 max-w-full" />
        <div className="mt-4 flex flex-wrap gap-1">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>
    </div>
  )
}
