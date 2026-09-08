import { BookOpen } from 'lucide-react'

import { EmptyState } from '@/components/empty-state'
import type { Citation } from '@/lib/types'

import { sourceAnchorId } from './citations'
import { datePart, sourceTypeLabel } from './format'
import { PanelSection } from './section'

/**
 * Sources tab: the numbered list every superscript on the page points into.
 *
 * The numbering is not assigned here. `MaterialDetail.sources` arrives already
 * ordered by first reference (lib/db/materials.ts), and this list renders that
 * order — so entry N is the entry superscript N means, by construction rather
 * than by agreement.
 *
 * Each entry is focusable (`tabIndex={-1}`) so a citation jump can move focus
 * as well as scroll; a keyboard reader who follows "[3]" ends up *at* source 3
 * rather than looking at it from wherever they were.
 */
export function SourcesPanel({ sources }: { sources: Citation[] }) {
  return (
    <PanelSection title="Sources">
      {sources.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          headingLevel={3}
          title="No sources cited yet"
          description="Every fact-bearing row on a material page carries a source. This material has no cited rows, so there is nothing to list."
        />
      ) : (
        <ol className="space-y-4">
          {sources.map((source, index) => {
            const number = index + 1
            return (
              <li
                key={source.id}
                id={sourceAnchorId(number)}
                tabIndex={-1}
                className="grid scroll-mt-24 grid-cols-[2.5rem_minmax(0,1fr)] rounded-md outline-offset-4 target:bg-brand-subtle/60 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span
                  aria-hidden="true"
                  className="font-mono text-sm text-muted-foreground"
                >
                  [{number}]
                </span>
                <div className="min-w-0">
                  <p className="min-w-0 break-words">
                    <span className="sr-only">Source {number}. </span>
                    {source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-brand underline underline-offset-4 hover:no-underline"
                      >
                        {source.title}
                      </a>
                    ) : (
                      source.title
                    )}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {source.author ? `${source.author} · ` : null}
                    {sourceTypeLabel(source.type)}
                    {source.publishedAt
                      ? ` · published ${source.publishedAt}`
                      : null}
                    {` · accessed ${datePart(source.accessedAt)}`}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </PanelSection>
  )
}
