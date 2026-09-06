import Link from 'next/link'

import { Button } from '@/components/ui/button'
import type { ChemicalClass } from '@/lib/types'

/**
 * The curated classes, offered as a way into the pattern box — and, when there
 * is no pattern box, as the feature itself.
 *
 * This is the component that carries the page's degradation story, so the two
 * modes are the point rather than a detail:
 *
 * - `mode="class"` — every preset links to `/materials?class=<slug>`, the
 *   server-side filter over the *precomputed* membership rows. This is what
 *   the server renders, what a reader with scripting off gets, and what stays
 *   on the page if RDKit never loads. It needs no WASM and no JavaScript.
 * - `mode="smarts"` — the same presets link to `/structure?smarts=<pattern>`,
 *   loading that class's own SMARTS into the box so it can be read and edited.
 *
 * The two agree by construction: the SMARTS a preset offers is the same string
 * that produced the class's precomputed rows, so a reader who lands on either
 * side of the fallback sees the same materials.
 *
 * Deliberately not `'use client'` — it has no state and no handlers, so it
 * simply follows whichever graph imports it, the way
 * `components/material/structure-plate.tsx` does.
 */
export function PresetList({
  classes,
  mode,
  activePattern,
}: {
  classes: readonly ChemicalClass[]
  mode: 'class' | 'smarts'
  /** The trimmed pattern currently in the URL, for the active state. */
  activePattern: string
}) {
  if (classes.length === 0) return null

  return (
    <ul className="mt-3 flex flex-wrap items-center gap-1">
      {classes.map((chemicalClass) => {
        // Active only in `smarts` mode: in `class` mode these links leave the
        // page entirely, so none of them is ever "the current view".
        const active =
          mode === 'smarts' && chemicalClass.smarts === activePattern

        return (
          <li key={chemicalClass.slug}>
            <Button asChild variant={active ? 'secondary' : 'ghost'} size="lg">
              {/* Same control as the browse page's class row, on purpose: the
                  two filter by the same thing and should not look like two
                  different ideas. */}
              <Link
                href={
                  mode === 'smarts'
                    ? `/structure?smarts=${encodeURIComponent(chemicalClass.smarts)}`
                    : `/materials?class=${encodeURIComponent(chemicalClass.slug)}`
                }
                aria-current={active ? 'true' : undefined}
                // No `title`: a tooltip is unreachable by keyboard and touch,
                // and an accessibility tree read back from the running page
                // showed the class description standing in for the link's own
                // name ("A carbonyl carbon joined to…" instead of "Ester").
                // The browse page's class row carries no descriptions either.
              >
                {chemicalClass.name}
                <span
                  aria-hidden="true"
                  className="text-muted-foreground tabular-nums"
                >
                  {chemicalClass.materialCount}
                </span>
              </Link>
            </Button>
          </li>
        )
      })}
    </ul>
  )
}
