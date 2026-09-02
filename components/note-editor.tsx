'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { CircleAlert, LockKeyhole } from 'lucide-react'
import { z } from 'zod'

import { saveNoteAction } from '@/app/materials/[slug]/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { NOTE_MAX_LENGTH, noteSchema } from '@/lib/validation/notes'

/**
 * The private note on a material page (W6-A / P3-B).
 *
 * A client component because a note should save itself — but it knows nothing
 * on its own. **Both facts it renders from arrive as server-passed props**:
 * whether there is a session, and the note's current text, both derived on the
 * server where `getUser()` and RLS are. There is no Supabase client in this
 * file and no fetch on mount.
 *
 * Signed out, this renders *nothing at all* — not a disabled box. A private
 * feature that does not apply to you should not advertise itself as a dead
 * control on a public reference page; the save button in the hero is already
 * the one place that says "sign in".
 *
 * ── The three rules the interaction obeys ─────────────────────────────────
 *
 * 1. **Save on blur, not on keystroke.** Every keystroke would be a write per
 *    character — a hundred rows of churn for one sentence, and the first thing
 *    Week 18's rate limiter would have to fight. Blur is also the moment a
 *    person has actually finished a thought.
 * 2. **Optimistic, with a real rollback.** The editor treats the text as saved
 *    the instant it leaves, and puts its record of the saved text back if the
 *    server disagrees — which makes the next blur retry automatically.
 * 3. **A failure never costs the reader a word.** Rollback moves
 *    `savedBody` (this component's record of what the server holds), never
 *    `draft` (what is in the box). The textarea is not cleared, not reverted
 *    and not disabled on failure; the text stays exactly where it was typed and
 *    the reader is told what happened.
 */

/** Where a save has got to. Drives one polite live region, nothing else. */
type NoteStatus =
  | 'idle'
  | 'saving'
  | 'saved'
  | 'cleared'
  | 'failed'
  /** Refused by the shared schema before anything was sent. */
  | 'invalid'

/** Show the counter only once it starts to matter. */
const COUNTER_VISIBLE_FROM = NOTE_MAX_LENGTH - 300

export interface NoteEditorProps {
  materialId: string
  /** Server-derived: `getUser()` found a session. Never a client guess. */
  signedIn: boolean
  /** Server-derived starting text; `''` when there is no note yet. */
  initialBody: string
}

export function NoteEditor({
  materialId,
  signedIn,
  initialBody,
}: NoteEditorProps) {
  // The two states are separate components so the editor's hooks only exist
  // where there is something to edit.
  if (!signedIn) return null
  return <NoteForm materialId={materialId} initialBody={initialBody} />
}

