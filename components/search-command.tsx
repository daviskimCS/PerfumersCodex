'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { Clock, CornerDownLeft, Search, X } from 'lucide-react'

import type { SearchResponse } from '@/app/api/search/route'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  clearRecentSearches,
  readRecentSearches,
  rememberSearch,
} from '@/lib/search/recent'
import type { SearchResult } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * The search palette (W4-B / P2-F) — the live replacement for the inert search
 * slot P2-C reserved in the header.
 *
 * PUBLIC OPEN CONTRACT: dispatching `new CustomEvent('open-search')` on
 * `window` opens and focuses this palette from anywhere — Wave 5's homepage
 * uses that instead of reaching into this component.
 *
 * Why a dialog rather than a dropdown under the header field: the panel is
 * PORTALED TO `document.body` on purpose. The header carries `.site-chrome`,
 * which re-points `--foreground`, `--muted-foreground`, `--border`, `--brand`,
 * `--accent`… to the rail's inverted palette (app/globals.css). A results panel
 * rendered inside that subtree would inherit cream-on-cream text in light mode.
 * Outside the header every token means what the rest of the page means by it,
 * while the header trigger — which *is* chrome — keeps using the rail's values.
 * (`--popover` is the one pair the rails deliberately leave alone, which is why
 * the skip link can float above the rail; a whole panel needs more than a pair.)
 *
 * On state shape: what a request produced is stored, and everything the UI
 * shows is *derived* from whether that stored answer belongs to the query
 * currently in the box. No effect writes state synchronously — that is both
 * what `react-hooks/set-state-in-effect` requires and what makes a stale
 * response structurally unable to be displayed.
 */

/** Debounce window. "~150ms" per the checklist item — long enough to skip the
 *  keystrokes of a fast typist, short enough that search still feels instant. */
const DEBOUNCE_MS = 150

/** @see the PUBLIC OPEN CONTRACT above — `window.dispatchEvent(new CustomEvent('open-search'))` opens the palette. */
const OPEN_SEARCH_EVENT = 'open-search'

/** Stable identity, so "no results" never looks like a new array to React. */
const NO_RESULTS: SearchResult[] = []

/** What one completed request produced, tagged with the query that produced it. */
interface SearchAnswer {
  query: string
  results: SearchResult[]
}

/* ---------------------------------------------------------------------------
   Which modifier key to advertise. Read through useSyncExternalStore rather
   than an effect: the platform is an external, never-changing fact, and the
   server snapshot (null) renders no hint at all instead of guessing wrong.
   --------------------------------------------------------------------------- */

let applePlatform: boolean | null = null

function subscribeToNothing(): () => void {
  return () => {}
}

function getPlatformSnapshot(): boolean {
  applePlatform ??= /mac|iphone|ipad|ipod/i.test(navigator.userAgent)
  return applePlatform
}

function getPlatformServerSnapshot(): boolean | null {
  return null
}

