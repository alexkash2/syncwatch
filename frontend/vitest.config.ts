import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Kept separate from vite.config.ts so the dev-server config isn't hit when
// running tests (different plugin set, no Tailwind scanning, etc.).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: false,
  },
});
