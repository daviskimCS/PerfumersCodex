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
   * A bare hostname is accepted and upgraded to https://. Typing
   * "perfumerscodex.com" into a hosting dashboard is the obvious thing to do,
   * and this value is read at module scope by app/layout.tsx — so rejecting it
   * would fail the whole build over a missing scheme, for a value used only to
   * build metadata URLs. Tolerance is worth more than strictness here.
   */
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .trim()
    .transform((value) =>
      value === '' || /^https?:\/\//i.test(value) ? value : `https://${value}`
    )
    .pipe(z.url())
    .default('http://localhost:3000'),
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
