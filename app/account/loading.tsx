import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Skeleton for /account (D4): mirrors the final layout — title, one-line
 * description, hairline, the email definition pair, the sign-out button — so
 * nothing jumps when `getUser()` resolves. Widths approximate the real
 * content; heights match the type scale's line heights and the button.
 */
export default function AccountLoading() {
  return (
    <div className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      <div className="mx-auto w-full max-w-measure">
        {/* h1, text-3xl: 2.25rem line height */}
        <Skeleton className="h-9 w-44" />
        {/* description, text-base: 1.75rem line height */}
        <Skeleton className="mt-2 h-7 w-72 max-w-full" />

        <Separator className="my-8" />

        {/* "Email" label, text-sm: 1.25rem line height */}
        <Skeleton className="h-5 w-12" />
        {/* the email address itself */}
        <Skeleton className="mt-1 h-7 w-56 max-w-full" />

        {/* sign-out button, default h-8 */}
        <Skeleton className="mt-8 h-8 w-24" />
      </div>
    </div>
  )
}
