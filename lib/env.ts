import { z } from 'zod'

/**
 * Validated environment access (docs/architecture.md D6).
 *
 * Every server-side environment read goes through this module — no raw
 * `process.env` elsewhere. A missing or malformed variable fails loudly with
 * the variable's name and what was expected of it, instead of surfacing as
 * `undefined` three layers down at 2 a.m.
 *
 * Validation is PER-VARIABLE and LAZY — each key is parsed on first access,
 * then cached. This is deliberate, not an optimization: CI builds with no
 * env vars at all, and `next build` prerenders the static pages, whose
 * layout only needs NEXT_PUBLIC_SITE_URL (which has a default). Eager
 * whole-object parsing would make the build demand DATABASE_URL it never
 * uses. Lazy per-key parsing keeps "fail loudly at boot" true where it
 * matters — the first code path that actually needs a variable.
 *
 * SERVER ONLY. The browser client (lib/supabase/client.ts) keeps literal
 * `process.env.NEXT_PUBLIC_*` references on purpose: Next.js inlines those
 * at build time by textual substitution, which dynamic access through this
 * module would defeat.
 */

const SITE_URL_FALLBACK = 'http://localhost:3000'

/**
 * An optional server-only secret.
 *
 * Absent, empty, and whitespace-only all mean "not set". A dashboard field
 * cleared to `""` is how a person switches a feature off, and it must never be
 * read as a password of zero length.
 *
 * The value is trimmed, because values pasted into hosting dashboards and
 * `.env` files routinely arrive with a trailing newline — which means a secret
 * cannot begin or end with whitespace. Same normalizing posture as
 * NEXT_PUBLIC_SITE_URL below.
 */
const optionalSecret = () =>
  z.preprocess((raw) => {
    if (typeof raw !== 'string') return undefined
    const trimmed = raw.trim()
    return trimmed === '' ? undefined : trimmed
  }, z.string().optional())

const schemas = {
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url()
    .describe('Supabase project URL (https://<ref>.supabase.co)'),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .startsWith(
      'sb_publishable_',
      'must be a new-style publishable key — legacy anon keys are deprecated'
    ),
  SUPABASE_SECRET_KEY: z
    .string()
    .startsWith(
      'sb_secret_',
      'must be a new-style secret key — legacy service_role keys are deprecated'
    ),
  // Pooled, port 6543, transaction mode — the app runtime (prepare: false).
  DATABASE_URL: z.string().startsWith('postgresql://').includes(':6543', {
    message:
      'DATABASE_URL must be the transaction pooler (port 6543) — the app must not run on the direct connection',
  }),
  // Direct, port 5432 — drizzle-kit migrations only.
  DIRECT_URL: z.string().startsWith('postgresql://'),
  /**
   * Absolute base for canonical URLs and Open Graph tags.
   *
   * This one NEVER throws, deliberately — it is the single exception to the
   * fail-loudly rule above, and it is earned. app/layout.tsx reads it at
   * module scope, so `next build` evaluates it while collecting page data;
   * a strict schema here turns a cosmetic metadata value into a failed
   * deployment. It cost this project five broken builds to learn that.
   *
   * Normalizes what people actually type into hosting dashboards: surrounding
   * quotes, stray whitespace, a bare hostname with no scheme. Anything still
   * unparseable falls back to the default and warns on the server, so the site
   * ships with imperfect canonical URLs instead of not shipping.
   *
   * DATABASE_URL and the keys above keep throwing: a wrong database is a
   * correctness problem, a wrong og:url is a cosmetic one.
   */
  NEXT_PUBLIC_SITE_URL: z
    .preprocess((raw) => {
      if (typeof raw !== 'string') return undefined
      const cleaned = raw
        .trim()
        .replace(/^['"]|['"]$/g, '')
        .trim()
      if (cleaned === '') return undefined
      return /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`
    }, z.url().default(SITE_URL_FALLBACK))
    .catch(({ issues }) => {
      console.warn(
        `[env] NEXT_PUBLIC_SITE_URL is not a usable URL (${issues[0]?.message}); ` +
          `falling back to ${SITE_URL_FALLBACK}. Canonical and Open Graph URLs will be wrong until it is fixed.`
      )
      return SITE_URL_FALLBACK
    }),

  /**
   * PRE-LAUNCH GATE (lib/gate.ts). Both optional, both SERVER-ONLY.
   *
   * Never rename either of these to NEXT_PUBLIC_*. Next inlines those into the
   * client bundle by textual substitution, which would publish the password to
   * exactly the people the gate exists to keep out.
   *
   * SITE_GATE_PASSWORD is the switch as well as the password: UNSET MEANS THE
   * GATE IS OFF. That is deliberate. `next build` and CI run with no
   * environment at all and must keep working, and a variable that goes missing
   * from a hosting dashboard must never lock the maker out of their own site.
   *
   * SITE_GATE_SECRET signs the unlock cookie. When it is unset, lib/gate.ts
   * falls back to using the password as the HMAC key rather than inventing a
   * default — a hard-coded fallback secret in a public repository is not a
   * secret. Set it in production anyway: it is the difference between a gate
   * whose signing key is a memorable phrase and one whose key is random.
   */
  SITE_GATE_PASSWORD: optionalSecret(),
  SITE_GATE_SECRET: optionalSecret(),
} as const

type Schemas = typeof schemas
export type Env = { [K in keyof Schemas]: z.output<Schemas[K]> }

const cache = new Map<string, unknown>()

function read<K extends keyof Schemas>(key: K): Env[K] {
  if (typeof window !== 'undefined') {
    throw new Error(
      `lib/env.ts is server-only — read ${key} via an inlined process.env.NEXT_PUBLIC_* literal in client code`
    )
  }
  if (!cache.has(key)) {
    const parsed = schemas[key].safeParse(process.env[key])
    if (!parsed.success) {
      throw new Error(
        `Invalid environment: ${key} — ${parsed.error.issues
          .map((issue) => issue.message)
          .join('; ')}. See .env.example.`
      )
    }
    cache.set(key, parsed.data)
  }
  return cache.get(key) as Env[K]
}

export const env: Readonly<Env> = new Proxy({} as Env, {
  get: (_target, key) => read(key as keyof Schemas),
})
