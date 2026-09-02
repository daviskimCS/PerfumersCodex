import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * The two repeated shapes inside a material page's panels.
 *
 * Not a design system — just the two pieces that would otherwise be retyped in
 * every panel with slightly different spacing each time. Anything with real
 * behaviour belongs in `components/ui/*`.
 */

/** A titled block inside a tab panel, with an optional line under the title. */
export function PanelSection({
  title,
  aside,
  children,
  className,
}: {
  title: string
  /** Right-hand furniture for the heading row — a badge, a provenance note. */
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('mt-10 first:mt-0', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-b border-border pb-2">
        <h2 className="text-xl">{title}</h2>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

/**
 * One term/value pair. Renders nothing when the value is absent, so a caller
 * can list every field it might have without guarding each one — an empty
 * `<dl>` is the section's business, not the field's.
 */
export function Field({
  term,
  value,
  mono = false,
}: {
  term: string
  value: ReactNode
  /** For values that are inherently monospaced data: CAS, SMILES, formulae. */
  mono?: boolean
}) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-1 py-2 sm:grid-cols-[13rem_minmax(0,1fr)]">
      <dt className="text-sm text-muted-foreground">{term}</dt>
      <dd className={cn('min-w-0 break-words', mono && 'font-mono text-sm')}>
        {value}
      </dd>
    </div>
  )
}

/** A `<dl>` with the divider rhythm the fields above expect. */
export function FieldList({ children }: { children: ReactNode }) {
  return <dl className="divide-y divide-border/60">{children}</dl>
}
