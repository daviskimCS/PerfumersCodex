import { Skeleton } from '@/components/ui/skeleton'

/**
 * The `/families` segment's loading boundary — the page frame only, for the
 * same reason `app/materials/loading.tsx` is (see the long note there).
 *
 * Without this file the nearest boundary above `/families/[slug]` is
 * `app/loading.tsx`, so a cold load of a family page briefly renders the
 * *homepage* skeleton before its own — W5-A measured exactly that in the
 * streamed HTML (root fallback at byte 10692, the family skeleton only at
 * 12867). This shields the subtree with something that claims no layout it
 * does not know.
 *
 * There is no `/families` index route today; this exists solely as that
 * shield. If an index is ever added, it supplies its own skeleton inside
 * `page.tsx` behind a `<Suspense>`, exactly as `/materials` does — not here.
 */
export default function FamiliesSegmentLoading() {
  return (
    <div className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      <Skeleton className="h-9 w-48 max-w-full" />
    </div>
  )
}
