import { SaveButtonSkeleton } from '@/components/save-button'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Skeleton for the material detail page (docs/architecture.md D4).
 *
 * Shaped block by block against `page.tsx` so the swap does not jump: the
 * breadcrumb, the hero's two columns (type label, title, CAS, family pills,
 * and the structure plate at the same `aspect-4/3` and the same widths at
 * every breakpoint), the Identity list, the tab bar at its mobile and desktop
 * heights, and one panel's worth of rows.
 *
 * Every height here is a line-height off the type scale in globals.css —
 * text-sm is 1.25rem (h-5), text-xl 1.75rem (h-7), text-3xl 2.25rem (h-9),
 * text-4xl 2.5rem (h-10) — rather than an eyeballed value.
 */
export default function MaterialLoading() {
  return (
    <div className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      {/* Breadcrumb (text-sm) */}
      <Skeleton className="h-5 w-24" />

      {/* Hero */}
      <div className="mt-6 flex flex-col gap-10 md:flex-row md:items-start md:justify-between md:gap-12">
        <div className="min-w-0 flex-1">
          {/* Material type label (text-xs) */}
          <Skeleton className="h-4 w-20" />
          {/* Canonical name (text-3xl / md:text-4xl) */}
          <Skeleton className="mt-3 h-9 w-80 max-w-full md:h-10" />
          {/* CAS number (text-sm) */}
          <Skeleton className="mt-4 h-5 w-40 max-w-full" />
          {/* Family badges (Badge is h-5, rounded-4xl) */}
          <div className="mt-6 flex flex-wrap gap-2">
            <Skeleton className="h-5 w-24 rounded-4xl" />
            <Skeleton className="h-5 w-20 rounded-4xl" />
          </div>
          {/* Save button (W5-B) — the same skeleton the page's own Suspense
              boundary falls back to, so the hero reserves this box whichever
              of the two is standing in. */}
          <div className="mt-8">
            <SaveButtonSkeleton />
          </div>
        </div>
        {/* Structure plate — same box the viewer reserves, so the hero does
            not reflow whether or not this material has a SMILES string. */}
        <Skeleton className="aspect-4/3 w-full rounded-xl sm:w-80 md:w-72 lg:w-80" />
      </div>

      {/* Identity block */}
      <div className="mt-12">
        <div className="border-b border-border pb-2">
          {/* Section heading (text-xl) */}
          <Skeleton className="h-7 w-32" />
        </div>
        <div className="mt-5 space-y-4">
          {Array.from({ length: 4 }, (_, row) => (
            <div
              key={row}
              className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[13rem_minmax(0,1fr)]"
            >
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-full max-w-md" />
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar — h-11 on mobile, h-8 from md, matching MaterialTabs */}
      <div className="mt-14">
        <Skeleton className="h-11 w-full rounded-lg md:h-8 md:w-72" />

        {/* One panel: a section heading plus a few rows */}
        <div className="mt-6">
          <div className="border-b border-border pb-2">
            <Skeleton className="h-7 w-48" />
          </div>
          <div className="mt-5 space-y-4">
            {Array.from({ length: 4 }, (_, row) => (
              <div key={row} className="space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-4/5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
