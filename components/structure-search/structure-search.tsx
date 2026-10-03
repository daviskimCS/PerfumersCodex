'use client'

import {
  useEffect,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CircleAlert, Hexagon, SearchX, Unplug } from 'lucide-react'
import type { RDKitModule } from '@rdkit/rdkit'

import { EmptyState } from '@/components/empty-state'
import {
  MaterialCard,
  MaterialCardGrid,
  MaterialCardSkeleton,
} from '@/components/material-card'
import { loadRDKit } from './rdkit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ChemicalClass, MaterialSummary } from '@/lib/types'

import { matchPattern } from './match'
import type { MatchOutcome } from './match'
import { PresetList } from './preset-list'

/**
 * Arbitrary-SMARTS structure search — the half of the structural axis that
 * cannot be precomputed.
 *
 * Fixed classes ("ester", "macrocyclic ketone") are matched once in the data
 * pipeline and filtered server-side at `/materials?class=…`. A pattern a
 * reader invents at the bench has no rows to filter, so it is matched here, in
 * the browser, against every candidate's SMILES. This is the only page in the
 * app that loads RDKit.js for anything other than drawing one molecule
 * (docs/cheminformatics.md §1).
 *
 * THE URL IS THE STATE. The pattern lives in `?smarts=…` and arrives as a prop
 * from the server component; nothing about the result set is held in component
 * state. Presets are plain `<Link>`s and the box is a real GET form, so every
 * result set has an address that reproduces it exactly — the same contract the
 * browse and search pages keep.
 *
 * PROGRESSIVE ENHANCEMENT, in the order the page acquires it:
 *
 * 1. **Server HTML** — the explanation, the pattern box (a GET form that
 *    round-trips the URL on its own), and the class presets *as links to
 *    `/materials?class=…`*. No JavaScript required; the reader gets the
 *    precomputed half of the feature.
 * 2. **Hydrated, WASM loading** — same page, plus a busy line. Nothing above
 *    the results moves, so the arrival of the matcher shifts no layout.
 * 3. **RDKit ready** — the presets re-point at `?smarts=…`, and matching runs.
 *
 * If step 3 never happens — no WebAssembly, a blocked asset, a dropped
 * connection — the page stays at step 1 rather than becoming a dead end. That
 * is the whole reason the presets carry two hrefs.
 */

/** What the matcher needs from a material: a card's worth of data, plus SMILES. */
export type StructureCandidate = MaterialSummary & { smiles: string }

type Matcher =
  | { status: 'loading' }
  | { status: 'ready'; rdkit: RDKitModule }
  | { status: 'unavailable' }

/** `idle` is the server's render, and the whole of a no-JS reader's page. */
type Engine = { status: 'idle' } | Matcher

/** Mirrors the cap on `/search`; a SMARTS pattern is never near this long. */
const MAX_PATTERN_LENGTH = 200

/* --- hydration probe ------------------------------------------------------
   `idle` has to be distinguishable from `loading`, because the difference is
   the difference between "this is all you get" and "results are coming": with
   scripting off, a busy line and a card skeleton would both be permanent
   lies. A `useEffect` that flips a flag would say the same thing, but sets
   state synchronously in an effect (react-hooks/set-state-in-effect, and the
   cascading render it warns about). `useSyncExternalStore` is the ordained
   way to hold a value that differs between the server render and the client:
   React uses the server snapshot through hydration, then re-renders with the
   client one. The store never changes, so nothing ever notifies.
   ------------------------------------------------------------------------- */
const subscribeToNothing = () => () => {}
const onTheClient = () => true
const onTheServer = () => false

