import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  // Serial runs keep the 1 MiB render-timing gate free of CPU contention.
  workers: 1,
  use: {
    headless: true,
  },
});
