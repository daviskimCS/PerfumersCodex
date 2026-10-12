import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

import { SectionHeading } from './section-heading'

/**
 * The two repeated shapes inside a material page's panels.
 *
 * Not a design system — just the two pieces that would otherwise be retyped in
 * every panel with slightly different spacing each time. Anything with real
 * behaviour belongs in `components/ui/*`.
 */

/** The icon beside a section title: decorative, so screen readers skip it. */
export function SectionIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <Icon
      aria-hidden="true"
      strokeWidth={1.5}
      className="size-5 shrink-0 text-muted-foreground"
    />
  )
}

/**
 * A titled block inside a tab panel.
 *
 * `info` is the section's explanation (what a value means, how it was
 * computed). It sits behind an ⓘ button rather than under the title, so the
 * page leads with the data and a reader who wants the method asks for it.
 * Caveats a reader must not miss (a regulatory disclaimer, the experimental
 * label on model output) do not go here: they stay in the body, visible.
 */
export function PanelSection({
  title,
  icon,
  aside,
  info,
  infoLabel,
  children,
  className,
}: {
  /** Usually a string; a node when the title itself carries a citation. */
  title: ReactNode
  icon?: LucideIcon
  /** Right-hand furniture for the heading row — a badge, a provenance note. */
  aside?: ReactNode
  /** The section's explanation, collapsed behind an ⓘ button. */
  info?: ReactNode
  /** The ⓘ button's name when `title` is not a plain string. */
  infoLabel?: string
  children: ReactNode
  className?: string
}) {
  const iconNode = icon ? <SectionIcon icon={icon} /> : null
  return (
    <section className={cn('mt-10 first:mt-0', className)}>
      {info ? (
        <SectionHeading
          title={title}
          icon={iconNode}
          aside={aside}
          info={info}
          infoLabel={
            infoLabel ?? (typeof title === 'string' ? title : 'this section')
          }
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border pb-2">
          <div className="flex min-w-0 items-center gap-2">
            {iconNode}
            <h2 className="text-xl">{title}</h2>
          </div>
          {aside ? <div className="shrink-0">{aside}</div> : null}
        </div>
      )}
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
