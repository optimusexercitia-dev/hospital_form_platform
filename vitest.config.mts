import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Unit/component tests run under jsdom. Playwright E2E specs live in `e2e/`
// and are excluded here so the two runners never collide.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // The real `server-only` package throws when imported from Vitest's
      // client-module context; stub it so server-only helpers can be unit-tested
      // without weakening the runtime guard in app code.
      'server-only': fileURLToPath(
        new URL('./test/stubs/server-only.ts', import.meta.url),
      ),
    },
  },
})
