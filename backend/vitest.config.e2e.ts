import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Dedicated DB + seed; never touch the developer's bpms.db
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./db/bpms.e2e.db',
      LOG_CONSOLE: 'false',
      LOG_FILE_ENABLED: 'false',
      LOG_LEVEL: 'error',
    },
    globalSetup: ['./test/global-setup.e2e.ts'],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
