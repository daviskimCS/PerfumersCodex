import type { ReactNode } from 'react'

import { Skeleton } from '@/components/ui/skeleton'

/**
 * The frame the 2D structure sits in — one fixed box shared by the loading,
 * drawn, and unavailable states so the hero never reflows as WASM arrives.
 *
 * Deliberately not `'use client'`: it is imported by the async structure chunk
 * and by nothing else, so it simply follows whichever graph pulls it in.
 */
export function StructurePlate({
  children,
  busy = false,
}: {
  children?: ReactNode
  busy?: boolean
}) {
  return (
    <div
      aria-busy={busy || undefined}
      className="flex aspect-4/3 w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-surface p-3 sm:w-80 md:w-72 lg:w-80"
    >
      {busy ? <Skeleton className="size-full rounded-lg" /> : children}
    </div>
  )
}
