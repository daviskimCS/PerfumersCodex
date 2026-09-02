'use client'

import { Suspense, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'

import { signInWithGoogle } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { initialAuthFormState } from '@/lib/validation/auth'

/**
 * "Continue with Google" — the third-party half of both auth pages (W7-A).
 *
 * One component, mounted identically on `/login` and `/signup`, because with
 * Google there is only one flow: the button signs you in if Supabase already
 * knows this Google account and creates the account if it does not. Shipping
 * a "Sign in with Google" and a separate "Sign up with Google" would be two
 * labels for one request. The line under the button says so outright rather
 * than leaving the reader to discover it.
 *
 * **Dormant on arrival.** The Google provider is not enabled on the Supabase
 * project yet (Google Cloud Console credentials + the dashboard toggle are
 * the maker's, per `docs/maker-todo.md`), so today this button ends at the
 * "isn't available right now" notice below rather than at Google. That is the
 * W3-A precedent: `app/auth/confirm/route.ts` shipped before the email
 * template pointed at it. Nothing here changes when the provider is turned
 * on.
 *
 * No brand glyph. AGENTS.md limits imagery to structure diagrams, and a
 * four-colour Google "G" is exactly the kind of mark that reads wrong on one
 * of the two grounds this site has to look right on. The word "Google" is the
 * affordance.
 */

/**
 * The failure notices `app/auth/callback/route.ts` can hand back on
 * `/login?error=…`. That route imports this type (type-only, so this client
 * module contributes nothing to its bundle) and can therefore only emit a
 * code that has copy on this side — the two halves cannot drift apart
 * silently.
 */
export type GoogleAuthNoticeCode =
  'google_cancelled' | 'google_unavailable' | 'google_expired' | 'google_failed'

const NOTICES: Record<GoogleAuthNoticeCode, string> = {
  google_cancelled:
    'Google sign-in was cancelled. Nothing was created and nothing changed.',
  google_unavailable:
    'Google sign-in isn’t available right now. Use your email and password below.',
  google_expired:
    'That Google sign-in took too long, or it was started in a different browser. Start again from this page.',
  google_failed:
    'We couldn’t finish signing you in with Google. Try again, or use your email and password below.',
}

function noticeFor(code: string | null): string | null {
  return code !== null && code in NOTICES
    ? NOTICES[code as GoogleAuthNoticeCode]
    : null
}

/**
 * The whole block: labelled divider, any returning failure notice, the
 * button, and the honest one-liner. Mounted as a single element on both
 * pages so the two can never drift.
 */
export function GoogleAuth() {
  return (
    <div className="mt-6 flex flex-col gap-6">
      {/* Decorative rules either side of a real word: the "or" is text in
          the reading order, so it needs no ARIA of its own. */}
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      {/*
        `useSearchParams` suspends during prerender, so the fallback is the
        SAME form with nothing read from the URL — a real, submittable button
        from the first paint, not a skeleton and not a disabled stand-in. The
        only thing lost by clicking before hydration is the `next` redirect,
        which falls back to /account. A dead button here would be worse than
        a slightly less specific destination.
      */}
      <Suspense fallback={<GoogleForm next={null} notice={null} />}>
        <GoogleFormFromUrl />
      </Suspense>
    </div>
  )
}

function GoogleFormFromUrl() {
  const searchParams = useSearchParams()
  return (
    <GoogleForm
      next={searchParams.get('next')}
      notice={noticeFor(searchParams.get('error'))}
    />
  )
}

function GoogleForm({
  next,
  notice,
}: {
  /** Raw `?next=` from the URL. The server action re-validates it (D6). */
  next: string | null
  /** Plain-language explanation of a round trip that came back unfinished. */
  notice: string | null
}) {
  const [state, formAction, pending] = useActionState(
    signInWithGoogle,
    initialAuthFormState
  )

  // A notice from the URL describes the trip the reader just came back from;
  // `state.formError` describes the one they just started. The second is the
  // newer fact, so it wins.
  const message = state.formError ?? notice

  return (
    <form
      action={formAction}
      aria-busy={pending}
      className="flex flex-col gap-3"
    >
      {next === null ? null : <input type="hidden" name="next" value={next} />}

      {message === null ? null : (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {message}
        </div>
      )}

      <Button
        type="submit"
        variant="outline"
        size="lg"
        // Disabled only while the request is in flight: a second submit would
        // start a second PKCE flow and abandon the first one's verifier.
        disabled={pending}
        className="w-full"
      >
        {pending ? 'Taking you to Google…' : 'Continue with Google'}
      </Button>

      <p className="text-sm text-muted-foreground">
        The same button either way — if you haven’t used Google here before, it
        creates your account.
      </p>
    </form>
  )
}
