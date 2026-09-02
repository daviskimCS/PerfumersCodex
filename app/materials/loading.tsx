import { Skeleton } from '@/components/ui/skeleton'

/**
 * The `/materials` segment's loading boundary — deliberately just the page
 * frame, not the index's skeleton. That is the fix for a real bug.
 *
 * WHAT WENT WRONG (found by W4-C, fixed here in W5-A). Next's `loading.js`
 * "wraps not-found.js, page.js, and nested layout.js files in a Suspense
 * boundary" (node_modules/next/dist/docs/.../file-conventions/loading.md), so
 * a `loading.tsx` in *this* folder also covers `/materials/[slug]`. Measured
 * against the live production build, the streamed HTML for a material page
 * carries THIS boundary's fallback in the shell and only afterwards swaps in
 * `[slug]/loading.tsx` — React does not reach the deeper boundary before the
 * shell is flushed. So whatever this file renders is what a material page
 * shows first, and when it held the index's skeleton (a page heading plus
 * eight list rows) every material page briefly claimed to be the index.
 *
 * WHY NOT JUST DELETE IT. Then the nearest boundary becomes `app/loading.tsx`
 * and a material page flashes the *homepage* skeleton instead — verified the
 * same way. A route group (`(index)/`) relocates the problem for the same
 * reason. The boundary is unavoidable; only its contents are ours to choose.
 *
 * WHY NOT IMPORT `[slug]/loading.tsx` HERE. Tried, measured, reverted: a
 * cross-segment import in a `loading.tsx` delays this fallback enough that
 * React falls back to the ROOT boundary for the whole `/materials` subtree,
 * which is worse. This file must stay self-contained.
 *
 * THE FIX, in two halves that only work together:
 *
 * 1. this boundary renders only what every page under `/materials` has in
 *    common — the page container and a heading bar. It cannot claim a layout
 *    it does not know, so it claims none;
 * 2. the index's real skeleton (controls, card grid, pagination) moved
 *    *inside* `page.tsx`, behind its own `<Suspense>`, and the detail page
 *    already has `[slug]/loading.tsx`. Each route supplies its own; this
 *    supplies the frame.
 */
export default function MaterialsSegmentLoading() {
  return (
    <div className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      {/* A page heading — text-3xl on the index, and the detail page's own
          title sits a line lower. h-9 is the text-3xl line height. */}
      <Skeleton className="h-9 w-48 max-w-full" />
    </div>
  )
}
