import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The GUI test harness uses Vitest with the same React plugin as the build,
// running in jsdom so components render against a DOM. It deliberately does
// NOT proxy /api — the API layer (src/api.ts) is mocked per test instead, so
// the suite never needs a live gui-server. Mock the api module, never call
// through to fetch.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    css: false,
  },
});