function NoteForm({
  materialId,
  initialBody,
}: {
  materialId: string
  initialBody: string
}) {
  const fieldId = useId()
  const helpId = useId()
  const statusId = useId()

  /** What is in the box. Only the reader ever changes this. */
  const [draft, setDraft] = useState(initialBody)
  /** What the server is believed to hold. Optimistically ahead; rolled back. */
  const [savedBody, setSavedBody] = useState(initialBody)
  const [status, setStatus] = useState<NoteStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  /**
   * Which save is the current one.
   *
   * Blur-refocus-blur can put two saves in flight, and without this a slow
   * *first* request failing would roll back over a fast *second* request that
   * succeeded — the editor would show a stale rollback for text that is safely
   * stored. Only the newest request is allowed to touch state.
   */
  const requestRef = useRef(0)

  const overLimit = draft.length > NOTE_MAX_LENGTH

  function commit(value: string) {
    // The shared schema is the client's validator too (D6): same file, same
    // cap, so the refusal a reader sees here is word for word the refusal the
    // server would have sent — and the server re-parses regardless.
    const parsed = noteSchema.safeParse({ materialId, body: value })
    if (!parsed.success) {
      setStatus('invalid')
      setMessage(
        z.flattenError(parsed.error).fieldErrors.body?.[0] ??
          'That note could not be saved.'
      )
      return
    }

    const normalized = parsed.data.body
    if (normalized === savedBody) {
      // Nothing to send. Clear a stale refusal — the reader has just edited
      // their way back to what is already stored — but leave a "Saved" alone.
      if (status === 'invalid') {
        setStatus('idle')
        setMessage(null)
      }
      return
    }

    const previous = savedBody
    const requestId = requestRef.current + 1
    requestRef.current = requestId

    setSavedBody(normalized)
    setStatus('saving')
    setMessage(null)

    startTransition(async () => {
      // The raw value goes over the wire, not the normalized one: the server
      // trims with the same schema, and sending what was typed keeps this call
      // identical in shape to the forged POST the action has to survive.
      const result = await saveNoteAction(materialId, value)
      if (requestId !== requestRef.current) return

      if (result.ok) {
        setStatus(result.stored ? 'saved' : 'cleared')
        return
      }

      // Rollback touches only the record of what the server holds. `draft` is
      // untouched, so nothing the reader typed is lost, and the next blur (or
      // the retry button) sends it again.
      setSavedBody(previous)
      setStatus('failed')
      setMessage(result.message)
    })
  }

  return (
    <section
      aria-labelledby={`${fieldId}-heading`}
      // Its own bordered block, below the tabs and outside every panel: a
      // private note must never be mistakable for the cited editorial record
      // (AGENTS.md). Solid border, not the dashed one the experimental odor
      // module uses — the two are different kinds of not-editorial.
      className="mt-16 rounded-xl border border-border-strong p-6 md:p-8"
    >
      <div className="flex flex-wrap items-center gap-3">
        <LockKeyhole
          aria-hidden="true"
          strokeWidth={1.5}
          className="size-5 text-muted-foreground"
        />
        <h2 id={`${fieldId}-heading`} className="text-xl">
          Your note
        </h2>
        <Badge variant="outline">Private</Badge>
      </div>

      <p className="mt-4 max-w-measure text-sm text-muted-foreground">
        Only you can see this. It is not part of this material’s cited record,
        it is never published, and it is deleted with your account.
      </p>

      {/* The heading names the region; the label names the control. Hidden
          rather than absent so the textarea has a real accessible name. */}
      <Label htmlFor={fieldId} className="sr-only">
        Your private note on this material
      </Label>

      <textarea
        id={fieldId}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commit(draft)}
        // Deliberately no `maxLength`: it would silently swallow the tail of a
        // long paste. Over-length text is kept, shown, counted and refused with
        // a message instead of being truncated behind the reader's back.
        aria-invalid={overLimit || status === 'invalid' || undefined}
        aria-describedby={`${helpId} ${statusId}`}
        aria-busy={pending || undefined}
        placeholder="Bench notes, substitutions, what it actually smells like to you…"
        // Mirrors the token set in components/ui/input.tsx so the two controls
        // are the same object at different heights. A shadcn `textarea`
        // primitive is the right long-term home for this. `min-h-32` rather
        // than `rows` or `field-sizing-content` so the height is one fixed
        // number the skeleton can reserve exactly; `resize-y` hands the reader
        // the rest.
        className="mt-6 min-h-32 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
      />

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p id={helpId} className="text-sm text-muted-foreground">
          Saves on its own when you click away. Clearing the box deletes the
          note.
        </p>

        {draft.length >= COUNTER_VISIBLE_FROM ? (
          <p
            className={cn(
              'font-mono text-xs',
              overLimit ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            {draft.length} / {NOTE_MAX_LENGTH}
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {/* One polite live region for all four outcomes. Polite, not assertive,
            including for failures: this fires on blur, when focus has already
            moved on, and interrupting the reader there is worse than telling
            them a beat later. Always in the DOM, so a change to its *text* is
            what gets announced rather than the region itself appearing — and
            the retry button stays outside it so its label is not read out as
            part of the message. */}
        <p
          id={statusId}
          role="status"
          aria-live="polite"
          className="flex items-center gap-1.5"
        >
          {status === 'saving' ? (
            <span className="text-muted-foreground">Saving…</span>
          ) : null}
          {status === 'saved' ? (
            <span className="text-muted-foreground">Saved</span>
          ) : null}
          {status === 'cleared' ? (
            <span className="text-muted-foreground">Note cleared</span>
          ) : null}
          {status === 'failed' || status === 'invalid' ? (
            <span className="flex items-center gap-1.5 text-destructive">
              <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
              {message}
            </span>
          ) : null}
        </p>

        {status === 'failed' ? (
          // Only a transport/server failure is retryable. An over-length note
          // needs an edit, not another attempt, so 'invalid' gets no button.
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => commit(draft)}
          >
            Try again
          </Button>
        ) : null}
      </div>
    </section>
  )
}

/**
 * Shown when the reader is signed in but their note could not be read.
 *
 * Not an empty textarea. "You have no note" and "we could not fetch your note"
 * look identical as a blank box, and the blank box would invite the reader to
 * type over a note that still exists — so the editor is withheld entirely and
 * the section says what happened (D4: never catch-and-render-blank). Reloading
 * is the fix, so there is no retry control to build here.
 */
export function NoteEditorUnavailable() {
  return (
    <section
      aria-labelledby="note-unavailable-heading"
      className="mt-16 rounded-xl border border-border-strong p-6 md:p-8"
    >
      <div className="flex flex-wrap items-center gap-3">
        <LockKeyhole
          aria-hidden="true"
          strokeWidth={1.5}
          className="size-5 text-muted-foreground"
        />
        <h2 id="note-unavailable-heading" className="text-xl">
          Your note
        </h2>
        <Badge variant="outline">Private</Badge>
      </div>
      <p className="mt-4 max-w-measure text-sm text-muted-foreground">
        Your private note couldn’t be loaded just now, so it isn’t shown here —
        nothing has been lost. Reload the page to try again.
      </p>
    </section>
  )
}

/**
 * The editor's skeleton, kept in this file so it cannot drift from the editor.
 *
 * Used twice: as the Suspense fallback while the material page resolves the
 * session and the note, and in that route's `loading.tsx`. Heights come off the
 * type scale in globals.css — text-sm is 1.25rem (h-5), text-xl 1.75rem (h-7) —
 * and the box matches the textarea's `min-h-32`.
 *
 * For a signed-out reader this resolves to nothing at all, which is why the
 * page mounts the region **last**: the collapse shifts no content, because
 * there is none below it.
 */
export function NoteEditorSkeleton() {
  return (
    <div className="mt-16 rounded-xl border border-border-strong p-6 md:p-8">
      {/* Heading row (text-xl) */}
      <Skeleton className="h-7 w-32" />
      {/* Framing line (text-sm) */}
      <Skeleton className="mt-4 h-5 w-full max-w-measure" />
      {/* The box itself — `min-h-32` on the textarea, so exactly h-32 */}
      <Skeleton className="mt-6 h-32 w-full rounded-lg" />
      {/* Help line (text-sm) */}
      <Skeleton className="mt-2 h-5 w-72 max-w-full" />
      {/* The save-status row. Reserved, not shimmered: it is empty until a save
          happens, so a Skeleton here would promise content that never arrives —
          but the editor's `min-h-7` holds this space open, and without the same
          gap the swap would shift the footer by a row. */}
      <div className="mt-3 h-7" />
    </div>
  )
}
