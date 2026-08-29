import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    // The CI firestore-rules job installs only rules-tests deps (no root
    // node_modules), so vite/esbuild walking up to the repo-root tsconfig.json
    // (which extends "expo/tsconfig.base") crashes with TSConfckParseError
    // before any test runs. Pinning tsconfigRaw disables that walk-up.
    tsconfigRaw: '{}',
  },
  test: {
    include: ['**/*.test.ts'],
    testTimeout: 30_000,
  },
});
