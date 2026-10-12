import { Skeleton } from '@/components/ui/skeleton'

/**
 * Skeleton for /reset-password (D4): the heading and the two password fields
 * the reader will most often see, so the form does not jump in.
 */
export default function ResetPasswordLoading() {
  return (
    <div className="flex flex-1 items-center justify-center px-gutter py-section md:px-gutter-lg">
      <div className="w-full max-w-sm">
        {/* h1, text-2xl */}
        <Skeleton className="h-8 w-64 max-w-full" />
        <div className="mt-8 flex flex-col gap-6">
          {[0, 1].map((key) => (
            <div key={key} className="flex flex-col gap-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          ))}
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}
