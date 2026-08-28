import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * The one empty state for the whole app (docs/architecture.md D4).
 *
 * Domain empty states — "no results", "nothing recorded yet", "nothing saved" —
 * are *content passed to this component*, never new bespoke components. If a
 * page needs something this cannot express, widen this component rather than
 * adding a second one.
 *
 * Example:
 *
 *   <EmptyState
 *     icon={Inbox}
 *     title="Nothing here yet"
 *     description="Items show up here once there are some to show."
 *     action={
 *       <Button asChild variant="outline">
 *         <Link href="/">Somewhere useful</Link>
 *       </Button>
 *     }
 *   />
 *
 * Notes for callers:
 * - This is a *block of content*, not a page layout. It centres its own text
 *   and caps it at the reading measure; whether it fills the viewport or sits
 *   inside a section is the caller's business, not this component's.
 * - Server component. Anything interactive goes in `action`, which is a slot —
 *   a client component passed there stays a client component.
 * - An empty state that appears *after* an interaction (search results going
 *   from some to none) needs announcing, but the live region belongs on the
 *   container that swaps, not here — otherwise a static 404 announces itself.
 */

const HEADING_TAGS = { 1: 'h1', 2: 'h2', 3: 'h3' } as const

export interface EmptyStateProps {
  /** One short line. Rendered as a real heading, so: plain text, no markup. */
  title: string
  /**
   * What is empty, and what that means. Required on purpose — a bare title
   * ("No results") tells the reader nothing they did not already know.
   * Phrasing content only; it renders inside a <p>.
   */
  description: ReactNode
  /**
   * The way onward — usually one `<Button asChild><Link …>`. Optional: some
   * empty states are a plain statement of fact with nowhere to go.
   */
  action?: ReactNode
  /** Decorative mark above the title. Hidden from assistive tech. */
  icon?: LucideIcon
  /**
   * Heading level, so the page keeps a sane outline. Defaults to 2 — an empty
   * state normally sits beneath a page title. Pass 1 when the empty state *is*
   * the page, as on the 404.
   */
  headingLevel?: 1 | 2 | 3
  /** Escape hatch for placement only (width, spacing). Not for restyling. */
  className?: string
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon,
  headingLevel = 2,
  className,
}: EmptyStateProps) {
  const Heading = HEADING_TAGS[headingLevel]

  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-measure flex-col items-center py-12 text-center',
        className
      )}
    >
      {Icon ? (
        <Icon
          aria-hidden="true"
          strokeWidth={1.5}
          className="mb-4 size-6 text-muted-foreground"
        />
      ) : null}
      <Heading className="text-xl">{title}</Heading>
      {/* Balanced, not pretty: empty-state copy is one or two lines, and
          balancing stops the last line from stranding a single word. */}
      <p className="mt-2 text-balance text-muted-foreground">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}
