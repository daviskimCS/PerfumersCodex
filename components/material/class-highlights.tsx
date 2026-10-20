'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { isHighlighted } from '@/lib/structure/highlight'
import type { ChemicalClassMatch, ChemicalClassRef } from '@/lib/types'

/**
 * The structure plate with the material's chemical classes under it. A class
 * whose matched atoms are known is a toggle: pressing it tints the bonds and
 * atom labels that earned the class and dims the rest, so the word and the
 * shape connect. One class at a time; pressing it again clears the tint.
 *
 * The drawing arrives as `children`, already rendered on the server, so it
 * is in the HTML with scripting off. This component only sets
 * `data-highlighted` on the inlined paths (`lib/structure/highlight.ts`
 * decides which) and `data-highlighting` on the wrapper; CSS does the
 * tinting (CLASS HIGHLIGHTS in globals.css). The stored markup is never
 * rewritten.
 */
export function ClassHighlights({
  classes,
  matches,
  children,
}: {
  classes: ChemicalClassRef[]
  /** Only matches drawn by the drawing's own RDKit (`drawableMatches`). */
  matches: ChemicalClassMatch[]
  children: ReactNode
}) {
  const [active, setActive] = useState<string | null>(null)
  const drawing = useRef<HTMLDivElement>(null)
  const atomsBySlug = useMemo(
    () => new Map(matches.map((match) => [match.slug, new Set(match.atoms)])),
    [matches]
  )

  useEffect(() => {
    const root = drawing.current
    if (root === null) return
    const atoms = active === null ? undefined : atomsBySlug.get(active)
    for (const element of root.querySelectorAll('svg [class]')) {
      element.toggleAttribute(
        'data-highlighted',
        atoms !== undefined &&
          isHighlighted(element.getAttribute('class') ?? '', atoms)
      )
    }
  }, [active, atomsBySlug])

  return (
    <div>
      <div
        ref={drawing}
        className="class-highlights"
        data-highlighting={active === null ? undefined : ''}
      >
        {children}
      </div>

      {classes.length > 0 ? (
        <div className="mt-4">
          <p
            id="chemical-classes-label"
            className="font-mono text-xs tracking-widest text-muted-foreground uppercase"
          >
            Chemical classes
          </p>
          <ul
            aria-labelledby="chemical-classes-label"
            className="mt-2 flex flex-wrap gap-2"
          >
            {classes.map((chemicalClass) => {
              const toggleable = atomsBySlug.has(chemicalClass.slug)
              const pressed = active === chemicalClass.slug
              return (
                <li key={chemicalClass.slug}>
                  {toggleable ? (
                    <button
                      type="button"
                      aria-pressed={pressed}
                      title={
                        pressed
                          ? 'Clear the highlight'
                          : 'Highlight in the structure'
                      }
                      onClick={() =>
                        setActive(pressed ? null : chemicalClass.slug)
                      }
                      className={cn(
                        'inline-flex h-8 items-center gap-2 rounded-lg border px-2.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring',
                        pressed
                          ? 'border-brand bg-brand-subtle text-foreground'
                          : 'border-border bg-background hover:bg-muted dark:border-input dark:bg-input/30 dark:hover:bg-input/50'
                      )}
                    >
                      {/* The tint's own colour, hollow until pressed: the
                          chip and the atoms it lights share one swatch. */}
                      <span
                        aria-hidden="true"
                        className={cn(
                          'size-2 rounded-full border border-brand',
                          pressed && 'bg-brand'
                        )}
                      />
                      {chemicalClass.name}
                    </button>
                  ) : (
                    <span className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-sm">
                      {chemicalClass.name}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
