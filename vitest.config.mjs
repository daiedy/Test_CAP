import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.test.{js,mjs}'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    // Each worker that loads node:sqlite (the CAP tests) printed the same Node ExperimentalWarning
    // into every `npm test` output (ADR-0031 decision 4). The warning has no code, so its type is
    // the narrowest filter Node offers; it applies to the test workers only.
    execArgv: ['--disable-warning=ExperimentalWarning'],
    coverage: { provider: 'v8', include: ['srv/**/*.js'], reportsDirectory: 'coverage' },
  },
});
