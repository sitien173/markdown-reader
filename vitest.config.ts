import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/e2e/**'],
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
});
