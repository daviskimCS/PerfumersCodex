import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * Skeleton for /account (D4): mirrors the final layout — title, one-line
 * description, then the four sections (email, password, sign out, delete) with
 * their separators — so nothing jumps when `getUser()` resolves. Widths
 * approximate the real content; heights match the type scale's line heights
 * and the controls.
 *
 * Only what the page renders *unconditionally* is drawn. The pending-email
 * notice, every inline error and every success notice are conditional, so
 * sketching them here would make the skeleton predict a page that usually does
 * not appear.
 */

/** Label (text-sm, 1.25rem) + input (h-8) + hint (text-sm), gap-2. */
function FieldSkeleton({ labelWidth }: { labelWidth: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className={cn('h-5', labelWidth)} />
      <Skeleton className="h-8 w-full rounded-lg" />
    </div>
  )
}

export default function AccountLoading() {
  return (
    <div className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      <div className="mx-auto w-full max-w-measure">
        {/* h1, text-3xl: 2.25rem line height */}
        <Skeleton className="h-9 w-44" />
        {/* description, text-base: 1.75rem line height */}
        <Skeleton className="mt-2 h-7 w-72 max-w-full" />

        <Separator className="my-8" />

        {/* ── Email ─────────────────────────────────────────────────────── */}
        {/* h2, text-xl: 1.75rem line height */}
        <Skeleton className="h-7 w-20" />
        {/* "Current email address" label, text-sm */}
        <Skeleton className="mt-4 h-5 w-40" />
        {/* the address itself, text-base */}
        <Skeleton className="mt-1 h-7 w-56 max-w-full" />
        <div className="mt-6 flex flex-col gap-6">
          <FieldSkeleton labelWidth="w-36" />
          {/* submit button, default h-8 */}
          <Skeleton className="h-8 w-48 rounded-lg" />
        </div>

        <Separator className="my-10" />

        {/* ── Password ──────────────────────────────────────────────────── */}
        <Skeleton className="h-7 w-28" />
        <Skeleton className="mt-2 h-5 w-64 max-w-full" />
        <div className="mt-6 flex flex-col gap-6">
          <FieldSkeleton labelWidth="w-32" />
          <FieldSkeleton labelWidth="w-28" />
          <FieldSkeleton labelWidth="w-40" />
          <Skeleton className="h-8 w-36 rounded-lg" />
        </div>

        <Separator className="my-10" />

        {/* ── Sign out ──────────────────────────────────────────────────── */}
        <Skeleton className="h-7 w-24" />
        <Skeleton className="mt-2 h-5 w-full max-w-80" />
        <Skeleton className="mt-6 h-8 w-24 rounded-lg" />

        <Separator className="my-10" />

        {/* ── Delete account (the bordered danger block) ─────────────────── */}
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 md:p-6">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="mt-2 h-5 w-full" />
          <Skeleton className="mt-1 h-5 w-3/4" />
          <Skeleton className="mt-6 h-8 w-36 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
