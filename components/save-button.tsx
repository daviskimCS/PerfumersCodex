'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Bookmark, BookmarkCheck } from 'lucide-react'

import { saveMaterialAction, unsaveMaterialAction } from '@/app/saved/actions'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * The save control on a material page (W5-B / P3-A).
 *
 * A client component because a bookmark should feel like a switch, not a page
 * load — but it knows nothing on its own. **Both facts it renders from arrive
 * as server-passed props**: whether there is a session, and whether this
 * material is already on the shelf, both derived on the server where
 * `getUser()` and RLS are. There is no Supabase client in this file and no
 * fetch on mount; a reader with scripting off still gets a correct, static
 * picture of their own shelf.
 *
 * Signed out, this is a link to sign in — not a disabled button. A control
 * that looks operable and does nothing is worse than one that says where to
 * go, and a link works before hydration.
 */

export interface SaveButtonProps {
  materialId: string
  /** Server-derived: `getUser()` found a session. Never a client guess. */
  signedIn: boolean
  /** Server-derived starting state; the toggle owns it from mount onward. */
  initialSaved: boolean
}

export function SaveButton({
  materialId,
  signedIn,
  initialSaved,
}: SaveButtonProps) {
  // The two states are separate components so the toggle's hooks only exist
  // where there is something to toggle.
  return signedIn ? (
    <SaveToggle materialId={materialId} initialSaved={initialSaved} />
  ) : (
    <SignInToSave />
  )
}

function SignInToSave() {
  return (
    <Button asChild variant="outline" size="lg">
      <Link href="/login">
        <Bookmark aria-hidden="true" />
        Sign in to save
      </Link>
    </Button>
  )
}

function SaveToggle({
  materialId,
  initialSaved,
}: {
  materialId: string
  initialSaved: boolean
}) {
  const [saved, setSaved] = useState(initialSaved)
  const [failure, setFailure] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  /**
   * Optimistic, with an explicit rollback.
   *
   * The flip lands before the request leaves, so the button never waits on the
   * network and the page is never blocked; if the server disagrees, the state
   * goes back and says why. Deliberately `useState` rather than
   * `useOptimistic`: an optimistic value is discarded when its transition
   * ends, so a *successful* save would flicker back to "Save" for as long as
   * it took new props to arrive. The button owns its own state instead, and
   * the actions' `revalidatePath` keeps every other surface honest.
   */
  function toggle() {
    const next = !saved
    setSaved(next)
    setFailure(null)

    startTransition(async () => {
      const result = next
        ? await saveMaterialAction(materialId)
        : await unsaveMaterialAction(materialId)

      if (!result.ok) {
        setSaved(!next)
        setFailure(result.message)
      }
    })
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        onClick={toggle}
        variant={saved ? 'secondary' : 'outline'}
        size="lg"
        // The pressed state is the accessible truth of a toggle; the label
        // change beside it is the visible one. Not `disabled` while pending —
        // a control that goes dead on click reads as broken, and a second
        // click is harmless: both actions are idempotent server-side.
        aria-pressed={saved}
        aria-busy={pending || undefined}
      >
        {saved ? (
          <BookmarkCheck aria-hidden="true" />
        ) : (
          <Bookmark aria-hidden="true" />
        )}
        {saved ? 'Saved' : 'Save'}
      </Button>

      {failure === null ? null : (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
    </div>
  )
}

/**
 * The button's skeleton, kept in this file so it cannot drift from the button.
 *
 * Used twice: as the Suspense fallback while the material page resolves the
 * session, and in that route's `loading.tsx`. `Button size="lg"` is `h-9` and
 * `rounded-lg`; the width sits between "Save" and "Sign in to save" so neither
 * outcome shifts the hero much (D4's no-jump rule).
 */
export function SaveButtonSkeleton() {
  return <Skeleton className="h-9 w-32 rounded-lg" />
}
