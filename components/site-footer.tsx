const LICENCE_LINK_CLASSNAME =
  'text-foreground underline decoration-brand-muted underline-offset-4 transition-colors hover:decoration-brand'

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-chrome text-chrome-foreground">
      <div className="mx-auto w-full max-w-page px-gutter py-5 md:px-gutter-lg md:py-6">
        <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
          <p>&copy; 2026 Davis Kim</p>

          {/*
            The data-licence line docs/licensing.md requires on every page.
            CC BY-SA obliges us to link the licence itself, not just name it.
          */}
          <p className="max-w-measure text-balance">
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