export function StructureSearch({
  candidates,
  classes,
  pattern,
}: {
  candidates: readonly StructureCandidate[]
  classes: readonly ChemicalClass[]
  /** Raw `?smarts=` value, exactly as typed. */
  pattern: string
}) {
  const router = useRouter()
  const [matcher, setMatcher] = useState<Matcher>({ status: 'loading' })
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    onTheClient,
    onTheServer
  )
  const engine: Engine = hydrated ? matcher : { status: 'idle' }

  const fieldId = useId()
  const hintId = useId()
  const messageId = useId()
  const headingId = useId()

  // After mount, never during render (AGENTS.md: RDKit is never in the
  // critical path). `loadRDKit` memoises at module scope, so a client-side
  // navigation back to this page reuses the instantiated module and only a
  // full reload pays for the WASM again.
  useEffect(() => {
    let cancelled = false

    loadRDKit().then(
      (rdkit) => {
        if (!cancelled) setMatcher({ status: 'ready', rdkit })
      },
      () => {
        // Deliberately swallowed. Everything a reader can do about this is
        // already on the page: the presets are still links to the precomputed
        // classes.
        if (!cancelled) setMatcher({ status: 'unavailable' })
      }
    )

    return () => {
      cancelled = true
    }
  }, [])

  const query = pattern.trim()

  /**
   * GUARD 1 — an empty or whitespace-only pattern never reaches RDKit.
   *
   * `get_qmol('')` is *valid*, so without this the page would be asking
   * "which materials contain nothing" and rendering whatever came back as an
   * answer. There is no honest answer, so there is no filtering: the presets
   * and the hint stand in for a result set.
   *
   * The rest is ~50 substructure matches over an already-compiled query —
   * microseconds. No worker, no debounce: the work only happens on navigation,
   * and neither would earn its complexity here.
   */
  // Keyed off `matcher`, not the derived `engine`: `engine` is a fresh object
  // every render, and `matcher` only reaches `ready` from the effect below —
  // which is to say, after hydration. The two conditions are the same one.
  const outcome = useMemo(
    () =>
      matcher.status === 'ready' && query !== ''
        ? matchPattern(matcher.rdkit, query, candidates)
        : null,
    [matcher, query, candidates]
  )

  const matches =
    outcome?.status === 'matched'
      ? candidates.filter((candidate) => outcome.ids.has(candidate.id))
      : []

  const invalid = outcome?.status === 'invalid'

  return (
    <>
      {/*
        A real GET form, so the URL round-trips with scripting off exactly as
        it does on `/search`. `onSubmit` upgrades that to a client-side
        navigation when JS is available — same destination, but the router
        keeps the page mounted, and with it the instantiated WASM module.
      */}
      <form
        action="/structure"
        method="get"
        role="search"
        className="mt-8 max-w-measure"
        onSubmit={(event) => {
          event.preventDefault()
          const entered = new FormData(event.currentTarget).get('smarts')
          const next = typeof entered === 'string' ? entered.trim() : ''
          // `push`, not `replace`: the presets are ordinary links that push,
          // and Back should walk a reader's refinements in the order they
          // made them rather than skipping to whatever preceded the page.
          router.push(
            next === ''
              ? '/structure'
              : `/structure?smarts=${encodeURIComponent(next)}`
          )
        }}
      >
        <Label htmlFor={fieldId}>SMARTS pattern</Label>

        <div className="mt-2 flex items-center gap-2">
          <Input
            // Remounts when the URL changes so a preset's pattern actually
            // appears in the box: `defaultValue` alone is read once.
            key={pattern}
            id={fieldId}
            name="smarts"
            defaultValue={pattern}
            maxLength={MAX_PATTERN_LENGTH}
            placeholder="e.g. [CX3](=O)[OX2H0][#6]"
            aria-invalid={invalid || undefined}
            aria-describedby={`${hintId} ${messageId}`}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="h-9 font-mono"
          />
          <Button type="submit" variant="outline" size="lg">
            Match
          </Button>
        </div>
      </form>

      <p
        id={hintId}
        className="mt-2 max-w-measure text-sm text-muted-foreground"
      >
        SMARTS is the pattern language RDKit reads — roughly SMILES with
        wildcards. Nothing is sent anywhere: the matching runs in this browser.
      </p>

      {/*
        GUARD 2 — an unreadable pattern says so here, beside the box that
        produced it, and nowhere else. Never an error boundary: a mistyped
        bracket is not a broken page. The field keeps what was typed (it is in
        the URL), so the fix is an edit rather than a retype.

        Always in the DOM and height-reserved, so what gets announced is the
        change of text rather than the appearance of a region — the pattern
        `components/note-editor.tsx` established.
      */}
      <p
        id={messageId}
        role="status"
        aria-live="polite"
        className="mt-2 flex min-h-5 items-center gap-1.5 text-sm text-destructive"
      >
        {invalid ? (
          <>
            <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
            That isn’t a valid SMARTS pattern. Check the brackets and ring
            closures, or start from one of the presets below.
          </>
        ) : null}
      </p>

      <section aria-labelledby={`${headingId}-presets`} className="mt-8">
        <h2
          id={`${headingId}-presets`}
          className="text-2xs tracking-wide text-muted-foreground uppercase"
        >
          Presets
        </h2>

        <PresetList
          classes={classes}
          // GUARD 4, first half: until RDKit is actually ready — including
          // forever, if it fails — every preset is a link to the precomputed
          // class filter, which needs neither WASM nor JavaScript.
          mode={engine.status === 'ready' ? 'smarts' : 'class'}
          activePattern={query}
        />

        <p className="mt-3 max-w-measure text-sm text-muted-foreground">
          Matching runs over the {candidates.length}{' '}
          {candidates.length === 1 ? 'material' : 'materials'} with a recorded
          structure. Naturals and other mixtures carry no single structure, so
          they are never matched.
        </p>

        {/*
          GUARD 5 — with scripting off this is the only thing that changes, and
          it says plainly why the box above cannot answer. Everything it points
          at is already on the page.
        */}
        <noscript>
          <p className="mt-3 max-w-measure text-sm text-muted-foreground">
            Matching a typed pattern needs JavaScript, because it runs here in
            the browser. The presets above do not: each one is a class already
            matched on the server, and filters the browse page directly.
          </p>
        </noscript>
      </section>

      <section
        aria-labelledby={`${headingId}-results`}
        aria-busy={engine.status === 'loading' || undefined}
        className="mt-8"
      >
        <h2 id={`${headingId}-results`} className="sr-only">
          Matching materials
        </h2>

        {/* The count, announced politely when it changes. Stable in the DOM
            and height-reserved for the same reason as the message above. */}
        <p
          role="status"
          aria-live="polite"
          className="min-h-5 text-sm text-muted-foreground"
        >
          {statusLine(engine, outcome, matches.length)}
        </p>

        <ResultsBody
          engine={engine}
          query={query}
          outcome={outcome}
          matches={matches}
        />
      </section>
    </>
  )
}

