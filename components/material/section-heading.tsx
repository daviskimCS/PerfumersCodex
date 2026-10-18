'use client'

import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { Info } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * A panel heading row whose explanation sits behind an ⓘ button.
 *
 * The disclosure pattern (WAI-ARIA APG): a real `<button>` with
 * `aria-expanded` and `aria-controls`, so a screen reader announces "About
 * Structurally similar, collapsed" and reaches the text by pressing it, the
 * same way a sighted reader does. The button sits beside the `<h2>`, not
 * inside it, so the heading's accessible name stays the bare title in a
 * rotor's list of headings.
 *
 * The only client code in a panel heading; `PanelSection` renders this only
 * when the section has an explanation, so the rest stay server-only.
 */
export function SectionHeading({
  title,
  icon,
  aside,
  info,
  infoLabel,
}: {
  title: ReactNode
  icon?: ReactNode
  aside?: ReactNode
  info: ReactNode
  /** What the section is called, for the button's accessible name. */
  infoLabel: string
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border pb-2">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <h2 className="text-xl">{title}</h2>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
            className={cn(
              'inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none',
              open && 'bg-muted text-foreground'
            )}
          >
            <Info aria-hidden="true" strokeWidth={1.75} className="size-4" />
            <span className="sr-only">About {infoLabel}</span>
          </button>
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      <div
        id={panelId}
        hidden={!open}
        className="mt-3 max-w-measure rounded-md border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
      >
        {info}
      </div>
    </>
  )
}
