import { Skeleton } from '@/components/ui/skeleton'

// Skeleton for the material detail page (docs/architecture.md D4): a title
// bar, a meta line, and a few section blocks, mirroring page.tsx's rhythm
// (h1, then mt-10 sections) so the swap doesn't jump.
export default function MaterialLoading() {
  return (
    <div className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      {/* h1 is text-3xl → 2.25rem line height */}
      <Skeleton className="h-9 w-72 max-w-full" />
      <Skeleton className="mt-3 h-5 w-40 max-w-full" />
      {Array.from({ length: 3 }, (_, section) => (
        <div key={section} className="mt-10">
          {/* h2 is text-2xl → 2rem line height */}
          <Skeleton className="h-8 w-48 max-w-full" />
          <div className="mt-4 space-y-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-5/6" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
