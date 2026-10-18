'use client'

import { Suspense, useActionState, type ReactNode } from 'react'
import { Roboto } from 'next/font/google'
import { useSearchParams } from 'next/navigation'

import { signInWithGoogle } from '@/app/(auth)/actions'
import { Separator } from '@/components/ui/separator'
import { initialAuthFormState } from '@/lib/validation/auth'

// Downloaded at build time and served from this site like every other font,
// so no reader's browser asks Google for it. Only the auth pages load it.
const roboto = Roboto({ weight: '500', subsets: ['latin'], display: 'swap' })

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
 * **Google's own button, not ours.** Readers recognise the standard "Continue
 * with Google" button and trust it; a restyled one reads like a phishing
 * page. So this one follows Google's branding guidelines rather than the
 * site's tokens: the unaltered four-colour "G", Roboto Medium 14/20, the
 * white (light) or #131314 (dark) fill with Google's grey outline, 40px tall,
 * 12px padding. Those exact values are Google's, which is why they are
 * literals here and nowhere else. It is the one brand mark on the site,
 * allowed beside the structure diagrams because Google requires it.
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
export function GoogleAuth({
  notice,
}: {
  /**
   * Legal small print shown directly above the button, where it is in view
   * at the moment of the click. `/login` passes the terms notice here: its
   * Google button creates an account for an address it has not seen, so it
   * needs the notice as much as `/signup` does.
   */
  notice?: ReactNode
} = {}) {
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
      {notice}

      <Suspense fallback={<GoogleForm next={null} notice={null} />}>
        <GoogleFormFromUrl />
      </Suspense>
    </div>
  )
}

/**
 * The same button on `/account`, for a Google-only account confirming it is
 * the owner before deleting itself (`deleteAccount` asks for a recent
 * sign-in). It is an ordinary Google sign-in that comes back to `next`.
 */
export function GoogleReauth({ next }: { next: string }) {
  return <GoogleForm next={next} notice={null} />
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

      <button
        type="submit"
        // Disabled only while the request is in flight: a second submit would
        // start a second PKCE flow and abandon the first one's verifier.
        disabled={pending}
        className={`${roboto.className} flex h-10 w-full items-center justify-center gap-3 rounded-[4px] border border-[#747775] bg-white px-3 text-sm leading-5 tracking-[0.25px] text-[#1F1F1F] transition-colors outline-none hover:bg-[#EEEEEE] focus-visible:ring-3 focus-visible:ring-ring disabled:cursor-default disabled:opacity-60 dark:border-[#8E918F] dark:bg-[#131314] dark:text-[#E3E3E3] dark:hover:bg-[#262627]`}
      >
        <GoogleG />
        <span>
          {pending ? 'Taking you to Google…' : 'Continue with Google'}
        </span>
      </button>
    </form>
  )
}

/** Google's "G", exactly as its brand kit draws it: never recoloured. */
function GoogleG() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 48 48"
      className="size-5 shrink-0"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}
