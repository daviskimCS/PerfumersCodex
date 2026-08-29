import Link from 'next/link'
import { Search } from 'lucide-react'

import { ThemeToggle } from '@/components/theme-toggle'
import { Input } from '@/components/ui/input'

export function SiteHeader() {
  // `bg-chrome` is opaque on purpose. This bar sits above the textured canvas
  // and has to cover whatever scrolls beneath it — a translucent or absent
  // background lets content ghost through the wordmark.
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-chrome text-chrome-foreground">
      {/* First tab stop on every page: jump past the chrome to the content. */}
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-3 focus-visible:left-gutter focus-visible:z-50 focus-visible:rounded-lg focus-visible:border focus-visible:border-border-strong focus-visible:bg-surface-raised focus-visible:px-3 focus-visible:py-2 focus-visible:text-sm focus-visible:shadow-md md:focus-visible:left-gutter-lg"
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
          Search slot — reserves the position and size the real search bar will
          occupy. The feature itself is P2-F (debounced instant search, Cmd-K
          focus, arrow-key results), which is gated on the P2-E query layer.

          Deliberately inert: a disabled input, not a live-looking box that
          quietly swallows keystrokes. Disabled also keeps it out of the tab
          order, so the placeholder never sits between the wordmark and the
          theme toggle for keyboard users.
        */}
        <div className="ml-auto hidden min-w-0 flex-1 sm:block sm:max-w-72">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              disabled
              placeholder="Search"
              aria-label="Search — not yet available"
              className="h-9 pl-8"
            />
          </div>
        </div>

        <div className="ml-auto flex items-center sm:ml-0">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
