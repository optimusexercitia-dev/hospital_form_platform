import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * PDF·P1 mint SMOKE runner (plan §2.7 / lead B7 brief) — DELIBERATELY outside
 * the default suite: it needs the local Supabase stack AND a running Gotenberg
 * sidecar (docs/deployment/pdf-renderer.md), so it must never gate `npm test`.
 *
 *   npx vitest run --config vitest.smoke.config.ts
 *
 * Env comes from .env.local (loadEnvFile below): supabase keys +
 * PDF_RENDERER_URL + PDF_VERIFICATION_BASE_URL.
 */
process.loadEnvFile('.env.local')

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['scripts/smoke/**/*.smoke.ts'],
    testTimeout: 90_000,
    hookTimeout: 90_000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(
        new URL('./test/stubs/server-only.ts', import.meta.url),
      ),
    },
  },
})
