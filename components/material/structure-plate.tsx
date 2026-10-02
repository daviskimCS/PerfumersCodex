import type { ReactNode } from 'react'

/**
 * The frame the 2D structure sits in — one fixed box shared by the drawn and
 * unavailable states, at the same size `loading.tsx` reserves, so the hero
 * never reflows.
 *
 * Deliberately not `'use client'`: it follows whichever graph pulls it in.
 */
export function StructurePlate({ children }: { children: ReactNode }) {
  return (
    <div className="flex aspect-4/3 w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-surface p-3 sm:w-80 md:w-72 lg:w-80">
      {children}
    </div>
  )
}