/**
 * One line of status for the results region, or nothing.
 *
 * Empty for every state another part of the page already explains — an invalid
 * pattern (the message beside the box), an unavailable matcher and an empty
 * pattern (the empty states below). That keeps the live region to one job:
 * saying how many materials matched.
 */
function statusLine(
  engine: Engine,
  outcome: PendingOutcome,
  count: number
): string {
  if (engine.status === 'loading') return 'Loading the structure matcher…'
  if (outcome?.status !== 'matched') return ''
  return count === 1
    ? '1 material contains this fragment'
    : `${count} materials contain this fragment`
}

/** `null` while there is nothing to match — no matcher yet, or no pattern. */
type PendingOutcome = MatchOutcome | null

function ResultsBody({
  engine,
  query,
  outcome,
  matches,
}: {
  engine: Engine
  query: string
  outcome: PendingOutcome
  matches: readonly StructureCandidate[]
}): ReactNode {
  // GUARD 4, second half. The matcher is gone for this reader; the page is
  // not. Everything precomputed still works, and the empty state says where.
  if (engine.status === 'unavailable') {
    return (
      <EmptyState
        className="mt-6"
        icon={Unplug}
        title="The structure matcher didn’t load"
        description="Matching a typed pattern needs RDKit, which runs in your browser and could not be loaded here. The presets above are matched on the server instead, and still work."
        action={
          <Button asChild variant="outline" size="lg">
            <Link href="/materials">Browse all materials</Link>
          </Button>
        }
      />
    )
  }

  // Results really are coming: reserve the shape they will take rather than
  // letting the grid appear under the reader's cursor.
  if (engine.status === 'loading' && query !== '') {
    return (
      <MaterialCardGrid className="mt-4">
        {Array.from({ length: 3 }, (_, card) => (
          <li key={card}>
            <MaterialCardSkeleton />
          </li>
        ))}
      </MaterialCardGrid>
    )
  }

  // Pre-mount, and the whole of the no-JS render. The explanation, the
  // presets and the noscript note above are the page in this state; anything
  // here would be a promise that a reader without JavaScript never sees kept.
  if (engine.status !== 'ready') return null

  // GUARD 1, rendered: no pattern, so no filtering and no claim about one.
  if (query === '') {
    return (
      <EmptyState
        className="mt-6"
        icon={Hexagon}
        title="Nothing matched yet"
        description="Pick a preset above to load its pattern, then edit it — or write a SMARTS fragment of your own. Materials appear here as soon as a pattern is entered."
        action={
          <Button asChild variant="outline" size="lg">
            <Link href="/materials">Browse all materials</Link>
          </Button>
        }
      />
    )
  }

  // GUARD 2, rendered: the message beside the box has already said it. A
  // second copy here would be noise, and an empty grid would be a lie.
  if (outcome === null || outcome.status === 'invalid') return null

  if (matches.length === 0) {
    return (
      <EmptyState
        className="mt-6"
        icon={SearchX}
        title="No material contains this fragment"
        description="The pattern is valid — nothing published with a recorded structure matches it. A broader fragment, or one of the presets above, is the usual next step."
      />
    )
  }

  return (
    <MaterialCardGrid className="mt-4">
      {matches.map((material) => (
        <li key={material.id}>
          <MaterialCard material={material} />
        </li>
      ))}
    </MaterialCardGrid>
  )
}
