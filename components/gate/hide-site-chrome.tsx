/**
 * Hides the site header (and anything else portalled into `<body>`) on the two
 * pre-launch gate pages.
 *
 * WHY THIS EXISTS. The gate works by REWRITING to `/coming-soon`, so the
 * pre-launch page renders inside `app/layout.tsx` like every other route — and
 * that layout's header carries a search field, a "Sign in" link and, for a
 * signed-in visitor, a "Saved" link. On a page whose entire purpose is to show
 * the public nothing, that header advertises the route structure the gate is
 * meant to keep quiet. App Router has exactly one root layout per app and it
 * cannot be opted out of by a child route, so a page that must not show the
 * chrome has to hide it.
 *
 * WHY IT HIDES EVERY DIRECT CHILD OF `<body>` RATHER THAN NAMING THE HEADER.
 * `components/search-command.tsx` binds Cmd-K to `window` and portals its panel
 * to `document.body`. Hiding `header.site-chrome` alone would leave that
 * listener live: Cmd-K on the construction page would open a working search
 * palette sitting outside the hidden header. Matching on "not the main content,
 * not the footer" catches the portal too, and does not depend on a class name
 * in a file this feature does not own.
 *
 * The footer is deliberately KEPT. docs/licensing.md requires the CC BY-SA
 * attribution line on every page of the live site, and the footer holds no
 * internal links — it says who owns the work and under what licence, which is
 * true of the construction page as much as of any other.
 *
 * The skip link goes with the header, which is correct: WCAG's bypass-blocks
 * requirement applies to repeated blocks of content, and on this page there is
 * nothing to bypass.
 *
 * A PLAIN `<style>`, deliberately — NOT React 19's hoisted form (`href` +
 * `precedence`). Hoisted styles are permanent: React lifts them into `<head>`
 * and leaves them there for the life of the document, because a stylesheet
 * that flickers out during a client-side navigation would be worse than one
 * that lingers. That is exactly wrong here. Unlocking redirects from
 * `/unlock` to `/`, which is a CLIENT-SIDE navigation — with the hoisted form
 * the rule survived it and the real homepage rendered with no header at all
 * until a hard reload. Measured, not theorised. A plain style element belongs
 * to this page's tree and is removed when the page unmounts.
 *
 * It sits mid-document rather than in `<head>`, which cannot cause a flash of
 * the header: the layout's stylesheet `<link>` is render-blocking, so the
 * whole body is parsed long before anything is painted.
 *
 * TEMPORARY, like the gate. When the site launches and the gate is deleted,
 * this goes with it.
 */
export function HideSiteChrome() {
  return (
    <style>
      {
        // Two of Next's own elements are exempt. `nextjs-portal` is the
        // development error overlay — hiding it would make a crash on this
        // page look like a blank screen. `next-route-announcer` is the
        // visually-hidden live region that reads the new page title after a
        // client-side navigation, which is how a screen-reader user learns
        // that submitting the unlock form went somewhere.
        'body > :not(#main-content):not(footer):not(nextjs-portal):not(next-route-announcer){display:none}'
      }
    </style>
  )
}
