import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Perfumers Codex',
  description:
    'A curated, citation-driven aromachemical reference for working perfumers.',
}

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
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
