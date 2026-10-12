import path from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * Integration suite: the auth and account code run for real against a local
 * Supabase stack (`supabase start`), never against production. Kept out of
 * `npm test` so the unit suite stays database-free and instant; CI runs it as
 * its own job. How to run it locally: tests/integration/README.md.
 *
 * Files run one at a time: they share one database and one auth server, and
 * the auth server's per-IP rate limits are easier to reason about serially.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.integration.test.ts'],
    setupFiles: ['tests/integration/setup.ts'],
    globalSetup: ['tests/integration/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // The actions log every refused sign-in server-side, as they should in
    // production. In a suite that refuses sign-ins on purpose that is noise.
    onConsoleLog: (log) => !/^\[(auth|account)\]/.test(log),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
