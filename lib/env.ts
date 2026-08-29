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
