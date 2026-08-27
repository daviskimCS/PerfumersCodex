import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node only: no jsdom, no component-render tests, no E2E in v1.
    // Focused unit tests on core logic (search ranking, synonym resolution,
    // data normalization, citation handling). See docs/architecture.md D5.
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', '.next'],
    // CI stays green before the first test lands (runbook Week 1 step 8).
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
