import type { NextConfig } from 'next'

/**
 * Security headers on every response.
 *
 * Deliberately NOT a script-src CSP. App Router pages carry inline scripts
 * (the RSC payload, the theme script in app/layout.tsx), so a script policy
 * either allows 'unsafe-inline', which stops nothing, or needs a per-request
 * nonce, which forces every page to render dynamically. What ships instead
 * are the directives that cost nothing and break nothing:
 *
 * - frame-ancestors 'none' (and X-Frame-Options for old browsers): no other
 *   site can frame a page, so the account forms cannot be clickjacked.
 * - base-uri 'self', object-src 'none': an injected <base> or <object> is
 *   inert, which narrows what any future markup injection could do.
 * - nosniff, a strict referrer policy, and no camera, microphone or location.
 *
 * HSTS is set here rather than left to the host, so it holds wherever the
 * app is deployed. No includeSubDomains: other subdomains (mail, auth DNS
 * records) are not this app's to commit to HTTPS.
 */
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
]

const nextConfig: NextConfig = {
  // Don't advertise the framework on every response.
  poweredByHeader: false,
  turbopack: {
    // This repo is checked out as a git worktree nested inside the main
    // checkout, and Turbopack infers the project root from the outermost
    // package-lock.json — which would pull in the parent checkout's files.
    // Pin the root so a worktree builds itself and nothing above it.
    root: __dirname,
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
