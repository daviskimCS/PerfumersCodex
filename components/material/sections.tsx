import type { ReactNode } from 'react'

/**
 * The body of a material page: every section on one page, in reading order,
 * with an "On this page" list of links to them.
 *
 * It replaced four tabs (Safety, Olfactive, Usage, Sources) on 2026-10-14.
 * One page keeps everything visible and findable with the browser's own
 * search, prints whole, and lets a citation superscript be a plain link to
 * its entry under Sources, like a footnote.
 *
 * The order: the maker's olfactive description first (the part only he can
 * write), then safety (what someone at the bench checks), then usage, and the
 * reference list last.
 *
 * Server component, no client JavaScript: the list is ordinary in-page links.
 * On a phone it is a row pinned under the site header; from `md` it is a
 * column beside the sections that stays in view while they scroll.
 */

export const MATERIAL_SECTIONS = [
  { id: 'olfactive', label: 'Olfactive' },
  { id: 'safety', label: 'Safety' },
  { id: 'usage', label: 'Usage' },
  { id: 'sources', label: 'Sources' },
] as const

export type MaterialSectionId = (typeof MATERIAL_SECTIONS)[number]['id']

export function MaterialSections({
  sections,
}: {
  sections: Record<MaterialSectionId, ReactNode>
}) {
  return (
    <div className="md:grid md:grid-cols-[9rem_minmax(0,1fr)] md:gap-12">
      <nav
        aria-label="On this page"
        className="sticky top-14 z-10 -mx-gutter mb-10 border-b border-border bg-background px-gutter md:static md:mx-0 md:mb-0 md:border-0 md:bg-transparent md:px-0"
      >
        <div className="md:sticky md:top-24">
          <p className="hidden font-mono text-xs tracking-widest text-muted-foreground uppercase md:block">
            On this page
          </p>
          <ul className="flex gap-5 overflow-x-auto py-3 text-sm md:mt-3 md:flex-col md:gap-2 md:overflow-visible md:py-0">
            {MATERIAL_SECTIONS.map(({ id, label }) => (
              <li key={id} className="shrink-0">
                <a
                  href={`#${id}`}
                  className="rounded-sm text-muted-foreground underline-offset-4 outline-offset-2 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="flex min-w-0 flex-col gap-14">
        {MATERIAL_SECTIONS.map(({ id, label }) => (
          <section
            key={id}
            id={id}
            aria-labelledby={`${id}-label`}
            // A link landing here clears the sticky header and the pinned
            // list through the page's scroll-padding (globals.css).
            className="border-t border-border pt-8 first:border-t-0 first:pt-0"
          >
            {/* The section rises in as it scrolls into view (`reveal`,
                globals.css). It is this wrapper that moves, never the
                section, because a browser aims an in-page link at where the
                target is drawn: a section still 24px low when "Safety" is
                clicked would land 24px under the header. Sources only fades
                (`--reveal-rise: 0`), since each entry in it is itself a
                citation's target. */}
            <div
              className={
                id === 'sources' ? 'reveal [--reveal-rise:0px]' : 'reveal'
              }
            >
              <p
                id={`${id}-label`}
                className="font-mono text-xs tracking-widest text-muted-foreground uppercase"
              >
                {label}
              </p>
              <div className="mt-6 text-base">{sections[id]}</div>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
