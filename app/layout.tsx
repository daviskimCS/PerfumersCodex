import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { Analytics } from '@vercel/analytics/next'

import './globals.css'

import { env } from '@/lib/env'

// JetBrains Mono, self-hosted from assets/fonts/jetbrains-mono (OFL-1.1; the
// licence sits beside the files). Chosen over Geist Mono because it carries
// Greek natively — α-ionone, β-caryophyllene, γ-undecalactone are everyday
// names here, and Geist Mono has none of those letters (docs/maker-todo.md,
// item 5). Self-hosted so the share cards (app/opengraph-image.tsx) can set
// the same family from the same release, with no request-time font fetch.
//
// One variable file covers 100–800, so the 400 / 500 / 600 the UI uses are
// real instances. The declared range is load-bearing, not documentation:
// app/globals.css sets `font-synthesis-weight: none` on <body>, so a face the
// browser believed to be 400-only could not be faked bolder and every
// `font-medium` and heading would render at 400.
const jetbrainsMono = localFont({
  src: '../assets/fonts/jetbrains-mono/JetBrainsMono[wght].ttf',
  weight: '100 800',
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

const SITE_NAME = 'Perfumers Codex'
const SITE_DESCRIPTION =
  'A curated, citation-driven aromachemical reference for working perfumers.'

// The canonical origin. Read from the environment rather than hard-coded so a
// preview deployment advertises itself and not production; localhost keeps
// `new URL()` from throwing when the variable is absent (local dev, CI).
const SITE_URL = env.NEXT_PUBLIC_SITE_URL

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: 'Davis Kim' }],
  creator: 'Davis Kim',
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: '/',
    locale: 'en_US',
    // `images` is deliberately absent HERE and set by file convention instead:
    // app/opengraph-image.tsx is the site-wide card, and
    // app/materials/[slug]/opengraph-image.tsx overrides it per material.
    // Declaring a URL in this object as well would pin every page to the
    // generic card and silently defeat the per-material one (W7-A).
  },
  twitter: {
    // `summary_large_image`, not `summary`: the cards are 1200x630, and
    // `summary` makes X crop them to a small square thumbnail — most of the
    // design thrown away at exactly the moment it is meant to work. Next
    // mirrors the openGraph image into twitter:image automatically, so there
    // is nothing further to declare (W7-A).
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
}

// Runs synchronously during HTML parsing, so the stored theme is on <html>
// before the browser's first paint — no flash of the wrong mode. This is the
// approach Next documents for the problem (app/guides/preventing-flash-before-
// hydration): a raw inline <script> in <head>, plus suppressHydrationWarning on
// the element it mutates. `next/script` is not a substitute — even
// `beforeInteractive` is tied to React's lifecycle, and this has to land before
// React is involved at all.
//
// Two things get written, and components/theme-toggle.tsx writes the same two:
//   class="dark"         drives the palette (globals.css keys off `.dark`)
//   data-theme-pref=…    the *stored choice* — lets the toggle show which of
//                        light/dark/system is active with no JS and no flash.
const themeScript = `(function(){try{var p=localStorage.getItem("theme");if(p!=="light"&&p!=="dark")p="system";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;e.dataset.themePref=p;e.classList.toggle("dark",d)}catch(_){}})()`

// No `antialiased` class here on purpose. It forces grayscale font smoothing,
// which thins every stem and makes small text look sharp and under-inked.
// Smoothing is set in app/globals.css, and the class has to stay off this
// markup for that to hold: `antialiased` is a utility, and the utilities layer
// outranks @layer base.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // suppressHydrationWarning because themeScript mutates this element's
    // `class` and `data-theme-pref` before React hydrates. It is scoped to
    // <html> alone and does not extend to descendants.
    <html
      lang="en"
      data-theme-pref="system"
      className={`${jetbrainsMono.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        {/*
          tabIndex={-1} is what makes the skip link work. Without it the link
          only sets location.hash: Chrome then moves the TAB START into main,
          which half-works, but focus itself never moves — Safari does not
          follow at all and no screen-reader virtual cursor goes with it.
          -1 keeps it out of the tab order while making it programmatically
          focusable, which is exactly the case this attribute exists for.
        */}
        <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col">
          {children}
        </main>
        <SiteFooter />
        {/*
          Vercel Web Analytics — cookieless, stores no IP addresses, and needs
          no consent banner, which is why it can sit in the root layout
          unconditionally. It self-disables outside Vercel, so local dev and
          CI builds send nothing. Mention it in the privacy policy (Week 18)
          alongside the search_queries log.
        */}
        <Analytics />
      </body>
    </html>
  )
}
