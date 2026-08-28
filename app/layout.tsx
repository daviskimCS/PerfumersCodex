import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const SITE_NAME = 'Perfumers Codex'
const SITE_DESCRIPTION =
  'A curated, citation-driven aromachemical reference for working perfumers.'

// The canonical origin. Read from the environment rather than hard-coded so a
// preview deployment advertises itself and not production; localhost keeps
// `new URL()` from throwing when the variable is absent (local dev, CI).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

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
    // No `images` on purpose — the OG artwork does not exist yet. Pointing at
    // a file that isn't there produces a card with a broken image, which is
    // worse than a card with none. Add it when the asset lands.
  },
  twitter: {
    card: 'summary',
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
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <main id="main-content" className="flex flex-1 flex-col">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  )
}
