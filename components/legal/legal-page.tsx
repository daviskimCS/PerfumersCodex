import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * The shared shell for the two legal documents, `/privacy` and `/terms`.
 *
 * It exists so the pair cannot drift apart. The title block, the
 * last-updated line, the draft notice and the reading measure are declared
 * once here; a page supplies only its own words. Adding a third document
 * means importing this, not copying a layout.
 *
 * No new styles: the layout shell (`max-w-page` / `px-gutter` / `py-section`
 * around a `max-w-measure` column) is the one every text page in the app
 * uses, and the section rhythm mirrors `components/material/section.tsx`
 * rather than inventing a second heading treatment.
 *
 * No `loading.tsx` / `error.tsx` beside either page (docs/architecture.md
 * D4): both segments are static text — they fetch nothing and have no
 * failure mode, so those files would be scaffolding for states that cannot
 * occur. Same reasoning as `app/coming-soon/page.tsx`.
 */

/**
 * Both documents carry the same date, because they were drafted together.
 * Change it here when either one is revised, and say what changed in the
 * page's own "Changes" section.
 */
export const LEGAL_LAST_UPDATED = '5 September 2026'

/**
 * Link styling for prose. The same treatment as the footer's licence links
 * (`components/site-footer.tsx`) — underline in the muted brand hue, warming
 * on hover — so a link reads the same wherever it appears.
 */
export const LEGAL_LINK_CLASSNAME =
  'text-foreground underline decoration-brand-muted underline-offset-4 transition-colors hover:decoration-brand'

/**
 * The draft notice.
 *
 * ============================ REMOVING THIS ============================
 * Delete the `<DraftNotice />` line in `LegalPage` below. That is the whole
 * change — one line, deliberately, so that taking the notice down is an act
 * rather than an oversight. Do it only once Davis has read both documents
 * end to end and is content to publish them as his own words; until then
 * every reader should see that these are drafts.
 *
 * It is rendered by the shell rather than by each page so it cannot be left
 * on one document and forgotten on the other.
 * ======================================================================
 *
 * `role="note"` rather than `alert`: this is standing context on a static
 * page, not something that appeared in response to an action. An alert would
 * interrupt a screen-reader user mid-page for text that is simply part of
 * the document.
 */
function DraftNotice() {
  return (
    <div
      role="note"
      aria-labelledby="legal-draft-notice-heading"
      className="mt-6 rounded-lg border border-brand-muted bg-brand/5 px-4 py-3"
    >
      <p
        id="legal-draft-notice-heading"
        className="text-sm font-medium text-foreground"
      >
        Draft — not yet reviewed
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        This document was written from what the code actually does, but it is
        a draft awaiting Davis Kim’s review, and it is not legal advice. Treat
        it as an honest description of the site rather than a settled
        agreement.
      </p>
    </div>
  )
}

/**
 * A blank the maker has to fill in, marked so it is impossible to publish by
 * accident — visible in the rendered page, not only in the source.
 *
 * Used where guessing would be worse than an obvious gap: the contact
 * address, and the governing law on `/terms`.
 */
export function LegalPlaceholder({ children }: { children: ReactNode }) {
  return (
    <mark className="rounded-sm bg-brand/15 px-1.5 py-0.5 font-medium text-foreground">
      [ {children} ]
    </mark>
  )
}

/** One `h2` section of a document, with its heading tied to the region. */
export function LegalSection({
  id,
  heading,
  children,
}: {
  /** Slug for the heading id — also the anchor a link can point at. */
  id: string
  heading: string
  children: ReactNode
}) {
  const headingId = `${id}-heading`
  return (
    <section aria-labelledby={headingId} className="mt-10 first:mt-0">
      <h2
        id={headingId}
        className="border-b border-border pb-2 text-xl scroll-mt-24"
      >
        {heading}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

/** A bulleted list inside a section, with the house spacing. */
export function LegalList({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <ul className={cn('list-disc space-y-2 pl-5 marker:text-brand', className)}>
      {children}
    </ul>
  )
}

export function LegalPage({
  title,
  lead,
  children,
}: {
  title: string
  /** One or two sentences under the title, before the sections. */
  lead: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      <div className="mx-auto w-full max-w-measure">
        <h1 className="text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated {LEGAL_LAST_UPDATED}
        </p>

        <DraftNotice />

        <p className="mt-8 text-lg text-balance">{lead}</p>

        <div className="mt-10">{children}</div>
      </div>
    </div>
  )
}