export function SearchCommand() {
  const router = useRouter()
  const listboxId = React.useId()
  const optionId = React.useCallback(
    (index: number) => `${listboxId}-option-${index}`,
    [listboxId]
  )

  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [answer, setAnswer] = React.useState<SearchAnswer | null>(null)
  /** The query a request failed on, so one failure cannot become a retry loop. */
  const [failedQuery, setFailedQuery] = React.useState<string | null>(null)
  const [recent, setRecent] = React.useState<string[]>([])
  /** -1 = nothing highlighted, which is what makes Enter mean "see all results". */
  const [activeIndex, setActiveIndex] = React.useState(-1)

  const isApplePlatform = React.useSyncExternalStore(
    subscribeToNothing,
    getPlatformSnapshot,
    getPlatformServerSnapshot
  )

  const inputRef = React.useRef<HTMLInputElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const fieldTriggerRef = React.useRef<HTMLButtonElement>(null)
  const iconTriggerRef = React.useRef<HTMLButtonElement>(null)
  const previouslyFocusedRef = React.useRef<HTMLElement | null>(null)
  /**
   * Monotonic request counter. The effect below already aborts the in-flight
   * request on every keystroke, but an abort issued in the same tick a response
   * resolves cannot un-queue the `setState` that response is about to make — so
   * the sequence number is the second, independent guarantee that a slow early
   * response never overwrites a fast later one.
   */
  const requestSeq = React.useRef(0)

  /* --- everything the panel renders, derived from the query in the box --- */
  const trimmedQuery = query.trim()
  const answered = answer !== null && answer.query === trimmedQuery
  const results = answered ? answer.results : NO_RESULTS
  const failed = trimmedQuery !== '' && failedQuery === trimmedQuery
  const searching = trimmedQuery !== '' && !answered && !failed
  const showingRecent = trimmedQuery === '' && recent.length > 0
  const optionCount = showingRecent ? recent.length : results.length
  /** Clamped at read time: the option list changes out from under the index. */
  const activeOption = activeIndex < optionCount ? activeIndex : -1

  const openPalette = React.useCallback(() => {
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    setRecent(readRecentSearches())
    setQuery('')
    setAnswer(null)
    setFailedQuery(null)
    setActiveIndex(-1)
    setOpen(true)
  }, [])

  const closePalette = React.useCallback(() => {
    setOpen(false)

    // Send focus back where it came from — a keyboard user who closes the
    // palette should not be dumped at the top of the document. If the palette
    // was opened by the shortcut from no particular control, fall back to
    // whichever trigger is actually on screen at this breakpoint.
    const previous = previouslyFocusedRef.current
    previouslyFocusedRef.current = null
    const visibleTrigger = [
      fieldTriggerRef.current,
      iconTriggerRef.current,
    ].find((element) => element !== null && element.offsetParent !== null)
    const target =
      previous !== null && previous !== document.body
        ? previous
        : visibleTrigger
    target?.focus()
  }, [])

  const focusInput = React.useCallback(() => {
    const input = inputRef.current
    input?.focus()
    input?.select()
  }, [])

  /** Cmd/Ctrl-K from anywhere on the page. */
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k') return
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return

      event.preventDefault()
      if (open) focusInput()
      else openPalette()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, openPalette, focusInput])

  /** The documented `open-search` CustomEvent — the contract other code uses. */
  React.useEffect(() => {
    const onOpenSearch = () => {
      if (open) focusInput()
      else openPalette()
    }

    window.addEventListener(OPEN_SEARCH_EVENT, onOpenSearch)
    return () => window.removeEventListener(OPEN_SEARCH_EVENT, onOpenSearch)
  }, [open, openPalette, focusInput])

  /** Focus the field as soon as the panel exists. */
  React.useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
  }, [open])

  /** A click outside the panel closes it; the triggers manage themselves. */
  React.useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (panelRef.current?.contains(target)) return
      if (fieldTriggerRef.current?.contains(target)) return
      if (iconTriggerRef.current?.contains(target)) return
      closePalette()
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open, closePalette])

  /* ------------------------------------------------------------------------
     The debounced, abortable fetch.

     One effect owns the whole request lifecycle, so React's own cleanup is
     what cancels stale work: any change to the query tears down the pending
     timer AND aborts the in-flight request before the next one starts. The
     effect body itself only schedules — it never sets state.
     ------------------------------------------------------------------------ */
  React.useEffect(() => {
    if (!open) return
    // Nothing to ask (empty box), already answered, or already failed on this
    // exact string — in all three cases the render is already correct.
    if (trimmedQuery === '' || answered || failed) return

    const controller = new AbortController()
    const { signal } = controller
    const sequence = ++requestSeq.current

    const timer = window.setTimeout(() => {
      const run = async () => {
        try {
          const response = await fetch(
            `/api/search?q=${encodeURIComponent(trimmedQuery)}`,
            { signal, headers: { accept: 'application/json' } }
          )
          if (!response.ok) {
            throw new Error(`Search request failed: ${response.status}`)
          }

          const payload = (await response.json()) as SearchResponse
          if (signal.aborted || sequence !== requestSeq.current) return

          setAnswer({ query: trimmedQuery, results: payload.results })
          setActiveIndex(-1)
        } catch {
          if (signal.aborted || sequence !== requestSeq.current) return
          // Never blank: the panel says the search failed rather than
          // pretending the corpus has nothing (AGENTS.md — no
          // catch-and-render-blank).
          setFailedQuery(trimmedQuery)
          setActiveIndex(-1)
        }
      }

      void run()
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [open, trimmedQuery, answered, failed])

  /** Keep the highlighted option in view when arrowing through a long list. */
  React.useEffect(() => {
    if (activeOption < 0) return
    document
      .getElementById(optionId(activeOption))
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeOption, optionId])

  const goToMaterial = React.useCallback(
    (result: SearchResult) => {
      setRecent(rememberSearch(trimmedQuery))
      closePalette()
      router.push(`/materials/${result.slug}`)
    },
    [closePalette, router, trimmedQuery]
  )

  const goToResultsPage = React.useCallback(
    (searchQuery: string) => {
      const target = searchQuery.trim()
      if (target === '') return
      setRecent(rememberSearch(target))
      closePalette()
      router.push(`/search?q=${encodeURIComponent(target)}`)
    },
    [closePalette, router]
  )

  const chooseRecent = (entry: string) => {
    setQuery(entry)
    setActiveIndex(-1)
  }

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (optionCount === 0) return
      event.preventDefault()

      const step = event.key === 'ArrowDown' ? 1 : -1
      // From "nothing highlighted", Down lands on the first option and Up on
      // the last; after that the list wraps.
      const next =
        activeOption < 0
          ? step === 1
            ? 0
            : optionCount - 1
          : (activeOption + step + optionCount) % optionCount
      setActiveIndex(next)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()

      if (showingRecent) {
        if (activeOption >= 0) chooseRecent(recent[activeOption])
        return
      }

      const highlighted = activeOption >= 0 ? results[activeOption] : undefined
      if (highlighted !== undefined) {
        goToMaterial(highlighted)
        return
      }

      // Nothing highlighted: Enter means "show me everything you have".
      goToResultsPage(query)
    }
  }

  const onPanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closePalette()
      return
    }

    // Keep Tab inside the dialog. Not a focus-management library — just enough
    // that a keyboard user cannot tab out into a page they cannot see.
    if (event.key !== 'Tab') return

    const panel = panelRef.current
    if (panel === null) return

    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => element.offsetParent !== null)
    if (focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement

    if (event.shiftKey && active === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const shortcutHint =
    isApplePlatform === null ? null : isApplePlatform ? '⌘K' : 'Ctrl K'

  // Announced, not displayed — the visible list already says this to anyone who
  // can see it. (EmptyState's own note: the live region belongs on the
  // container that swaps, which is this panel.)
  const announcement = failed
    ? 'Search is unavailable right now.'
    : answered
      ? results.length === 0
        ? `No results for ${trimmedQuery}`
        : `${results.length} ${results.length === 1 ? 'result' : 'results'} for ${trimmedQuery}`
      : ''

  return (
    <>
      {/* Below sm the field is hidden (P2-C's decision), so the affordance is
          an icon button; it opens the same palette, full-screen at that width. */}
      <Button
        ref={iconTriggerRef}
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Search"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? closePalette() : openPalette())}
        className="sm:hidden"
      >
        <Search aria-hidden="true" />
      </Button>

      {/* sm and up: a control shaped like the field it replaces. Hand-rolled
          rather than <Button variant="outline"> because that variant paints
          `bg-background` — the page's cream — which would sit as a light box on
          the brown rail. The classes below mirror components/ui/input.tsx so
          the slot still reads as the search field it stands in for. */}
      <button
        ref={fieldTriggerRef}
        type="button"
        aria-label="Search"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? closePalette() : openPalette())}
        className="hidden h-9 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-base text-muted-foreground transition-colors outline-none hover:border-border-strong focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex md:text-sm"
      >
        <Search aria-hidden="true" className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">Search</span>
        {shortcutHint === null ? null : (
          <kbd
            aria-hidden="true"
            className="hidden shrink-0 rounded-sm border border-border-strong px-1 text-2xs md:inline-block"
          >
            {shortcutHint}
          </kbd>
        )}
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-50 flex flex-col sm:items-center sm:px-gutter sm:py-[10vh]">
              {/* Scrim. Decorative only — closing on an outside click is handled
                  by a document listener, so this carries no handler and no role.
                  Two tokens, one per mode, because a scrim has to DARKEN: the
                  warm ink does that on the cream page, but in dark mode
                  `--foreground` is near-white and would wash the page lighter
                  instead, so dark mode dims with its own near-black background. */}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-foreground/30 dark:bg-background/80"
              />

              <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Search materials"
                onKeyDown={onPanelKeyDown}
                className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-popover text-popover-foreground shadow-lg sm:max-w-2xl sm:flex-none sm:rounded-xl sm:border sm:border-border"
              >
                <div className="flex items-center gap-2 border-b border-border p-3">
                  <div className="relative min-w-0 flex-1">
                    <Search
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      ref={inputRef}
                      type="search"
                      role="combobox"
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value)
                        setActiveIndex(-1)
                      }}
                      onKeyDown={onInputKeyDown}
                      placeholder="Search materials"
                      aria-label="Search materials"
                      // Only while a listbox actually exists. The panel
                      // renders plain prose for "searching…", "no matches" and
                      // the opening hint, so an unconditional `aria-controls`
                      // would point at an id that is not in the document —
                      // an invalid reference, and one screen readers may
                      // follow into nothing. `aria-expanded="false"` alone is
                      // a complete description of a closed popup.
                      aria-controls={optionCount > 0 ? listboxId : undefined}
                      aria-expanded={optionCount > 0}
                      aria-autocomplete="list"
                      aria-activedescendant={
                        activeOption >= 0 ? optionId(activeOption) : undefined
                      }
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      className="h-10 pl-8"
                    />
                  </div>

                  {/* Full-screen at this width, so it needs a way out besides
                      the Escape key. */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Close search"
                    onClick={closePalette}
                    className="sm:hidden"
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>

                <div role="status" aria-live="polite" className="sr-only">
                  {announcement}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 sm:max-h-[min(24rem,50vh)]">
                  {failed ? (
                    <div className="px-3 py-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        Search isn&apos;t responding right now. This is usually
                        temporary.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => setFailedQuery(null)}
                      >
                        Try again
                      </Button>
                    </div>
                  ) : showingRecent ? (
                    <>
                      <div className="flex items-center justify-between gap-2 px-3 pt-1 pb-2">
                        <span
                          id={`${listboxId}-recent-label`}
                          className="text-2xs tracking-wide text-muted-foreground uppercase"
                        >
                          Recent searches
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => {
                            setRecent(clearRecentSearches())
                            setActiveIndex(-1)
                            inputRef.current?.focus()
                          }}
                        >
                          Clear
                        </Button>
                      </div>
                      <div
                        role="listbox"
                        id={listboxId}
                        aria-labelledby={`${listboxId}-recent-label`}
                      >
                        {recent.map((entry, index) => (
                          <button
                            key={entry}
                            id={optionId(index)}
                            type="button"
                            role="option"
                            aria-selected={index === activeOption}
                            tabIndex={-1}
                            onMouseMove={() => setActiveIndex(index)}
                            onClick={() => chooseRecent(entry)}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm',
                              index === activeOption &&
                                'bg-accent text-accent-foreground'
                            )}
                          >
                            <Clock
                              aria-hidden="true"
                              className="size-3.5 shrink-0 text-muted-foreground"
                            />
                            <span className="min-w-0 flex-1 truncate">
                              {entry}
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : trimmedQuery === '' ? (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      Search by name, trade name, or CAS number.
                    </p>
                  ) : searching ? (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      Searching…
                    </p>
                  ) : results.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      No matches for{' '}
                      <span className="text-foreground">{trimmedQuery}</span>.
                      Press Enter for spelling tips and browse links.
                    </p>
                  ) : (
                    <div
                      role="listbox"
                      id={listboxId}
                      aria-label="Search results"
                    >
                      {results.map((result, index) => (
                        <Link
                          key={result.id}
                          id={optionId(index)}
                          role="option"
                          aria-selected={index === activeOption}
                          tabIndex={-1}
                          href={`/materials/${result.slug}`}
                          onMouseMove={() => setActiveIndex(index)}
                          onClick={(event) => {
                            // Let the browser handle open-in-new-tab; only a
                            // plain click means "I am done with the palette".
                            if (
                              event.metaKey ||
                              event.ctrlKey ||
                              event.shiftKey ||
                              event.altKey
                            ) {
                              return
                            }
                            setRecent(rememberSearch(trimmedQuery))
                            closePalette()
                          }}
                          className={cn(
                            'flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-lg px-3 py-2 text-sm',
                            index === activeOption &&
                              'bg-accent text-accent-foreground'
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {result.canonicalName}
                          </span>
                          <ResultMeta result={result} />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border px-3 py-2 text-2xs text-muted-foreground">
                  {trimmedQuery === '' ? (
                    <span>Search the whole reference.</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => goToResultsPage(query)}
                      className="inline-flex items-center gap-1.5 rounded-sm underline underline-offset-4 outline-none hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <CornerDownLeft aria-hidden="true" className="size-3" />
                      See all results for “{trimmedQuery}”
                    </button>
                  )}
                  <span className="hidden sm:inline">
                    ↑↓ choose · ↵ open · esc close
                  </span>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}

/**
 * The rank-aware half of a result row, and the only place tiers are read.
 *
 * No tier number ever reaches the reader — a tier is an explanation, not a fact
 * about the material. What it earns is the *reason* the row is here: a synonym
 * hit says which synonym matched, and a CAS hit shows the number it matched, in
 * the mono face reserved for inherently monospaced data.
 */
function ResultMeta({ result }: { result: SearchResult }) {
  // The ranker's contract: matchedSynonym is non-null only on a tier-2 hit.
  if (result.matchedSynonym !== null) {
    return (
      <span className="shrink-0 text-xs text-muted-foreground">
        matched: {result.matchedSynonym}
      </span>
    )
  }

  if (result.matchTier === 0 && result.casNumber !== null) {
    return (
      <span className="shrink-0 font-mono text-xs text-muted-foreground">
        {result.casNumber}
      </span>
    )
  }

  return null
}
