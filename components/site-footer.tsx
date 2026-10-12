import Link from 'next/link'

const LICENCE_LINK_CLASSNAME =
  // nowrap: "CC BY-SA 4.0" otherwise breaks at its hyphen on a phone.
  'whitespace-nowrap text-foreground underline decoration-brand-muted underline-offset-4 transition-colors hover:decoration-brand'

export function SiteFooter() {
  return (
    <footer className="site-chrome border-t border-border">
      <div className="mx-auto w-full max-w-page px-gutter py-5 md:px-gutter-lg md:py-6">
        <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
          {/*
            The copyright and the two legal documents share one line rather
            than taking a row of their own: the footer's height and rhythm
            were deliberately tightened, and a third block would undo that.
            `flex-wrap` lets the pair drop under the copyright on a narrow
            screen instead of forcing the rail taller on every screen.
          */}
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span>&copy; 2026 Davis Kim</span>
            <Link href="/privacy" className={LICENCE_LINK_CLASSNAME}>
              Privacy
            </Link>
            <Link href="/terms" className={LICENCE_LINK_CLASSNAME}>
              Terms
            </Link>
          </p>

          {/*
            The data-licence line docs/licensing.md requires on every page.
            CC BY-SA obliges us to link the licence itself, not just name it.
          */}
          <p className="max-w-measure text-balance sm:text-right">
            Material data licensed{' '}
            <a
              href="https://creativecommons.org/licenses/by-sa/4.0/"
              rel="license noopener noreferrer"
              className={LICENCE_LINK_CLASSNAME}
            >
              CC BY-SA 4.0
            </a>{' '}
            &mdash; attribute Perfumers Codex / Davis Kim. Code licensed{' '}
            <a
              href="https://opensource.org/licenses/MIT"
              rel="license noopener noreferrer"
              className={LICENCE_LINK_CLASSNAME}
            >
              MIT
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  )
}
