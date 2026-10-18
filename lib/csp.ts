/**
 * The Content-Security-Policy every HTML page is served with, built per
 * request by proxy.ts.
 *
 * The script policy is the point. Every script the page runs must carry this
 * request's nonce, which Next.js adds to its own scripts and inline RSC
 * payload when it finds the nonce in the request's policy, and app/layout.tsx
 * adds to the theme script. A script that arrives any other way, such as
 * markup injected through a material's structure drawing (lib/structure/svg.ts
 * sanitises that, and this is the backstop if it ever misses something), does
 * not run. `'strict-dynamic'` extends trust to scripts a trusted script adds
 * (Turnstile, RDKit.js, Vercel Analytics), so no host list has to be kept in
 * step; `'self'` and Cloudflare's origin are only for older browsers that
 * ignore `'strict-dynamic'`.
 *
 * A nonce needs a fresh render per request, which every HTML route already
 * has (`next build` lists them all as dynamic).
 *
 * The other directives are the ones next.config.ts sets on every response:
 * no framing, no `<base>`, no plugins.
 */

/** Turnstile's script, for browsers that ignore `'strict-dynamic'`. */
const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com'

/**
 * The one page that may evaluate strings as code. RDKit.js's Emscripten glue
 * builds its function wrappers with `new Function` when it starts, so the
 * substructure search cannot run without `'unsafe-eval'`. It is allowed on
 * that page and nowhere else; a nonce is still needed to run any script at
 * all, so it does not let injected markup execute.
 */
const EVAL_PATHNAMES = new Set(['/structure'])

export function contentSecurityPolicy({
  nonce,
  pathname,
  dev = false,
}: {
  nonce: string
  pathname: string
  /** `next dev` evaluates code to rebuild server error stacks. */
  dev?: boolean
}): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    TURNSTILE_ORIGIN,
  ]
  if (dev || EVAL_PATHNAMES.has(pathname)) scriptSrc.push("'unsafe-eval'")

  return [
    `script-src ${scriptSrc.join(' ')}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ')
}

/** A fresh, unguessable nonce: 128 random bits, base64. */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
}
