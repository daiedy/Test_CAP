import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.test.{js,mjs}'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    coverage: { provider: 'v8', include: ['srv/**/*.js'], reportsDirectory: 'coverage' },
  },
});
