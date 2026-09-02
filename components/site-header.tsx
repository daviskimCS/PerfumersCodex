import Link from 'next/link'
import { UserRound } from 'lucide-react'

import { SearchCommand } from '@/components/search-command'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'

/**
 * Whether there is a signed-in caller, verified server-side.
 *
 * `getUser()` and never `getSession()` (AGENTS.md): the former validates the
 * token against the Supabase auth server, the latter trusts whatever is in the
 * cookie.
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
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return data.user !== null
  } catch {
    return false
  }
}

export async function SiteHeader() {
  // `bg-chrome` is opaque on purpose. This bar sits above the textured canvas
  // and has to cover whatever scrolls beneath it — a translucent or absent
  // background lets content ghost through the wordmark.
  const signedIn = await isSignedIn()

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
          <Button asChild variant="ghost" size="sm">
            <Link href={signedIn ? '/account' : '/login'}>
              <UserRound aria-hidden="true" className="sm:hidden" />
              <span className="max-sm:sr-only">
                {signedIn ? 'Account' : 'Sign in'}
              </span>
            </Link>
          </Button>

          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
