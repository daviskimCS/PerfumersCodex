import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node only: no jsdom, no component-render tests, no E2E in v1.
    // See docs/architecture.md D5 and the testing philosophy in AGENTS.md.
    environment: 'node',
    // CI stays green before the first test lands (runbook Week 1 step 8).
    passWithNoTests: true,
    include: ['**/*.test.ts'],
    exclude: ['node_modules', '.next'],
  },
});
