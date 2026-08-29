import { Skeleton } from '@/components/ui/skeleton'

// Skeleton for the materials index (docs/architecture.md D4): one heading bar
// and a column of list-row bars, mirroring page.tsx so the swap doesn't jump.
export default function MaterialsLoading() {
  return (
    <div className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      {/* h1 is text-3xl → 2.25rem line height */}
      <Skeleton className="h-9 w-44 max-w-full" />
      <div className="mt-8 space-y-4">
        {Array.from({ length: 8 }, (_, row) => (
          <Skeleton key={row} className="h-5 w-64 max-w-full" />
        ))}
      </div>
    </div>
  )
}
