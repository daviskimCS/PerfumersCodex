import { Suspense } from 'react'
import Link from 'next/link'
import { Bookmark, UserRound } from 'lucide-react'

import { SearchCommand } from '@/components/search-command'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getCurrentUserId } from '@/lib/db/bookmarks'

/**
 * Whether there is a signed-in caller, verified server-side.
 *
 * `getCurrentUserId` (lib/db/bookmarks.ts) rather than a second auth call of
 * its own: it is `cache()`-deduped per request, so on a material page the
 * header, the save button and the note editor share ONE token verification.
 * Before this the header verified on its own and the page verified again —
 * two auth round trips to draw one "Account" link.
 *
 * Unlike `/account` — which throws a transient auth-service failure to its
 * error boundary — this one degrades instead. The header renders on *every*
 * page, so throwing here would turn a momentary blip at Supabase into a broken
 * site. "Sign in" is the safe fallback: the link leads to `/login`, which is
 * where a signed-out visitor should go and where a signed-in one finds out
 * what is actually wrong.
 */
async function isSignedIn(): Promise<boolean> {
  try {
    return (await getCurrentUserId()) !== null
  } catch {
    return false
  }
}

export function SiteHeader() {
  // `bg-chrome` is opaque on purpose. This bar sits above the textured canvas
  // and has to cover whatever scrolls beneath it — a translucent or absent
  // background lets content ghost through the wordmark.
  return (
    <header className="site-chrome sticky top-0 z-40 border-b border-border">
      {/* First tab stop on every page: jump past the chrome to the content. */}
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-3 focus-visible:left-gutter focus-visible:z-50 focus-visible:rounded-lg focus-visible:border focus-visible:border-border-strong focus-visible:bg-popover focus-visible:text-popover-foreground focus-visible:px-3 focus-visible:py-2 focus-visible:text-sm focus-visible:shadow-md md:focus-visible:left-gutter-lg"
      >
        Skip to content
      </a>

      <div className="mx-auto flex h-14 w-full max-w-page items-center gap-3 px-gutter md:h-16 md:gap-6 md:px-gutter-lg">
        <Link
          href="/"
          className="font-display text-base font-semibold tracking-tight text-foreground md:text-lg"
        >
          Perfumers Codex
        </Link>

        {/*
          Search slot — the position and size P2-C reserved, now holding the
          real thing (P2-F). SearchCommand renders both affordances and hides
          the one that does not belong at the current width: a field-shaped
          trigger from `sm` up, an icon button below it (P2-C's decision was
          that the *field* is hidden on small screens, not that search is).

          The palette itself portals to document.body rather than opening
          inside this element — see the note in components/search-command.tsx
          about `.site-chrome` re-pointing the colour tokens.
        */}
        <div className="ml-auto flex min-w-0 flex-1 justify-end sm:max-w-72">
          <SearchCommand />
        </div>

        <div className="ml-auto flex items-center gap-1 sm:ml-0">
          {/*
            The auth affordance handed off by W3-A. Below `sm` it is the icon
            alone with the label kept for assistive tech — at 375px the rail
            has room for the wordmark, search, this, and the theme toggle only
            if one of them is a glyph.
          */}
          {/*
            Saved shelf — signed-in only, because it is meaningless otherwise
            and a link that always bounces to /login is worse than no link.
            W5-B shipped /saved with no way to reach it; this is that handoff.
            Icon-only below `sm` for the same width reason as the account
            link, with the label kept for assistive tech.
          */}
          {/*
            Its own Suspense boundary, so the rest of the chrome — and the
            page below it — never waits on the auth check. Everything else in
            this header is static; this slot was the one `await` that held the
            whole HTML stream back until Supabase had answered, on every page,
            for every signed-in reader. The fallback is sized like the control
            it stands in for, so nothing jumps when the real links arrive. For
            a signed-out visitor there is no cookie, no round trip and no
            visible fallback at all.
          */}
          {/* A landmark so screen-reader users can jump to the account links
              (Sign in, or Saved and Account) from the rotor. */}
          <nav aria-label="Account" className="flex items-center gap-1">
            <Suspense fallback={<AuthLinksSkeleton />}>
              <AuthLinks />
            </Suspense>
          </nav>

          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

async function AuthLinks() {
  const signedIn = await isSignedIn()

  return (
    <>
      {signedIn ? (
        <Button asChild variant="ghost" size="sm">
          <Link href="/saved">
            <Bookmark aria-hidden="true" className="sm:hidden" />
            <span className="max-sm:sr-only">Saved</span>
          </Link>
        </Button>
      ) : null}

      <Button asChild variant="ghost" size="sm">
        <Link href={signedIn ? '/account' : '/login'}>
          <UserRound aria-hidden="true" className="sm:hidden" />
          <span className="max-sm:sr-only">
            {signedIn ? 'Account' : 'Sign in'}
          </span>
        </Link>
      </Button>
    </>
  )
}

/** The footprint of the "Sign in" control: an icon button below `sm`, a short label above it. */
function AuthLinksSkeleton() {
  return <Skeleton aria-hidden="true" className="h-7 w-8 rounded-lg sm:w-16" />
}
