import path from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Node only: no jsdom, no component-render tests, no E2E in v1.
    // Focused unit tests on core logic (search ranking, synonym resolution,
    // data normalization, citation handling). See docs/architecture.md D5.
    environment: 'node',
    include: ['**/*.test.ts'],
    // Setting exclude replaces Vitest's defaults, so spread them back in
    // (nested node_modules, .git, dist, caches). The rest are this project's
    // build output, and .claude/, which holds agent worktrees — each a full
    // checkout whose tests would otherwise run twice.
    exclude: [
      ...configDefaults.exclude,
      '**/.next/**',
      '.claude/**',
      '.vercel/**',
      'coverage/**',
      'out/**',
      'build/**',
    ],
    // CI stays green before the first test lands (runbook Week 1 step 8).
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
