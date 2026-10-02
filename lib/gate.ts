import { env } from '@/lib/env'

/**
 * The pre-launch gate — signing, verification, and the allowlist predicate.
 *
 * The site is live but pre-launch: the public should see one construction
 * page and nothing else until the corpus is real. `proxy.ts` asks this module
 * three questions on every request — is the gate on, is this path exempt, and
 * does this cookie prove the password was entered — and rewrites to the
 * pre-launch page when the answers say so.
 *
 * SERVER ONLY, and it must stay that way: it reads the password through
 * `lib/env.ts`, which throws if it is ever imported into client code. Nothing
 * under `components/` may import this file — the unlock form talks to
 * `lib/validation/gate.ts` and to a server action, never to this.
 *
 * WEB CRYPTO, not `node:crypto`. Next 16 runs Proxy on the Node.js runtime by
 * default (node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/proxy.md, "Runtime"), but the same docs describe Proxy
 * as deployable to a CDN edge, and `runtime` is not configurable there, so the
 * code has to be portable. `crypto.subtle` and `btoa`/`atob` are globals in
 * both runtimes; `timingSafeEqual` exists in neither's shared subset.
 *
 * ON THE THREAT MODEL. This is a construction fence, not authentication. It
 * keeps an unfinished reference out of search results and out of the hands of
 * someone who typed the domain early. It is one shared password, entered
 * through a form with NO RATE LIMITING (Week 18, Upstash — see the note in
 * app/unlock/actions.ts), so it is brute-forceable by anyone willing to script
 * it. Choose a long password. Nothing behind the gate is treated as secret by
 * anything else in the system: user data is still protected by Supabase Auth
 * and RLS, and would be with the gate wide open.
 */

/** Where gated requests are rewritten to. Shared so proxy and page agree. */
export const PRELAUNCH_PATH = '/coming-soon'

/** The one route that has to stay reachable while the gate is closed. */
export const UNLOCK_PATH = '/unlock'

export const GATE_COOKIE_NAME = 'pc_gate'

/** 30 days. Long enough that the maker enters the password once a month. */
export const GATE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

/**
 * A cookie issued by a server whose clock runs slightly ahead of the one
 * verifying it is not a forgery. Five minutes of slack, and no more: the
 * window is a free extension of every token's life.
 */
const CLOCK_SKEW_MS = 5 * 60 * 1000

/** Bumping this invalidates every outstanding cookie. */
const TOKEN_VERSION = 'v1'

const encoder = new TextEncoder()

/**
 * Cookie attributes, exported so the proxy and the unlock action cannot drift
 * apart on them.
 *
 * `httpOnly` — no script needs to read this, and one that can read it can
 *   exfiltrate it.
 * `secure` — the token is a bearer credential; it never travels in clear text.
 *   NOTE FOR LOCAL TESTING: Chrome and Firefox accept `Secure` cookies on
 *   http://localhost (a secure context by definition), Safari historically
 *   does not. Test the gate locally in Chrome, or over https.
 * `sameSite: 'lax'` — the gate has to survive following a link into the site
 *   from elsewhere, which `strict` would break; there is no state-changing
 *   GET here for `lax` to expose.
 * `path: '/'` — it gates the whole site.
 */
export const gateCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
  maxAge: GATE_MAX_AGE_SECONDS,
} as const

/**
 * Is the gate switched on?
 *
 * UNSET MEANS OFF, deliberately (see lib/env.ts): local dev, CI and
 * `next build` must work with no new configuration, and a variable that goes
 * missing in a hosting dashboard must never lock the maker out of their own
 * site. The failure mode of this design is an accidentally-public site, which
 * is recoverable in seconds; the failure mode of the opposite design is an
 * unreachable one.
 */
export function isGateEnabled(): boolean {
  return env.SITE_GATE_PASSWORD !== undefined
}

/**
 * Paths that stay reachable with the gate closed.
 *
 * Deliberately minimal. `/_next/*` and the top-level static files are what the
 * pre-launch page itself is made of — gate those and the page renders unstyled
 * — and the site-wide share card is what the domain should preview as. The
 * unlock route obviously has to be reachable, or there would be no way in.
 *
 * EVERYTHING ELSE IS GATED, and `/materials/<slug>/opengraph-image` is the
 * case worth naming: it is a metadata route like `/opengraph-image`, but its
 * card is drawn from a material's own name, so exempting the pattern rather
 * than the exact path would publish the corpus one share card at a time. The
 * allowlist is exact-match on purpose.
 *
 * `/api/keep-alive` is the one route exempted for a machine: Vercel Cron cannot
 * enter a password. It returns no data, and the route itself refuses every
 * request that does not carry CRON_SECRET (lib/cron.ts), so the exemption
 * reveals nothing the gate exists to hide.
 */
const ALLOWLISTED_PATHNAMES = new Set([
  UNLOCK_PATH,
  '/api/keep-alive',
  '/icon.svg',
  '/apple-icon',
  '/opengraph-image',
  '/favicon.ico',
])

/**
 * A top-level file: one segment, with an extension. Everything Next serves out
 * of `public/` looks like this, and no route in this app does — slugs never
 * carry a dot, and every real page is either `/` or nested.
 */
const TOP_LEVEL_FILE = /^\/[^/]+\.[A-Za-z0-9]+$/

export function isGateAllowlisted(pathname: string): boolean {
  // Trailing-slash normalization happens in the router, and it is not worth
  // depending on whether it has already run when Proxy sees the URL.
  const path =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname

  if (ALLOWLISTED_PATHNAMES.has(path)) return true
  // Build output: chunks, the font files, the image optimizer.
  if (path.startsWith('/_next/')) return true
  return TOP_LEVEL_FILE.test(path)
}

