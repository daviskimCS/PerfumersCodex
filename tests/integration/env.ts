/**
 * The integration suite's environment, read once and checked hard.
 *
 * The one rule that matters: this suite creates and deletes accounts, so it
 * must never be pointed at the production project. Every URL is required to
 * be a loopback address, and the suite refuses to start otherwise. There is
 * no flag to override that.
 */

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `${name} is not set. Start a local stack with \`supabase start\` and export its values (tests/integration/README.md).`
    )
  }
  return value
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

function assertLoopback(name: string, url: string): void {
  const host = new URL(url).hostname
  if (!LOOPBACK.has(host)) {
    throw new Error(
      `${name} points at ${host}. The integration suite creates and deletes accounts and only runs against a local Supabase stack.`
    )
  }
}

export function integrationEnv() {
  const supabaseUrl = required('NEXT_PUBLIC_SUPABASE_URL')
  const databaseUrl = required('TEST_DATABASE_URL')
  assertLoopback('NEXT_PUBLIC_SUPABASE_URL', supabaseUrl)
  assertLoopback('TEST_DATABASE_URL', databaseUrl)

  return {
    supabaseUrl,
    publishableKey: required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    secretKey: required('SUPABASE_SECRET_KEY'),
    databaseUrl,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  }
}
