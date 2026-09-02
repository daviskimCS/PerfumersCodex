import { Skeleton } from '@/components/ui/skeleton'

/**
 * Skeleton for the homepage (docs/architecture.md D4).
 *
 * Sitting at the app root, this boundary also backs any route below that
 * ships no `loading.tsx` of its own — accepted deliberately in wave-5.md
 * (W5-A's root-segment caveat). Measured against the live production build,
 * it does more than that: Next does not always reach a *dynamic* segment's
 * own boundary before flushing the shell, so `/families/[slug]` shows this
 * fallback for one frame before its own. (Same mechanism as the one
 * documented at length in `app/materials/loading.tsx`; the shield there is a
 * `loading.tsx` at the intermediate segment, which `/families` has no room
 * for in this item's file list. Reported to the orchestrator.)
 *
 * That is why this stops at the homepage's opening block — title, lead,
 * count line, actions — rather than mirroring the two sections below it.
 * A title-and-text-and-actions shape is what the homepage genuinely looks
 * like above the fold AND the only shape this can honestly promise for a
 * route it is merely standing in for. Adding the lower sections would buy the
 * homepage very little and make every stand-in appearance a lie.
 *
 * Heights are line-heights off the type scale in globals.css — text-sm is
 * 1.25rem (h-5), text-lg 2rem (h-8), text-4xl 2.5rem (h-10), text-5xl 3.25rem
 * (h-13), Button size="lg" is h-9 — rather than eyeballed values.
 */
export default function AppLoading() {
  return (
    <div className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      <div className="max-w-measure">
        {/* h1 (text-4xl / md:text-5xl) */}
        <Skeleton className="h-10 w-72 max-w-full md:h-13" />

        {/* Lead paragraph (text-lg → 2rem line height), four lines */}
        <div className="mt-6 space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-11/12" />
          <Skeleton className="h-8 w-2/3" />
        </div>

        {/* The count line (text-sm) */}
        <Skeleton className="mt-6 h-5 w-56 max-w-full" />

        {/* Search + browse buttons (h-9) */}
        <div className="mt-8 flex flex-wrap gap-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-44" />
        </div>
      </div>
    </div>
  )
}