/* -------------------------------------------------------------------------
   Signing
   ------------------------------------------------------------------------- */

/**
 * The HMAC key.
 *
 * SITE_GATE_SECRET when it is set; otherwise the password itself, which is the
 * documented fallback — a gate with one variable configured must still work,
 * and inventing a hard-coded default "secret" would be worse than no secret at
 * all, because it would be in the public repository.
 *
 * The password is folded into the key material either way, which buys one
 * useful property: rotating the password invalidates every outstanding cookie,
 * so changing it actually locks people out rather than only affecting the next
 * person to visit the unlock form.
 */
async function signingKey(): Promise<CryptoKey> {
  const password = env.SITE_GATE_PASSWORD
  if (password === undefined) {
    // Unreachable through the exported functions, all of which check
    // isGateEnabled() first. Loud rather than silently signing with "".
    throw new Error('lib/gate.ts: no SITE_GATE_PASSWORD — the gate is off.')
  }

  // Length-prefixed rather than concatenated: without it, a (secret,
  // password) pair of ("ab", "c") and one of ("a", "bc") would derive the
  // same key. ASCII only — no separator byte that an environment variable
  // could itself contain.
  const secret = env.SITE_GATE_SECRET ?? ''
  const material = `${secret.length}:${secret}${password}`
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(material),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
}

/**
 * Deliberately not memoized. Proxy is documented as code that "should not
 * attempt relying on shared modules or globals" because it may run per-request
 * in an isolate; `importKey` on 32-odd bytes is microseconds, and a cached key
 * would also outlive a password change within a warm process.
 */
async function hmac(message: string): Promise<Uint8Array> {
  const signature = await crypto.subtle.sign(
    'HMAC',
    await signingKey(),
    encoder.encode(message)
  )
  return new Uint8Array(signature)
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeBase64Url(value: string): Uint8Array | null {
  const base64 = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=')
  try {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    return bytes
  } catch {
    // Not base64 at all. A forgery, not an error worth logging per request.
    return null
  }
}

/**
 * Constant-time byte comparison.
 *
 * `===` on strings, and `Array.prototype.every`, both return the moment they
 * find a difference, and how long that took is measurable across a network.
 * This one always walks every byte and accumulates the difference.
 *
 * The length check is not a leak: both callers compare 32-byte SHA-256 digests
 * whose length is fixed and public, so `a.length !== b.length` only ever means
 * "the caller sent something that is not a digest at all".
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let difference = 0
  for (let index = 0; index < a.length; index += 1) {
    difference |= a[index] ^ b[index]
  }
  return difference === 0
}

/**
 * Mint the unlock cookie's value: `v1.<issued-at>.<signature>`.
 *
 * The password is NOT in here, in any form. The cookie carries an issue time
 * and an HMAC over it, so a stolen cookie is worth one session on one site
 * until it expires, and is worth nothing towards guessing the password.
 */
export async function createGateToken(
  now: number = Date.now()
): Promise<string> {
  const issuedAt = String(now)
  const signature = await hmac(`${TOKEN_VERSION}:${issuedAt}`)
  return `${TOKEN_VERSION}.${issuedAt}.${encodeBase64Url(signature)}`
}

/**
 * Does this cookie value prove the password was entered, recently enough?
 *
 * Order matters: the signature is checked BEFORE the issue time is believed.
 * Reading an expiry off an unverified payload and acting on it is how a gate
 * ends up trusting an attacker's own arithmetic.
 *
 * The cookie's own `maxAge` is a request that the browser stop sending it. A
 * curl user is under no such obligation, so the age is re-checked here against
 * a value we signed.
 */
export async function verifyGateToken(
  token: string | undefined,
  now: number = Date.now()
): Promise<boolean> {
  if (token === undefined || !isGateEnabled()) return false

  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [version, issuedAt, signature] = parts
  if (version !== TOKEN_VERSION) return false

  const provided = decodeBase64Url(signature)
  if (provided === null) return false
  // Base64 is malleable: a 32-byte digest ends on a 4-bit boundary, so the
  // final character carries two bits nothing reads, and 4 spellings of every
  // token decode to the same bytes. Harmless — the comparison below is over
  // the decoded digest either way — but a cookie with exactly one valid
  // spelling is easier to reason about, and this rejects the rest. Done on
  // the caller's own input against its own re-encoding, so there is no secret
  // here for the non-constant-time comparison to leak.
  if (encodeBase64Url(provided) !== signature) return false

  const expected = await hmac(`${version}:${issuedAt}`)
  if (!timingSafeEqual(expected, provided)) return false

  const issued = Number(issuedAt)
  if (!Number.isSafeInteger(issued)) return false
  const age = now - issued
  return age >= -CLOCK_SKEW_MS && age <= GATE_MAX_AGE_SECONDS * 1000
}

/**
 * Is this what the maker set as the password?
 *
 * Compared as HMAC digests rather than as strings — the "double HMAC" pattern.
 * Two properties fall out of it, and neither is available from `===`:
 *
 *   1. The comparison is over two 32-byte digests, so it is constant-time in
 *      the real sense — the loop length does not depend on the secret, and a
 *      1-character guess costs exactly what a 60-character guess costs. A
 *      `submitted === password` comparison leaks the length of the password
 *      and, on most engines, the position of the first wrong character.
 *   2. An attacker cannot steer the comparison, because they cannot compute
 *      the digest of their own guess without the key.
 */
export async function isGatePassword(submitted: string): Promise<boolean> {
  const password = env.SITE_GATE_PASSWORD
  if (password === undefined) return false

  const [submittedDigest, expectedDigest] = await Promise.all([
    hmac(`password:${submitted}`),
    hmac(`password:${password}`),
  ])
  return timingSafeEqual(submittedDigest, expectedDigest)
}
